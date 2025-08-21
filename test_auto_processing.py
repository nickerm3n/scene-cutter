#!/usr/bin/env python3
"""
Тест автоматической обработки курса
"""

import requests
import json
import time

# URL микросервиса
BASE_URL = "http://localhost:8005"

def test_auto_processing():
    """Тест автоматической обработки курса"""
    print("🚀 Тестирование автоматической обработки курса")
    print("="*50)
    
    # Загружаем тестовые данные
    try:
        with open('test_course_with_pipeline.json', 'r', encoding='utf-8') as f:
            test_data = json.load(f)
    except FileNotFoundError:
        print("❌ Файл test_course_with_pipeline.json не найден")
        return False
    
    print(f"📚 Курс: {test_data['course_data']['title']}")
    print(f"📊 Секций: {len(test_data['course_data']['sections'])}")
    print(f"⚙️  Настройки пайплайна: {test_data['pipeline_config']}")
    
    try:
        print("\n📤 Отправка запроса...")
        response = requests.post(
            f"{BASE_URL}/api/course",
            json=test_data,
            headers={'Content-Type': 'application/json'},
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Запрос успешно отправлен!")
            print(f"   Статус: {result.get('success')}")
            print(f"   Сообщение: {result.get('message')}")
            print(f"   Статус пайплайна: {result.get('pipeline_status')}")
            print(f"   Директория результатов: {result.get('output_dir')}")
            print(f"   Примечание: {result.get('note')}")
            
            print("\n⏳ Обработка выполняется в фоновом режиме...")
            print("📋 Проверьте логи микросервиса для прогресса")
            
            return True
        else:
            print(f"❌ Ошибка: {response.status_code}")
            print(f"   Ответ: {response.text}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("❌ Не удалось подключиться к микросервису")
        print("   Убедитесь, что микросервис запущен: python microservice/app.py")
        return False
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        return False

def test_health():
    """Проверка здоровья сервиса"""
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        if response.status_code == 200:
            print("✅ Микросервис работает")
            return True
        else:
            print(f"❌ Микросервис недоступен: {response.status_code}")
            return False
    except:
        print("❌ Микросервис недоступен")
        return False

def main():
    """Основная функция"""
    print("🧪 ТЕСТ АВТОМАТИЧЕСКОЙ ОБРАБОТКИ")
    print("="*50)
    
    # Проверяем здоровье сервиса
    if not test_health():
        print("\n❌ Микросервис не доступен")
        print("Запустите микросервис:")
        print("   cd microservice")
        print("   python app.py")
        return
    
    # Тестируем автоматическую обработку
    if test_auto_processing():
        print("\n✅ Тест завершен успешно!")
        print("📁 Результаты будут сохранены в указанной директории")
    else:
        print("\n❌ Тест завершился с ошибкой")

if __name__ == "__main__":
    main()
