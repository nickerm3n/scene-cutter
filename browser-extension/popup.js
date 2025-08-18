// Глобальные переменные
let extractedLinks = [];
let currentSettings = {
    backendUrl: 'http://localhost:8000',
    selectors: 'a[href], .video-link, .download-btn, video source, source[src]'
};

// DOM элементы
const statusEl = document.getElementById('status');
const extractBtn = document.getElementById('extractBtn');
const sendBtn = document.getElementById('sendBtn');
const linksListEl = document.getElementById('linksList');
const backendUrlInput = document.getElementById('backendUrl');
const selectorsInput = document.getElementById('selectors');

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    loadSettings();
    setupEventListeners();
    updateUI();
});

// Настройка обработчиков событий
function setupEventListeners() {
    extractBtn.addEventListener('click', handleExtract);
    sendBtn.addEventListener('click', handleSend);
    
    backendUrlInput.addEventListener('change', saveSettings);
    selectorsInput.addEventListener('change', saveSettings);
}

// Обработка извлечения ссылок
async function handleExtract() {
    try {
        setStatus('Извлечение ссылок...', 'loading');
        
        // Получаем активную вкладку
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // Выполняем скрипт на странице для извлечения ссылок
        const result = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: extractLinksFromPage,
            args: [currentSettings.selectors]
        });
        
        if (result && result[0] && result[0].result) {
            extractedLinks = result[0].result;
            console.log('Результат извлечения:', extractedLinks);
            setStatus(`Найдено ${extractedLinks.length} ссылок`, 'success');
            updateLinksList();
            sendBtn.disabled = extractedLinks.length === 0;
        } else {
            console.error('Неожиданный результат:', result);
            throw new Error('Не удалось извлечь ссылки');
        }
        
    } catch (error) {
        console.error('Ошибка при извлечении ссылок:', error);
        setStatus('Ошибка при извлечении ссылок', 'error');
    }
}

// Обработка отправки на сервер
async function handleSend() {
    if (extractedLinks.length === 0) {
        setStatus('Нет ссылок для отправки', 'error');
        return;
    }
    
    // Временно отключаем отправку на сервер для отладки
    setStatus('Отправка отключена (режим отладки)', 'loading');
    
    // Выводим найденные ссылки в консоль для отладки
    console.log('=== НАЙДЕННЫЕ ССЫЛКИ ===');
    console.log('Всего ссылок:', extractedLinks.length);
    extractedLinks.forEach((link, index) => {
        console.log(`Ссылка ${index + 1}:`, {
            url: link.url,
            text: link.text,
            elementType: link.elementType,
            selector: link.selector,
            className: link.className,
            id: link.id
        });
    });
    console.log('========================');
    
    // Показываем уведомление вместо отправки
    setTimeout(() => {
        setStatus(`Найдено ${extractedLinks.length} ссылок (отправка отключена)`, 'success');
    }, 1000);
    
    /* Раскомментировать для включения отправки на сервер:
    try {
        setStatus('Отправка на сервер...', 'loading');
        
        const response = await fetch(`${currentSettings.backendUrl}/api/links`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                links: extractedLinks,
                pageUrl: await getCurrentPageUrl(),
                timestamp: new Date().toISOString()
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            setStatus('Ссылки успешно отправлены', 'success');
            console.log('Ответ сервера:', result);
        } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
    } catch (error) {
        console.error('Ошибка при отправке на сервер:', error);
        setStatus('Ошибка при отправке на сервер', 'error');
    }
    */
}

// Функция для извлечения ссылок со страницы (выполняется в контексте страницы)
function extractLinksFromPage(selectors) {
    const links = [];
    const selectorList = selectors.split(',').map(s => s.trim());
    
    selectorList.forEach(selector => {
        try {
            const elements = document.querySelectorAll(selector);
            console.log('elements', elements);
            elements.forEach(element => {
                let url = null;
                let text = '';
                
                // Обрабатываем разные типы элементов
                if (element.tagName.toLowerCase() === 'source') {
                    url = element.src || element.getAttribute('src');
                    text = 'Video Source';
                } else if (element.tagName.toLowerCase() === 'video') {
                    // Для video элементов ищем source внутри
                    const sources = element.querySelectorAll('source');
                    sources.forEach(source => {
                        const sourceUrl = source.src || source.getAttribute('src');
                        if (sourceUrl && sourceUrl.trim()) {
                            links.push({
                                url: sourceUrl,
                                text: 'Video Source',
                                selector: selector,
                                elementType: 'source',
                                className: source.className || '',
                                id: source.id || '',
                                title: source.title || source.getAttribute('title') || '',
                                parentVideo: {
                                    className: element.className || '',
                                    id: element.id || ''
                                }
                            });
                        }
                    });
                    return; // Пропускаем добавление самого video элемента
                } else {
                    // Для обычных ссылок
                    url = element.href || element.getAttribute('href');
                    text = element.textContent?.trim() || '';
                }
                
                if (url && url.trim()) {
                    const linkInfo = {
                        url: url,
                        text: text,
                        selector: selector,
                        elementType: element.tagName.toLowerCase(),
                        className: element.className || '',
                        id: element.id || '',
                        title: element.title || element.getAttribute('title') || ''
                    };
                    
                    links.push(linkInfo);
                }
            });
        } catch (error) {
            console.warn(`Ошибка при обработке селектора "${selector}":`, error);
        }
    });
    
    // Удаляем дубликаты
    const uniqueLinks = links.filter((link, index, self) => 
        index === self.findIndex(l => l.url === link.url)
    );
    
    console.log('Извлеченные ссылки:', uniqueLinks);
    return uniqueLinks;
}

// Обновление списка ссылок в UI
function updateLinksList() {
    if (extractedLinks.length === 0) {
        linksListEl.innerHTML = '<div class="no-links">Ссылки не найдены</div>';
        return;
    }
    
    linksListEl.innerHTML = extractedLinks.map((link, index) => `
        <div class="link-item">
            <div class="link-text" title="${link.url}">
                <strong>${link.text || 'Без текста'}</strong><br>
                <small>${link.url}</small><br>
                <small style="color: #7f8c8d;">Тип: ${link.elementType} | Селектор: ${link.selector}</small>
            </div>
            <div class="link-actions">
                <button class="link-btn" onclick="copyToClipboard('${link.url}')">Копировать</button>
                <button class="link-btn" onclick="removeLink(${index})">Удалить</button>
            </div>
        </div>
    `).join('');
}

// Копирование ссылки в буфер обмена
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        setStatus('Ссылка скопирована', 'success');
        setTimeout(() => setStatus('Готов к работе', 'success'), 2000);
    }).catch(err => {
        console.error('Ошибка при копировании:', err);
        setStatus('Ошибка при копировании', 'error');
    });
}

// Удаление ссылки из списка
function removeLink(index) {
    extractedLinks.splice(index, 1);
    updateLinksList();
    sendBtn.disabled = extractedLinks.length === 0;
    setStatus(`Удалена ссылка. Осталось: ${extractedLinks.length}`, 'success');
}

// Получение URL текущей страницы
async function getCurrentPageUrl() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab.url;
}

// Установка статуса
function setStatus(message, type = 'success') {
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
}

// Обновление UI
function updateUI() {
    backendUrlInput.value = currentSettings.backendUrl;
    selectorsInput.value = currentSettings.selectors;
    sendBtn.disabled = extractedLinks.length === 0;
}

// Загрузка настроек
function loadSettings() {
    chrome.storage.sync.get(['backendUrl', 'selectors'], (result) => {
        if (result.backendUrl) currentSettings.backendUrl = result.backendUrl;
        if (result.selectors) currentSettings.selectors = result.selectors;
        updateUI();
    });
}

// Сохранение настроек
function saveSettings() {
    currentSettings.backendUrl = backendUrlInput.value;
    currentSettings.selectors = selectorsInput.value;
    
    chrome.storage.sync.set({
        backendUrl: currentSettings.backendUrl,
        selectors: currentSettings.selectors
    });
    
    setStatus('Настройки сохранены', 'success');
    setTimeout(() => setStatus('Готов к работе', 'success'), 2000);
}
