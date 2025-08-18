# Course Parser Browser Extension

Браузерное расширение для извлечения ссылок с веб-страниц и отправки их на бэкенд для дальнейшей обработки.

## Возможности

- 🔍 Извлечение ссылок с веб-страниц по CSS селекторам
- 🎯 Настраиваемые селекторы для поиска элементов
- 📋 Копирование ссылок в буфер обмена
- 🚀 Отправка данных на бэкенд сервер
- ⚙️ Настраиваемые параметры подключения
- 🎨 Современный и удобный интерфейс

## Установка

### Для разработки (Chrome/Edge)

1. Откройте браузер и перейдите в `chrome://extensions/`
2. Включите "Режим разработчика" (Developer mode)
3. Нажмите "Загрузить распакованное расширение" (Load unpacked)
4. Выберите папку `browser-extension` из этого проекта
5. Расширение будет установлено и появится в панели инструментов

### Для Firefox

1. Откройте `about:debugging`
2. Перейдите на вкладку "This Firefox"
3. Нажмите "Load Temporary Add-on"
4. Выберите файл `manifest.json` из папки `browser-extension`

## Использование

### Основные функции

1. **Извлечение ссылок:**
   - Откройте любую веб-страницу
   - Нажмите на иконку расширения в панели инструментов
   - Нажмите кнопку "Извлечь ссылки"
   - Расширение найдет все ссылки на странице

2. **Настройка селекторов:**
   - В настройках расширения можно указать CSS селекторы
   - По умолчанию используются: `a[href], .video-link, .download-btn`
   - Селекторы разделяются запятыми

3. **Отправка на сервер:**
   - После извлечения ссылок нажмите "Отправить на сервер"
   - Данные будут отправлены на указанный бэкенд URL
   - По умолчанию: `http://localhost:8000`

### Настройки

- **URL сервера:** Адрес вашего бэкенд сервера
- **CSS селекторы:** Список селекторов для поиска элементов
- **Уведомления:** Включение/выключение уведомлений

## Структура файлов

```
browser-extension/
├── manifest.json          # Конфигурация расширения
├── popup.html            # Интерфейс popup
├── popup.css             # Стили popup
├── popup.js              # Логика popup
├── content.js            # Скрипт для работы со страницей
├── background.js         # Фоновый скрипт
├── icons/                # Иконки расширения
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md             # Этот файл
```

## API

### Content Script API

Расширение предоставляет глобальный объект `window.courseParserExtension` со следующими методами:

```javascript
// Извлечение ссылок
const links = window.courseParserExtension.extractLinksFromPage(selectors);

// Подсветка элементов
window.courseParserExtension.highlightElements(selectors);

// Удаление подсветки
window.courseParserExtension.removeHighlights();

// Получение информации об элементе
const info = window.courseParserExtension.getElementInfo(element);

// Поиск элементов по тексту
const elements = window.courseParserExtension.findElementsByText(searchText, selector);
```

### Формат данных

Ссылки извлекаются в следующем формате:

```javascript
{
  url: "https://example.com/link",
  text: "Текст ссылки",
  selector: "a[href]",
  elementType: "a",
  className: "link-class",
  id: "link-id",
  title: "Заголовок ссылки",
  position: {
    x: 100,
    y: 200,
    width: 150,
    height: 30
  }
}
```

## Интеграция с бэкендом

Расширение отправляет данные на эндпоинт `/api/links` в формате:

```javascript
{
  links: [...], // Массив найденных ссылок
  pageUrl: "https://example.com/page",
  timestamp: "2024-01-01T12:00:00.000Z"
}
```

## Разработка

### Добавление новых функций

1. Измените `manifest.json` для новых разрешений
2. Обновите `popup.html` для нового UI
3. Добавьте логику в `popup.js`
4. При необходимости обновите `content.js` для работы со страницей

### Отладка

1. Откройте DevTools для popup: правый клик на иконке → "Inspect popup"
2. Для content script: DevTools страницы → Console
3. Для background script: chrome://extensions → "background page"

## Лицензия

MIT License

## Поддержка

При возникновении проблем создайте issue в репозитории проекта.
