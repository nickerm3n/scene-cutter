// Content Script для браузерного расширения Course Parser
// Этот скрипт выполняется в контексте веб-страницы

console.log('Course Parser Extension: Content script загружен');

// Слушаем сообщения от popup или background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Получено сообщение:', request);
    
    switch (request.action) {
        case 'extractLinks':
            const links = extractLinksFromPage(request.selectors);
            sendResponse({ success: true, links: links });
            break;
            
        case 'highlightElements':
            highlightElements(request.selectors);
            sendResponse({ success: true });
            break;
            
        case 'removeHighlights':
            removeHighlights();
            sendResponse({ success: true });
            break;
            
        default:
            sendResponse({ success: false, error: 'Неизвестное действие' });
    }
    
    return true; // Важно для асинхронных ответов
});

// Функция извлечения ссылок со страницы
function extractLinksFromPage(selectors) {
    const links = [];
    const selectorList = selectors ? selectors.split(',').map(s => s.trim()) : ['a[href]'];
    
    console.log('Извлечение ссылок с селекторами:', selectorList);
    
    selectorList.forEach(selector => {
        try {
            const elements = document.querySelectorAll(selector);
            console.log(`Найдено ${elements.length} элементов для селектора "${selector}"`);
            
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
                                position: getElementPosition(source),
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
                        title: element.title || element.getAttribute('title') || '',
                        position: getElementPosition(element)
                    };
                    
                    links.push(linkInfo);
                }
            });
        } catch (error) {
            console.warn(`Ошибка при обработке селектора "${selector}":`, error);
        }
    });
    
    // Удаляем дубликаты по URL
    const uniqueLinks = links.filter((link, index, self) => 
        index === self.findIndex(l => l.url === link.url)
    );
    
    console.log(`Извлечено ${uniqueLinks.length} уникальных ссылок`);
    return uniqueLinks;
}

// Функция подсветки элементов на странице
function highlightElements(selectors) {
    removeHighlights(); // Удаляем предыдущие подсветки
    
    const selectorList = selectors ? selectors.split(',').map(s => s.trim()) : ['a[href]'];
    
    selectorList.forEach(selector => {
        try {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                element.style.outline = '2px solid #3498db';
                element.style.outlineOffset = '2px';
                element.style.backgroundColor = 'rgba(52, 152, 219, 0.1)';
                element.classList.add('course-parser-highlighted');
            });
        } catch (error) {
            console.warn(`Ошибка при подсветке селектора "${selector}":`, error);
        }
    });
}

// Функция удаления подсветки
function removeHighlights() {
    const highlightedElements = document.querySelectorAll('.course-parser-highlighted');
    highlightedElements.forEach(element => {
        element.style.outline = '';
        element.style.outlineOffset = '';
        element.style.backgroundColor = '';
        element.classList.remove('course-parser-highlighted');
    });
}

// Функция получения позиции элемента
function getElementPosition(element) {
    const rect = element.getBoundingClientRect();
    return {
        x: rect.left + window.scrollX,
        y: rect.top + window.scrollY,
        width: rect.width,
        height: rect.height
    };
}

// Дополнительные утилиты для работы с DOM
function getElementInfo(element) {
    return {
        tagName: element.tagName.toLowerCase(),
        className: element.className || '',
        id: element.id || '',
        textContent: element.textContent?.trim() || '',
        href: element.href || element.getAttribute('href') || '',
        src: element.src || element.getAttribute('src') || '',
        title: element.title || element.getAttribute('title') || '',
        alt: element.alt || element.getAttribute('alt') || '',
        dataAttributes: getDataAttributes(element)
    };
}

// Получение data-атрибутов элемента
function getDataAttributes(element) {
    const dataAttrs = {};
    for (let attr of element.attributes) {
        if (attr.name.startsWith('data-')) {
            dataAttrs[attr.name] = attr.value;
        }
    }
    return dataAttrs;
}

// Функция для поиска элементов по тексту
function findElementsByText(searchText, selector = '*') {
    const elements = document.querySelectorAll(selector);
    const matches = [];
    
    elements.forEach(element => {
        const text = element.textContent?.trim() || '';
        if (text.toLowerCase().includes(searchText.toLowerCase())) {
            matches.push(element);
        }
    });
    
    return matches;
}

// Экспорт функций для использования в popup
window.courseParserExtension = {
    extractLinksFromPage,
    highlightElements,
    removeHighlights,
    getElementInfo,
    findElementsByText
};
