import { DOM_ELEMENTS, CONFIG } from './config.js';
import { setStatus } from './utils.js';
import { exportCourseData, clearCourseData } from './storage.js';

// Отображение версии в UI
export function displayVersion() {
  const versionElement = document.getElementById('version');
  if (versionElement) {
    const buildDate = new Date(CONFIG.BUILD_DATE).toLocaleString();
    versionElement.innerHTML = `
      <div style="font-size: 10px; color: #7f8c8d; text-align: center; padding: 5px;">
        v${CONFIG.VERSION} | ${buildDate}
      </div>
    `;
  }
  
  // Также выводим в консоль для отладки
  console.log(`[Course Parser] Version: ${CONFIG.VERSION} | Build: ${CONFIG.BUILD_DATE}`);
}



// Обновление отображения курса
export function updateCourseDisplay(courseData) {
  if (!courseData || !courseData.sections) {
    DOM_ELEMENTS.courseContainer.innerHTML =
      '<div class="no-course">Курс не извлечен</div>';
    return;
  }

  const sectionsHtml = courseData.sections
    .map((section) => {
      const itemsHtml = section.items
        .map((item) => `<div style="margin-left: 10px;">• ${item.title}</div>`)
        .join("");

      return `
            <div style="margin-bottom: 8px;">
                <strong>${section.title}</strong> (${section.items.length} элементов)
                ${itemsHtml}
            </div>
        `;
    })
    .join("");

  DOM_ELEMENTS.courseContainer.innerHTML = `
        <div class="course-progress">
            <strong>${courseData.title}</strong><br>
            Всего секций: ${courseData.sections.length}<br>
            Всего элементов: ${courseData.sections.reduce(
              (sum, section) => sum + section.items.length,
              0
            )}
        </div>
        <div class="course-structure">
            ${sectionsHtml}
        </div>
        <div class="course-actions">
            <button class="course-btn" onclick="exportCourseData()">Экспорт</button>
            <button class="course-btn" onclick="clearCourseData()">Очистить</button>
        </div>
    `;
}

// Экспорт данных курса
export function handleExportCourseData() {
  const currentUrl = window.location.href;
  if (exportCourseData(currentUrl)) {
    setStatus("Курс экспортирован", "success");
  } else {
    setStatus("Данные курса не найдены", "error");
  }
}

// Очистка данных курса
export function handleClearCourseData() {
  const currentUrl = window.location.href;
  if (clearCourseData(currentUrl)) {
    updateCourseDisplay(null);
    setStatus("Данные курса очищены", "success");
  } else {
    setStatus("Ошибка при очистке", "error");
  }
}

// Настройка обработчиков событий
export function setupEventListeners() {
  DOM_ELEMENTS.courseBtn.addEventListener("click", () => {
    import('./courseExtractor.js').then(module => {
      module.handleCourse();
    });
  });

  DOM_ELEMENTS.maxSectionsInput.addEventListener("change", () => {
    import('./config.js').then(module => {
      module.saveSettings();
    });
  });

  DOM_ELEMENTS.microserviceUrlInput.addEventListener("change", () => {
    import('./config.js').then(module => {
      module.saveSettings();
    });
  });
}

// Глобальные функции для вызова из HTML
window.exportCourseData = handleExportCourseData;
window.clearCourseData = handleClearCourseData;
