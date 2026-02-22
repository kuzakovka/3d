/**
 * 3D Tour Module - Reusable Class
 */
class TourModule {
    constructor(containerId, config) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`Container with ID "${containerId}" not found.`);
            return;
        }
        this.config = config;
        this.viewer = null;
        this.overlay = this.container.querySelector('.tour-activation-overlay');

        this.initEventListeners();
    }

    initEventListeners() {
        if (this.overlay) {
            this.overlay.addEventListener('click', () => this.activate());
        }
    }

    activate() {
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

// Теперь используем локальные файлы, которые будут лежать в той же папке
const defaultTourConfig = {
    "default": {
        "firstScene": "room1",
        "author": "Antigravity 3D",
        "sceneFadeDuration": 1000,
        "autoLoad": true,
        "showFullscreenCtrl": true,
        "autoRotate": -2
    },
    "scenes": {
        "room1": {
            "title": "Первая комната",
            "hfov": 110,
            "type": "equirectangular",
            "panorama": "room1.jpg",
            "hotSpots": [
                { "pitch": -5, "yaw": 120, "type": "scene", "text": "Перейти во вторую", "sceneId": "room2" }
            ]
        },
        "room2": {
            "title": "Вторая комната",
            "hfov": 110,
            "type": "equirectangular",
            "panorama": "room2.jpg",
            "hotSpots": [
                { "pitch": -5, "yaw": 0, "type": "scene", "text": "Вернуться назад", "sceneId": "room1" }
            ]
        }
    }
};

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    window.myTour = new TourModule('main-tour-container', defaultTourConfig);
});
