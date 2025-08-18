import { currentSettings, extractedLinks } from './config.js';
import { setStatus, executeScriptOnPage, getCurrentPageUrl, updateUI } from './utils.js';
import { updateLinksList } from './ui.js';

// Обработка извлечения ссылок
export async function handleExtract() {
  try {
    setStatus("Извлечение ссылок...", "loading");

    // Выполняем скрипт на странице для извлечения ссылок
    const result = await executeScriptOnPage(extractLinksFromPage, [currentSettings.selectors]);

    if (result && result[0] && result[0].result) {
      extractedLinks.length = 0; // Очищаем массив
      extractedLinks.push(...result[0].result);
      
      console.log("Результат извлечения", extractedLinks);
      setStatus(`Найдено ${extractedLinks.length} ссылок`, "success");
      updateLinksList(extractedLinks);
      updateUI(extractedLinks);
    } else {
      console.error("Неожиданный результат", result);
      throw new Error("Не удалось извлечь ссылки");
    }
  } catch (error) {
    console.error("Ошибка при извлечении ссылок", error);
    setStatus("Ошибка при извлечении ссылок", "error");
  }
}

// Обработка отправки на сервер
export async function handleSend() {
  if (extractedLinks.length === 0) {
    setStatus("Нет ссылок для отправки", "error");
    return;
  }

  // Временно отключаем отправку на сервер для отладки
  setStatus("Отправка отключена (режим отладки)", "loading");

  // Выводим найденные ссылки в консоль для отладки
  console.log("=== НАЙДЕННЫЕ ССЫЛКИ ===");
  console.log("Всего ссылок", extractedLinks.length);
  extractedLinks.forEach((link, index) => {
    console.log(`Ссылка ${index + 1}`, {
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
            console.log('Ответ сервера', result);
        } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
    } catch (error) {
        console.error('Ошибка при отправке на сервер', error);
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
