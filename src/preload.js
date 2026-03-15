const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Key events (overlay + editor)
  onGlobalKeydown:    (cb) => ipcRenderer.on('global-keydown',    (_, v) => cb(v)),
  onGlobalKeyup:      (cb) => ipcRenderer.on('global-keyup',      (_, v) => cb(v)),
  onSettingsUpdated:  (cb) => ipcRenderer.on('settings-updated',  ()    => cb()),

  // Settings
  getSettings:  ()  => ipcRenderer.invoke('get-settings'),
  saveSettings: (s) => ipcRenderer.invoke('save-settings', s),

  // OBS
  getObsUrl:   () => ipcRenderer.invoke('get-obs-url'),
  importImage: (path) => ipcRenderer.invoke('import-image', path),

  // Overlay control
  moveOverlay:            (x, y) => ipcRenderer.send('move-overlay', { x, y }),
  toggleOverlayVisibility:(v)    => ipcRenderer.send('toggle-overlay-visibility', v),
  setOverlayInteractive:  (i)    => ipcRenderer.send('set-overlay-interactive', i),
  saveOverlayPos:         (x, y) => ipcRenderer.send('save-overlay-pos', { x, y }),
  onMoveModeToggle:       (cb)   => ipcRenderer.on('move-mode-toggle', (_, v) => cb(v)),
  onOverlayMoved:         (cb)   => ipcRenderer.on('overlay-moved', (_, v) => cb(v)),

  // Frameless window control
  minimizeWindow:    () => ipcRenderer.send('minimize-window'),
  closeWindow:       () => ipcRenderer.send('close-window'),
  setWindowPosition: (x, y) => ipcRenderer.send('set-window-position', { x, y }),
  getWindowPosition: () => ipcRenderer.invoke('get-window-position'),

  // Layout Library
  getLayouts:   () => ipcRenderer.invoke('get-layouts'),
  saveLayout:   (l) => ipcRenderer.invoke('save-layout', l),
  deleteLayout: (id) => ipcRenderer.invoke('delete-layout', id),

  // General
  getFilePath: (file) => webUtils.getPathForFile(file),
  openEditor:  () => ipcRenderer.send('open-editor'),
  hideOverlay: () => ipcRenderer.send('hide-overlay'),
  quitApp:     () => ipcRenderer.send('quit-app'),
});
