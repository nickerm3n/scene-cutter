import { CONFIG } from './config.js';
import { setStatus, executeScriptOnPage, delay } from './utils.js';
import { updateCourseDisplay } from './ui.js';
import { saveCourseToStorage } from './storage.js';

// Обработка извлечения курса
export async function handleCourse() {
  try {
    setStatus("Извлечение курса...", "loading");

    // Сначала кликаем по кнопке Course content
    const clickResult = await executeScriptOnPage(clickCourseContentButton);

    if (
      clickResult &&
      clickResult[0] &&
      clickResult[0].result &&
      clickResult[0].result.success
    ) {
      console.log("Клик выполнен успешно, ждем появления аккордеона...");

      // Ждем появления аккордеона
      await delay(CONFIG.DELAYS.COURSE_CONTENT_LOAD);

      console.log("Начинаем извлечение секций...");

      // Теперь извлекаем структуру курса
      const extractResult = await executeScriptOnPage(extractAccordionSections);

      if (extractResult && extractResult[0] && extractResult[0].result) {
        const courseData = extractResult[0].result;
        console.log("Извлеченная структура курса", courseData);

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
    console.error("Ошибка при извлечении курса", error);
    setStatus("Ошибка при извлечении курса", "error");
  }
}

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

    console.log("Кнопка найдена через XPath", courseContentButton);
    console.log("Текст кнопки", courseContentButton.textContent);

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
    console.error("Ошибка при клике по кнопке Course content", error);
    return { success: false, error: error.message };
  }
}

// Функция для извлечения секций аккордеона (выполняется в контексте страницы)
async function extractAccordionSections() {
  try {
    console.log("Ищем секции аккордеона...");

    // Ищем все панели аккордеона по точному селектору
    let accordionPanels = document.querySelectorAll('[data-purpose^="section-panel-"]');

    console.log(`Найдено панелей аккордеона: ${accordionPanels.length}`);

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

    console.log("Найдено панелей аккордеона", accordionPanels.length);

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
      let items = panel.querySelectorAll('[data-purpose^="curriculum-item-"]');

      console.log(`В секции ${sectionIndex} найдено элементов: ${items.length}`);

      if (items.length === 0) {
        items = panel.querySelectorAll(
          '[data-purpose^="curriculum-item"]'
        );
      }

      if (items.length === 0) {
        items = panel.querySelectorAll(CONFIG.SELECTORS.ITEM_TITLE);
      }

      if (items.length === 0) {
        items = panel.querySelectorAll(
          '[class*="item-title"], [data-purpose*="title"]'
        );
      }

      console.log(`Найдено элементов в секции "${sectionTitle}":`, items.length);

      // Выводим информацию о найденных элементах
      items.forEach((item, index) => {
        const dataPurpose = item.getAttribute("data-purpose");
        const title =
          item
            .querySelector('[data-purpose="item-title"]')
            ?.textContent?.trim() || "Без названия";
        console.log(`  Элемент ${index}: data-purpose="${dataPurpose}", title="${title}"`);
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

                  console.log(`Кликаем по элементу: ${itemTitle} (${dataPurpose})`);

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
              console.log(`Найдена ссылка на видео (без source): ${videoLink}`);
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
                CONFIG.SELECTORS.TRANSCRIPT_PANEL
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
                console.log("Панель транскрипта найдена, извлекаем текст...");

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

                console.log(`Найдено элементов транскрипта: ${cueElements.length}`);

                const textParts = [];

                cueElements.forEach((cue, index) => {
                  const text = cue.textContent?.trim();
                  if (text) {
                    textParts.push(`${index + 1}. ${text}`);
                    console.log(`Фраза ${index + 1}:`, text);
                  }
                });

                transcript = textParts.join("\n\n");
                console.log(`Транскрипт извлечен (${transcript.length} символов)`);
              } else {
                console.log("Панель транскрипта не найдена");
              }
            } else {
              console.log("Кнопка транскрипта не найдена");
            }
          } catch (error) {
            console.error("Ошибка при извлечении транскрипта", error);
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
        console.log(`Транскрипт: ${transcript ? transcript.length + " символов" : "не найден"}`);

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

    console.log("Извлеченные секции", sections);

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

    console.log("Отфильтрованные секции", uniqueSections);

    // Возвращаем структуру курса
    const courseData = {
      url: window.location.href,
      title: document.title,
      sections: uniqueSections,
      extractedAt: new Date().toISOString(),
    };

    return { success: true, ...courseData };
  } catch (error) {
    console.error("Ошибка при извлечении секций", error);
    return { success: false, error: error.message };
  }
}
