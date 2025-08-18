#!/usr/bin/env python3
import requests
import json
import time

def test_endpoint(url, name):
    """Тестирует эндпоинт и выводит результат"""
    try:
        print(f"\n=== Тестирование {name} ===")
        print(f"URL: {url}")
        
        response = requests.get(url, timeout=5)
        print(f"Статус код: {response.status_code}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                print("Ответ (JSON):")
                print(json.dumps(data, indent=2, ensure_ascii=False))
            except json.JSONDecodeError:
                print("Ответ (текст):")
                print(response.text)
        else:
            print(f"Ошибка: {response.text}")
            
    except requests.exceptions.RequestException as e:
        print(f"Ошибка подключения: {e}")

def main():
    base_url = "http://127.0.0.1:8000"
    
    print("🚀 Тестирование микросервиса")
    print("=" * 50)
    
    # Тестируем все эндпоинты
    endpoints = [
        (f"{base_url}/", "Корневой эндпоинт"),
        (f"{base_url}/health", "Health Check"),
        (f"{base_url}/api/data", "API Data")
    ]
    
    for url, name in endpoints:
        test_endpoint(url, name)
        time.sleep(1)  # Небольшая пауза между запросами
    
    print("\n" + "=" * 50)
    print("✅ Тестирование завершено!")

if __name__ == "__main__":
    main()
