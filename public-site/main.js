/**
 * public-site/main.js
 * Интерактивность обычного сайта-магазина EliTCeramiC
 */

document.addEventListener('DOMContentLoaded', () => {
    initBurgerMenu();
    initSmoothScroll();
    initHeaderScroll();
    initNavDropdowns();
});

// Плавная прокрутка якорей
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', (e) => {
            const href = anchor.getAttribute('href');
            if (href === '#') return;
            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                const top = target.getBoundingClientRect().top + window.scrollY - 130;
                window.scrollTo({ top, behavior: 'smooth' });
            }
        });
    });
}

// Заголовок при скролле
function initHeaderScroll() {
    const header = document.querySelector('.site-header');
    if (!header) return;
    window.addEventListener('scroll', () => {
        header.style.background = window.scrollY > 20
            ? 'rgba(10,10,15,0.97)'
            : 'rgba(10,10,15,0.85)';
    }, { passive: true });
}

// Мобильное меню
function initBurgerMenu() {
    const btn = document.getElementById('burger-btn');
    const nav = document.querySelector('.main-nav');
    if (!btn || !nav) return;

    btn.addEventListener('click', () => {
        const isOpen = btn.classList.contains('active');
        btn.classList.toggle('active', !isOpen);
        if (!isOpen) {
            nav.style.cssText = `
                display: block !important;
                position: fixed;
                top: 120px; left: 0; right: 0;
                background: rgba(10,10,15,0.98);
                border-top: 1px solid rgba(255,255,255,0.08);
                padding: 20px 24px;
                backdrop-filter: blur(20px);
                z-index: 999;
            `;
            const list = nav.querySelector('.nav-list');
            if (list) list.style.cssText = 'flex-direction: column; align-items: flex-start; gap: 4px;';
        } else {
            nav.style.cssText = '';
            const list = nav.querySelector('.nav-list');
            if (list) list.style.cssText = '';
        }
    });

    document.addEventListener('click', (e) => {
        if (!btn.contains(e.target) && !nav.contains(e.target)) {
            btn.classList.remove('active');
            nav.style.cssText = '';
            const list = nav.querySelector('.nav-list');
            if (list) list.style.cssText = '';
        }
    });
}

// Dropdown (клавиатура)
function initNavDropdowns() {
    document.querySelectorAll('.nav-has-dropdown > .nav-link').forEach(link => {
        link.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                link.closest('.nav-item').classList.toggle('open');
            }
        });
    });
}
