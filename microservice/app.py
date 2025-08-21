from flask import Flask, jsonify, request
import requests
import json
import subprocess
import os
import sys
from datetime import datetime
from pathlib import Path

app = Flask(__name__)

# Путь к пайплайну
PIPELINE_DIR = Path(__file__).parent.parent / "video-pipeline"
PIPELINE_SCRIPT = PIPELINE_DIR / "pipeline_api.py"

@app.route('/health', methods=['GET'])
def health_check():
    """Простой эндпоинт для проверки работоспособности сервиса"""
    return jsonify({
        'status': 'healthy',
        'message': 'Микросервис работает!'
    })

@app.route('/api/data', methods=['GET'])
def get_data():
    """Эндпоинт для получения данных через GET запрос"""
    try:
        # Пример GET запроса к внешнему API
        response = requests.get('https://jsonplaceholder.typicode.com/posts/1', timeout=5)
        response.raise_for_status()
        
        return jsonify({
            'success': True,
            'data': response.json(),
            'source': 'external_api'
        })
    except requests.RequestException as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'message': 'Ошибка при получении данных'
        }), 500

@app.route('/api/course', methods=['POST'])
def receive_course():
    """Эндпоинт для приема данных курса и автоматического запуска пайплайна"""
    try:
        # Получаем данные из POST запроса
        course_data = request.get_json()
        
        if not course_data:
            return jsonify({
                'success': False,
                'error': 'Данные курса не получены'
            }), 400
        
        # Выводим данные в терминал
        print("\n" + "="*80)
        print(f"📚 ПОЛУЧЕНЫ ДАННЫЕ КУРСА - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("="*80)
        
        # Основная информация о курсе
        print(f"🎯 Название курса: {course_data.get('title', 'Не указано')}")
        print(f"🔗 URL курса: {course_data.get('url', 'Не указано')}")
        print(f"📅 Дата извлечения: {course_data.get('extractedAt', 'Не указано')}")
        print(f"📊 Количество секций: {len(course_data.get('sections', []))}")
        
        # Подсчитываем общее количество элементов
        total_items = sum(len(section.get('items', [])) for section in course_data.get('sections', []))
        print(f"📝 Общее количество элементов: {total_items}")
        
        print("\n" + "-"*80)
        print("📋 СТРУКТУРА КУРСА:")
        print("-"*80)
        
        # Детальная информация по секциям
        for i, section in enumerate(course_data.get('sections', []), 1):
            print(f"\n📖 Секция {i}: {section.get('title', 'Без названия')}")
            print(f"   📊 Элементов в секции: {len(section.get('items', []))}")
            
            # Информация по элементам секции
            for j, item in enumerate(section.get('items', []), 1):
                print(f"   📝 Элемент {j}: {item.get('title', 'Без названия')}")
                if item.get('videoUrl'):
                    print(f"      🎥 Видео: {item.get('videoUrl')}")
                if item.get('transcript'):
                    transcript_length = len(item.get('transcript', ''))
                    print(f"      📄 Транскрипт: {transcript_length} символов")
        
        print("\n" + "="*80)
        print("🚀 ЗАПУСК АВТОМАТИЧЕСКОЙ ОБРАБОТКИ ВИДЕО")
        print("="*80)
        
        # Проверяем существование пайплайна
        if not PIPELINE_SCRIPT.exists():
            print(f"❌ Пайплайн не найден: {PIPELINE_SCRIPT}")
            return jsonify({
                'success': False,
                'error': f'Пайплайн не найден: {PIPELINE_SCRIPT}',
                'message': 'Данные курса получены, но пайплайн недоступен'
            }), 500
        
        # Получаем настройки пайплайна из запроса или используем значения по умолчанию
        pipeline_config = request.get_json().get('pipeline_config', {})
        
        # Настройки по умолчанию
        default_config = {
            'output_dir': f"course_output_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            'threshold': 5.0,
            'min_scene_len': 0.5,
            'extract_clips': False,
            'keep_temp': False,
            'max_modules': None  # Обрабатываем все модули
        }
        
        # Объединяем с пользовательскими настройками
        pipeline_config = {**default_config, **pipeline_config}
        
        print(f"📁 Пайплайн: {PIPELINE_SCRIPT}")
        print(f"📂 Директория результатов: {pipeline_config['output_dir']}")
        print(f"⚙️  Настройки: threshold={pipeline_config['threshold']}, extract_clips={pipeline_config['extract_clips']}")
        
        # Создаем временный файл с данными курса
        import tempfile
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f:
            json.dump(course_data, f, ensure_ascii=False, indent=2)
            temp_file_path = f.name
        
        try:
            # Формируем команду для запуска пайплайна
            cmd = [
                sys.executable,
                str(PIPELINE_SCRIPT),
                "--data-file", temp_file_path
            ]
            
            # Добавляем конфигурацию пайплайна
            if pipeline_config.get('output_dir'):
                cmd.extend(["-o", pipeline_config['output_dir']])
            
            if pipeline_config.get('threshold'):
                cmd.extend(["--threshold", str(pipeline_config['threshold'])])
            
            if pipeline_config.get('min_scene_len'):
                cmd.extend(["--min-scene-len", str(pipeline_config['min_scene_len'])])
            
            if pipeline_config.get('extract_clips'):
                cmd.append("--extract-clips")
            
            if pipeline_config.get('keep_temp'):
                cmd.append("--keep-temp")
            
            if pipeline_config.get('max_modules'):
                cmd.extend(["--max", str(pipeline_config['max_modules'])])
            
            print(f"🎬 Команда пайплайна: {' '.join(cmd)}")
            print("🚀 Запуск пайплайна...")
            
            # Запускаем пайплайн синхронно с выводом в реальном времени
            try:
                result = subprocess.run(
                    cmd,
                    text=True,
                    cwd=str(PIPELINE_DIR),
                    timeout=3600  # 1 час таймаут
                )
                
                # Удаляем временный файл
                os.unlink(temp_file_path)
                
                # Анализируем результат
                if result.returncode == 0:
                    print("✅ Пайплайн успешно завершен")
                    
                    # Пытаемся извлечь результат из вывода
                    output_lines = result.stdout.strip().split('\n')
                    pipeline_result = None
                    
                    for line in output_lines:
                        if line.startswith('📋 Pipeline Result:'):
                            # Ищем JSON в следующих строках
                            for next_line in output_lines[output_lines.index(line)+1:]:
                                if next_line.strip().startswith('{'):
                                    try:
                                        pipeline_result = json.loads(next_line.strip())
                                        break
                                    except json.JSONDecodeError:
                                        continue
                            break
                    
                    return jsonify({
                        'success': True,
                        'message': f'Курс "{course_data.get("title", "Неизвестный")}" успешно обработан',
                        'sections_count': len(course_data.get('sections', [])),
                        'total_items': total_items,
                        'pipeline_status': 'completed',
                        'pipeline_result': pipeline_result,
                        'output_dir': pipeline_config['output_dir'],
                        'processed_at': datetime.now().isoformat()
                    })
                else:
                    print(f"❌ Ошибка пайплайна (код: {result.returncode})")
                    
                    return jsonify({
                        'success': False,
                        'error': f'Ошибка пайплайна (код: {result.returncode})',
                        'message': 'Данные курса получены, но обработка видео завершилась с ошибкой',
                        'sections_count': len(course_data.get('sections', [])),
                        'total_items': total_items,
                        'pipeline_status': 'failed',
                        'output_dir': pipeline_config['output_dir'],
                        'processed_at': datetime.now().isoformat()
                    }), 500
                    
            except subprocess.TimeoutExpired:
                # Удаляем временный файл
                if os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)
                
                print("⏰ Таймаут выполнения пайплайна (более 1 часа)")
                return jsonify({
                    'success': False,
                    'error': 'Таймаут выполнения пайплайна (более 1 часа)',
                    'message': 'Данные курса получены, но обработка видео превысила лимит времени',
                    'sections_count': len(course_data.get('sections', [])),
                    'total_items': total_items,
                    'pipeline_status': 'timeout',
                    'output_dir': pipeline_config['output_dir'],
                    'processed_at': datetime.now().isoformat()
                }), 500
            
        except Exception as e:
            # Удаляем временный файл
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
            
            print(f"❌ Ошибка запуска пайплайна: {str(e)}")
            return jsonify({
                'success': False,
                'error': f'Ошибка запуска пайплайна: {str(e)}',
                'message': 'Данные курса получены, но не удалось запустить обработку видео'
            }), 500
        
    except Exception as e:
        print(f"\n❌ ОШИБКА ПРИ ОБРАБОТКЕ КУРСА: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e),
            'message': 'Ошибка при обработке данных курса'
        }), 500



@app.route('/api/status', methods=['GET'])
def get_status():
    """Эндпоинт для проверки статуса обработки"""
    return jsonify({
        'status': 'running',
        'message': 'Микросервис работает',
        'timestamp': datetime.now().isoformat(),
        'note': 'Для проверки статуса обработки конкретного курса проверьте логи микросервиса'
    })

@app.route('/', methods=['GET'])
def root():
    """Корневой эндпоинт"""
    return jsonify({
        'message': 'Добро пожаловать в микросервис Course Parser!',
        'version': '2.0',
        'features': [
            'Автоматическая обработка видео при получении данных курса',
            'Синхронная обработка через пайплайн с выводом в реальном времени',
            'Настраиваемые параметры обработки',
            'Поддержка транскриптов'
        ],
        'endpoints': {
            'health': '/health',
            'status': '/api/status',
            'course': '/api/course (POST) - основной эндпоинт с синхронной обработкой видео',
            'root': '/'
        },
        'usage': {
            'course_endpoint': 'Отправьте JSON с данными курса и настройками пайплайна',
            'example': {
                'course_data': {'title': '...', 'sections': [...]},
                'pipeline_config': {'threshold': 5.0, 'extract_clips': False}
            }
        }
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8005, debug=True)
