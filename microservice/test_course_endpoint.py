#!/usr/bin/env python3
"""
Тестовый скрипт для проверки эндпоинта /api/course
"""

import requests
import json

def test_course_endpoint():
    """Тестирует эндпоинт для приема данных курса"""
    
    # URL микросервиса
    base_url = "http://localhost:8005"
    
    # Тестовые данные курса
    test_course_data = {
        "title": "Тестовый курс по Python",
        "url": "https://example.com/course/python",
        "extractedAt": "2024-01-15T10:30:00Z",
        "sections": [
            {
                "title": "Введение в Python",
                "items": [
                    {
                        "title": "Что такое Python",
                        "videoUrl": "https://example.com/video1.mp4",
                        "transcript": "Python - это высокоуровневый язык программирования...",
                        "dataPurpose": "item-1"
                    },
                    {
                        "title": "Установка Python",
                        "videoUrl": "https://example.com/video2.mp4",
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
                        "videoUrl": "https://example.com/video3.mp4",
                        "transcript": "В Python есть несколько основных типов данных...",
                        "dataPurpose": "item-3"
                    }
                ]
            }
        ]
    }
    
    try:
        print("🧪 Тестируем эндпоинт /api/course...")
        print(f"📡 Отправляем POST запрос на {base_url}/api/course")
        print(f"📊 Размер данных: {len(json.dumps(test_course_data))} байт")
        
        # Отправляем POST запрос
        response = requests.post(
            f"{base_url}/api/course",
            json=test_course_data,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        print(f"📥 Получен ответ: HTTP {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Успешно!")
            print(f"📝 Сообщение: {result.get('message', 'Нет сообщения')}")
            print(f"📊 Секций: {result.get('sections_count', 0)}")
            print(f"📝 Элементов: {result.get('total_items', 0)}")
            print(f"🕐 Получено в: {result.get('received_at', 'Не указано')}")
        else:
            print("❌ Ошибка!")
            print(f"📄 Ответ: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Ошибка подключения! Убедитесь, что микросервис запущен на http://localhost:8005")
    except requests.exceptions.Timeout:
        print("❌ Таймаут запроса!")
    except Exception as e:
        print(f"❌ Неожиданная ошибка: {e}")

if __name__ == "__main__":
    test_course_endpoint()
