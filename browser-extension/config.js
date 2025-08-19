// Конфигурация приложения
export const CONFIG = {
  VERSION: "1.0.0",
  BUILD_DATE: new Date().toISOString(),
  SELECTORS: {
    COURSE_CONTENT_BUTTON: '//span[text()="Course content"]',
    SECTION_PANELS: '[data-purpose^="section-panel-"]',
    CURRICULUM_ITEMS: '[data-purpose^="curriculum-item-"]',
    ITEM_TITLE: '[data-purpose="item-title"]'
  },
  DELAYS: {
    COURSE_CONTENT_LOAD: 2000,
    ITEM_PROCESS: 3000,
    SECTION_EXPAND: 1000
  }
};

// Глобальные переменные состояния
export let currentSettings = {
  maxSections: 1,
  microserviceUrl: 'http://localhost:8005',
};

// DOM элементы
export const DOM_ELEMENTS = {
  status: document.getElementById("status"),
  courseBtn: document.getElementById("courseBtn"),
  courseContainer: document.getElementById("courseContainer"),
  maxSectionsInput: document.getElementById("maxSections"),
  microserviceUrlInput: document.getElementById("microserviceUrl")
};

// Функции для работы с настройками
export function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["maxSections", "microserviceUrl"], (result) => {
      if (result.maxSections !== undefined) currentSettings.maxSections = result.maxSections;
      if (result.microserviceUrl !== undefined) currentSettings.microserviceUrl = result.microserviceUrl;
      resolve();
    });
  });
}

export function saveSettings() {
  currentSettings.maxSections = parseInt(DOM_ELEMENTS.maxSectionsInput.value) || 1;
  currentSettings.microserviceUrl = DOM_ELEMENTS.microserviceUrlInput.value || 'http://localhost:8005';

  chrome.storage.sync.set({
    maxSections: currentSettings.maxSections,
    microserviceUrl: currentSettings.microserviceUrl,
  });
}

export function updateSettingsUI() {
  DOM_ELEMENTS.maxSectionsInput.value = currentSettings.maxSections;
  DOM_ELEMENTS.microserviceUrlInput.value = currentSettings.microserviceUrl;
}
