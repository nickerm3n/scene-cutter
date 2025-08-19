import { CONFIG } from "./config.js";
import { setStatus, executeScriptOnPage, delay } from "./utils.js";
import { updateCourseDisplay } from "./ui.js";
import { saveCourseToStorage } from "./storage.js";

// Обработка извлечения курса
export async function handleCourse() {
  try {
    setStatus("Извлечение курса...", "loading");

    // 1. Сначала кликаем по кнопке Course content
    const clickResult = await executeScriptOnPage(clickCourseContentButton);

    if (
      clickResult &&
      clickResult[0] &&
      clickResult[0].result &&
      clickResult[0].result.success
    ) {
      console.log("Клик выполнен успешно, ждем появления аккордеона...");
      
      // Делаем маленькую паузу
      await delay(1000);
      
      // 2-15. Запускаем полный алгоритм парсинга
      setStatus("Начинаем парсинг курса...", "loading");
      const courseData = await executeScriptOnPage(parseFullCourse);
      
      if (courseData && courseData[0] && courseData[0].result) {
        const data = courseData[0].result;
        console.log("Данные курса извлечены:", data);
        
        // Сохраняем данные в storage
        await saveCourseToStorage(data);
        
        // Обновляем UI
        updateCourseDisplay(data);
        
        const totalItems = data.sections.reduce((sum, section) => sum + section.items.length, 0);
        setStatus(`Извлечено ${data.sections.length} секций, ${totalItems} элементов`, "success");
      } else {
        throw new Error("Не удалось извлечь данные курса");
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

// Основная функция парсинга курса (выполняется в контексте страницы)
async function parseFullCourse() {
  // Вспомогательные функции (должны быть внутри для доступа в контексте страницы)
  
  // Функция для ожидания появления элемента
  async function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const element = document.querySelector(selector);
        resolve(element);
      }, timeout);
    });
  }

  // Функция для безопасного клика по элементу
  async function safeClick(element, description = 'элемент') {
    try {
      if (!element) {
        console.warn(`Элемент для клика не найден: ${description}`);
        return false;
      }

      console.log('Element ====>', element);

      // Проверяем, видим ли элемент
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        console.warn(`Элемент не видим: ${description}`);
        return false;
      }

      // Прокручиваем к элементу если нужно
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await new Promise(resolve => setTimeout(resolve, 500));

      // Кликаем
      element.click();
      console.log(`Клик выполнен: ${description}`);
      return true;
    } catch (error) {
      console.error(`Ошибка при клике по ${description}:`, error);
      return false;
    }
  }

  // Функция для поиска видео URL
  async function findVideoUrl() {
    try {
      // Пробуем разные селекторы для видео
      const videoSelectors = [
        'video.video-player--video-player--HiAnq',
        'video[controlslist="nodownload"]',
        'video source',
        'video'
      ];

      for (const selector of videoSelectors) {
        const videoElement = await waitForElement(selector, 5000);
        if (videoElement) {
          // Если это source элемент
          if (videoElement.tagName === 'SOURCE') {
            if (videoElement.src) {
              return videoElement.src;
            }
          }
          // Если это video элемент
          else if (videoElement.tagName === 'VIDEO') {
            const sourceElement = videoElement.querySelector('source');
            if (sourceElement && sourceElement.src) {
              return sourceElement.src;
            }
            // Проверяем src самого video элемента
            if (videoElement.src) {
              return videoElement.src;
            }
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Ошибка при поиске видео URL:', error);
      return null;
    }
  }

  // Функция для извлечения транскрипта
  async function extractTranscript() {
    try {
      let transcript = '';
      
      // Проверяем, есть ли уже открытая панель транскрипта
      let transcriptPanel = await waitForElement('[data-purpose="transcript-panel"]', 2000);
      
      if (!transcriptPanel) {
        // Если панель не открыта, кликаем на кнопку транскрипта
        const transcriptButton = await waitForElement('[data-purpose="transcript-toggle"]', 3000);
        if (transcriptButton) {
          await safeClick(transcriptButton, 'кнопка транскрипта');
          // Ждем появления панели
          transcriptPanel = await waitForElement('[data-purpose="transcript-panel"]', 5000);
        }
      }

      // Читаем транскрипт
      if (transcriptPanel) {
        const transcriptTexts = transcriptPanel.querySelectorAll('[data-purpose="cue-text"]');
        transcript = Array.from(transcriptTexts)
          .map(el => el.textContent?.trim())
          .filter(text => text)
          .join('\n');
      }

      return transcript;
    } catch (error) {
      console.error('Ошибка при извлечении транскрипта:', error);
      return '';
    }
  }

  // Функция для возврата к списку секций
  async function returnToCourseContent() {
    try {
      const courseContentButton = document.evaluate(
        '//span[text()="Course content"]',
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      ).singleNodeValue;
      
      if (courseContentButton) {
        const button = courseContentButton.closest("button");
        if (button) {
          await safeClick(button, 'кнопка Course content');
          // Пауза 4 секунды
          await new Promise(resolve => setTimeout(resolve, 4000));
        }
      }
    } catch (error) {
      console.error('Ошибка при возврате к Course content:', error);
    }
  }

  // Основная логика парсинга
  try {
    const courseData = {
      title: document.title,
      url: window.location.href,
      sections: [],
      extractedAt: new Date().toISOString()
    };

    // 2. Ищем контейнер с секциями
    const curriculumContainer = document.querySelector('[data-purpose="curriculum-section-container"]');
    if (!curriculumContainer) {
      throw new Error('Контейнер curriculum-section-container не найден');
    }

    // 3. Находим все секции
    const sectionPanels = curriculumContainer.querySelectorAll('[data-purpose^="section-panel-"]');
    console.log(`Найдено ${sectionPanels.length} секций`);

    if (sectionPanels.length === 0) {
      throw new Error('Секции курса не найдены');
    }

    // 4. Цикл по секциям (для тестирования - только первая секция)
    for (let sectionIndex = 0; sectionIndex < Math.min(1, sectionPanels.length); sectionIndex++) {
      // Заново находим секции после каждого возврата к списку
      const curriculumContainer = document.querySelector('[data-purpose="curriculum-section-container"]');
      const currentSectionPanels = curriculumContainer?.querySelectorAll('[data-purpose^="section-panel-"]');
      
      if (!currentSectionPanels || sectionIndex >= currentSectionPanels.length) {
        console.warn(`Не удалось найти секцию ${sectionIndex}`);
        continue;
      }
      
      const sectionPanel = currentSectionPanels[sectionIndex];
      
      try {
        // Получаем заголовок секции
        const sectionTitle = sectionPanel.querySelector('.ud-accordion-panel-title')?.textContent?.trim() || `Секция ${sectionIndex + 1}`;
        console.log(`Обрабатываем секцию: ${sectionTitle}`);
        
        // Отправляем прогресс
        chrome.runtime.sendMessage({
          type: 'PROGRESS_UPDATE',
          data: {
            currentSection: sectionIndex + 1,
            totalSections: sectionPanels.length,
            sectionTitle: sectionTitle,
            status: 'Обработка секции'
          }
        });
        
        const sectionData = {
          title: sectionTitle,
          items: []
        };

        // Кликаем на секцию чтобы раскрыть
        const sectionTitleElement = sectionPanel.querySelector('.ud-accordion-panel-title');
        if (sectionTitleElement) {
          await safeClick(sectionTitleElement, `секция "${sectionTitle}"`);
        } else {
          console.warn(`Не найден элемент с классом ud-accordion-panel-title для секции "${sectionTitle}"`);
          // Fallback - кликаем на весь блок секции
          await safeClick(sectionPanel, `секция "${sectionTitle}"`);
        }
        
        // Пауза 4 секунды
        await new Promise(resolve => setTimeout(resolve, 4000));

        // 5. Ищем список элементов внутри секции
        const itemsList = sectionPanel.querySelector('.ud-unstyled-list');
        if (itemsList) {
          const listItems = itemsList.querySelectorAll('li');
          console.log(`Найдено ${listItems.length} элементов в секции ${sectionTitle}`);

          // 6-13. Цикл по элементам
          for (let itemIndex = 0; itemIndex < listItems.length; itemIndex++) {
            // Заново находим элементы после каждого возврата к списку
            const currentSectionPanel = document.querySelector(`[data-purpose="section-panel-${sectionIndex}"]`);
            const currentItemsList = currentSectionPanel?.querySelector('.ud-unstyled-list');
            const currentListItems = currentItemsList?.querySelectorAll('li');
            
            if (!currentListItems || itemIndex >= currentListItems.length) {
              console.warn(`Не удалось найти элемент ${itemIndex} в секции ${sectionTitle}`);
              continue;
            }
            
            const listItem = currentListItems[itemIndex];
            
            // Проверяем, содержит ли элемент кнопку "Resources" (элементы только с ресурсами, без видео)
            const resourcesButton = listItem.querySelector('button[aria-label="Resource list"]');
            if (resourcesButton) {
              console.log(`Пропускаем элемент только с ресурсами: ${itemIndex}`);
              continue;
            }
            
            // Проверяем, содержит ли элемент слово "Quiz"
            const itemTitle = listItem.querySelector('[data-purpose="item-title"]')?.textContent?.trim() || '';
            if (itemTitle.toLowerCase().includes('quiz')) {
              console.log(`Пропускаем элемент с Quiz: ${itemTitle}`);
              continue;
            }
            
            try {
              // 7. Получаем заголовок элемента
              const itemTitle = listItem.querySelector('[data-purpose="item-title"]')?.textContent?.trim() || `Элемент ${itemIndex + 1}`;
              console.log(`Обрабатываем элемент: ${itemTitle}`);
              
              // Отправляем прогресс элемента
              chrome.runtime.sendMessage({
                type: 'PROGRESS_UPDATE',
                data: {
                  currentSection: sectionIndex + 1,
                  totalSections: sectionPanels.length,
                  currentItem: itemIndex + 1,
                  totalItems: listItems.length,
                  sectionTitle: sectionTitle,
                  itemTitle: itemTitle,
                  status: 'Обработка элемента'
                }
              });

              // 8. Кликаем на элемент
              const itemTitleElement = listItem.querySelector('[data-purpose="item-title"]');
              if (itemTitleElement) {
                await safeClick(itemTitleElement, `элемент "${itemTitle}"`);
              } else {
                console.warn(`Не найден элемент с data-purpose="item-title" для "${itemTitle}"`);
                // Fallback - кликаем на весь li
                await safeClick(listItem, `элемент "${itemTitle}"`);
              }
              
              // Пауза 2 секунды
              await new Promise(resolve => setTimeout(resolve, 2000));

              // 9. Ищем видео
              const videoUrl = await findVideoUrl();

              // 10-12. Работаем с транскриптом
              const transcript = await extractTranscript();

              // Сохраняем данные элемента
              sectionData.items.push({
                title: itemTitle,
                videoUrl: videoUrl,
                transcript: transcript,
                dataPurpose: listItem.getAttribute('data-purpose') || `item-${itemIndex}`
              });

              console.log(`Элемент ${itemTitle} обработан. Видео: ${videoUrl ? 'найдено' : 'не найдено'}, Транскрипт: ${transcript.length} символов`);
              
              // Возвращаемся к списку секций после каждого элемента
              await returnToCourseContent();
              
            } catch (itemError) {
              console.error(`Ошибка при обработке элемента ${itemIndex}:`, itemError);
              // Продолжаем с следующим элементом
              continue;
            }
          }
        }

        courseData.sections.push(sectionData);
        
      } catch (sectionError) {
        console.error(`Ошибка при обработке секции ${sectionIndex}:`, sectionError);
        // Продолжаем со следующей секцией
        continue;
      }
    }

    console.log('Парсинг курса завершен');
    return courseData;

  } catch (error) {
    console.error('Ошибка при парсинге курса:', error);
    return { error: error.message };
  }
}