const container = document.getElementById('overlay-container');
let keyElements = {};
let isMoveMode = false;
let isDragging = false;
let startX, startY, winX, winY;

window.electronAPI.onMoveModeToggle((interactive) => {
    isMoveMode = interactive;
    document.body.classList.toggle('move-mode', interactive);
    if (!interactive) {
        // Final position save
        window.electronAPI.saveOverlayPos(window.screenX, window.screenY);
    }
});

// Manual window drag logic
document.addEventListener('mousedown', async (e) => {
    if (!isMoveMode) return;
    isDragging = true;
    startX = e.screenX;
    startY = e.screenY;
    const pos = await window.electronAPI.getWindowPosition();
    winX = pos.x;
    winY = pos.y;
});

document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.screenX - startX;
    const dy = e.screenY - startY;
    window.electronAPI.setWindowPosition(winX + dx, winY + dy);
});

document.addEventListener('mouseup', () => {
    if (isDragging) {
        isDragging = false;
        // Turn off interactive mode once released
        window.electronAPI.setOverlayInteractive(false);
    }
});

// ── Audio Engine ──────────────────────────────────────────────────────────────
const ctx = new (window.AudioContext || window.webkitAudioContext)();

function playKeyPress() {
    if (ctx.state === 'suspended') ctx.resume();

    // Short, satisfying mechanical click
    const bufferSize = ctx.sampleRate * 0.04;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 4);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3500;
    filter.Q.value = 0.8;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
}

function playKeyRelease() {
    if (ctx.state === 'suspended') ctx.resume();
    const bufferSize = ctx.sampleRate * 0.025;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 6) * 0.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2000;
    filter.Q.value = 1.2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.07, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.025);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
}

// ── Rendering ────────────────────────────────────────────────────────────────
function renderKeys() {
    container.innerHTML = '';
    keyElements = {};

    keysConfig.forEach(keyConf => {
        const el = document.createElement('div');
        el.className = 'key-element';
        el.id = keyConf.id;

        if (keyConf.image) {
            el.style.backgroundImage = `url('${CSS.escape ? keyConf.image : keyConf.image}')`;
            el.style.backgroundSize = 'cover';
            el.style.backgroundPosition = 'center';
        } else {
            el.innerText = keyConf.label || '?';
        }

        el.style.left = `${keyConf.x}px`;
        el.style.top = `${keyConf.y}px`;
        if (keyConf.width) el.style.width = `${keyConf.width}px`;
        if (keyConf.height) el.style.height = `${keyConf.height}px`;

        container.appendChild(el);

        // Map keycode -> elements
        if (keyConf.keycode) {
            if (!keyElements[keyConf.keycode]) keyElements[keyConf.keycode] = [];
            keyElements[keyConf.keycode].push(el);
        }
    });
}

async function loadSettings() {
    const settings = await window.electronAPI.getSettings();
    if (settings && settings.keys) {
        keysConfig = settings.keys;
        renderKeys();
    }
}

loadSettings();

window.electronAPI.onSettingsUpdated(() => loadSettings());

// ── Key Events ────────────────────────────────────────────────────────────────
const pressedKeys = new Set();

window.electronAPI.onGlobalKeydown((keycode) => {
    const els = keyElements[keycode];
    if (els && els.length > 0) {
        if (!pressedKeys.has(keycode)) {
            pressedKeys.add(keycode);
            playKeyPress();
        }
        els.forEach(el => el.classList.add('active'));
    }
});

window.electronAPI.onGlobalKeyup((keycode) => {
    pressedKeys.delete(keycode);
    const els = keyElements[keycode];
    if (els && els.length > 0) {
        playKeyRelease();
        els.forEach(el => el.classList.remove('active'));
    }
});
