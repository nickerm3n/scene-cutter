from flask import Flask, jsonify, request
import requests
import json
from datetime import datetime

app = Flask(__name__)

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
    """Эндпоинт для приема данных курса"""
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
        print("✅ ДАННЫЕ КУРСА УСПЕШНО ОБРАБОТАНЫ")
        print("="*80 + "\n")
        
        return jsonify({
            'success': True,
            'message': f'Курс "{course_data.get("title", "Неизвестный")}" успешно получен',
            'sections_count': len(course_data.get('sections', [])),
            'total_items': total_items,
            'received_at': datetime.now().isoformat()
        })
        
    except Exception as e:
        print(f"\n❌ ОШИБКА ПРИ ОБРАБОТКЕ КУРСА: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e),
            'message': 'Ошибка при обработке данных курса'
        }), 500

@app.route('/', methods=['GET'])
def root():
    """Корневой эндпоинт"""
    return jsonify({
        'message': 'Добро пожаловать в микросервис Course Parser!',
        'endpoints': {
            'health': '/health',
            'data': '/api/data',
            'course': '/api/course (POST)',
            'root': '/'
        }
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8005, debug=True)
