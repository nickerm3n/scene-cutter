import { DOM_ELEMENTS, CONFIG } from './config.js';
import { setStatus, copyToClipboard, updateUI } from './utils.js';
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

// Обновление списка ссылок в UI
export function updateLinksList(extractedLinks = []) {
  if (extractedLinks.length === 0) {
    DOM_ELEMENTS.linksList.innerHTML = '<div class="no-links">Ссылки не найдены</div>';
    return;
  }

  DOM_ELEMENTS.linksList.innerHTML = extractedLinks
  .map(
    (link, index) => `
      <div class="link-item">
          <div class="link-text" title="${link.url}">
              <strong>${link.text || "Без текста"}</strong><br>
              <small>${link.url}</small><br>
              <small style="color: #7f8c8d;">Тип: ${
                link.elementType
              } | Селектор: ${link.selector}</small>
          </div>
          <div class="link-actions">
              <button class="link-btn" onclick="copyToClipboard('${
                link.url
              }')">Копировать</button>
              <button class="link-btn" onclick="removeLink(${index})">Удалить</button>
          </div>
      </div>
  `
  )
  .join("");
}

// Удаление ссылки из списка
export function removeLink(index) {
  import('./config.js').then(module => {
    const { extractedLinks } = module;
    extractedLinks.splice(index, 1);
    updateLinksList(extractedLinks);
    updateUI(extractedLinks);
    setStatus(`Удалена ссылка. Осталось: ${extractedLinks.length}`, "success");
  });
}

// Обновление отображения транскрипта
export function updateTranscriptDisplay(transcript) {
  if (!transcript || !transcript.text) {
    DOM_ELEMENTS.transcriptContainer.innerHTML =
      '<div class="no-transcript">Транскрипт не найден</div>';
    return;
  }

  DOM_ELEMENTS.transcriptContainer.innerHTML = `
        <div class="transcript-text">${transcript.text}</div>
        <div class="transcript-actions">
            <button class="transcript-btn" onclick="copyTranscriptToClipboard()">Копировать</button>
            <button class="transcript-btn" onclick="clearTranscript()">Очистить</button>
        </div>
    `;
}

// Копирование транскрипта в буфер обмена
export function copyTranscriptToClipboard() {
  const transcriptText = document.querySelector(".transcript-text");
  if (transcriptText) {
    navigator.clipboard
      .writeText(transcriptText.textContent)
      .then(() => {
        setStatus("Транскрипт скопирован", "success");
        setTimeout(() => setStatus("Готов к работе", "success"), 2000);
      })
      .catch((err) => {
        console.error("Ошибка при копировании транскрипта:", err);
        setStatus("Ошибка при копировании", "error");
      });
  }
}

// Очистка транскрипта
export function clearTranscript() {
  updateTranscriptDisplay(null);
  setStatus("Транскрипт очищен", "success");
  setTimeout(() => setStatus("Готов к работе", "success"), 2000);
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
  DOM_ELEMENTS.extractBtn.addEventListener("click", () => {
    // Импортируем функцию из linkExtractor.js
    import('./linkExtractor.js').then(module => {
      module.handleExtract();
    });
  });

  DOM_ELEMENTS.transcriptBtn.addEventListener("click", () => {
    import('./transcriptExtractor.js').then(module => {
      module.handleTranscript();
    });
  });

  DOM_ELEMENTS.courseBtn.addEventListener("click", () => {
    import('./courseExtractor.js').then(module => {
      module.handleCourse();
    });
  });

  DOM_ELEMENTS.processItemBtn.addEventListener("click", () => {
    import('./transcriptExtractor.js').then(module => {
      module.handleProcessItem();
    });
  });

  DOM_ELEMENTS.sendBtn.addEventListener("click", () => {
    import('./linkExtractor.js').then(module => {
      module.handleSend();
    });
  });

  DOM_ELEMENTS.backendUrlInput.addEventListener("change", () => {
    import('./config.js').then(module => {
      module.saveSettings();
    });
  });

  DOM_ELEMENTS.selectorsInput.addEventListener("change", () => {
    import('./config.js').then(module => {
      module.saveSettings();
    });
  });
}

// Глобальные функции для вызова из HTML
window.copyToClipboard = copyToClipboard;
window.removeLink = removeLink;
window.copyTranscriptToClipboard = copyTranscriptToClipboard;
window.clearTranscript = clearTranscript;
window.exportCourseData = handleExportCourseData;
window.clearCourseData = handleClearCourseData;
