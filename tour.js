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

// Конфигурация по умолчанию
const defaultTourConfig = {
    "default": {
        "firstScene": "living-room",
        "author": "Antigravity 3D",
        "sceneFadeDuration": 1000,
        "autoLoad": true,
        "showFullscreenCtrl": true,
        "autoRotate": -2
    },
    "scenes": {
        "living-room": {
            "title": "Гостиная",
            "hfov": 110,
            "type": "equirectangular",
            "panorama": "https://pannellum.org/images/alma.jpg",
            "hotSpots": [
                { "pitch": -1.1, "yaw": 102.9, "type": "scene", "text": "В сад", "sceneId": "garden" }
            ]
        },
        "garden": {
            "title": "Сад",
            "hfov": 110,
            "type": "equirectangular",
            "panorama": "https://pannellum.org/images/tocopilla.jpg",
            "hotSpots": [
                { "pitch": -0.6, "yaw": 37.1, "type": "scene", "text": "В гостиную", "sceneId": "living-room" }
            ]
        }
    }
};

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    // В будущем ты сможешь создавать несколько туров на одной странице, 
    // просто создавая новые экземпляры TourModule с разными ID
    window.myTour = new TourModule('main-tour-container', defaultTourConfig);
});
