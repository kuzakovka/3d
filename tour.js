/**
 * 3D Tour Module - Reusable Class
 * Now supports remote JSON configuration for easy integration from Editor.
 */
class TourModule {
    constructor(containerId, configOrPath) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`Container with ID "${containerId}" not found.`);
            return;
        }

        this.config = null;
        this.configOrPath = configOrPath;
        this.viewer = null;
        this.overlay = this.container.querySelector('.tour-activation-overlay');

        this.init();
    }

    async init() {
        // If config is a string, it's a path to JSON
        if (typeof this.configOrPath === 'string') {
            try {
                const response = await fetch(this.configOrPath);
                this.config = await response.json();
                console.log('3D Tour configuration loaded from:', this.configOrPath);
            } catch (err) {
                console.error('Failed to load tour config:', err);
                return;
            }
        } else {
            this.config = this.configOrPath;
        }

        this.initEventListeners();
    }

    initEventListeners() {
        if (this.overlay) {
            this.overlay.addEventListener('click', () => this.activate());
        }
    }

    activate() {
        if (!this.config) {
            console.error('Tour configuration not ready.');
            return;
        }

        if (this.overlay) {
            this.overlay.classList.add('hidden');
        }

        const panoramaElement = this.container.querySelector('.panorama-target');
        if (panoramaElement) {
            this.viewer = pannellum.viewer(panoramaElement, this.config);
            console.log('3D Tour Module activated.');
        } else {
            console.error('Panorama target element not found inside container.');
        }
    }
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    /**
     * ПУТЬ К КОНФИГУРАЦИИ:
     * Вы можете передать объект напрямую (как раньше) 
     * ИЛИ передать путь к файлу 'tour-editor/tour-config.json'
     */
    window.myTour = new TourModule('main-tour-container', './tour-editor/tour-config.json');
});
