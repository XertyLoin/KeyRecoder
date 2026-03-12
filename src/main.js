const { app, BrowserWindow, Tray, Menu, ipcMain } = require('electron');
const path = require('path');
const http = require('http');
const fs   = require('fs');
const Store = require('electron-store');
const { uIOhook, UiohookKey } = require('uiohook-napi');

const store = new Store();
let tray = null;
let overlayWindow = null;
let editorWindow  = null;
let obsServer     = null;
const OBS_PORT    = 4242;

// ── Default layout ─────────────────────────────────────────────────────────
const defaultSettings = {
  keys: [
    { id: 'key_z',     x: 120, y: 100, keycode: UiohookKey.Z,     label: 'Z' },
    { id: 'key_q',     x: 40,  y: 180, keycode: UiohookKey.Q,     label: 'Q' },
    { id: 'key_s',     x: 120, y: 180, keycode: UiohookKey.S,     label: 'S' },
    { id: 'key_d',     x: 200, y: 180, keycode: UiohookKey.D,     label: 'D' },
    { id: 'key_space', x: 80,  y: 260, keycode: UiohookKey.Space, label: 'SPACE', width: 200 }
  ],
  // Overlay window position on screen
  overlayX: 100,
  overlayY: 100,
};

if (!store.has('settings')) store.set('settings', defaultSettings);

// ── OBS / Browser-source HTTP server ───────────────────────────────────────
function startObsServer() {
  if (obsServer) return;
  obsServer = http.createServer((req, res) => {
    const rendererDir = path.join(__dirname, 'renderer', 'overlay');

    // Serve the overlay page (and its assets)
    let filePath;
    if (req.url === '/' || req.url === '/index.html') {
      filePath = path.join(rendererDir, 'index.html');
    } else if (req.url === '/style.css') {
      filePath = path.join(rendererDir, 'style.css');
    } else if (req.url === '/script.js') {
      filePath = path.join(rendererDir, 'obs-script.js'); // lightweight polling version
    } else {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath);
    const mime = { '.html':'text/html', '.css':'text/css', '.js':'application/javascript' };
    try {
      res.writeHead(200, { 'Content-Type': mime[ext] || 'text/plain' });
      res.end(fs.readFileSync(filePath));
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  });
  obsServer.listen(OBS_PORT);
}

// ── State SSE endpoint so obs-script.js can receive key events ─────────────
let sseClients = [];
function broadcastSse(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients = sseClients.filter(res => !res.destroyed);
  sseClients.forEach(res => res.write(msg));
}

// Create a second server for SSE on port OBS_PORT+1
let sseServer = null;
function startSseServer() {
  if (sseServer) return;
  sseServer = http.createServer((req, res) => {
    if (req.url === '/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
        'Connection': 'keep-alive',
      });
      res.write(':ok\n\n');
      sseClients.push(res);
      req.on('close', () => { sseClients = sseClients.filter(r => r !== res); });
    } else if (req.url === '/settings') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(store.get('settings')));
    } else {
      res.writeHead(404); res.end();
    }
  });
  sseServer.listen(OBS_PORT + 1);
}

// ── Windows ───────────────────────────────────────────────────────────────
function createOverlay() {
  if (overlayWindow) return;
  const { overlayX = 100, overlayY = 100 } = store.get('settings') || {};

  overlayWindow = new BrowserWindow({
    width: 800,
    height: 600,
    x: overlayX,
    y: overlayY,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  overlayWindow.loadFile(path.join(__dirname, 'renderer/overlay/index.html'));

  overlayWindow.on('closed', () => { overlayWindow = null; });
}

function createEditor() {
  if (editorWindow) { editorWindow.focus(); return; }

  editorWindow = new BrowserWindow({
    width: 940,
    height: 720,
    minWidth: 700,
    frame: false,           // We handle our own custom titlebar
    resizable: false,       // Prevent resizing glitch while moving
    transparent: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  editorWindow.loadFile(path.join(__dirname, 'renderer/editor/index.html'));
  editorWindow.on('closed', () => { editorWindow = null; });
}

// ── Tray ──────────────────────────────────────────────────────────────────
function setupTray() {
  const iconPath = path.join(__dirname, '..', 'assets', 'tray_icon.png');
  tray = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Edit Layout',    click: createEditor },
    { label: 'Toggle Overlay', click: () => {
        if (overlayWindow) overlayWindow.close();
        else createOverlay();
    }},
    { type: 'separator' },
    { label: 'Quit KeyRecoder', click: () => { app.isQuiting = true; app.quit(); }}
  ]);

  tray.setToolTip('KeyRecoder');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => createEditor());
}

// ── App Entry ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  setupTray();
  createOverlay();
  startObsServer();
  startSseServer();

  // ── IPC handlers ───────────────────────────────────────────────────────
  ipcMain.handle('get-settings', () => store.get('settings'));

  ipcMain.handle('save-settings', (event, settings) => {
    store.set('settings', settings);
    if (overlayWindow) overlayWindow.webContents.send('settings-updated');
    return true;
  });

  ipcMain.handle('get-obs-url', () => `http://localhost:${OBS_PORT}`);

  ipcMain.on('move-overlay', (event, { x, y }) => {
    // Manually setting coords from input
    const s = store.get('settings') || {};
    s.overlayX = x; s.overlayY = y;
    store.set('settings', s);
    if (overlayWindow) overlayWindow.setPosition(Math.round(x), Math.round(y));
  });

  ipcMain.on('set-overlay-interactive', (event, interactive) => {
    if (overlayWindow) {
      overlayWindow.setIgnoreMouseEvents(!interactive);
      overlayWindow.webContents.send('move-mode-toggle', interactive);
    }
  });

  ipcMain.on('save-overlay-pos', (event, { x, y }) => {
    const s = store.get('settings') || {};
    s.overlayX = x; s.overlayY = y;
    store.set('settings', s);
    if (editorWindow) {
      editorWindow.webContents.send('overlay-moved', { x, y });
    }
  });

  ipcMain.on('toggle-overlay-visibility', (event, visible) => {
    if (overlayWindow) {
      if (visible) overlayWindow.show();
      else overlayWindow.hide();
    }
  });

  ipcMain.on('open-editor', createEditor);
  ipcMain.on('hide-overlay', () => { if (overlayWindow) overlayWindow.close(); });
  ipcMain.on('quit-app', () => app.quit());

  // Window drag & control (Generic for any window)
  ipcMain.handle('get-window-position', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { x: 0, y: 0 };
    const [x, y] = win.getPosition();
    return { x, y };
  });

  ipcMain.on('set-window-position', (event, { x, y }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.setPosition(Math.round(x), Math.round(y));
  });

  ipcMain.on('minimize-window', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.minimize();
  });

  ipcMain.on('close-window', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.close();
  });

  // ── uIOhook ────────────────────────────────────────────────────────────
  uIOhook.on('keydown', (e) => {
    if (overlayWindow) overlayWindow.webContents.send('global-keydown', e.keycode);
    if (editorWindow)  editorWindow.webContents.send('global-keydown', e.keycode);
    broadcastSse('keydown', { keycode: e.keycode });
  });

  uIOhook.on('keyup', (e) => {
    if (overlayWindow) overlayWindow.webContents.send('global-keyup', e.keycode);
    if (editorWindow)  editorWindow.webContents.send('global-keyup', e.keycode);
    broadcastSse('keyup', { keycode: e.keycode });
  });

  uIOhook.start();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createOverlay();
  });
});

app.on('window-all-closed', () => { /* keep running in tray */ });
app.on('will-quit', () => { uIOhook.stop(); });
