# AI Services - Vision-Enhanced Content Processing

Эта папка содержит TypeScript сервисы для AI/LLM обработки контента курсов с поддержкой визуального анализа.

## Структура

```
ai-services/
├── src/
│   ├── services/          # AI/LLM сервисы
│   │   └── content-processor.ts  # Основной процессор с vision
│   ├── utils/             # Утилиты для работы с HTML и файлами
│   │   ├── simple-html-parser.ts # Парсер HTML контента
│   │   └── file-utils.ts         # Утилиты для работы с файлами
│   ├── types/             # TypeScript типы
│   │   └── index.ts
│   ├── index.ts           # Основной файл пайплайна
│   └── test.ts            # Тесты
├── package.json           # Зависимости Node.js
├── tsconfig.json          # Конфигурация TypeScript
└── node_modules/          # Зависимости
```

## Основные компоненты

- **Content Processor**: Основной процессор с поддержкой GPT-4o vision
- **Vision Processing**: Обработка визуального контента и изображений
- **HTML Parser**: Парсинг HTML и извлечение транскриптов
- **File Utils**: Утилиты для работы с файлами и директориями

## Установка и запуск

```bash
cd ai-services
npm install
```

## Тестирование

```bash
npm test
```
