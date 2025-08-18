// Background Script для браузерного расширения Course Parser
// Этот скрипт работает в фоновом режиме

console.log('Course Parser Extension: Background script загружен');

// Обработка установки расширения
chrome.runtime.onInstalled.addListener((details) => {
    console.log('Расширение установлено:', details);
    
    if (details.reason === 'install') {
        // Первоначальная настройка при установке
        chrome.storage.sync.set({
            backendUrl: 'http://localhost:8000',
            selectors: 'a[href], .video-link, .download-btn, video source, source[src]',
            autoExtract: false,
            notifications: true
        });
        
        // Открываем страницу с инструкциями
        chrome.tabs.create({
            url: chrome.runtime.getURL('welcome.html')
        });
    }
});

// Обработка сообщений от popup и content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background получил сообщение:', request);
    
    switch (request.action) {
        case 'getSettings':
            chrome.storage.sync.get(null, (settings) => {
                sendResponse({ success: true, settings: settings });
            });
            break;
            
        case 'saveSettings':
            chrome.storage.sync.set(request.settings, () => {
                sendResponse({ success: true });
            });
            break;
            
        case 'extractFromTab':
            extractFromTab(request.tabId, request.selectors)
                .then(result => sendResponse({ success: true, result: result }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            break;
            
        case 'sendToBackend':
            sendToBackend(request.data)
                .then(result => sendResponse({ success: true, result: result }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            break;
            
        default:
            sendResponse({ success: false, error: 'Неизвестное действие' });
    }
    
    return true; // Для асинхронных ответов
});

// Функция извлечения данных из вкладки
async function extractFromTab(tabId, selectors) {
    try {
        const result = await chrome.scripting.executeScript({
            target: { tabId: tabId },
            function: (selectors) => {
                // Эта функция выполняется в контексте страницы
                return window.courseParserExtension?.extractLinksFromPage(selectors) || [];
            },
            args: [selectors]
        });
        
        return result[0]?.result || [];
    } catch (error) {
        console.error('Ошибка при извлечении из вкладки:', error);
        throw error;
    }
}

// Функция отправки данных на бэкенд
async function sendToBackend(data) {
    try {
        const settings = await chrome.storage.sync.get(['backendUrl']);
        const backendUrl = settings.backendUrl || 'http://localhost:8000';
        
        const response = await fetch(`${backendUrl}/api/links`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Ошибка при отправке на бэкенд:', error);
        throw error;
    }
}

// Обработка клика по иконке расширения
chrome.action.onClicked.addListener((tab) => {
    console.log('Клик по иконке расширения на вкладке:', tab.id);
    
    // Можно добавить логику для быстрого извлечения ссылок
    // или открытия popup программно
});

// Обработка изменения вкладок
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        console.log('Вкладка загружена:', tab.url);
        
        // Можно добавить автоматическое извлечение ссылок
        // или другие действия при загрузке страницы
    }
});

// Обработка удаления вкладок
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    console.log('Вкладка закрыта:', tabId);
    
    // Очистка данных, связанных с вкладкой
});

// Утилиты для работы с уведомлениями
function showNotification(title, message, type = 'info') {
    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: title,
        message: message
    });
}

// Утилиты для работы с контекстным меню
function createContextMenu() {
    // Проверяем, доступно ли контекстное меню
    if (chrome.contextMenus) {
        // Удаляем существующие элементы меню перед созданием новых
        chrome.contextMenus.removeAll(() => {
            chrome.contextMenus.create({
                id: 'extractLinks',
                title: 'Извлечь ссылки с этой страницы',
                contexts: ['page']
            });
            
            chrome.contextMenus.create({
                id: 'extractSelectedLinks',
                title: 'Извлечь ссылки из выделенного текста',
                contexts: ['selection']
            });
        });
    } else {
        console.warn('Context menus API недоступно');
    }
}

// Обработка кликов по контекстному меню
if (chrome.contextMenus) {
    chrome.contextMenus.onClicked.addListener((info, tab) => {
        switch (info.menuItemId) {
            case 'extractLinks':
                extractFromTab(tab.id, 'a[href]')
                    .then(links => {
                        console.log('Извлечено ссылок:', links.length);
                        showNotification('Course Parser', `Найдено ${links.length} ссылок`);
                    })
                    .catch(error => {
                        console.error('Ошибка при извлечении:', error);
                        showNotification('Course Parser', 'Ошибка при извлечении ссылок');
                    });
                break;
                
            case 'extractSelectedLinks':
                // Логика для извлечения ссылок из выделенного текста
                console.log('Выделенный текст:', info.selectionText);
                break;
        }
    });
}

// Инициализация при загрузке
createContextMenu();
