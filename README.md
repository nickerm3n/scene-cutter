# Course Parser - Система обработки видео курсов

Обновленная система для автоматической обработки видео из CSV файлов с поддержкой конвертации m3u8 и детекции сцен.

## Возможности

- 📁 Чтение списка видео из CSV файла
- 🎬 Конвертация m3u8 ссылок в MP4 видео
- 🔍 Автоматическое обнаружение сцен в видео
- 📸 Извлечение ключевых кадров из каждой сцены
- 📄 Генерация HTML отчетов
- 📊 Подробная статистика и логирование

## Структура файлов

```
course-parser/
├── playlist.csv              # CSV файл с модулями и ссылками
├── pipeline.py               # Главный скрипт pipeline
├── m3u8_converter.py         # Конвертер m3u8 в MP4
├── scene_detector.py         # Детектор сцен
├── batch_processor.py        # Пакетный процессор (устарел)
└── README.md                 # Эта документация
```

## Формат CSV файла

Создайте файл `playlist.csv` в следующем формате:

```csv
Module,Link
"7. Creating a Free Gemini AI API Token","https://example.com/video1.m3u8"
"8. Advanced API Usage","https://example.com/video2.m3u8"
```

## Использование

### Базовый запуск

```bash
# Обработать все модули из playlist.csv
python3 pipeline.py
```

### Продвинутые опции

```bash
# Использовать другой CSV файл
python3 pipeline.py -f my_playlist.csv

# Указать директорию для результатов
python3 pipeline.py -o my_results

# Начать с определенного модуля (полезно при возобновлении)
python3 pipeline.py --start-from 5

# Обработать только первые N модулей
python3 pipeline.py --max 10

# Настройка детекции сцен
python3 pipeline.py --threshold 10 --min-scene-len 1.0

# Извлечение клипов и сохранение временных файлов
python3 pipeline.py --extract-clips --keep-temp

# Полная настройка
python3 pipeline.py \
  -f my_playlist.csv \
  -o results \
  --threshold 5 \
  --extract-frames \
  --extract-clips \
  --frame-type middle \
  --keep-temp
```

## Параметры

### Основные параметры

- `-f, --file` - Путь к CSV файлу (по умолчанию: playlist.csv)
- `-o, --output` - Директория для результатов
- `--start-from` - С какого модуля начать (0-based)
- `--max` - Максимальное количество модулей для обработки

### Параметры конвертации

- `--codec` - Видео кодек (copy, libx264, libx265, по умолчанию: copy)
- `--quality` - Качество видео при перекодировании (0-51, по умолчанию: 23)

### Параметры детекции сцен

- `--threshold` - Порог детекции сцен (1-100, по умолчанию: 5)
- `--min-scene-len` - Минимальная длина сцены в секундах (по умолчанию: 0.5)
- `--detector` - Тип детектора (content, adaptive, по умолчанию: content)
- `--split-equal` - Разбить на N равных частей вместо детекции

### Параметры извлечения

- `--extract-frames` - Извлекать кадры из сцен (по умолчанию: да)
- `--frame-type` - Тип кадра (first, middle, last, best, по умолчанию: middle)
- `--extract-clips` - Извлекать видео клипы для каждой сцены
- `--no-html` - Не генерировать HTML отчет
- `--keep-temp` - Сохранить промежуточные файлы (конвертированные видео)

## Структура результатов

После выполнения pipeline создается следующая структура:

```
pipeline_output_YYYYMMDD_HHMMSS/
├── Module_Name_1/
│   ├── Module_Name_1.mp4          # Конвертированное видео (если --keep-temp)
│   └── scenes/
│       ├── frames/                 # Извлеченные кадры
│       │   ├── scene_001_00h00m00s.jpg
│       │   ├── scene_002_00h01m19s.jpg
│       │   └── ...
│       ├── clips/                  # Видео клипы (если --extract-clips)
│       ├── scenes_metadata.json    # Метаданные сцен
│       └── summary.html           # HTML отчет
├── Module_Name_2/
│   └── ...
├── pipeline.log                   # Подробный лог выполнения
└── pipeline_report.txt            # Финальный отчет
```

## Примеры использования

### Обработка одного модуля для тестирования

```bash
python3 pipeline.py --max 1
```

### Возобновление обработки с модуля 5

```bash
python3 pipeline.py --start-from 5
```

### Обработка с настройками для лекций

```bash
python3 pipeline.py \
  --threshold 3 \
  --min-scene-len 2.0 \
  --extract-frames \
  --frame-type middle \
  --extract-clips \
  --keep-temp
```

### Обработка с разбивкой на равные части

```bash
python3 pipeline.py --split-equal 20
```

## Требования

- Python 3.7+
- FFmpeg
- PySceneDetect
- OpenCV

### Установка зависимостей

```bash
# FFmpeg (macOS)
brew install ffmpeg

# Python зависимости
pip install scenedetect[opencv] opencv-python
```

## Логирование

Система создает подробные логи:

- `pipeline.log` - Подробный лог выполнения
- `pipeline_report.txt` - Финальный отчет со статистикой
- Консольный вывод с прогрессом в реальном времени

## Обработка ошибок

- Система продолжает работу даже при ошибках в отдельных модулях
- Подробная информация об ошибках записывается в лог
- Возможность возобновления с любого модуля
- Таймауты для предотвращения зависания

## Производительность

- Параллельная обработка не поддерживается (для стабильности)
- Рекомендуется обрабатывать не более 10-20 модулей за раз
- Время обработки зависит от размера видео и настроек детекции
- Среднее время: 1-3 минуты на модуль
