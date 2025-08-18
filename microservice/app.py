from flask import Flask, jsonify
import requests

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

@app.route('/', methods=['GET'])
def root():
    """Корневой эндпоинт"""
    return jsonify({
        'message': 'Добро пожаловать в микросервис!',
        'endpoints': {
            'health': '/health',
            'data': '/api/data',
            'root': '/'
        }
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=True)
