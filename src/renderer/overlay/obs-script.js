const container = document.getElementById('overlay-container');
let keysConfig = [];
let keyElements = {}; 

// ── OBS / Browser Source Logic ─────────────────────────────────────────────
// We use EventSource to listen to the local SSE server on port 4243
const eventSource = new EventSource('http://localhost:4243/events');

eventSource.addEventListener('keydown', (e) => {
    const data = JSON.parse(e.data);
    const els = keyElements[data.keycode];
    if (els) {
        els.forEach(el => el.classList.add('active'));
    }
});

eventSource.addEventListener('keyup', (e) => {
    const data = JSON.parse(e.data);
    const els = keyElements[data.keycode];
    if (els) {
        els.forEach(el => el.classList.remove('active'));
    }
});

// Initial settings fetch from our local server
async function fetchSettings() {
    try {
        const response = await fetch('http://localhost:4243/settings');
        const settings = await response.json();
        if (settings && settings.keys) {
            keysConfig = settings.keys;
            renderKeys();
        }
    } catch (err) {
        console.error('Failed to fetch settings for OBS overlay:', err);
        // Retry after a delay
        setTimeout(fetchSettings, 2000);
    }
}

function renderKeys() {
    container.innerHTML = '';
    keyElements = {};

    keysConfig.forEach(keyConf => {
        const el = document.createElement('div');
        el.className = 'key-element';
        el.id = keyConf.id;

        if (keyConf.image) {
            el.style.backgroundImage = `url('${keyConf.image}')`;
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

        if (keyConf.keycode) {
            if (!keyElements[keyConf.keycode]) keyElements[keyConf.keycode] = [];
            keyElements[keyConf.keycode].push(el);
        }
    });
}

fetchSettings();
