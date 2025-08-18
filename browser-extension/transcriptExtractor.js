import { CONFIG } from './config.js';
import { setStatus, executeScriptOnPage, delay } from './utils.js';
import { updateTranscriptDisplay } from './ui.js';
import { saveItemTranscript } from './storage.js';

// Обработка извлечения транскрипта
export async function handleTranscript() {
  try {
    setStatus("Извлечение транскрипта...", "loading");

    // Сначала кликаем по кнопке транскрипта
    const clickResult = await executeScriptOnPage(clickTranscriptButton);

    if (
      clickResult &&
      clickResult[0] &&
      clickResult[0].result &&
      clickResult[0].result.success
    ) {
      // Ждем немного, чтобы панель появилась
      await delay(CONFIG.DELAYS.TRANSCRIPT_LOAD);

      // Теперь извлекаем текст
      const extractResult = await executeScriptOnPage(extractTranscriptText);

      if (extractResult && extractResult[0] && extractResult[0].result) {
        const transcript = extractResult[0].result;
        console.log("Извлеченный транскрипт", transcript);

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
    console.error("Ошибка при извлечении транскрипта", error);
    setStatus("Ошибка при извлечении транскрипта", "error");
  }
}

// Обработка обработки элемента курса
export async function handleProcessItem() {
  try {
    setStatus("Обработка элемента...", "loading");

    // Выполняем скрипт на странице для обработки элемента
    const result = await executeScriptOnPage(processCourseItem);

    if (result && result[0] && result[0].result) {
      const itemResult = result[0].result;
      console.log("Результат обработки элемента", itemResult);

      if (itemResult.success) {
        setStatus(`Элемент обработан: ${itemResult.title}`, "success");

        // Ждем немного и извлекаем транскрипт
        setTimeout(async () => {
          await extractTranscriptForCurrentItem(itemResult);
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
    console.error("Ошибка при обработке элемента", error);
    setStatus("Ошибка при обработке элемента", "error");
  }
}

// Функция для извлечения транскрипта текущего элемента
async function extractTranscriptForCurrentItem(itemData) {
  try {
    setStatus("Извлечение транскрипта...", "loading");

    const result = await executeScriptOnPage(extractTranscriptForItem, [itemData]);

    if (result && result[0] && result[0].result) {
      const transcriptResult = result[0].result;
      console.log("Результат извлечения транскрипта", transcriptResult);

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
    console.error("Ошибка при извлечении транскрипта", error);
    setStatus("Ошибка при извлечении транскрипта", "error");
  }
}

// Функция для клика по кнопке транскрипта (выполняется в контексте страницы)
function clickTranscriptButton() {
  try {
    // Ищем кнопку транскрипта
    const transcriptButton = document.querySelector('button[data-purpose="transcript-toggle"]');

    if (!transcriptButton) {
      return { success: false, error: "Кнопка транскрипта не найдена" };
    }

    // Проверяем, открыт ли уже транскрипт
    const transcriptPanel = document.querySelector('[class*="transcript--transcript-panel"]');

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
  try {
    // Ищем панель транскрипта
    const transcriptPanel = document.querySelector(CONFIG.SELECTORS.TRANSCRIPT_PANEL);

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

// Функция для извлечения транскрипта для конкретного элемента
function extractTranscriptForItem(itemData) {
  try {
    console.log(`Извлекаем транскрипт для: ${itemData.title}`);

    // Ищем кнопку транскрипта
    const transcriptButton = document.querySelector('button[data-purpose="transcript-toggle"]');
    if (!transcriptButton) {
      console.log("Кнопка транскрипта не найдена");
      return { success: false, error: "Кнопка транскрипта не найдена" };
    }

    // Кликаем по кнопке транскрипта
    transcriptButton.click();
    console.log("Клик по кнопке транскрипта выполнен");

    // Ждем появления панели транскрипта
    setTimeout(() => {
      const transcriptPanel = document.querySelector('[class*="transcript--transcript-panel"]');
      if (transcriptPanel) {
        const transcriptText = extractTextFromTranscript(transcriptPanel);
        console.log(
          `Транскрипт извлечен для ${itemData.title}:`,
          transcriptText
        );

        // Обновляем данные элемента
        itemData.transcript = transcriptText;

        // Сохраняем в localStorage
        saveItemTranscript(itemData, window.location.href);
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
