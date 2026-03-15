// ── State ────────────────────────────────────────────────────────────────────
let keysConfig = [];
let selectedKeyId = null;
let isAssigning   = false;

// Single global drag state (prevents multiple listeners from multiplying)
const drag = { active: false, keyId: null, startX: 0, startY: 0, initLeft: 0, initTop: 0, el: null };

// ── DOM ──────────────────────────────────────────────────────────────────────
const canvas        = document.getElementById('editor-canvas');
const addKeyBtn     = document.getElementById('add-key-btn');
const applyBtn      = document.getElementById('apply-btn');
const propPanel     = document.getElementById('properties-panel');
const noSelMsg      = document.getElementById('no-selection-msg');
const propLabel     = document.getElementById('prop-label');
const propAssignBtn = document.getElementById('prop-assign-btn');
const assignText    = document.getElementById('assign-text');
const propKeycodeDisplay = document.getElementById('prop-keycode-display');
const propX         = document.getElementById('prop-x');
const propY         = document.getElementById('prop-y');
const propWidth     = document.getElementById('prop-width');
const propHeight    = document.getElementById('prop-height');
const propImage     = document.getElementById('prop-image');
const browseBtn     = document.getElementById('browse-image-btn');
const imgPreviewCt  = document.getElementById('image-preview-container');
const imgPreview    = document.getElementById('image-preview');
const propDeleteBtn = document.getElementById('prop-delete-btn');
const overlayXInput = document.getElementById('overlay-x');
const overlayYInput = document.getElementById('overlay-y');
const moveOverlayBtn= document.getElementById('move-overlay-btn');
const obsToggle     = document.getElementById('obs-mode-toggle');
const obsUrlDisplay = document.getElementById('obs-url-display');
const copyObsUrlBtn = document.getElementById('copy-obs-url-btn');
const tbMin         = document.getElementById('tb-min');
const tbClose       = document.getElementById('tb-close');
const titlebar      = document.getElementById('titlebar');

// ── Audio Engine ─────────────────────────────────────────────────────────────
const actx = new (window.AudioContext || window.webkitAudioContext)();

function playNoise(dur, vol, fc, Q = 0.9) {
    if (actx.state === 'suspended') actx.resume();
    const n = Math.floor(actx.sampleRate * dur);
    const buf = actx.createBuffer(1, n, actx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random()*2-1) * Math.pow(1 - i/n, 4);
    const src = actx.createBufferSource(); src.buffer = buf;
    const f = actx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=fc; f.Q.value=Q;
    const g = actx.createGain();
    g.gain.setValueAtTime(vol, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + dur);
    src.connect(f); f.connect(g); g.connect(actx.destination);
    src.start();
}
function playTone(freq, type='sine', dur=0.06, vol=0.06) {
    if (actx.state === 'suspended') actx.resume();
    const o = actx.createOscillator(); const g = actx.createGain();
    o.type=type; o.frequency.value=freq;
    g.gain.setValueAtTime(vol, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + dur);
    o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + dur);
}

function sndHover()  { playTone(900, 'sine', 0.022, 0.025); }
function sndClick()  { playNoise(0.04, 0.14, 3000); }
function sndSnap()   { playNoise(0.05, 0.18, 2000); playTone(480, 'triangle', 0.05, 0.035); }
function sndDelete() { playTone(160, 'sawtooth', 0.1, 0.07); }
function sndAssign() { playNoise(0.03, 0.1, 2500, 1.5); playTone(880, 'sine', 0.07, 0.05); }
function sndApply()  {
    playTone(440,'triangle',0.1,0.05);
    setTimeout(()=>playTone(554,'triangle',0.12,0.05),80);
    setTimeout(()=>playTone(659,'sine',0.18,0.05),160);
}
function sndCopy()   { playTone(700,'sine',0.06,0.05); playTone(1000,'sine',0.06,0.03); }

document.querySelectorAll('button').forEach(b => b.addEventListener('mouseenter', sndHover));

// ── Native Titlebar Drag (via CSS) ──────────────────────────────────────────
// No JS needed for movement if we use -webkit-app-region: drag on titlebar
tbMin.addEventListener('click',   () => window.electronAPI.minimizeWindow());
tbClose.addEventListener('click', () => window.electronAPI.closeWindow());

// ── Init ─────────────────────────────────────────────────────────────────────
async function init() {
    const settings = await window.electronAPI.getSettings();
    if (settings) {
        keysConfig = settings.keys || [];
        if (settings.overlayX != null) overlayXInput.value = settings.overlayX;
        if (settings.overlayY != null) overlayYInput.value = settings.overlayY;
    }
    const url = await window.electronAPI.getObsUrl();
    obsUrlDisplay.textContent = url;
    renderCanvas();

    // Sync overlay inputs if moved manually
    window.electronAPI.onOverlayMoved(({ x, y }) => {
        overlayXInput.value = x;
        overlayYInput.value = y;
    });
}

// ── Render (DOM diff approach — only re-creates if needed) ───────────────────
function renderCanvas() {
    // Remove keys no longer in config
    Array.from(canvas.children).forEach(child => {
        const id = child.dataset.keyId;
        if (!keysConfig.find(k => k.id === id)) canvas.removeChild(child);
    });

    keysConfig.forEach(keyConf => {
        let el = canvas.querySelector(`[data-key-id="${keyConf.id}"]`);
        const isNew = !el;

        if (isNew) {
            el = document.createElement('div');
            el.className = 'key-editor-element';
            el.dataset.keyId = keyConf.id;
            attachDrag(el, keyConf.id);
            canvas.appendChild(el);
        }

        // Always update visual state
        el.classList.toggle('selected', keyConf.id === selectedKeyId);
        el.style.left   = `${keyConf.x}px`;
        el.style.top    = `${keyConf.y}px`;
        el.style.width  = `${keyConf.width  || 62}px`;
        el.style.height = `${keyConf.height || 62}px`;

        if (keyConf.image) {
            el.style.backgroundImage    = `url('${keyConf.image}')`;
            el.style.backgroundSize     = 'cover';
            el.style.backgroundPosition = 'center';
            el.textContent = '';
        } else {
            el.style.backgroundImage = '';
            el.textContent = keyConf.label || '?';
        }
    });
}

// ── Drag (one set of listeners per canvas — never duplicated) ─────────────────
const GRID_SIZE = 20;

canvas.addEventListener('mousemove', e => {
    if (!drag.active) return;
    const k = keysConfig.find(k => k.id === drag.keyId);
    if (!k) return;

    let newX = drag.initLeft + (e.clientX - drag.startX);
    let newY = drag.initTop  + (e.clientY - drag.startY);

    // Grid snapping (disabled if CTRL is held)
    if (!e.ctrlKey) {
        newX = Math.round(newX / GRID_SIZE) * GRID_SIZE;
        newY = Math.round(newY / GRID_SIZE) * GRID_SIZE;
    }

    k.x = Math.max(0, newX);
    k.y = Math.max(0, newY);
    drag.el.style.left = `${k.x}px`;
    drag.el.style.top  = `${k.y}px`;

    // Sync panel in real-time if selected
    if (k.id === selectedKeyId) {
        propX.value = k.x / GRID_SIZE;
        propY.value = k.y / GRID_SIZE;
    }
});

document.addEventListener('mouseup', () => {
    if (drag.active) {
        drag.active = false;
        drag.el?.classList.remove('dragging');
        sndSnap();
    }
});

function attachDrag(el, keyId) {
    el.addEventListener('mousedown', e => {
        if (e.button !== 0) return;
        e.stopPropagation();
        sndClick();
        selectKey(keyId);
        const k = keysConfig.find(k => k.id === keyId);
        if (!k) return;
        drag.active    = true;
        drag.keyId     = keyId;
        drag.startX    = e.clientX;
        drag.startY    = e.clientY;
        drag.initLeft  = k.x;
        drag.initTop   = k.y;
        drag.el        = el;
        el.classList.add('dragging');
    });
}

// ── Selection ─────────────────────────────────────────────────────────────────
function selectKey(id) {
    selectedKeyId = id;
    // Update selected class without full re-render
    canvas.querySelectorAll('.key-editor-element').forEach(el => {
        el.classList.toggle('selected', el.dataset.keyId === id);
    });
    updatePanel();
}

canvas.addEventListener('mousedown', e => {
    if (e.target === canvas) {
        selectedKeyId = null;
        canvas.querySelectorAll('.key-editor-element').forEach(el => el.classList.remove('selected'));
        updatePanel();
    }
});

// ── Panel ─────────────────────────────────────────────────────────────────────
function updatePanel() {
    if (!selectedKeyId) {
        propPanel.classList.add('hidden');
        noSelMsg.classList.remove('hidden');
        return;
    }
    const k = keysConfig.find(k => k.id === selectedKeyId);
    if (!k) return;

    noSelMsg.classList.add('hidden');
    propPanel.classList.remove('hidden');

    propLabel.value  = k.label  || '';
    // Show in units (px / 20)
    propX.value      = (k.x || 0) / GRID_SIZE;
    propY.value      = (k.y || 0) / GRID_SIZE;
    propWidth.value  = (k.width  || 60) / GRID_SIZE;
    propHeight.value = (k.height || 60) / GRID_SIZE;
    propImage.value  = k.image  || '';
    propKeycodeDisplay.textContent = k.keycode
        ? `Keycode: 0x${k.keycode.toString(16).toUpperCase()} (${k.keycode})`
        : 'No key assigned';

    updateImagePreview(k.image);
    isAssigning = false;
    propAssignBtn.classList.remove('listening');
    assignText.textContent = 'Press to assign key…';
}

function updateImagePreview(src) {
    if (src && src.trim()) {
        imgPreview.src = src;
        imgPreviewCt.classList.remove('hidden');
    } else {
        imgPreviewCt.classList.add('hidden');
        imgPreview.src = '';
    }
}

// ── Global key listener (for assigning) ──────────────────────────────────────
window.electronAPI.onGlobalKeydown(keycode => {
    if (!isAssigning || !selectedKeyId) return;
    const k = keysConfig.find(k => k.id === selectedKeyId);
    if (!k) return;
    k.keycode = keycode;
    sndAssign();
    isAssigning = false;
    propAssignBtn.classList.remove('listening');
    assignText.textContent = 'Press to assign key…';
    propKeycodeDisplay.textContent = `Keycode: 0x${keycode.toString(16).toUpperCase()} (${keycode})`;
});

// ── Panel inputs ──────────────────────────────────────────────────────────────
propLabel.addEventListener('input', e => {
    const k = keysConfig.find(k => k.id === selectedKeyId);
    if (!k) return;
    k.label = e.target.value;
    const el = canvas.querySelector(`[data-key-id="${k.id}"]`);
    if (el && !k.image) el.textContent = k.label || '?';
});

propX.addEventListener('input', e => {
    const k = keysConfig.find(k => k.id === selectedKeyId);
    if (!k) return;
    const units = parseInt(e.target.value) || 0;
    k.x = units * GRID_SIZE;
    const el = canvas.querySelector(`[data-key-id="${k.id}"]`);
    if (el) el.style.left = `${k.x}px`;
});

propY.addEventListener('input', e => {
    const k = keysConfig.find(k => k.id === selectedKeyId);
    if (!k) return;
    const units = parseInt(e.target.value) || 0;
    k.y = units * GRID_SIZE;
    const el = canvas.querySelector(`[data-key-id="${k.id}"]`);
    if (el) el.style.top = `${k.y}px`;
});

propWidth.addEventListener('input', e => {
    const k = keysConfig.find(k => k.id === selectedKeyId);
    if (!k) return;
    const units = parseInt(e.target.value) || 1;
    k.width = units * GRID_SIZE;
    const el = canvas.querySelector(`[data-key-id="${k.id}"]`);
    if (el) el.style.width = `${k.width}px`;
});

propHeight.addEventListener('input', e => {
    const k = keysConfig.find(k => k.id === selectedKeyId);
    if (!k) return;
    const units = parseInt(e.target.value) || 1;
    k.height = units * GRID_SIZE;
    const el = canvas.querySelector(`[data-key-id="${k.id}"]`);
    if (el) el.style.height = `${k.height}px`;
});

propImage.addEventListener('input', e => {
    const k = keysConfig.find(k => k.id === selectedKeyId);
    if (!k) return;
    k.image = e.target.value;
    updateImagePreview(k.image);
    renderCanvas(); // needs full update for bg-image
});

propAssignBtn.addEventListener('click', () => {
    sndClick();
    isAssigning = !isAssigning;
    propAssignBtn.classList.toggle('listening', isAssigning);
    assignText.textContent = isAssigning ? 'Listening… press a key' : 'Press to assign key…';
});

browseBtn.addEventListener('click', () => {
    sndClick();
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = async e => {
        const file = e.target.files[0];
        if (!file) return;
        
        // Import file to AppData
        const fileName = await window.electronAPI.importImage(file.path);
        const uri = `http://localhost:4242/images/${fileName}`;

        const k = keysConfig.find(k => k.id === selectedKeyId);
        if (!k) return;
        k.image = uri;
        propImage.value = uri;
        updateImagePreview(uri);
        renderCanvas();
        sndSnap();
    };
    input.click();
});

// ── Add / Delete ──────────────────────────────────────────────────────────────
addKeyBtn.addEventListener('click', () => {
    sndClick();
    const id = 'key_' + Date.now();
    keysConfig.push({
        id, label: 'NEW', keycode: 0,
        x: GRID_SIZE * 5,
        y: GRID_SIZE * 5,
        width: GRID_SIZE * 3, 
        height: GRID_SIZE * 3
    });
    renderCanvas();
    selectKey(id);
});

propDeleteBtn.addEventListener('click', () => {
    if (!selectedKeyId) return;
    sndDelete();
    keysConfig = keysConfig.filter(k => k.id !== selectedKeyId);
    selectedKeyId = null;
    renderCanvas();
    updatePanel();
});

// ── Overlay position ──────────────────────────────────────────────────────────
moveOverlayBtn.addEventListener('click', () => {
    sndClick();
    // Enable interactive move mode on overlay
    window.electronAPI.setOverlayInteractive(true);
});

// ── OBS Mode ──────────────────────────────────────────────────────────────────
obsToggle.addEventListener('change', e => {
    window.electronAPI.toggleOverlayVisibility(!e.target.checked);
    sndClick();
});

copyObsUrlBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(obsUrlDisplay.textContent);
    copyObsUrlBtn.style.color = '#5bb87a';
    sndCopy();
    setTimeout(() => { copyObsUrlBtn.style.color = ''; }, 1500);
});

// ── Apply ────────────────────────────────────────────────────────────────────
applyBtn.addEventListener('click', async () => {
    sndApply();
    applyBtn.disabled = true;

    const settings = await window.electronAPI.getSettings() || {};
    settings.keys     = keysConfig;
    settings.overlayX = parseInt(overlayXInput.value) || 0;
    settings.overlayY = parseInt(overlayYInput.value) || 0;

    await window.electronAPI.saveSettings(settings);

    applyBtn.classList.add('success');
    applyBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M2 7.5l4 4 7-7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg> Saved!`;

    setTimeout(() => {
        applyBtn.disabled = false;
        applyBtn.classList.remove('success');
        applyBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <path d="M2 7.5l4 4 7-7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg> Apply Layout`;
    }, 1800);
});

// ── Start ─────────────────────────────────────────────────────────────────────
init();
