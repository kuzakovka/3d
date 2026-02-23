# public-site — Публичный сайт EliTCeramiC с 3D туром

Эта папка содержит **самодостаточный HTML/CSS/JS сайт**, который можно задеплоить на любой статический хостинг (Vercel, Netlify, GitHub Pages и т.д.).

---

## 📁 Структура

```
public-site/
├── index.html   ← главная страница сайта
├── style.css    ← все стили (тёмная тема, современный дизайн)
├── main.js      ← интерактивность, инициализация iframe тура
└── README.md    ← эта инструкция
```

---

## 🌀 Как интегрирован 3D тур

Тур встроен через **`<iframe>`** — это самый безопасный и универсальный способ для публичного сайта.

```html
<iframe
    id="tour-iframe"
    class="tour-iframe"
    src="https://your-3d-tour.vercel.app"
    allow="fullscreen; gyroscope; accelerometer"
    allowfullscreen
    loading="lazy"
    sandbox="allow-scripts allow-same-origin allow-fullscreen"
></iframe>
```

### Почему `<iframe>`, а не `tour-block.js` напрямую?

| Способ | iframe | Прямое подключение (tour-block.js) |
|---|---|---|
| Безопасность | ✅ Полная изоляция | ⚠️ Нужно доверять хосту |
| CORS | ✅ Не нужен | ❌ Нужен для JSON-конфига |
| Независимость | ✅ Тур и сайт отдельно | ❌ Сайт зависит от файлов тура |
| Same-origin | ✅ Не нужен | ❌ Файлы должны быть рядом |
| Обновление тура | ✅ Автоматически | ❌ Нужно копировать файлы |

---

## ⚙️ Настройка — 2 шага

### Шаг 1. Задеплойте 3D тур на Vercel
Убедитесь, что ваш 3D тур уже задеплоен и доступен по публичному URL, например:
```
https://3d-tour-kuzakovka.vercel.app
```

### Шаг 2. Укажите URL тура в `main.js`
Откройте файл `main.js` и замените:
```js
const TOUR_URL = 'TOUR_URL_PLACEHOLDER';
```
на ваш реальный URL:
```js
const TOUR_URL = 'https://3d-tour-kuzakovka.vercel.app';
```

Готово! При следующем деплое сайта тур автоматически появится в секции.

---

## 🚀 Деплой сайта на Vercel

### Вариант A — Vercel CLI (рекомендуется)

```bash
# Из папки public-site
cd public-site
npx vercel --prod
```

### Вариант B — через GitHub

1. Создайте отдельный репозиторий для `public-site/`
2. Подключите его к Vercel через dashboard
3. Vercel сам определит статический сайт

### Вариант C — Drag & Drop

1. Зайдите на [vercel.com](https://vercel.com)
2. Перетащите папку `public-site/` в Vercel dashboard
3. Готово за 30 секунд

---

## 🎨 Особенности дизайна

- **Тёмная тема** с фиолетово-синими акцентами (`#6c63ff`)
- **Glassmorphism** заголовок (backdrop-filter: blur)
- **Micro-animations** — hover эффекты, bounce прокрутки
- **Адаптивный дизайн** — работает на мобильных
- **Секция 3D тура** с кнопками "Полный экран" и "Открыть отдельно"
- **Демо-кнопка** — пока тур не настроен, показывает Pannellum demo

---

## 🔧 Кастомизация

### Изменить URL сайта в метатегах
В `index.html` найдите и замените:
```html
<meta property="og:url" content="https://your-vercel-domain.vercel.app">
```

### Добавить Yandex Maps
В секции `#contacts` замените `.contacts-map` содержимое на iframe карты:
```html
<iframe src="https://yandex.ru/map-widget/v1/..."></iframe>
```

### Изменить телефон и название
Найдите `8 (3843) 320-300` и `EliTCeramiC` в `index.html` и замените.

---

## 🛡️ Безопасность iframe

Атрибут `sandbox` настроен оптимально:
- `allow-scripts` — позволяет Pannellum работать
- `allow-same-origin` — нужен для загрузки конфига тура
- `allow-fullscreen` — кнопка полного экрана

**Не добавляйте** `allow-forms`, `allow-top-navigation` — они не нужны для тура.
