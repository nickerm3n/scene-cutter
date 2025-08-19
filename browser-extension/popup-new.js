// Основной файл приложения - точка входа
import { 
  loadSettings, 
  updateSettingsUI, 
  DOM_ELEMENTS 
} from './config.js';
import { updateUI } from './utils.js';
import { setupEventListeners, displayVersion } from './ui.js';

// Инициализация приложения
async function initializeApp() {
  try {
    // Загружаем настройки
    await loadSettings();
    
    // Отображаем версию
    displayVersion();
    
    // Настраиваем обработчики событий
    setupEventListeners();
    
    // Обновляем UI
    updateSettingsUI();
    
    console.log('[Course Parser] Приложение инициализировано');
  } catch (error) {
    console.error('[Course Parser] Ошибка при инициализации:', error);
  }
}

// Запускаем приложение после загрузки DOM
document.addEventListener("DOMContentLoaded", initializeApp);

// Экспортируем функции для глобального доступа (если нужно)
window.initializeApp = initializeApp;
