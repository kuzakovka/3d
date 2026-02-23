/**
 * 3D Tour Editor Logic
 */

let tourData = {
    "default": {
        "firstScene": "",
        "sceneFadeDuration": 1000,
        "autoLoad": true,
        "showFullscreenCtrl": true,
        "autoRotate": 0
    },
    "scenes": {}
};

let currentSceneId = null;
let viewer = null;
let selectedHotspot = null;

// DOM Elements
const roomsList = document.getElementById('rooms-list');
const addRoomBtn = document.getElementById('add-room-btn');
const modalOverlay = document.getElementById('modal-overlay');
const modalCancel = document.getElementById('modal-cancel');
const modalConfirm = document.getElementById('modal-confirm');
const roomNameInput = document.getElementById('room-name-input');
const roomUrlInput = document.getElementById('room-url-input');
const currentRoomNameDisplay = document.getElementById('current-room-name');
const emptyState = document.getElementById('empty-state');
const inspectorContent = document.getElementById('inspector-content');

// --- Initialization ---

function init() {
    // Restore autosaved draft from localStorage
    const saved = localStorage.getItem('tourEditorDraft');
    if (saved) {
        try {
            tourData = JSON.parse(saved);
            const scenes = Object.keys(tourData.scenes);
            renderRoomsList();
            if (scenes.length > 0) switchScene(scenes[0]);
            showToast('Черновик восстановлен', 'Ваш последний тур был автоматически восстановлен.', 'info');
            return;
        } catch (e) {
            console.warn('Failed to load draft:', e);
        }
    }
    renderRoomsList();
}

// --- Draft Auto-Save ---

function saveDraft() {
    try {
        localStorage.setItem('tourEditorDraft', JSON.stringify(tourData));
    } catch (e) {
        console.warn('Could not save draft:', e);
    }
}

// --- Scene Management ---

function addRoom(name, url) {
    const id = 'scene_' + Date.now();
    tourData.scenes[id] = {
        "title": name,
        "type": "equirectangular",
        "panorama": url,
        "hotSpots": []
    };

    if (!tourData.default.firstScene) {
        tourData.default.firstScene = id;
    }

    renderRoomsList();
    switchScene(id);
    saveDraft();
}

function switchScene(id) {
    currentSceneId = id;
    const scene = tourData.scenes[id];

    currentRoomNameDisplay.innerText = scene.title;
    emptyState.classList.add('hidden');

    // Destroy previous viewer if exists
    if (viewer) {
        viewer.destroy();
    }

    // Make sure every hotspot in tourData has a stable ID before deep-copying
    ensureHotspotIds();

    // Initialize Pannellum with ALL scenes so transitions work
    const proxiedScenes = JSON.parse(JSON.stringify(tourData.scenes));
    Object.keys(proxiedScenes).forEach(key => {
        const scene = proxiedScenes[key];
        if (scene.panorama && scene.panorama.startsWith('http')) {
            scene.panorama = `/proxy?url=${encodeURIComponent(scene.panorama)}`;
        }
        // Add custom tooltip with Edit button for each hotspot
        if (scene.hotSpots) {
            scene.hotSpots.forEach((hs, idx) => {
                hs.createTooltipFunc = hotspotTooltip;
                hs.createTooltipArgs = { index: idx, text: hs.text };
            });
        }
    });

    viewer = pannellum.viewer('panorama', {
        ...tourData.default,
        "firstScene": id,
        "scenes": proxiedScenes
    });

    // Sync editor state when user transitions via hotspot inside the viewer
    viewer.on('load', () => {
        const sceneId = viewer.getScene();
        if (sceneId && sceneId !== currentSceneId) {
            currentSceneId = sceneId;
            currentRoomNameDisplay.innerText = tourData.scenes[sceneId].title;
            renderRoomsList();
            showRoomInspector(sceneId);
        }
    });

    // Handle panorama load errors gracefully
    viewer.on('error', () => {
        showToast(
            'Панорама недоступна',
            'Не удалось загрузить изображение. Проверьте правильность URL панорамы, интернет-соединение и доступность ссылки. Если всё верно — возможно, сервер отклонил запрос или файл больше не существует.',
            'error'
        );
    });

    renderRoomsList(); // update active state in list
    showRoomInspector(id);
}

// --- Toast Notifications ---

function showToast(title, message, type = 'info') {
    // Remove old toast if exists
    const old = document.getElementById('editor-toast');
    if (old) old.remove();

    const toast = document.createElement('div');
    toast.id = 'editor-toast';
    toast.innerHTML = `
        <div class="toast-icon">${type === 'error' ? '⚠️' : 'ℹ️'}</div>
        <div class="toast-content">
            <strong>${title}</strong>
            <p>${message}</p>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    document.body.appendChild(toast);

    // Auto-dismiss after 8 seconds
    setTimeout(() => toast?.remove(), 8000);
}

// --- Tooltip Factory ---

function hotspotTooltip(hotSpotDiv, args) {
    hotSpotDiv.classList.add('custom-tooltip');
    const span = document.createElement('span');
    span.innerHTML = `
        <div class="tooltip-text">${args.text}</div>
        <button class="edit-hotspot-btn">Редактировать</button>
    `;
    hotSpotDiv.appendChild(span);

    // Logic for button click
    span.querySelector('.edit-hotspot-btn').onclick = (e) => {
        e.stopPropagation(); // Don't transition!
        e.preventDefault();
        showHotspotInspector(args.index);
    };
}

function addNewHotspot(pitch, yaw) {
    const idx = tourData.scenes[currentSceneId].hotSpots.length;
    const hsId = `hs_${currentSceneId}_${Date.now()}`;
    const newHs = {
        "id": hsId,
        "pitch": pitch,
        "yaw": yaw,
        "type": "scene",
        "text": "",
        "sceneId": ""
    };

    tourData.scenes[currentSceneId].hotSpots.push(newHs);

    // Add hotspot directly — no viewer rebuild!
    syncHotspots();
    showHotspotInspector(idx);
}

// Assign stable unique IDs to all hotspots that don't have one yet.
function ensureHotspotIds() {
    Object.keys(tourData.scenes).forEach(sceneId => {
        (tourData.scenes[sceneId].hotSpots || []).forEach((hs, idx) => {
            if (!hs.id) hs.id = `hs_${sceneId}_${idx}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        });
    });
}

// Sync hotspots for current scene WITHOUT destroying/recreating the viewer.
function syncHotspots() {
    if (!viewer) return;

    const sceneId = viewer.getScene() || currentSceneId;
    const hotSpots = tourData.scenes[sceneId]?.hotSpots || [];

    // 1. Snapshot existing list BEFORE removing (removeHotSpot mutates the array)
    const viewerConfig = viewer.getConfig();
    const existingHotSpots = [...(viewerConfig?.scenes?.[sceneId]?.hotSpots || [])];

    // 2. Remove every existing hotspot from DOM
    existingHotSpots.forEach(hs => {
        viewer.removeHotSpot(hs.id, sceneId);
    });

    // 3. Re-add all from tourData with fresh tooltip functions
    hotSpots.forEach((hs, idx) => {
        viewer.addHotSpot({
            ...hs,
            createTooltipFunc: hotspotTooltip,
            createTooltipArgs: { index: idx, text: hs.text }
        }, sceneId);
    });
}

// Full viewer rebuild — only used for major operations like room switch/delete
function refreshViewer() {
    if (viewer) {
        const pitch = viewer.getPitch();
        const yaw = viewer.getYaw();
        const hfov = viewer.getHfov();

        viewer.destroy();

        const proxiedScenes = JSON.parse(JSON.stringify(tourData.scenes));
        Object.keys(proxiedScenes).forEach(key => {
            const scene = proxiedScenes[key];
            if (scene.panorama && scene.panorama.startsWith('http')) {
                scene.panorama = `/proxy?url=${encodeURIComponent(scene.panorama)}`;
            }
            if (scene.hotSpots) {
                scene.hotSpots.forEach((hs, idx) => {
                    hs.createTooltipFunc = hotspotTooltip;
                    hs.createTooltipArgs = { index: idx, text: hs.text };
                });
            }
        });

        viewer = pannellum.viewer('panorama', {
            ...tourData.default,
            "firstScene": currentSceneId,
            "scenes": proxiedScenes
        });

        viewer.setPitch(pitch);
        viewer.setYaw(yaw);
        viewer.setHfov(hfov);

        viewer.on('load', () => {
            const sceneId = viewer.getScene();
            if (sceneId && sceneId !== currentSceneId) {
                currentSceneId = sceneId;
                currentRoomNameDisplay.innerText = tourData.scenes[sceneId].title;
                renderRoomsList();
                showRoomInspector(sceneId);
            }
        });
    }
}

// --- UI Rendering ---

function renderRoomsList() {
    roomsList.innerHTML = '';
    Object.keys(tourData.scenes).forEach(id => {
        const scene = tourData.scenes[id];
        const div = document.createElement('div');
        div.className = `room-item ${id === currentSceneId ? 'active' : ''}`;
        div.innerHTML = `
            <span class="room-title">${scene.title}</span>
            ${id === tourData.default.firstScene ? '<span class="first-badge">START</span>' : ''}
        `;
        div.onclick = () => switchScene(id);
        roomsList.appendChild(div);
    });
}

function showRoomInspector(id) {
    const scene = tourData.scenes[id];
    inspectorContent.innerHTML = `
        <div class="form-group">
            <label>Имя комнаты</label>
            <input type="text" value="${scene.title}" onchange="updateRoomField('${id}', 'title', this.value)">
        </div>
        <div class="form-group">
            <label>URL Панорамы</label>
            <input type="text" value="${scene.panorama}" onchange="updateRoomField('${id}', 'panorama', this.value)">
        </div>
        <button class="tertiary-btn" style="color: #ef4444; margin-top: 20px;" onclick="deleteRoom('${id}')">Удалить комнату</button>
        
        <div style="margin-top: 30px; border-top: 1px solid var(--border); padding-top: 20px;">
            <p class="hint">Чтобы добавить точку перехода, удерживайте <b>Alt</b> и кликните на панораму.</p>
        </div>
    `;
}

function showHotspotInspector(index) {
    const hs = tourData.scenes[currentSceneId].hotSpots[index];
    let roomOptions = '<option value="">-- Выберите комнату --</option>';
    Object.keys(tourData.scenes).forEach(id => {
        if (id !== currentSceneId) {
            roomOptions += `<option value="${id}" ${hs.sceneId === id ? 'selected' : ''}>${tourData.scenes[id].title}</option>`;
        }
    });
    // Build custom dropdown items
    const dropdownItems = Object.keys(tourData.scenes)
        .filter(id => id !== currentSceneId)
        .map(id => `<div class="custom-option" onclick="selectRoomOption(${index}, '${id}')">${tourData.scenes[id].title}</div>`)
        .join('');

    const selectedLabel = hs.sceneId && tourData.scenes[hs.sceneId]
        ? tourData.scenes[hs.sceneId].title
        : 'Выберите комнату...';

    inspectorContent.innerHTML = `
        <h4>Настройка перехода</h4>
        <div class="form-group" style="margin-top: 15px;">
            <label>Текст подсказки</label>
            <input type="text" 
                   value="${hs.text}" 
                   placeholder="Название перехода"
                   oninput="saveHotspotText(${index}, this.value)"
                   onchange="updateHotspotField(${index}, 'text', this.value)"
                   onblur="updateHotspotField(${index}, 'text', this.value)">
        </div>
        <div class="form-group" style="position: relative;">
            <label>Куда ведет</label>
            <div class="custom-select" id="room-dropdown-trigger" onclick="toggleDropdown()">
                <span id="room-dropdown-label">${selectedLabel}</span>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style="flex-shrink:0">
                    <path d="M6 8L1 3h10z" fill="#94a3b8"/>
                </svg>
            </div>
            <div class="custom-dropdown-menu hidden" id="room-dropdown-menu">
                <div class="custom-option" onclick="selectRoomOption(${index}, '')">— Не выбрано —</div>
                ${dropdownItems}
            </div>
        </div>
        <div style="display:flex; gap:10px; margin-top: 20px;">
            <button class="secondary-btn" style="flex:1" onclick="showRoomInspector('${currentSceneId}')">Назад</button>
            <button class="icon-btn" style="background:#ef4444; width:40px; height:40px;" onclick="deleteHotspot(${index})">🗑️</button>
        </div>
    `;
}

// --- Custom Dropdown Controls ---

window.toggleDropdown = () => {
    const menu = document.getElementById('room-dropdown-menu');
    if (menu) menu.classList.toggle('hidden');
};

window.selectRoomOption = (index, sceneId) => {
    // Update the data
    tourData.scenes[currentSceneId].hotSpots[index].sceneId = sceneId;

    // Update the displayed label
    const label = document.getElementById('room-dropdown-label');
    if (label) {
        label.innerText = sceneId && tourData.scenes[sceneId]
            ? tourData.scenes[sceneId].title
            : 'Выберите комнату...';
    }

    // Close dropdown
    const menu = document.getElementById('room-dropdown-menu');
    if (menu) menu.classList.add('hidden');

    // Refresh viewer to update hotspot
    refreshViewer();
};

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    const trigger = document.getElementById('room-dropdown-trigger');
    const menu = document.getElementById('room-dropdown-menu');
    if (menu && trigger && !trigger.contains(e.target) && !menu.contains(e.target)) {
        menu.classList.add('hidden');
    }
});

// --- Updates & Actions ---

window.updateRoomField = (id, field, value) => {
    tourData.scenes[id][field] = value;
    renderRoomsList();
    if (field === 'title') currentRoomNameDisplay.innerText = value;
    if (field === 'panorama') switchScene(id);
    saveDraft();
};

// Save text silently (no viewer refresh, keeps cursor in place)
window.saveHotspotText = (index, value) => {
    tourData.scenes[currentSceneId].hotSpots[index].text = value;
};

window.updateHotspotField = (index, field, value) => {
    tourData.scenes[currentSceneId].hotSpots[index][field] = value;
    syncHotspots();
    saveDraft();
};

window.deleteHotspot = (index) => {
    if (confirm('Удалить эту метку?')) {
        tourData.scenes[currentSceneId].hotSpots.splice(index, 1);
        refreshViewer();
        showRoomInspector(currentSceneId);
        saveDraft();
    }
};

window.deleteRoom = (id) => {
    if (confirm('Удалить эту комнату и все связи с ней?')) {
        // Remove room
        delete tourData.scenes[id];

        // Clean up hotspots in OTHER rooms that pointed to the deleted room
        Object.keys(tourData.scenes).forEach(sceneKey => {
            const scene = tourData.scenes[sceneKey];
            if (scene.hotSpots) {
                scene.hotSpots = scene.hotSpots.filter(hs => hs.sceneId !== id);
            }
        });

        if (tourData.default.firstScene === id) {
            tourData.default.firstScene = Object.keys(tourData.scenes)[0] || "";
        }

        renderRoomsList();

        const remainingScenes = Object.keys(tourData.scenes);
        if (remainingScenes.length > 0) {
            if (currentSceneId === id || !tourData.scenes[currentSceneId]) {
                // Deleted the currently viewed room — switch to first available
                switchScene(remainingScenes[0]);
            } else {
                // Staying in current scene — just remove ghost arrows via syncHotspots
                syncHotspots();
                showRoomInspector(currentSceneId);
            }
        } else {
            currentSceneId = null;
            emptyState.classList.remove('hidden');
            if (viewer) {
                viewer.destroy();
                viewer = null;
            }
            inspectorContent.innerHTML = '<p class="empty-hint">Выберите объект для редактирования</p>';
        }
    }
};


// --- Modal & Compilation ---

addRoomBtn.onclick = () => modalOverlay.classList.remove('hidden');
modalCancel.onclick = () => modalOverlay.classList.add('hidden');

modalConfirm.onclick = () => {
    const name = roomNameInput.value;
    const url = roomUrlInput.value;
    if (name && url) {
        addRoom(name, url);
        modalOverlay.classList.add('hidden');
        roomNameInput.value = '';
        roomUrlInput.value = '';
        saveDraft();
    }
};

init();

// Register the hotspot-add listener ONCE globally
document.getElementById('panorama').addEventListener('click', (e) => {
    if (!viewer) return;
    if (e.altKey || e.shiftKey) {
        const [pitch, yaw] = viewer.mouseEventToCoords(e);
        addNewHotspot(pitch, yaw);
        saveDraft();
    }
});

// --- Load Tour from File ---

function loadTourFromFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const loaded = JSON.parse(ev.target.result);
                if (!loaded.scenes || !loaded.default) throw new Error('Invalid format');
                tourData = loaded;
                saveDraft();
                renderRoomsList();
                const scenes = Object.keys(tourData.scenes);
                if (scenes.length > 0) {
                    switchScene(scenes[0]);
                }
                showToast('Тур загружен', `Файл «${file.name}» успешно загружен. Комнат: ${scenes.length}.`, 'info');
            } catch (err) {
                showToast('Ошибка загрузки', 'Не удалось прочитать файл. Убедитесь, что это правильный JSON-файл тура.', 'error');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

// --- Save Tour to File ---

async function saveToFile() {
    if (Object.keys(tourData.scenes).length === 0) {
        showToast('Нечего сохранять', 'Добавьте хотя бы одну комнату перед сохранением.', 'error');
        return;
    }

    // Build a clean copy of tourData without internal editor fields
    const cleanData = JSON.parse(JSON.stringify(tourData));
    Object.values(cleanData.scenes).forEach(scene => {
        (scene.hotSpots || []).forEach(hs => {
            delete hs.id; // Remove editor-only IDs
        });
    });
    const jsonStr = JSON.stringify(cleanData, null, 4);

    // Use File System Access API if available (Chrome/Edge) for native Save As dialog
    if ('showSaveFilePicker' in window) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: 'tour-config.json',
                types: [{
                    description: 'JSON файл конфигурации тура',
                    accept: { 'application/json': ['.json'] }
                }]
            });
            const writable = await handle.createWritable();
            await writable.write(jsonStr);
            await writable.close();
            showToast('Файл сохранён', 'Конфигурация тура успешно записана в выбранное место.', 'info');
        } catch (err) {
            if (err.name !== 'AbortError') {
                // AbortError means user cancelled — just silently ignore
                // Any other error — fallback to download
                downloadTourFile(jsonStr);
            }
        }
    } else {
        // Fallback for Firefox and other browsers
        downloadTourFile(jsonStr);
    }
}

function downloadTourFile(jsonStr) {
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tour-config.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Скачивание началось', 'tour-config.json сохранён в папку загрузок. Диалог выбора папки недоступен в вашем браузере.', 'info');
}
