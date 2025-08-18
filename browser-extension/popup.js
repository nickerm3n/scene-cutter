// Глобальные переменные
let extractedLinks = [];
let currentSettings = {
  backendUrl: "http://localhost:8000",
  selectors: "a[href], .video-link, .download-btn, video source, source[src]",
};

// DOM элементы
const statusEl = document.getElementById("status");
const extractBtn = document.getElementById("extractBtn");
const transcriptBtn = document.getElementById("transcriptBtn");
const courseBtn = document.getElementById("courseBtn");
const processItemBtn = document.getElementById("processItemBtn");
const sendBtn = document.getElementById("sendBtn");
const linksListEl = document.getElementById("linksList");
const transcriptContainerEl = document.getElementById("transcriptContainer");
const courseContainerEl = document.getElementById("courseContainer");
const backendUrlInput = document.getElementById("backendUrl");
const selectorsInput = document.getElementById("selectors");

// Инициализация
document.addEventListener("DOMContentLoaded", function () {
  loadSettings();
  setupEventListeners();
  updateUI();
});

// Настройка обработчиков событий
function setupEventListeners() {
  extractBtn.addEventListener("click", handleExtract);
  transcriptBtn.addEventListener("click", handleTranscript);
  courseBtn.addEventListener("click", handleCourse);
  processItemBtn.addEventListener("click", handleProcessItem);
  sendBtn.addEventListener("click", handleSend);

  backendUrlInput.addEventListener("change", saveSettings);
  selectorsInput.addEventListener("change", saveSettings);
}

// Обработка извлечения ссылок
async function handleExtract() {
  try {
    setStatus("Извлечение ссылок...", "loading");

    // Получаем активную вкладку
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    // Выполняем скрипт на странице для извлечения ссылок
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: extractLinksFromPage,
      args: [currentSettings.selectors],
    });

    if (result && result[0] && result[0].result) {
      extractedLinks = result[0].result;
      console.log("Результат извлечения:", extractedLinks);
      setStatus(`Найдено ${extractedLinks.length} ссылок`, "success");
      updateLinksList();
      sendBtn.disabled = extractedLinks.length === 0;
    } else {
      console.error("Неожиданный результат:", result);
      throw new Error("Не удалось извлечь ссылки");
    }
  } catch (error) {
    console.error("Ошибка при извлечении ссылок:", error);
    setStatus("Ошибка при извлечении ссылок", "error");
  }
}

// Обработка отправки на сервер
async function handleSend() {
  if (extractedLinks.length === 0) {
    setStatus("Нет ссылок для отправки", "error");
    return;
  }

  // Временно отключаем отправку на сервер для отладки
  setStatus("Отправка отключена (режим отладки)", "loading");

  // Выводим найденные ссылки в консоль для отладки
  console.log("=== НАЙДЕННЫЕ ССЫЛКИ ===");
  console.log("Всего ссылок:", extractedLinks.length);
  extractedLinks.forEach((link, index) => {
    console.log(`Ссылка ${index + 1}:`, {
      url: link.url,
      text: link.text,
      elementType: link.elementType,
      selector: link.selector,
      className: link.className,
      id: link.id,
    });
  });
  console.log("========================");

  // Показываем уведомление вместо отправки
  setTimeout(() => {
    setStatus(
      `Найдено ${extractedLinks.length} ссылок (отправка отключена)`,
      "success"
    );
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
  const selectorList = selectors.split(",").map((s) => s.trim());

  selectorList.forEach((selector) => {
    try {
      const elements = document.querySelectorAll(selector);
      console.log("elements", elements);
      elements.forEach((element) => {
        let url = null;
        let text = "";

        // Обрабатываем разные типы элементов
        if (element.tagName.toLowerCase() === "source") {
          url = element.src || element.getAttribute("src");
          text = "Video Source";
        } else if (element.tagName.toLowerCase() === "video") {
          // Для video элементов ищем source внутри
          const sources = element.querySelectorAll("source");
          sources.forEach((source) => {
            const sourceUrl = source.src || source.getAttribute("src");
            if (sourceUrl && sourceUrl.trim()) {
              links.push({
                url: sourceUrl,
                text: "Video Source",
                selector: selector,
                elementType: "source",
                className: source.className || "",
                id: source.id || "",
                title: source.title || source.getAttribute("title") || "",
                parentVideo: {
                  className: element.className || "",
                  id: element.id || "",
                },
              });
            }
          });
          return; // Пропускаем добавление самого video элемента
        } else {
          // Для обычных ссылок
          url = element.href || element.getAttribute("href");
          text = element.textContent?.trim() || "";
        }

        if (url && url.trim()) {
          const linkInfo = {
            url: url,
            text: text,
            selector: selector,
            elementType: element.tagName.toLowerCase(),
            className: element.className || "",
            id: element.id || "",
            title: element.title || element.getAttribute("title") || "",
          };

          links.push(linkInfo);
        }
      });
    } catch (error) {
      console.warn(`Ошибка при обработке селектора "${selector}":`, error);
    }
  });

  // Удаляем дубликаты
  const uniqueLinks = links.filter(
    (link, index, self) => index === self.findIndex((l) => l.url === link.url)
  );

  console.log("Извлеченные ссылки:", uniqueLinks);
  return uniqueLinks;
}

// Обработка извлечения транскрипта
async function handleTranscript() {
  try {
    setStatus("Извлечение транскрипта...", "loading");

    // Получаем активную вкладку
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    // Сначала кликаем по кнопке транскрипта
    const clickResult = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: clickTranscriptButton,
    });

    if (
      clickResult &&
      clickResult[0] &&
      clickResult[0].result &&
      clickResult[0].result.success
    ) {
      // Ждем немного, чтобы панель появилась
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Теперь извлекаем текст
      const extractResult = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: extractTranscriptText,
      });

      if (extractResult && extractResult[0] && extractResult[0].result) {
        const transcript = extractResult[0].result;
        console.log("Извлеченный транскрипт:", transcript);

        if (transcript.text) {
          setStatus(
            `Транскрипт извлечен (${transcript.text.length} символов)`,
            "success"
          );
          updateTranscriptDisplay(transcript);
        } else {
          setStatus("Транскрипт не найден", "error");
          updateTranscriptDisplay(null);
        }
      } else {
        throw new Error("Не удалось извлечь текст транскрипта");
      }
    } else {
      throw new Error("Не удалось открыть транскрипт");
    }
  } catch (error) {
    console.error("Ошибка при извлечении транскрипта:", error);
    setStatus("Ошибка при извлечении транскрипта", "error");
  }
}

// Функция для клика по кнопке транскрипта (выполняется в контексте страницы)
function clickTranscriptButton() {
  try {
    // Ищем кнопку транскрипта
    const transcriptButton = document.querySelector(
      'button[data-purpose="transcript-toggle"]'
    );

    if (!transcriptButton) {
      return { success: false, error: "Кнопка транскрипта не найдена" };
    }

    // Проверяем, открыт ли уже транскрипт
    const transcriptPanel = document.querySelector(
      '[class*="transcript--transcript-panel"]'
    );

    if (!transcriptPanel) {
      // Кликаем по кнопке, чтобы открыть транскрипт
      transcriptButton.click();
      return { success: true, message: "Клик выполнен" };
    } else {
      return { success: true, message: "Транскрипт уже открыт" };
    }
  } catch (error) {
    console.error("Ошибка при клике по кнопке транскрипта:", error);
    return { success: false, error: error.message };
  }
}

// Функция для извлечения текста транскрипта (выполняется в контексте страницы)
function extractTranscriptText() {
  // Функция для извлечения текста из панели транскрипта
  function extractTextFromTranscript(panel) {
    // Ищем элементы с текстом транскрипта (несколько возможных селекторов)
    const cueElements = panel.querySelectorAll(
      '[data-purpose="cue-text"], [class*="cue-text"], span[class*="cue"]'
    );
    const textParts = [];

    console.log("Найдено элементов транскрипта:", cueElements.length);

    cueElements.forEach((cue, index) => {
      const text = cue.textContent?.trim();
      if (text) {
        textParts.push(`${index + 1}. ${text}`);
        console.log(`Фраза ${index + 1}:`, text);
      }
    });

    const result = textParts.join("\n\n");
    console.log("Итоговый транскрипт:", result);
    return result;
  }

  // Функция для обработки одного элемента курса (выполняется в контексте страницы)
  function processCourseItem(itemData) {
    try {
      console.log(`Обрабатываем элемент: ${itemData.title}`);

      // 1. Находим элемент по data-purpose
      const itemElement = document.querySelector(
        `[data-purpose="${itemData.dataPurpose}"]`
      );
      if (!itemElement) {
        console.log(`Элемент не найден: ${itemData.dataPurpose}`);
        return { success: false, error: "Элемент не найден" };
      }

      // 2. Кликаем по элементу, чтобы открыть видео
      itemElement.click();
      console.log("Клик по элементу выполнен");

      // 3. Ждем загрузки видео
      setTimeout(() => {
        // 4. Извлекаем транскрипт
        extractTranscriptForItem(itemData);
      }, 3000);

      return { success: true, message: "Элемент обработан" };
    } catch (error) {
      console.error("Ошибка при обработке элемента:", error);
      return { success: false, error: error.message };
    }
  }

  // Функция для извлечения транскрипта для конкретного элемента
  function extractTranscriptForItem(itemData) {
    try {
      console.log(`Извлекаем транскрипт для: ${itemData.title}`);

      // Ищем кнопку транскрипта
      const transcriptButton = document.querySelector(
        'button[data-purpose="transcript-toggle"]'
      );
      if (!transcriptButton) {
        console.log("Кнопка транскрипта не найдена");
        return { success: false, error: "Кнопка транскрипта не найдена" };
      }

      // Кликаем по кнопке транскрипта
      transcriptButton.click();
      console.log("Клик по кнопке транскрипта выполнен");

      // Ждем появления панели транскрипта
      setTimeout(() => {
        const transcriptPanel = document.querySelector(
          '[class*="transcript--transcript-panel"]'
        );
        if (transcriptPanel) {
          const transcriptText = extractTextFromTranscript(transcriptPanel);
          console.log(
            `Транскрипт извлечен для ${itemData.title}:`,
            transcriptText
          );

          // Обновляем данные элемента
          itemData.transcript = transcriptText;

          // Сохраняем в localStorage
          saveItemTranscript(itemData);
        } else {
          console.log("Панель транскрипта не найдена");
        }
      }, 2000);
    } catch (error) {
      console.error("Ошибка при извлечении транскрипта:", error);
    }
  }

  // Функция для извлечения текста из панели транскрипта
  function extractTextFromTranscript(panel) {
    const cueElements = panel.querySelectorAll('[data-purpose="cue-text"]');
    const textParts = [];

    cueElements.forEach((cue, index) => {
      const text = cue.textContent?.trim();
      if (text) {
        textParts.push(`${index + 1}. ${text}`);
      }
    });

    return textParts.join("\n\n");
  }

  // Функция для сохранения транскрипта элемента
  function saveItemTranscript(itemData) {
    try {
      const courseKey = `course_${window.location.href.replace(
        /[^a-zA-Z0-9]/g,
        "_"
      )}`;
      const courseData = localStorage.getItem(courseKey);

      if (courseData) {
        const course = JSON.parse(courseData);

        // Находим и обновляем элемент
        course.sections.forEach((section) => {
          section.items.forEach((item) => {
            if (item.dataPurpose === itemData.dataPurpose) {
              item.transcript = itemData.transcript;
            }
          });
        });

        // Сохраняем обновленные данные
        localStorage.setItem(courseKey, JSON.stringify(course));
        console.log("Транскрипт сохранен для элемента:", itemData.title);
      }
    } catch (error) {
      console.error("Ошибка при сохранении транскрипта:", error);
    }
  }

  try {
    // Ищем панель транскрипта
    const transcriptPanel = document.querySelector(
      '[class*="transcript--transcript-panel"]'
    );

    if (!transcriptPanel) {
      console.log("Панель транскрипта не найдена");
      // Попробуем найти альтернативными способами
      const alternativePanel = document.querySelector(
        '[class*="transcript"], [data-purpose*="transcript"]'
      );
      if (alternativePanel) {
        console.log("Найдена альтернативная панель транскрипта");
        const text = extractTextFromTranscript(alternativePanel);
        return { success: true, text: text };
      }
      return { success: false, error: "Панель транскрипта не найдена" };
    }

    console.log("Транскрипт найден, извлекаем текст...");
    const text = extractTextFromTranscript(transcriptPanel);
    return { success: true, text: text };
  } catch (error) {
    console.error("Ошибка при извлечении текста транскрипта:", error);
    return { success: false, error: error.message };
  }
}

// Обновление отображения транскрипта
function updateTranscriptDisplay(transcript) {
  if (!transcript || !transcript.text) {
    transcriptContainerEl.innerHTML =
      '<div class="no-transcript">Транскрипт не найден</div>';
    return;
  }

  transcriptContainerEl.innerHTML = `
        <div class="transcript-text">${transcript.text}</div>
        <div class="transcript-actions">
            <button class="transcript-btn" onclick="copyTranscriptToClipboard()">Копировать</button>
            <button class="transcript-btn" onclick="clearTranscript()">Очистить</button>
        </div>
    `;
}

// Копирование транскрипта в буфер обмена
function copyTranscriptToClipboard() {
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
function clearTranscript() {
  updateTranscriptDisplay(null);
  setStatus("Транскрипт очищен", "success");
  setTimeout(() => setStatus("Готов к работе", "success"), 2000);
}

// Обработка обработки элемента курса
async function handleProcessItem() {
  try {
    setStatus("Обработка элемента...", "loading");

    // Получаем активную вкладку
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    // Выполняем скрипт на странице для обработки элемента
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => {
        // Функция для обработки одного элемента курса (выполняется в контексте страницы)
        function processCourseItem() {
          try {
            console.log("Начинаем обработку элемента...");

            // Получаем первый элемент из первой секции (для тестирования)
            const firstItem = document.querySelector(
              '[data-purpose="curriculum-item-0-0"]'
            );
            let anyItem = null;

            if (!firstItem) {
              // Попробуем найти любой элемент curriculum-item
              anyItem = document.querySelector(
                '[data-purpose^="curriculum-item"]'
              );
              if (!anyItem) {
                console.log("Элементы курса не найдены");
                return { success: false, error: "Элементы курса не найдены" };
              }
              console.log(
                "Найден элемент:",
                anyItem.getAttribute("data-purpose")
              );
            }

            const targetItem = firstItem || anyItem;

            const dataPurpose = targetItem.getAttribute("data-purpose");
            const titleElement = targetItem.querySelector(
              '[data-purpose="item-title"]'
            );
            const title = titleElement
              ? titleElement.textContent.trim()
              : "Без названия";

            console.log(`Обрабатываем элемент: ${title} (${dataPurpose})`);

            // Кликаем по элементу
            targetItem.click();
            console.log("Клик по элементу выполнен");

            return { success: true, title: title, dataPurpose: dataPurpose };
          } catch (error) {
            console.error("Ошибка при обработке элемента:", error);
            return { success: false, error: error.message };
          }
        }

        return processCourseItem();
      },
    });

    if (result && result[0] && result[0].result) {
      const itemResult = result[0].result;
      console.log("Результат обработки элемента:", itemResult);

      if (itemResult.success) {
        setStatus(`Элемент обработан: ${itemResult.title}`, "success");

        // Ждем немного и извлекаем транскрипт
        setTimeout(async () => {
          await extractTranscriptForCurrentItem(tab.id, itemResult);
        }, 3000);
      } else {
        setStatus(
          "Ошибка при обработке элемента: " + itemResult.error,
          "error"
        );
      }
    } else {
      throw new Error("Не удалось обработать элемент");
    }
  } catch (error) {
    console.error("Ошибка при обработке элемента:", error);
    setStatus("Ошибка при обработке элемента", "error");
  }
}

// Функция для извлечения транскрипта текущего элемента
async function extractTranscriptForCurrentItem(tabId, itemData) {
  try {
    setStatus("Извлечение транскрипта...", "loading");

    const result = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      function: (itemData) => {
        // Функция для извлечения транскрипта для конкретного элемента
        function extractTranscriptForItem() {
          try {
            console.log(`Извлекаем транскрипт для: ${itemData.title}`);

            // Ищем кнопку транскрипта
            const transcriptButton = document.querySelector(
              'button[data-purpose="transcript-toggle"]'
            );
            if (!transcriptButton) {
              console.log("Кнопка транскрипта не найдена");
              return { success: false, error: "Кнопка транскрипта не найдена" };
            }

            // Кликаем по кнопке транскрипта
            transcriptButton.click();
            console.log("Клик по кнопке транскрипта выполнен");

            // Ждем появления панели транскрипта
            setTimeout(() => {
              const transcriptPanel = document.querySelector(
                '[class*="transcript--transcript-panel"]'
              );
              if (transcriptPanel) {
                const transcriptText =
                  extractTextFromTranscript(transcriptPanel);
                console.log(
                  `Транскрипт извлечен для ${itemData.title}:`,
                  transcriptText
                );

                // Обновляем данные элемента
                itemData.transcript = transcriptText;

                // Сохраняем в localStorage
                saveItemTranscript(itemData);
              } else {
                console.log("Панель транскрипта не найдена");
              }
            }, 2000);

            return { success: true, message: "Транскрипт извлечен" };
          } catch (error) {
            console.error("Ошибка при извлечении транскрипта:", error);
            return { success: false, error: error.message };
          }
        }

        // Функция для извлечения текста из панели транскрипта
        function extractTextFromTranscript(panel) {
          const cueElements = panel.querySelectorAll(
            '[data-purpose="cue-text"]'
          );
          const textParts = [];

          cueElements.forEach((cue, index) => {
            const text = cue.textContent?.trim();
            if (text) {
              textParts.push(`${index + 1}. ${text}`);
            }
          });

          return textParts.join("\n\n");
        }

        // Функция для сохранения транскрипта элемента
        function saveItemTranscript(itemData) {
          try {
            const courseKey = `course_${window.location.href.replace(
              /[^a-zA-Z0-9]/g,
              "_"
            )}`;
            const courseData = localStorage.getItem(courseKey);

            if (courseData) {
              const course = JSON.parse(courseData);

              // Находим и обновляем элемент
              course.sections.forEach((section) => {
                section.items.forEach((item) => {
                  if (item.dataPurpose === itemData.dataPurpose) {
                    item.transcript = itemData.transcript;
                  }
                });
              });

              // Сохраняем обновленные данные
              localStorage.setItem(courseKey, JSON.stringify(course));
              console.log("Транскрипт сохранен для элемента:", itemData.title);
            }
          } catch (error) {
            console.error("Ошибка при сохранении транскрипта:", error);
          }
        }

        return extractTranscriptForItem();
      },
      args: [itemData],
    });

    if (result && result[0] && result[0].result) {
      const transcriptResult = result[0].result;
      console.log("Результат извлечения транскрипта:", transcriptResult);

      if (transcriptResult.success) {
        setStatus(`Транскрипт извлечен для: ${itemData.title}`, "success");
      } else {
        setStatus(
          "Ошибка при извлечении транскрипта: " + transcriptResult.error,
          "error"
        );
      }
    }
  } catch (error) {
    console.error("Ошибка при извлечении транскрипта:", error);
    setStatus("Ошибка при извлечении транскрипта", "error");
  }
}

// Обновление отображения курса
function updateCourseDisplay(courseData) {
  if (!courseData || !courseData.sections) {
    courseContainerEl.innerHTML =
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

  courseContainerEl.innerHTML = `
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

// Сохранение курса в localStorage
function saveCourseToStorage(courseData) {
  try {
    const courseKey = `course_${courseData.url.replace(/[^a-zA-Z0-9]/g, "_")}`;
    localStorage.setItem(courseKey, JSON.stringify(courseData));
    console.log("Курс сохранен в localStorage:", courseKey);
  } catch (error) {
    console.error("Ошибка при сохранении курса:", error);
  }
}

// Экспорт данных курса
function exportCourseData() {
  try {
    const courseKey = `course_${window.location.href.replace(
      /[^a-zA-Z0-9]/g,
      "_"
    )}`;
    const courseData = localStorage.getItem(courseKey);

    if (courseData) {
      const dataStr =
        "data:text/json;charset=utf-8," + encodeURIComponent(courseData);
      const downloadAnchorNode = document.createElement("a");
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", "course_data.json");
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();

      setStatus("Курс экспортирован", "success");
    } else {
      setStatus("Данные курса не найдены", "error");
    }
  } catch (error) {
    console.error("Ошибка при экспорте курса:", error);
    setStatus("Ошибка при экспорте", "error");
  }
}

// Очистка данных курса
function clearCourseData() {
  try {
    const courseKey = `course_${window.location.href.replace(
      /[^a-zA-Z0-9]/g,
      "_"
    )}`;
    localStorage.removeItem(courseKey);
    updateCourseDisplay(null);
    setStatus("Данные курса очищены", "success");
  } catch (error) {
    console.error("Ошибка при очистке курса:", error);
    setStatus("Ошибка при очистке", "error");
  }
}

// Обработка извлечения курса
async function handleCourse() {
  try {
    setStatus("Извлечение курса...", "loading");

    // Получаем активную вкладку
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    // Сначала кликаем по кнопке Course content
    const clickResult = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => {
        // Функция для клика по кнопке Course content (выполняется в контексте страницы)
        function clickCourseContentButton() {
          try {
            console.log('Ищем кнопку "Course content"...');

            // Ищем кнопку через XPath
            let courseContentButton = document.evaluate(
              '//span[text()="Course content"]',
              document,
              null,
              XPathResult.FIRST_ORDERED_NODE_TYPE,
              null
            ).singleNodeValue;

            if (!courseContentButton) {
              // Попробуем альтернативный XPath
              courseContentButton = document.evaluate(
                '//span[contains(text(), "Course content")]',
                document,
                null,
                XPathResult.FIRST_ORDERED_NODE_TYPE,
                null
              ).singleNodeValue;

              if (!courseContentButton) {
                console.log('Кнопка "Course content" не найдена через XPath');
                return {
                  success: false,
                  error: 'Кнопка "Course content" не найдена',
                };
              }
            }

            console.log("Кнопка найдена через XPath:", courseContentButton);
            console.log("Текст кнопки:", courseContentButton.textContent);

            // Кликаем по кнопке
            const button = courseContentButton.closest("button");
            if (button) {
              button.click();
              console.log('Клик по кнопке "Course content" выполнен');
              return { success: true, message: "Клик выполнен" };
            } else {
              return {
                success: false,
                error: "Не удалось найти кнопку для клика",
              };
            }
          } catch (error) {
            console.error("Ошибка при клике по кнопке Course content:", error);
            return { success: false, error: error.message };
          }
        }

        return clickCourseContentButton();
      },
    });

    if (
      clickResult &&
      clickResult[0] &&
      clickResult[0].result &&
      clickResult[0].result.success
    ) {
      console.log("Клик выполнен успешно, ждем появления аккордеона...");

      // Ждем появления аккордеона
      await new Promise((resolve) => setTimeout(resolve, 2000));

      console.log("Начинаем извлечение секций...");

      // Теперь извлекаем структуру курса
      const extractResult = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => {
          // Функция для извлечения секций аккордеона (выполняется в контексте страницы)
          async function extractAccordionSections() {
            try {
              console.log("Ищем секции аккордеона...");

              // Ищем все панели аккордеона по точному селектору
              let accordionPanels = document.querySelectorAll(
                '[data-purpose^="section-panel-"]'
              );

              console.log(
                `Найдено панелей аккордеона: ${accordionPanels.length}`
              );

              if (accordionPanels.length === 0) {
                // Попробуем альтернативные селекторы
                accordionPanels = document.querySelectorAll(
                  '[data-purpose^="section-panel"]'
                );
              }

              if (accordionPanels.length === 0) {
                // Попробуем альтернативные селекторы
                accordionPanels = document.querySelectorAll(
                  '[class*="accordion-panel"]'
                );
              }

              if (accordionPanels.length === 0) {
                // Попробуем альтернативные селекторы
                accordionPanels = document.querySelectorAll(
                  '[class*="panel"], [data-purpose*="panel"]'
                );
              }

              console.log(
                "Найдено панелей аккордеона:",
                accordionPanels.length
              );

              // Выводим информацию о найденных панелях
              accordionPanels.forEach((panel, index) => {
                const dataPurpose = panel.getAttribute("data-purpose");
                console.log(`Панель ${index}: data-purpose="${dataPurpose}"`);
              });

              if (accordionPanels.length === 0) {
                return {
                  success: false,
                  error: "Панели аккордеона не найдены",
                };
              }

              const sections = [];

              for (
                let sectionIndex = 0;
                sectionIndex < accordionPanels.length;
                sectionIndex++
              ) {
                const panel = accordionPanels[sectionIndex];

                // Извлекаем название секции (несколько способов)
                let sectionTitleElement = panel.querySelector(
                  ".ud-accordion-panel-title span"
                );
                if (!sectionTitleElement) {
                  sectionTitleElement = panel.querySelector(
                    '[class*="accordion-panel-title"] span'
                  );
                }
                if (!sectionTitleElement) {
                  sectionTitleElement = panel.querySelector(
                    '[class*="panel-title"] span, [data-purpose*="title"]'
                  );
                }

                const sectionTitle = sectionTitleElement
                  ? sectionTitleElement.textContent.trim()
                  : `Section ${sectionIndex + 1}`;

                console.log(`Обрабатываем секцию: ${sectionTitle}`);

                // Проверяем, развернута ли секция
                const contentWrapper = panel.querySelector(
                  ".accordion-panel-module--content-wrapper--TkHqe"
                );
                const isExpanded =
                  contentWrapper &&
                  contentWrapper.getAttribute("aria-hidden") === "false";

                console.log(`Секция ${sectionTitle} развернута: ${isExpanded}`);

                // Если секция свернута, разворачиваем её
                if (!isExpanded) {
                  const toggleButton = panel.querySelector(".js-panel-toggler");
                  if (toggleButton) {
                    console.log(`Разворачиваем секцию: ${sectionTitle}`);
                    toggleButton.click();
                    // Ждем немного, чтобы секция развернулась
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                  }
                }

                // Ищем все элементы в секции (несколько способов)
                let items = panel.querySelectorAll(
                  '[data-purpose^="curriculum-item-"]'
                );

                console.log(
                  `В секции ${sectionIndex} найдено элементов: ${items.length}`
                );

                if (items.length === 0) {
                  items = panel.querySelectorAll(
                    '[data-purpose^="curriculum-item"]'
                  );
                }

                if (items.length === 0) {
                  items = panel.querySelectorAll('[data-purpose="item-title"]');
                }

                if (items.length === 0) {
                  items = panel.querySelectorAll(
                    '[class*="item-title"], [data-purpose*="title"]'
                  );
                }

                console.log(
                  `Найдено элементов в секции "${sectionTitle}":`,
                  items.length
                );

                // Выводим информацию о найденных элементах
                items.forEach((item, index) => {
                  const dataPurpose = item.getAttribute("data-purpose");
                  const title =
                    item
                      .querySelector('[data-purpose="item-title"]')
                      ?.textContent?.trim() || "Без названия";
                  console.log(
                    `  Элемент ${index}: data-purpose="${dataPurpose}", title="${title}"`
                  );
                });

                const sectionItems = [];

                // Обрабатываем каждый элемент в секции
                for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
                  const item = items[itemIndex];

                  // Извлекаем заголовок элемента
                  let itemTitle = "";
                  let videoLink = null;
                  let dataPurpose = item.getAttribute("data-purpose");

                  // Если это элемент curriculum-item
                  if (
                    dataPurpose &&
                    dataPurpose.startsWith("curriculum-item")
                  ) {
                    // Ищем заголовок внутри элемента
                    const titleElement = item.querySelector(
                      '[data-purpose="item-title"]'
                    );
                    if (titleElement) {
                      itemTitle = titleElement.textContent.trim();
                    } else {
                      itemTitle = item.textContent.trim();
                    }

                    console.log(
                      `Кликаем по элементу: ${itemTitle} (${dataPurpose})`
                    );

                    // Кликаем по элементу, чтобы загрузить видео
                    item.click();

                    // Ждем загрузки видео
                    await new Promise((resolve) => setTimeout(resolve, 2000));

                    // Ищем видео после клика
                    const videoElement = document.querySelector("video");
                    if (videoElement) {
                      // Ищем source внутри video
                      const sourceElement =
                        videoElement.querySelector("source");
                      if (sourceElement) {
                        videoLink =
                          sourceElement.src ||
                          sourceElement.getAttribute("src");
                        console.log(`Найдена ссылка на видео: ${videoLink}`);
                      } else {
                        // Если нет source, берем src самого video
                        videoLink =
                          videoElement.src || videoElement.getAttribute("src");
                        console.log(
                          `Найдена ссылка на видео (без source): ${videoLink}`
                        );
                      }
                    }

                    // Извлекаем транскрипт для этого элемента
                    let transcript = null;
                    try {
                      // Ищем кнопку транскрипта
                      const transcriptButton = document.querySelector(
                        'button[data-purpose="transcript-toggle"]'
                      );
                      if (transcriptButton) {
                        console.log("Кликаем по кнопке транскрипта...");
                        transcriptButton.click();

                        // Ждем появления панели транскрипта
                        await new Promise((resolve) =>
                          setTimeout(resolve, 1500)
                        );

                        // Ищем панель транскрипта
                        let transcriptPanel = document.querySelector(
                          '[class*="transcript--transcript-panel"]'
                        );

                        // Если не найдена, пробуем альтернативные селекторы
                        if (!transcriptPanel) {
                          transcriptPanel = document.querySelector(
                            '[data-purpose="transcript-panel"]'
                          );
                        }

                        if (!transcriptPanel) {
                          transcriptPanel = document.querySelector(
                            '[class*="transcript-panel"]'
                          );
                        }

                        if (transcriptPanel) {
                          console.log(
                            "Панель транскрипта найдена, извлекаем текст..."
                          );

                          // Извлекаем текст транскрипта - пробуем несколько селекторов
                          let cueElements = transcriptPanel.querySelectorAll(
                            '[data-purpose="cue-text"]'
                          );

                          // Если не найдены, пробуем альтернативные селекторы
                          if (cueElements.length === 0) {
                            cueElements = transcriptPanel.querySelectorAll(
                              '[class*="cue-text"]'
                            );
                          }

                          if (cueElements.length === 0) {
                            cueElements =
                              transcriptPanel.querySelectorAll(
                                'span[class*="cue"]'
                              );
                          }

                          if (cueElements.length === 0) {
                            // Пробуем найти все span элементы внутри cue-container
                            cueElements = transcriptPanel.querySelectorAll(
                              '[class*="cue-container"] span'
                            );
                          }

                          console.log(
                            `Найдено элементов транскрипта: ${cueElements.length}`
                          );

                          const textParts = [];

                          cueElements.forEach((cue, index) => {
                            const text = cue.textContent?.trim();
                            if (text) {
                              textParts.push(`${index + 1}. ${text}`);
                              console.log(`Фраза ${index + 1}:`, text);
                            }
                          });

                          transcript = textParts.join("\n\n");
                          console.log(
                            `Транскрипт извлечен (${transcript.length} символов)`
                          );
                        } else {
                          console.log("Панель транскрипта не найдена");
                        }
                      } else {
                        console.log("Кнопка транскрипта не найдена");
                      }
                    } catch (error) {
                      console.error(
                        "Ошибка при извлечении транскрипта:",
                        error
                      );
                      transcript = null; // Убеждаемся, что transcript определен
                    }
                  } else if (dataPurpose === "item-title") {
                    // Если это span с заголовком
                    itemTitle = item.textContent.trim();
                    // Ищем родительский элемент с ссылкой
                    const parentLink =
                      item.closest("a") ||
                      item.closest('[data-purpose^="curriculum-item"]');
                    if (parentLink) {
                      videoLink =
                        parentLink.href || parentLink.getAttribute("href");
                      dataPurpose =
                        parentLink.getAttribute("data-purpose") || dataPurpose;
                    }
                  } else {
                    // Fallback
                    itemTitle = item.textContent.trim();
                    videoLink = item.href || item.getAttribute("href");
                  }

                  console.log(`Обработан элемент: ${itemTitle}`);
                  console.log(`Ссылка на видео: ${videoLink}`);
                  console.log(`Data-purpose: ${dataPurpose}`);
                  console.log(
                    `Транскрипт: ${
                      transcript ? transcript.length + " символов" : "не найден"
                    }`
                  );

                  // Создаем объект элемента
                  const itemData = {
                    title: itemTitle,
                    videoUrl: videoLink,
                    transcript: transcript,
                    index: itemIndex + 1,
                    dataPurpose: dataPurpose || "unknown",
                  };

                  sectionItems.push(itemData);
                }

                // Создаем объект секции
                const sectionData = {
                  title: sectionTitle,
                  items: sectionItems,
                  index: sectionIndex + 1,
                };

                sections.push(sectionData);
              }

              console.log("Извлеченные секции:", sections);

              // Фильтруем дублирующиеся секции и пустые секции
              const uniqueSections = sections.filter((section, index, self) => {
                // Удаляем пустые секции
                if (section.items.length === 0) {
                  console.log(`Удаляем пустую секцию: ${section.title}`);
                  return false;
                }

                // Удаляем дублирующиеся секции по названию
                const firstIndex = self.findIndex(
                  (s) => s.title === section.title
                );
                if (firstIndex !== index) {
                  console.log(`Удаляем дублирующуюся секцию: ${section.title}`);
                  return false;
                }

                return true;
              });

              console.log("Отфильтрованные секции:", uniqueSections);

              // Возвращаем структуру курса
              const courseData = {
                url: window.location.href,
                title: document.title,
                sections: uniqueSections,
                extractedAt: new Date().toISOString(),
              };

              return { success: true, ...courseData };
            } catch (error) {
              console.error("Ошибка при извлечении секций:", error);
              return { success: false, error: error.message };
            }
          }

          return extractAccordionSections();
        },
      });

      if (extractResult && extractResult[0] && extractResult[0].result) {
        const courseData = extractResult[0].result;
        console.log("Извлеченная структура курса:", courseData);

        if (courseData.success) {
          setStatus(
            `Курс извлечен: ${courseData.sections.length} секций`,
            "success"
          );
          updateCourseDisplay(courseData);

          // Сохраняем в localStorage
          saveCourseToStorage(courseData);
        } else {
          setStatus(
            "Ошибка при извлечении курса: " + courseData.error,
            "error"
          );
          updateCourseDisplay(null);
        }
      } else {
        throw new Error("Не удалось извлечь структуру курса");
      }
    } else {
      throw new Error("Не удалось открыть Course content");
    }
  } catch (error) {
    console.error("Ошибка при извлечении курса:", error);
    setStatus("Ошибка при извлечении курса", "error");
  }
}

// Обновление списка ссылок в UI
function updateLinksList() {
  if (extractedLinks.length === 0) {
    linksListEl.innerHTML = '<div class="no-links">Ссылки не найдены</div>';
    return;
  }

  linksListEl.innerHTML = extractedLinks
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

// Копирование ссылки в буфер обмена
function copyToClipboard(text) {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      setStatus("Ссылка скопирована", "success");
      setTimeout(() => setStatus("Готов к работе", "success"), 2000);
    })
    .catch((err) => {
      console.error("Ошибка при копировании:", err);
      setStatus("Ошибка при копировании", "error");
    });
}

// Удаление ссылки из списка
function removeLink(index) {
  extractedLinks.splice(index, 1);
  updateLinksList();
  sendBtn.disabled = extractedLinks.length === 0;
  setStatus(`Удалена ссылка. Осталось: ${extractedLinks.length}`, "success");
}

// Получение URL текущей страницы
async function getCurrentPageUrl() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab.url;
}

// Установка статуса
function setStatus(message, type = "success") {
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
  chrome.storage.sync.get(["backendUrl", "selectors"], (result) => {
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
    selectors: currentSettings.selectors,
  });

  setStatus("Настройки сохранены", "success");
  setTimeout(() => setStatus("Готов к работе", "success"), 2000);
}
