# Руководство по интеграции Course Parser

Подробное руководство по настройке и интеграции всех компонентов системы Course Parser.

## Обзор архитектуры

```
┌─────────────────┐    HTTP/JSON    ┌─────────────────┐    Subprocess    ┌─────────────────┐
│ Browser         │ ──────────────► │ Microservice    │ ──────────────► │ Video Pipeline  │
│ Extension       │                 │ (Flask)         │                 │ (Python)        │
│                 │                 │                 │                 │                 │
│ - Парсинг курса │                 │ - Прием данных  │                 │ - Конвертация   │
│ - Извлечение    │                 │ - Валидация     │                 │ - Детекция сцен │
│ - Отправка      │                 │ - Логирование   │                 │ - HTML отчеты   │
└─────────────────┘                 └─────────────────┘                 └─────────────────┘
```

## Шаг 1: Подготовка окружения

### Установка зависимостей

```bash
# 1. Клонируйте репозиторий
git clone <repository-url>
cd course-parser

# 2. Установите FFmpeg (macOS)
brew install ffmpeg

# 3. Установите зависимости микросервиса
cd microservice
pip install -r requirements.txt

# 4. Установите зависимости пайплайна
cd ../video-pipeline
pip install -r requirements.txt

# 5. Вернитесь в корневую директорию
cd ..
```

### Проверка установки

```bash
# Проверьте FFmpeg
ffmpeg -version

# Проверьте Python зависимости
python -c "import flask, requests, cv2, scenedetect; print('✅ Все зависимости установлены')"
```

## Шаг 2: Настройка микросервиса

### Запуск микросервиса

```bash
cd microservice
python app.py
```

Микросервис будет доступен по адресу: `http://localhost:8005`

### Тестирование микросервиса

```bash
# В новом терминале
cd microservice
python test_pipeline_integration.py
```

### Конфигурация микросервиса

Отредактируйте `microservice/app.py` для изменения настроек:

```python
# Изменение порта
app.run(host='0.0.0.0', port=8005, debug=True)

# Изменение таймаута обработки
timeout=3600  # 1 час
```

## Шаг 3: Настройка расширения браузера

### Установка расширения

1. Откройте Chrome/Chromium
2. Перейдите на `chrome://extensions/`
3. Включите "Режим разработчика"
4. Нажмите "Загрузить распакованное расширение"
5. Выберите папку `browser-extension/`

### Настройка расширения

1. Откройте расширение в браузере
2. Перейдите в "Настройки"
3. Укажите URL микросервиса: `http://localhost:8005`
4. Сохраните настройки

### Тестирование расширения

1. Перейдите на страницу курса (например, Udemy)
2. Нажмите на иконку расширения
3. Нажмите "Извлечь курс"
4. Проверьте логи в консоли браузера (F12)

## Шаг 4: Интеграция с пайплайном

### Автоматическая интеграция

Микросервис автоматически интегрируется с пайплайном:

1. **Прием данных**: Микросервис получает JSON данные от расширения
2. **Передача в пайплайн**: Данные передаются в `video-pipeline/pipeline_api.py`
3. **Обработка**: Пайплайн конвертирует видео и создает отчеты
4. **Результат**: Результаты возвращаются в микросервис

### Ручная интеграция

Для тестирования можно использовать пайплайн напрямую:

```bash
cd video-pipeline

# Обработка JSON данных
python pipeline_api.py --data-file ../test_course.json

# Обработка CSV файла
python pipeline.py -f ../playlist.csv

# С настройками
python pipeline_api.py \
  --data-file ../test_course.json \
  --threshold 5 \
  --extract-clips \
  --keep-temp
```

## Шаг 5: API Endpoints

### Основные эндпоинты

#### 1. Проверка здоровья
```bash
curl http://localhost:8005/health
```

#### 2. Прием данных курса
```bash
curl -X POST http://localhost:8005/api/course \
  -H "Content-Type: application/json" \
  -d @test_course.json
```

#### 3. Обработка видео (асинхронная)
```bash
curl -X POST http://localhost:8005/api/process-video \
  -H "Content-Type: application/json" \
  -d '{
    "course_data": {
      "title": "Тестовый курс",
      "sections": [...]
    },
    "pipeline_config": {
      "output_dir": "results",
      "threshold": 5.0,
      "max_modules": 1
    }
  }'
```

#### 4. Обработка видео (синхронная)
```bash
curl -X POST http://localhost:8005/api/process-video-sync \
  -H "Content-Type: application/json" \
  -d '{"course_data": {...}}'
```

## Шаг 6: Мониторинг и логирование

### Логи микросервиса

Логи выводятся в консоль и содержат:
- Время запросов
- Статус обработки
- Ошибки и предупреждения

### Логи пайплайна

Файлы логов создаются в директории результатов:
- `pipeline.log` - детальный лог выполнения
- `pipeline_report.txt` - финальный отчет
- `api_pipeline.log` - лог API версии

### Мониторинг производительности

```bash
# Проверка использования ресурсов
top -p $(pgrep -f "python.*app.py")

# Проверка дискового пространства
df -h

# Проверка сетевых соединений
netstat -an | grep 8005
```

## Шаг 7: Обработка ошибок

### Частые проблемы

#### 1. Микросервис не запускается
```bash
# Проверьте порт
lsof -i :8005

# Проверьте зависимости
pip list | grep flask
```

#### 2. Пайплайн не найден
```bash
# Проверьте путь к пайплайну
ls -la video-pipeline/pipeline_api.py

# Проверьте права доступа
chmod +x video-pipeline/pipeline_api.py
```

#### 3. FFmpeg не установлен
```bash
# Установите FFmpeg
brew install ffmpeg  # macOS
sudo apt-get install ffmpeg  # Ubuntu
```

#### 4. Таймаут обработки
```bash
# Увеличьте таймаут в микросервисе
timeout=7200  # 2 часа

# Или обрабатывайте меньше модулей
"max_modules": 5
```

### Отладка

#### Включение отладочного режима
```python
# В microservice/app.py
app.run(host='0.0.0.0', port=8005, debug=True)
```

#### Проверка логов
```bash
# Логи микросервиса
tail -f microservice/app.log

# Логи пайплайна
tail -f video-pipeline/pipeline.log
```

## Шаг 8: Оптимизация производительности

### Настройки для больших курсов

```json
{
  "pipeline_config": {
    "max_modules": 5,
    "threshold": 10.0,
    "min_scene_len": 1.0,
    "extract_clips": false,
    "keep_temp": false
  }
}
```

### Параллельная обработка

Для обработки нескольких курсов одновременно:

1. Запустите несколько экземпляров микросервиса на разных портах
2. Используйте разные директории для результатов
3. Мониторьте использование ресурсов

### Кэширование

- Результаты обработки сохраняются в указанной директории
- Повторная обработка пропускает уже обработанные модули
- Используйте `--keep-temp` для сохранения промежуточных файлов

## Шаг 9: Безопасность

### Рекомендации по безопасности

1. **Ограничьте доступ к микросервису**
   ```python
   app.run(host='127.0.0.1', port=8005)  # Только локальный доступ
   ```

2. **Добавьте аутентификацию**
   ```python
   from functools import wraps
   from flask import request, jsonify
   
   def require_api_key(f):
       @wraps(f)
       def decorated_function(*args, **kwargs):
           api_key = request.headers.get('X-API-Key')
           if api_key != 'your-secret-key':
               return jsonify({'error': 'Invalid API key'}), 401
           return f(*args, **kwargs)
       return decorated_function
   ```

3. **Валидация входных данных**
   ```python
   # Проверяйте размер JSON данных
   if len(request.data) > 10 * 1024 * 1024:  # 10MB
       return jsonify({'error': 'Data too large'}), 413
   ```

## Шаг 10: Развертывание

### Продакшн развертывание

1. **Используйте WSGI сервер**
   ```bash
   pip install gunicorn
   gunicorn -w 4 -b 0.0.0.0:8005 app:app
   ```

2. **Настройте reverse proxy (nginx)**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://127.0.0.1:8005;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

3. **Используйте systemd для автозапуска**
   ```ini
   [Unit]
   Description=Course Parser Microservice
   After=network.target
   
   [Service]
   User=your-user
   WorkingDirectory=/path/to/course-parser/microservice
   ExecStart=/usr/bin/python app.py
   Restart=always
   
   [Install]
   WantedBy=multi-user.target
   ```

### Мониторинг в продакшене

1. **Логирование в файлы**
   ```python
   import logging
   logging.basicConfig(
       filename='app.log',
       level=logging.INFO,
       format='%(asctime)s %(levelname)s: %(message)s'
   )
   ```

2. **Метрики производительности**
   ```python
   from flask import request
   import time
   
   @app.before_request
   def start_timer():
       request.start_time = time.time()
   
   @app.after_request
   def log_request(response):
       duration = time.time() - request.start_time
       logging.info(f'{request.method} {request.path} {response.status_code} {duration:.2f}s')
       return response
   ```

## Заключение

После выполнения всех шагов у вас будет полностью интегрированная система:

1. ✅ **Расширение браузера** извлекает данные курса
2. ✅ **Микросервис** принимает и обрабатывает данные
3. ✅ **Пайплайн** конвертирует видео и создает отчеты
4. ✅ **API** обеспечивает взаимодействие между компонентами

Система готова к использованию в продакшене с дополнительными настройками безопасности и мониторинга.
