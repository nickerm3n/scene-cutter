#!/usr/bin/env python3
"""
Тест интеграции микросервиса с пайплайном
"""

import requests
import json
import time

# URL микросервиса
BASE_URL = "http://localhost:8005"

def test_health():
    """Тест проверки здоровья сервиса"""
    print("🔍 Тестирование здоровья сервиса...")
    
    try:
        response = requests.get(f"{BASE_URL}/health")
        if response.status_code == 200:
            print("✅ Сервис работает")
            return True
        else:
            print(f"❌ Ошибка: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Ошибка подключения: {e}")
        return False

def test_course_reception():
    """Тест приема данных курса с автоматической обработкой"""
    print("\n📚 Тестирование приема данных курса с автоматической обработкой...")
    
    # Тестовые данные курса
    course_data = {
        "title": "Тестовый курс по Python",
        "url": "https://example.com/course/python",
        "extractedAt": "2024-01-15T15:30:45.123Z",
        "sections": [
            {
                "title": "Введение в Python",
                "items": [
                    {
                        "title": "Что такое Python",
                        "videoUrl": "https://example.com/video1.m3u8",
                        "transcript": "Python - это высокоуровневый язык программирования...",
                        "dataPurpose": "item-1"
                    },
                    {
                        "title": "Установка Python",
                        "videoUrl": "https://example.com/video2.m3u8",
                        "transcript": "Для установки Python скачайте его с официального сайта...",
                        "dataPurpose": "item-2"
                    }
                ]
            },
            {
                "title": "Основы программирования",
                "items": [
                    {
                        "title": "Переменные и типы данных",
                        "videoUrl": "https://example.com/video3.m3u8",
                        "transcript": "Переменные в Python не требуют объявления типа...",
                        "dataPurpose": "item-3"
                    }
                ]
            }
        ]
    }
    
    # Настройки пайплайна для теста
    pipeline_config = {
        "threshold": 5.0,
        "min_scene_len": 0.5,
        "extract_clips": False,
        "keep_temp": False,
        "max_modules": 1  # Обрабатываем только один модуль для теста
    }
    
    # Объединяем данные
    request_data = {
        "course_data": course_data,
        "pipeline_config": pipeline_config
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/course",
            json=request_data,
            headers={'Content-Type': 'application/json'},
            timeout=30  # Увеличиваем таймаут для обработки
        )
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Данные курса успешно получены и отправлены на обработку")
            print(f"   Секций: {result.get('sections_count')}")
            print(f"   Элементов: {result.get('total_items')}")
            print(f"   Статус пайплайна: {result.get('pipeline_status')}")
            print(f"   Директория результатов: {result.get('output_dir')}")
            print(f"   Примечание: {result.get('note')}")
            return True
        else:
            print(f"❌ Ошибка: {response.status_code}")
            print(f"   Ответ: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        return False

def test_pipeline_integration():
    """Тест интеграции с пайплайном"""
    print("\n🎬 Тестирование интеграции с пайплайном...")
    
    # Тестовые данные курса (с реальными m3u8 ссылками из playlist.csv)
    course_data = {
        "title": "Тестовый курс с реальными ссылками",
        "url": "https://example.com/course/test",
        "extractedAt": "2024-01-15T15:30:45.123Z",
        "sections": [
            {
                "title": "Тестовая секция",
                "items": [
                    {
                        "title": "Creating a Free Gemini AI API Token",
                        "videoUrl": "https://epam.udemy.com/assets/65239373/files/2025-05-19_13-24-39-e9b0432abed617654f061458eba3c9a6/2/aa00ec69985284ee7aa555e8a3d2c689505c.m3u8?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwYXRoIjoiMjAyNS0wNS0xOV8xMy0yNC0zOS1lOWIwNDMyYWJlZDYxNzY1NGYwNjE0NThlYmEzYzlhNi8yLyIsImV4cCI6MTc1NTI4OTIzNH0.R0JMG9VJNNioGiDic0xrOa86hERGpmdJgemCBuC4SuM&provider=cloudfront&v=1",
                        "transcript": "I'm super excited to discuss this piece of the course with you...",
                        "dataPurpose": "item-1"
                    }
                ]
            }
        ]
    }
    
    # Конфигурация пайплайна
    pipeline_config = {
        "output_dir": "test_output",
        "threshold": 5.0,
        "min_scene_len": 0.5,
        "extract_clips": False,
        "keep_temp": True,
        "max_modules": 1  # Обрабатываем только один модуль для теста
    }
    
    request_data = {
        "course_data": course_data,
        "pipeline_config": pipeline_config
    }
    
    try:
        print("🚀 Отправка запроса на обработку видео...")
        response = requests.post(
            f"{BASE_URL}/api/process-video",
            json=request_data,
            headers={'Content-Type': 'application/json'},
            timeout=300  # 5 минут таймаут
        )
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Запрос на обработку видео успешно отправлен")
            print(f"   Успех: {result.get('success')}")
            print(f"   Сообщение: {result.get('message')}")
            
            if result.get('pipeline_result'):
                pipeline_result = result['pipeline_result']
                print(f"   Результат пайплайна:")
                print(f"     - Всего модулей: {pipeline_result.get('total_modules')}")
                print(f"     - Обработано: {pipeline_result.get('processed_modules')}")
                print(f"     - Ошибок: {len(pipeline_result.get('failed_modules', []))}")
                print(f"     - Время: {pipeline_result.get('total_time', 0):.1f}с")
                print(f"     - Директория: {pipeline_result.get('output_dir')}")
            
            return True
        else:
            print(f"❌ Ошибка: {response.status_code}")
            print(f"   Ответ: {response.text}")
            return False
    except requests.exceptions.Timeout:
        print("⏰ Таймаут запроса (более 5 минут)")
        return False
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        return False

def test_sync_pipeline():
    """Тест синхронного пайплайна"""
    print("\n⚡ Тестирование синхронного пайплайна...")
    
    # Тестовые данные курса
    course_data = {
        "title": "Синхронный тест",
        "url": "https://example.com/course/sync",
        "extractedAt": "2024-01-15T15:30:45.123Z",
        "sections": [
            {
                "title": "Тестовая секция",
                "items": [
                    {
                        "title": "Тестовый модуль",
                        "videoUrl": "https://example.com/test.m3u8",
                        "transcript": "Это тестовый транскрипт...",
                        "dataPurpose": "item-1"
                    }
                ]
            }
        ]
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/process-video-sync",
            json={"course_data": course_data},
            headers={'Content-Type': 'application/json'},
            timeout=60  # 1 минута таймаут
        )
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Синхронный пайплайн работает")
            print(f"   Успех: {result.get('success')}")
            return True
        else:
            print(f"❌ Ошибка: {response.status_code}")
            print(f"   Ответ: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        return False

def main():
    """Основная функция тестирования"""
    print("🧪 ТЕСТИРОВАНИЕ ИНТЕГРАЦИИ МИКРОСЕРВИСА С ПАЙПЛАЙНОМ")
    print("="*60)
    
    # Проверяем, что сервис запущен
    if not test_health():
        print("\n❌ Сервис не доступен. Запустите микросервис:")
        print("   cd microservice")
        print("   python app.py")
        return
    
    # Тестируем прием данных курса
    if not test_course_reception():
        print("\n❌ Ошибка при приеме данных курса")
        return
    
    # Тестируем синхронный пайплайн
    if not test_sync_pipeline():
        print("\n❌ Ошибка синхронного пайплайна")
        return
    
    # Тестируем асинхронный пайплайн (опционально)
    print("\n⚠️  Тест асинхронного пайплайна может занять много времени...")
    user_input = input("Продолжить? (y/n): ")
    
    if user_input.lower() == 'y':
        if not test_pipeline_integration():
            print("\n❌ Ошибка асинхронного пайплайна")
            return
    
    print("\n✅ Все тесты завершены!")

if __name__ == "__main__":
    main()
