// Конфигурация приложения
export const CONFIG = {
  VERSION: "1.0.0",
  BUILD_DATE: new Date().toISOString(),
  DEFAULT_BACKEND_URL: "http://localhost:8000",
  DEFAULT_SELECTORS: "a[href], .video-link, .download-btn, video source, source[src]",
  SELECTORS: {
    TRANSCRIPT_BUTTON: 'button[data-purpose="transcript-toggle"]',
    TRANSCRIPT_PANEL: '[class*="transcript--transcript-panel"]',
    CUE_TEXT: '[data-purpose="cue-text"]',
    COURSE_CONTENT_BUTTON: '//span[text()="Course content"]',
    SECTION_PANELS: '[data-purpose^="section-panel-"]',
    CURRICULUM_ITEMS: '[data-purpose^="curriculum-item-"]',
    ITEM_TITLE: '[data-purpose="item-title"]'
  },
  DELAYS: {
    TRANSCRIPT_LOAD: 2000,
    COURSE_CONTENT_LOAD: 2000,
    ITEM_PROCESS: 3000,
    SECTION_EXPAND: 1000
  }
};

// Глобальные переменные состояния
export let extractedLinks = [];
export let currentSettings = {
  backendUrl: CONFIG.DEFAULT_BACKEND_URL,
  selectors: CONFIG.DEFAULT_SELECTORS,
};

// DOM элементы
export const DOM_ELEMENTS = {
  status: document.getElementById("status"),
  extractBtn: document.getElementById("extractBtn"),
  transcriptBtn: document.getElementById("transcriptBtn"),
  courseBtn: document.getElementById("courseBtn"),
  processItemBtn: document.getElementById("processItemBtn"),
  sendBtn: document.getElementById("sendBtn"),
  linksList: document.getElementById("linksList"),
  transcriptContainer: document.getElementById("transcriptContainer"),
  courseContainer: document.getElementById("courseContainer"),
  backendUrlInput: document.getElementById("backendUrl"),
  selectorsInput: document.getElementById("selectors")
};

// Функции для работы с настройками
export function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["backendUrl", "selectors"], (result) => {
      if (result.backendUrl) currentSettings.backendUrl = result.backendUrl;
      if (result.selectors) currentSettings.selectors = result.selectors;
      resolve();
    });
  });
}

export function saveSettings() {
  currentSettings.backendUrl = DOM_ELEMENTS.backendUrlInput.value;
  currentSettings.selectors = DOM_ELEMENTS.selectorsInput.value;

  chrome.storage.sync.set({
    backendUrl: currentSettings.backendUrl,
    selectors: currentSettings.selectors,
  });
}

export function updateSettingsUI() {
  DOM_ELEMENTS.backendUrlInput.value = currentSettings.backendUrl;
  DOM_ELEMENTS.selectorsInput.value = currentSettings.selectors;
}
