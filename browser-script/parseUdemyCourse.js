
async function parseUdemyCourse(maxSections = 0) {
    // Вспомогательные функции
    
    // Функция для ожидания появления элемента
    async function waitForElement(selector, timeout = 10000) {
      return new Promise((resolve) => {
        const startTime = Date.now();
        const checkInterval = setInterval(() => {
          const element = document.querySelector(selector);
          if (element || Date.now() - startTime > timeout) {
            clearInterval(checkInterval);
            resolve(element);
          }
        }, 100);
      });
    }
  
    // Функция для безопасного клика по элементу
    async function safeClick(element, description = 'элемент') {
      try {
        if (!element) {
          console.warn(`Элемент для клика не найден: ${description}`);
          return false;
        }
  
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
            let videoUrl = null;
            
            // Если это source элемент
            if (videoElement.tagName === 'SOURCE') {
              videoUrl = videoElement.src;
            }
            // Если это video элемент
            else if (videoElement.tagName === 'VIDEO') {
              const sourceElement = videoElement.querySelector('source');
              if (sourceElement && sourceElement.src) {
                videoUrl = sourceElement.src;
              } else if (videoElement.src) {
                videoUrl = videoElement.src;
              }
            }
  
            if (videoUrl) {
              console.log('Найден видео URL:', videoUrl);
              
              // Если это blob URL, заменяем на обычный URL
              if (videoUrl.startsWith('blob:')) {
                console.log('Обнаружен blob URL, заменяем на обычный URL...');
                const udemyVideoUrl = videoUrl.replace('blob:https://epam.udemy.com/', 'https://epam.udemy.com/');
                console.log('Заменен на:', udemyVideoUrl);
                return udemyVideoUrl;
              } else {
                return videoUrl;
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
  
    // Функция для клика по кнопке Course content
    async function clickCourseContentButton() {
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
  
    // ==== ОСНОВНАЯ ЛОГИКА ПАРСИНГА ====
    try {
      console.log("🚀 Начинаем парсинг курса Udemy...");
      console.log(`Настройки: maxSections = ${maxSections} (0 = все секции)`);
      
      // 1. Сначала кликаем по кнопке Course content
      const clickResult = await clickCourseContentButton();
      if (!clickResult.success) {
        throw new Error("Не удалось открыть Course content");
      }
      
      console.log("✅ Course content открыт, ждем загрузки...");
      await new Promise(resolve => setTimeout(resolve, 2000));
  
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
      console.log(`📚 Найдено ${sectionPanels.length} секций`);
  
      if (sectionPanels.length === 0) {
        throw new Error('Секции курса не найдены');
      }
  
      // 4. Цикл по секциям (ограниченный настройкой maxSections)
      const sectionsToProcess = maxSections === 0 ? sectionPanels.length : Math.min(maxSections, sectionPanels.length);
      console.log(`📋 Будет обработано ${sectionsToProcess} секций из ${sectionPanels.length}`);
      
      for (let sectionIndex = 0; sectionIndex < sectionsToProcess; sectionIndex++) {
        // Заново находим секции после каждого возврата к списку
        const curriculumContainer = document.querySelector('[data-purpose="curriculum-section-container"]');
        const currentSectionPanels = curriculumContainer?.querySelectorAll('[data-purpose^="section-panel-"]');
        
        if (!currentSectionPanels || sectionIndex >= currentSectionPanels.length) {
          console.warn(`❌ Не удалось найти секцию ${sectionIndex}`);
          continue;
        }
        
        const sectionPanel = currentSectionPanels[sectionIndex];
        
        try {
          // Получаем заголовок секции
          const sectionTitle = sectionPanel.querySelector('.ud-accordion-panel-title')?.textContent?.trim() || `Секция ${sectionIndex + 1}`;
          console.log(`\n📂 [${sectionIndex + 1}/${sectionsToProcess}] Обрабатываем секцию: ${sectionTitle}`);
          
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
            await safeClick(sectionPanel, `секция "${sectionTitle}"`);
          }
          
          // Пауза 4 секунды
          await new Promise(resolve => setTimeout(resolve, 4000));
  
          // 5. Ищем список элементов внутри секции
          const itemsList = sectionPanel.querySelector('.ud-unstyled-list');
          if (itemsList) {
            const listItems = itemsList.querySelectorAll('li');
            console.log(`   📝 Найдено ${listItems.length} элементов в секции`);
  
            // 6-13. Цикл по элементам
            for (let itemIndex = 0; itemIndex < listItems.length; itemIndex++) {
              // Заново находим элементы после каждого возврата к списку
              const currentSectionPanel = document.querySelector(`[data-purpose="section-panel-${sectionIndex}"]`);
              const currentItemsList = currentSectionPanel?.querySelector('.ud-unstyled-list');
              const currentListItems = currentItemsList?.querySelectorAll('li');
              
              if (!currentListItems || itemIndex >= currentListItems.length) {
                console.warn(`   ❌ Не удалось найти элемент ${itemIndex} в секции ${sectionTitle}`);
                continue;
              }
              
              const listItem = currentListItems[itemIndex];
              
              // Проверяем, содержит ли элемент кнопку "Resources" (элементы только с ресурсами, без видео)
              const resourcesButton = listItem.querySelector('button[aria-label="Resource list"]');
              if (resourcesButton) {
                console.log(`   ⏭️  Пропускаем элемент только с ресурсами: ${itemIndex}`);
                continue;
              }
              
              // Проверяем, содержит ли элемент слово "Quiz"
              const itemTitle = listItem.querySelector('[data-purpose="item-title"]')?.textContent?.trim() || '';
              if (itemTitle.toLowerCase().includes('quiz')) {
                console.log(`   ⏭️  Пропускаем элемент с Quiz: ${itemTitle}`);
                continue;
              }
              
              try {
                // 7. Получаем заголовок элемента
                const itemTitle = listItem.querySelector('[data-purpose="item-title"]')?.textContent?.trim() || `Элемент ${itemIndex + 1}`;
                console.log(`   🎬 [${itemIndex + 1}/${listItems.length}] Обрабатываем: ${itemTitle}`);
  
                // 8. Кликаем на элемент
                const itemTitleElement = listItem.querySelector('[data-purpose="item-title"]');
                if (itemTitleElement) {
                  await safeClick(itemTitleElement, `элемент "${itemTitle}"`);
                } else {
                  console.warn(`Не найден элемент с data-purpose="item-title" для "${itemTitle}"`);
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
  
                console.log(`      ✅ Видео: ${videoUrl ? 'найдено' : 'не найдено'}, Транскрипт: ${transcript.length} символов`);
                
                // Возвращаемся к списку секций после каждого элемента
                await returnToCourseContent();
                
              } catch (itemError) {
                console.error(`   ❌ Ошибка при обработке элемента ${itemIndex}:`, itemError);
                continue;
              }
            }
          }
  
          courseData.sections.push(sectionData);
          console.log(`   ✅ Секция обработана: ${sectionData.items.length} элементов сохранено`);
          
        } catch (sectionError) {
          console.error(`❌ Ошибка при обработке секции ${sectionIndex}:`, sectionError);
          continue;
        }
      }
  
      console.log('\n🎉 Парсинг курса завершен!');
      console.log('📊 Статистика:');
      console.log(`   - Секций обработано: ${courseData.sections.length}`);
      const totalItems = courseData.sections.reduce((sum, section) => sum + section.items.length, 0);
      console.log(`   - Всего элементов: ${totalItems}`);
      
      console.log('\n📦 Результат (объект courseData):');
      console.log(courseData);
      
      window.courseData = courseData;
      return courseData;
  
    } catch (error) {
      console.error('❌ Критическая ошибка при парсинге курса:', error);
      return { error: error.message };
    }
  }
  
  // ========================================
  // ИНСТРУКЦИЯ ПО ИСПОЛЬЗОВАНИЮ:
  // ========================================
  // 1. Откройте страницу курса на Udemy
  // 2. Откройте консоль браузера (F12)
  // 3. Вставьте весь этот код и нажмите Enter
  // 4. Запустите функцию одним из способов:
  //
  //    Парсить ВСЕ секции:
  //    await parseUdemyCourse(0)
  //    
  //    Парсить только ПЕРВУЮ секцию:
  //    await parseUdemyCourse(1)
  //    
  //    Парсить первые 3 секции:
  //    await parseUdemyCourse(3)
  //
  // 5. Результат будет выведен в консоль
  // ========================================
  
  // Автозапуск (раскомментируйте нужную строку):
  // parseUdemyCourse(1).then(data => console.log('Готово!', data));  // Первая секция
  // parseUdemyCourse(0).then(data => console.log('Готово!', data));  // Все секции