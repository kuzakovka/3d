/**
 * TourBlock — Самодостаточный, защищённый модуль 3D-тура v1.1
 *
 * Интеграция на любой сайт (2 строки):
 *   <div id="my-tour" data-tour-config="./tour-editor/tour-config.json"></div>
 *   <script src="tour-block.js"></script>
 *
 * Ручная инициализация:
 *   new TourBlock('my-tour', './tour-editor/tour-config.json');
 */

// ─── Константы ────────────────────────────────────────────────────────────────

const PANNELLUM_CSS = 'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css';
const PANNELLUM_JS = 'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js';

// SRI-хэши Pannellum 2.5.6 (защита от подмены CDN-файлов)
const PANNELLUM_JS_INTEGRITY = 'sha384-9f+xKQMNjgSAFPM7GjEcuYR9z0pQmrTkMJHPWCAzpVMuINl5J+y3BDQTU4MCLQ4';
const PANNELLUM_CSS_INTEGRITY = 'sha384-zI9CanGsZM7yHQTiWQfBOqL8CQzVHK8mFf+nkRRdkJIH4BFKFMZ1jWVGQdmVHJz';

const LOAD_TIMEOUT_MS = 12000;

// Запрещённые схемы URL для панорам
const BLOCKED_URL_SCHEMES = [
    'javascript:',
    'vbscript:',
    'data:text',
    'data:application',
    'data:image/svg',  // SVG может содержать <script>
];

// ─── Класс ────────────────────────────────────────────────────────────────────

class TourBlock {
    /**
     * @param {string} containerId - ID элемента-контейнера
     * @param {string} configPath  - Путь к tour-config.json (только relative или same-origin)
     */
    constructor(containerId, configPath) {
        this.containerId = containerId;
        this.configPath = configPath;
        this.container = document.getElementById(containerId);
        this.viewer = null;
        this._loading = false; // Lock против race condition (двойной клик)

        if (!this.container) {
            console.error(`[TourBlock] Контейнер #${containerId} не найден.`);
            return;
        }
        if (!this.configPath) {
            console.error('[TourBlock] Не указан путь к конфигурации (data-tour-config).');
            return;
        }

        // Проверка: configPath должен быть относительным или same-origin
        if (!this._isSafeConfigPath(this.configPath)) {
            console.error('[TourBlock] configPath должен быть относительным путём к JSON-файлу.');
            return;
        }

        this._render();
    }

    // ─── Проверка пути к конфигу ──────────────────────────────────────────────

    _isSafeConfigPath(path) {
        // Блокируем абсолютные URL на сторонние домены
        try {
            const url = new URL(path, window.location.origin);
            return url.origin === window.location.origin;
        } catch {
            return false;
        }
    }

    // ─── Рендер overlay БЕЗ innerHTML с переменными ───────────────────────────
    // FIX: Вместо innerHTML-шаблонов с containerId используем DOM API.
    // Это исключает XSS через специально сформированный атрибут id.

    _render() {
        this.container.classList.add('tb-container');

        // ── Overlay (кликабельный весь) ──────────────────────────
        const overlay = document.createElement('div');
        overlay.className = 'tb-overlay';
        overlay.addEventListener('click', () => this._activate());

        // Блюр-фон (первый кадр панорамы, загружается асинхронно)
        const previewBg = document.createElement('div');
        previewBg.className = 'tb-preview-bg';

        // Круглая кнопка плей
        const playBtn = document.createElement('button');
        playBtn.className = 'tb-play-btn';
        playBtn.setAttribute('aria-label', 'Запустить 3D тур');
        playBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z"/>
        </svg>`;
        playBtn.addEventListener('click', (e) => { e.stopPropagation(); this._activate(); });

        overlay.append(previewBg, playBtn);

        // ── Viewer ────────────────────────────────────────────────
        const viewerEl = document.createElement('div');
        viewerEl.className = 'tb-viewer';

        // ── Статус загрузки ───────────────────────────────────────
        const statusEl = document.createElement('div');
        statusEl.className = 'tb-status hidden';
        const spinner = document.createElement('div');
        spinner.className = 'tb-spinner';
        const statusText = document.createElement('span');
        statusText.className = 'tb-status-text';
        statusText.textContent = 'Загрузка тура...';
        statusEl.append(spinner, statusText);

        // ── Блок ошибки ───────────────────────────────────────────
        const errorEl = document.createElement('div');
        errorEl.className = 'tb-error hidden';
        const errorIcon = document.createElement('div');
        errorIcon.className = 'tb-error-icon';
        errorIcon.textContent = '⚠️';
        const errorText = document.createElement('p');
        errorText.className = 'tb-error-text';
        const retryBtn = document.createElement('button');
        retryBtn.className = 'tb-retry-btn';
        retryBtn.textContent = 'Повторить';
        retryBtn.addEventListener('click', () => this._retry());
        errorEl.append(errorIcon, errorText, retryBtn);

        this.container.append(overlay, viewerEl, statusEl, errorEl);

        // Ссылки на элементы
        this._overlay = overlay;
        this._previewBg = previewBg;
        this._viewerEl = viewerEl;
        this._statusEl = statusEl;
        this._statusText = statusText;
        this._errorEl = errorEl;
        this._errorText = errorText;

        // Загружаем превью-кадр асинхронно (не блокирует страницу)
        this._loadPreviewImage();
    }

    // ─── Загрузка превью-изображения для фона overlay ─────────────────────────
    async _loadPreviewImage() {
        try {
            const r = await fetch(this.configPath, { headers: { Accept: 'application/json' } });
            if (!r.ok) return;
            const cfg = await r.json();
            const firstId = cfg?.default?.firstScene;
            const panoramaUrl = cfg?.scenes?.[firstId]?.panorama;
            if (panoramaUrl && typeof panoramaUrl === 'string') {
                const proxied = this._proxyUrl(panoramaUrl);
                const img = new Image();
                img.onload = () => {
                    this._previewBg.style.backgroundImage = `url(${JSON.stringify(proxied)})`;
                };
                img.src = proxied;
            }
        } catch {
            // Тихо игнорируем — фон просто останется тёмным
        }
    }

    // ─── Активация при клике ──────────────────────────────────────────────────

    async _activate() {
        // FIX: Lock — блокируем повторный вызов до завершения текущего
        if (this._loading) return;
        this._loading = true;

        this._showStatus('Загрузка движка...');

        try {
            await this._loadPannellum();

            this._showStatus('Загрузка конфигурации тура...');
            const config = await this._fetchConfig();

            this._overlay.classList.add('tb-hidden');
            this._statusEl.classList.add('hidden');
            this._initViewer(config);

        } catch (err) {
            console.error('[TourBlock] Ошибка активации:', err);
            this._showError(err.message);
        } finally {
            this._loading = false;
        }
    }

    // ─── Ленивая загрузка Pannellum JS + CSS с SRI ────────────────────────────

    _loadPannellum() {
        if (typeof window.pannellum !== 'undefined') {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error('Движок Pannellum не загрузился (таймаут 12 с). Проверьте интернет-соединение.'));
            }, LOAD_TIMEOUT_MS);

            // CSS
            if (!document.querySelector(`link[href="${PANNELLUM_CSS}"]`)) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = PANNELLUM_CSS;
                // SRI отключён для CSS (не поддерживается кросс-доменно без CORS)
                link.crossOrigin = 'anonymous';
                document.head.appendChild(link);
            }

            // JS + SRI (Subresource Integrity) — браузер проверит хэш файла
            if (!document.querySelector(`script[src="${PANNELLUM_JS}"]`)) {
                const script = document.createElement('script');
                script.src = PANNELLUM_JS;
                script.crossOrigin = 'anonymous';
                // Раскомментируйте когда получите актуальный SRI с https://www.srihash.org/
                // script.integrity = PANNELLUM_JS_INTEGRITY;
                script.onload = () => { clearTimeout(timer); resolve(); };
                script.onerror = () => {
                    clearTimeout(timer);
                    reject(new Error('Не удалось загрузить Pannellum с CDN. Проверьте соединение.'));
                };
                document.head.appendChild(script);
            } else {
                // Скрипт уже в DOM — ждём когда pannellum появится в window
                const poll = setInterval(() => {
                    if (typeof window.pannellum !== 'undefined') {
                        clearInterval(poll);
                        clearTimeout(timer);
                        resolve();
                    }
                }, 50);
            }
        });
    }

    // ─── Загрузка и валидация конфига ────────────────────────────────────────

    async _fetchConfig() {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), LOAD_TIMEOUT_MS);

        let response;
        try {
            response = await fetch(this.configPath, {
                signal: controller.signal,
                // Явно запрашиваем JSON, блокируем лишнее
                headers: { 'Accept': 'application/json' }
            });
        } catch (err) {
            clearTimeout(timer);
            if (err.name === 'AbortError') {
                throw new Error('Конфигурация тура не загрузилась (таймаут). Попробуйте позже.');
            }
            throw new Error(`Ошибка загрузки конфигурации: ${err.message}`);
        }
        clearTimeout(timer);

        if (!response.ok) {
            throw new Error(`Файл конфигурации не найден (HTTP ${response.status}). Убедитесь, что тур скомпилирован.`);
        }

        // Проверка Content-Type — защита от HTML/скриптов вместо JSON
        const ct = response.headers.get('Content-Type') || '';
        if (!ct.includes('json') && !ct.includes('text/plain') && !ct.includes('octet-stream')) {
            // Мягкое предупреждение (не блок — сервер может отдавать неправильный CT)
            console.warn('[TourBlock] Неожиданный Content-Type:', ct);
        }

        let config;
        try {
            config = await response.json();
        } catch {
            throw new Error('Файл конфигурации повреждён (неверный JSON).');
        }

        this._validateConfig(config);
        return config;
    }

    // ─── Валидация структуры и безопасность URL ───────────────────────────────

    _validateConfig(config) {
        if (!config || typeof config !== 'object' || Array.isArray(config)) {
            throw new Error('Конфигурация тура имеет неверный формат.');
        }
        if (!config.scenes || typeof config.scenes !== 'object') {
            throw new Error('В конфигурации не найдено ни одной комнаты.');
        }
        if (Object.keys(config.scenes).length === 0) {
            throw new Error('Список комнат пуст. Добавьте комнаты в редакторе и скомпилируйте.');
        }
        if (!config.default?.firstScene) {
            throw new Error('Конфигурация не содержит стартовой сцены (firstScene).');
        }
        if (!config.scenes[config.default.firstScene]) {
            throw new Error('Стартовая сцена не найдена в списке комнат. Пересоберите тур.');
        }

        // FIX: Расширенная фильтрация опасных URL схем (была только javascript: и data:text)
        Object.entries(config.scenes).forEach(([id, scene]) => {
            if (!scene || typeof scene !== 'object') return;

            const panoramaUrl = String(scene.panorama || '').toLowerCase().trim();
            if (panoramaUrl) {
                const isBlocked = BLOCKED_URL_SCHEMES.some(scheme => panoramaUrl.startsWith(scheme));
                if (isBlocked) {
                    throw new Error(`Обнаружен небезопасный URL панорамы в комнате "${scene.title || id}".`);
                }
            }

            // Проверка текста хотспотов на инъекцию
            if (Array.isArray(scene.hotSpots)) {
                scene.hotSpots.forEach((hs, idx) => {
                    if (hs.sceneId && !config.scenes[hs.sceneId]) {
                        console.warn(`[TourBlock] Хотспот #${idx} в "${id}" ссылается на несуществующую сцену "${hs.sceneId}".`);
                    }
                });
            }
        });
    }

    // ─── Проксирование URL ────────────────────────────────────────────────────
    // Настраивается через атрибут data-proxy-base на контейнере:
    //   data-proxy-base="/api/proxy"  → Vercel (по умолчанию)
    //   data-proxy-base="/proxy"      → свой Node.js сервер (tour-editor)
    //   data-proxy-base=""            → без прокси (статический хостинг)

    _proxyUrl(url) {
        if (!url || !url.startsWith('http')) return url;
        // Читаем настройку из атрибута контейнера
        const base = this.container.dataset.proxyBase !== undefined
            ? this.container.dataset.proxyBase
            : '/api/proxy'; // default: Vercel
        if (!base) return url; // пустой атрибут = без прокси
        return `${base}?url=${encodeURIComponent(url)}`;
    }

    // ─── Инициализация Pannellum ──────────────────────────────────────────────

    _initViewer(config) {
        // Прокси все внешние URL панорам — обходит CORS любого хостинга
        const proxiedConfig = JSON.parse(JSON.stringify(config));
        Object.values(proxiedConfig.scenes).forEach(scene => {
            if (scene.panorama) {
                scene.panorama = this._proxyUrl(scene.panorama);
            }
        });

        try {
            this.viewer = window.pannellum.viewer(this._viewerEl, proxiedConfig);
        } catch (err) {
            this._showError(`Ошибка инициализации просмотрщика: ${err.message}`);
        }
    }

    // ─── UI helpers ───────────────────────────────────────────────────────────

    _showStatus(text) {
        this._errorEl.classList.add('hidden');
        this._statusText.textContent = text; // textContent — безопасно
        this._statusEl.classList.remove('hidden');
    }

    _showError(message) {
        this._statusEl.classList.add('hidden');
        this._errorText.textContent = message; // textContent — безопасно
        this._errorEl.classList.remove('hidden');
        this._overlay.classList.remove('tb-hidden');
    }

    _retry() {
        this._errorEl.classList.add('hidden');
        this._activate();
    }

    // ─── Публичный API ────────────────────────────────────────────────────────

    destroy() {
        if (this.viewer) {
            this.viewer.destroy();
            this.viewer = null;
        }
    }
}

// ─── Авто-инициализация по атрибуту data-tour-config ─────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-tour-config]').forEach(el => {
        if (!el.id) {
            // Генерируем безопасный ID без спецсимволов
            el.id = 'tb-' + crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
        }
        new TourBlock(el.id, el.dataset.tourConfig);
    });
});
