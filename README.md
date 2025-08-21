# Course Parser - Система обработки курсов

Полная система для извлечения, обработки и анализа видео-курсов с поддержкой автоматической детекции сцен и генерации отчетов.

## Архитектура проекта

```
course-parser/
├── browser-extension/          # Расширение браузера для парсинга курсов
├── microservice/               # Микросервис для приема и обработки данных
├── video-pipeline/             # Пайплайн для обработки видео
├── playlist.csv               # Пример CSV файла с данными курса
├── playlist2.csv              # Расширенный пример CSV
└── README.md                  # Документация проекта
```

## Компоненты системы

### 1. Browser Extension (`browser-extension/`)
Расширение браузера для автоматического извлечения данных курса:
- Парсинг структуры курса
- Извлечение ссылок на видео (m3u8)
- Получение транскриптов
- Отправка данных на микросервис

### 2. Microservice (`microservice/`)
Flask-микросервис для приема и обработки данных:
- Прием данных от расширения браузера
- Интеграция с видео-пайплайном
- API для обработки видео
- Логирование и мониторинг

### 3. Video Pipeline (`video-pipeline/`)
Система обработки видео с поддержкой:
- Конвертация m3u8 в MP4
- Автоматическая детекция сцен
- Извлечение ключевых кадров
- Генерация HTML отчетов с транскриптами
- Работа с JSON данными вместо CSV

## Быстрый старт

### 1. Установка зависимостей

```bash
# Зависимости для микросервиса
cd microservice
pip install -r requirements.txt

# Зависимости для пайплайна
cd ../video-pipeline
pip install -r requirements.txt
```

### 2. Запуск микросервиса

```bash
cd microservice
python app.py
```

Микросервис будет доступен по адресу: `http://localhost:8005`

### 3. Установка расширения браузера

1. Откройте `chrome://extensions/`
2. Включите "Режим разработчика"
3. Нажмите "Загрузить распакованное расширение"
4. Выберите папку `browser-extension/`

### 4. Настройка расширения

1. Откройте расширение в браузере
2. В настройках укажите URL микросервиса: `http://localhost:8005`
3. Перейдите на страницу курса
4. Нажмите "Извлечь курс"

## Использование

### Через расширение браузера (рекомендуется)

1. **Извлечение данных**: Используйте расширение для парсинга курса
2. **Автоматическая обработка**: Данные автоматически отправляются на микросервис
3. **Результаты**: Обработанные видео и отчеты сохраняются в указанной директории

### Через API напрямую

```bash
# Отправка данных курса с автоматической обработкой
curl -X POST http://localhost:8005/api/course \
  -H "Content-Type: application/json" \
  -d @test_course_with_pipeline.json

# Ручная обработка видео (если нужно)
curl -X POST http://localhost:8005/api/process-video \
  -H "Content-Type: application/json" \
  -d @pipeline_request.json
```

### Через пайплайн напрямую

```bash
cd video-pipeline

# Обработка CSV файла
python pipeline.py -f ../playlist.csv

# Обработка JSON данных
python pipeline_api.py --data-file course_data.json
```

## API Endpoints

### Микросервис (`http://localhost:8005`)

- `GET /health` - Проверка работоспособности
- `POST /api/course` - Прием данных курса
- `POST /api/process-video` - Асинхронная обработка видео
- `POST /api/process-video-sync` - Синхронная обработка видео

### Примеры запросов

**Отправка данных курса с автоматической обработкой:**
```json
{
  "course_data": {
    "title": "Название курса",
    "url": "https://example.com/course",
    "extractedAt": "2024-01-15T15:30:45.123Z",
    "sections": [
      {
        "title": "Секция 1",
        "items": [
          {
            "title": "Урок 1",
            "videoUrl": "https://example.com/video.m3u8",
            "transcript": "Текст транскрипта...",
            "dataPurpose": "item-1"
          }
        ]
      }
    ]
  },
  "pipeline_config": {
    "output_dir": "results",
    "threshold": 5.0,
    "min_scene_len": 0.5,
    "extract_clips": false,
    "keep_temp": false,
    "max_modules": 10
  }
}
```

**Обработка видео:**
```json
{
  "course_data": { /* данные курса */ },
  "pipeline_config": {
    "output_dir": "results",
    "threshold": 5.0,
    "min_scene_len": 0.5,
    "extract_clips": false,
    "keep_temp": true,
    "max_modules": 10
  }
}
```

## Результаты обработки

После обработки создается структура:

```
output_directory/
├── Module_Name_1/
│   ├── Module_Name_1.mp4          # Конвертированное видео (если keep_temp=true)
│   └── scenes/
│       ├── frames/                 # Извлеченные кадры
│       │   ├── scene_001_00h00m00s.jpg
│       │   └── ...
│       ├── clips/                  # Видео клипы (если extract_clips=true)
│       ├── scenes_metadata.json    # Метаданные сцен
│       └── summary.html           # HTML отчет с транскриптом
├── Module_Name_2/
│   └── ...
├── pipeline.log                   # Лог выполнения
└── pipeline_report.txt            # Финальный отчет
```

## Тестирование

```bash
# Тест микросервиса
cd microservice
python test_pipeline_integration.py

# Тест пайплайна
cd ../video-pipeline
python pipeline_api.py --data-file ../test_course.json
```

## Конфигурация

### Параметры пайплайна

- `threshold` - Порог детекции сцен (1-100, по умолчанию: 5)
- `min_scene_len` - Минимальная длина сцены в секундах (по умолчанию: 0.5)
- `extract_frames` - Извлекать кадры из сцен (по умолчанию: true)
- `extract_clips` - Извлекать видео клипы (по умолчанию: false)
- `keep_temp` - Сохранять временные файлы (по умолчанию: false)
- `generate_html` - Генерировать HTML отчеты (по умолчанию: true)

### Настройки микросервиса

- Порт: 8005 (изменяется в `microservice/app.py`)
- Таймаут обработки: 1 час
- Логирование: в консоль и файлы

## Требования

- Python 3.7+
- FFmpeg
- Chrome/Chromium браузер
- PySceneDetect
- OpenCV
- Flask

## Установка зависимостей

```bash
# FFmpeg (macOS)
brew install ffmpeg

# Python зависимости
pip install scenedetect[opencv] opencv-python flask requests
```

## Поддержка

- **Логи**: Проверяйте файлы `pipeline.log` и консоль микросервиса
- **Ошибки**: Детальная информация в логах и HTTP ответах
- **Производительность**: Рекомендуется обрабатывать не более 10-20 модулей одновременно

## Лицензия

MIT License
