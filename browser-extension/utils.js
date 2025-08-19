import { DOM_ELEMENTS } from './config.js';

// Утилиты для работы с Chrome API
export async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  return tab;
}

export async function getCurrentPageUrl() {
  const tab = await getCurrentTab();
  return tab.url;
}

export async function executeScriptOnPage(functionToExecute, args = []) {
  const tab = await getCurrentTab();
  return await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: functionToExecute,
    args: args
  });
}

// Утилиты для работы с UI
export function setStatus(message, type = "success") {
  DOM_ELEMENTS.status.textContent = message;
  DOM_ELEMENTS.status.className = `status ${type}`;
}

export function updateUI(extractedLinks = []) {
  DOM_ELEMENTS.sendBtn.disabled = extractedLinks.length === 0;
}

// Утилиты для работы с буфером обмена
export function copyToClipboard(text) {
  return navigator.clipboard.writeText(text)
    .then(() => {
      setStatus("Скопировано в буфер обмена", "success");
      setTimeout(() => setStatus("Готов к работе", "success"), 2000);
    })
    .catch((err) => {
      console.error("Ошибка при копировании:", err);
      setStatus("Ошибка при копировании", "error");
    });
}

// Утилиты для работы с задержками
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Утилиты для работы с DOM
export function createElement(tag, className, textContent = '') {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (textContent) element.textContent = textContent;
  return element;
}

// Утилиты для валидации
export function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

export function sanitizeText(text) {
  return text ? text.trim() : '';
}

// Утилиты для логирования
export function log(message, data = null) {
  console.log(`[Course Parser] ${message}`, data || '');
}

export function logError(message, error = null) {
  console.error(`[Course Parser] ${message}`, error || '');
}

// Утилиты для работы с данными
export function removeDuplicates(array, key = 'url') {
  return array.filter((item, index, self) => 
    index === self.findIndex(t => t[key] === item[key])
  );
}

export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Утилиты для работы с датами
export function formatDate(date) {
  return new Date(date).toLocaleString();
}

export function getTimestamp() {
  return new Date().toISOString();
}

// Утилиты для работы с микросервисом
export async function sendCourseToMicroservice(courseData, microserviceUrl) {
  try {
    console.log(`Отправляем данные курса на микросервис: ${microserviceUrl}`);
    
    const response = await fetch(`${microserviceUrl}/api/course`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(courseData)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('Ответ от микросервиса:', result);
    
    return {
      success: true,
      data: result
    };
  } catch (error) {
    console.error('Ошибка при отправке данных на микросервис:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
