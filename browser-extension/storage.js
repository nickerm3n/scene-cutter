import { log, logError } from './utils.js';

// Ключи для localStorage
const STORAGE_KEYS = {
  COURSE_PREFIX: 'course_',
  SETTINGS: 'settings'
};

// Функции для работы с курсами
export function saveCourseToStorage(courseData) {
  try {
    const courseKey = generateCourseKey(courseData.url);
    localStorage.setItem(courseKey, JSON.stringify(courseData));
    log('Курс сохранен в localStorage', courseKey);
    return true;
  } catch (error) {
    logError('Ошибка при сохранении курса', error);
    return false;
  }
}

export function loadCourseFromStorage(url) {
  try {
    const courseKey = generateCourseKey(url);
    const courseData = localStorage.getItem(courseKey);
    return courseData ? JSON.parse(courseData) : null;
  } catch (error) {
    logError('Ошибка при загрузке курса', error);
    return null;
  }
}

export function clearCourseData(url) {
  try {
    const courseKey = generateCourseKey(url);
    localStorage.removeItem(courseKey);
    log('Данные курса очищены', courseKey);
    return true;
  } catch (error) {
    logError('Ошибка при очистке курса', error);
    return false;
  }
}

// Функции для работы с транскриптами элементов
export function saveItemTranscript(itemData, courseUrl) {
  try {
    const courseKey = generateCourseKey(courseUrl);
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
      log('Транскрипт сохранен для элемента', itemData.title);
      return true;
    }
    return false;
  } catch (error) {
    logError('Ошибка при сохранении транскрипта', error);
    return false;
  }
}

export function getItemTranscript(itemDataPurpose, courseUrl) {
  try {
    const courseData = loadCourseFromStorage(courseUrl);
    if (!courseData) return null;

    // Ищем элемент с транскриптом
    for (const section of courseData.sections) {
      for (const item of section.items) {
        if (item.dataPurpose === itemDataPurpose) {
          return item.transcript;
        }
      }
    }
    return null;
  } catch (error) {
    logError('Ошибка при получении транскрипта', error);
    return null;
  }
}

// Функции для экспорта данных
export function exportCourseData(courseUrl) {
  try {
    const courseData = loadCourseFromStorage(courseUrl);
    if (!courseData) {
      throw new Error('Данные курса не найдены');
    }

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(courseData, null, 2));
    const downloadAnchorNode = document.createElement("a");
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `course_data_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();

    log('Курс экспортирован');
    return true;
  } catch (error) {
    logError('Ошибка при экспорте курса', error);
    return false;
  }
}

export function exportAllCourses() {
  try {
    const allCourses = [];
    
    // Собираем все курсы из localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_KEYS.COURSE_PREFIX)) {
        try {
          const courseData = JSON.parse(localStorage.getItem(key));
          allCourses.push(courseData);
        } catch (e) {
          logError('Ошибка при парсинге курса', { key, error: e });
        }
      }
    }

    if (allCourses.length === 0) {
      throw new Error('Курсы не найдены');
    }

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allCourses, null, 2));
    const downloadAnchorNode = document.createElement("a");
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `all_courses_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();

    log('Все курсы экспортированы', { count: allCourses.length });
    return true;
  } catch (error) {
    logError('Ошибка при экспорте всех курсов', error);
    return false;
  }
}

// Функции для очистки данных
export function clearAllCourses() {
  try {
    const keysToRemove = [];
    
    // Собираем все ключи курсов
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_KEYS.COURSE_PREFIX)) {
        keysToRemove.push(key);
      }
    }

    // Удаляем все курсы
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    log('Все курсы очищены', { count: keysToRemove.length });
    return true;
  } catch (error) {
    logError('Ошибка при очистке всех курсов', error);
    return false;
  }
}

// Вспомогательные функции
function generateCourseKey(url) {
  return `${STORAGE_KEYS.COURSE_PREFIX}${url.replace(/[^a-zA-Z0-9]/g, "_")}`;
}

// Функции для работы со статистикой
export function getStorageStats() {
  try {
    const stats = {
      totalCourses: 0,
      totalItems: 0,
      totalTranscripts: 0,
      storageSize: 0
    };

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_KEYS.COURSE_PREFIX)) {
        try {
          const courseData = JSON.parse(localStorage.getItem(key));
          stats.totalCourses++;
          
          courseData.sections?.forEach(section => {
            stats.totalItems += section.items?.length || 0;
            section.items?.forEach(item => {
              if (item.transcript) stats.totalTranscripts++;
            });
          });
          
          stats.storageSize += localStorage.getItem(key).length;
        } catch (e) {
          logError('Ошибка при анализе курса', { key, error: e });
        }
      }
    }

    return stats;
  } catch (error) {
    logError('Ошибка при получении статистики', error);
    return null;
  }
}
