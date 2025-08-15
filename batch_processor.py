#!/usr/bin/env python3
"""
Скрипт для пакетной обработки ссылок из CSV файла
Читает playlist.csv и конвертирует все m3u8 ссылки
"""

import os
import sys
import csv
import subprocess
import argparse
from pathlib import Path
from datetime import datetime
import time
import re


class BatchProcessor:
    def __init__(self, csv_file: str = "playlist.csv", output_dir: str = None):
        """
        Инициализация процессора
        
        :param csv_file: Путь к CSV файлу
        :param output_dir: Директория для сохранения результатов
        """
        self.csv_file = Path(csv_file)
        
        # Проверяем существование файла
        if not self.csv_file.exists():
            raise FileNotFoundError(f"CSV файл не найден: {csv_file}")
        
        # Создаем директорию для результатов
        if output_dir:
            self.output_dir = Path(output_dir)
        else:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            self.output_dir = Path(f"batch_output_{timestamp}")
        
        self.output_dir.mkdir(exist_ok=True)
        
        # Лог файл
        self.log_file = self.output_dir / "batch_processing.log"
        
        # Статистика
        self.total_modules = 0
        self.processed_modules = 0
        self.failed_modules = []
        self.skipped_modules = []
        
        self._init_logging()
    
    def _init_logging(self):
        """Инициализация логирования"""
        self.log_messages = []
        self._log(f"="*60)
        self._log(f"Batch Processor запущен: {datetime.now()}")
        self._log(f"CSV файл: {self.csv_file}")
        self._log(f"Выходная директория: {self.output_dir}")
        self._log(f"="*60)
    
    def _log(self, message: str):
        """Логирование сообщений"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        log_entry = f"[{timestamp}] {message}"
        print(log_entry)
        self.log_messages.append(log_entry)
        
        # Сохраняем в файл
        with open(self.log_file, 'a', encoding='utf-8') as f:
            f.write(log_entry + '\n')
    
    def _sanitize_filename(self, module_name: str) -> str:
        """
        Очистка имени модуля для использования в качестве имени файла
        
        :param module_name: Исходное имя модуля
        :return: Очищенное имя файла
        """
        # Удаляем номер в начале (например, "7. Creating..." -> "Creating...")
        module_name = re.sub(r'^\d+\.\s*', '', module_name)
        
        # Заменяем недопустимые символы
        invalid_chars = '<>:"/\\|?*'
        for char in invalid_chars:
            module_name = module_name.replace(char, '_')
        
        # Ограничиваем длину
        if len(module_name) > 100:
            module_name = module_name[:100]
        
        # Удаляем пробелы в начале и конце
        module_name = module_name.strip()
        
        # Заменяем множественные пробелы на одинарные
        module_name = re.sub(r'\s+', ' ', module_name)
        
        # Заменяем пробелы на подчеркивания
        module_name = module_name.replace(' ', '_')
        
        return module_name or "module"
    
    def read_csv(self) -> list:
        """
        Чтение CSV файла
        
        :return: Список модулей с ссылками
        """
        modules = []
        
        try:
            with open(self.csv_file, 'r', encoding='utf-8') as f:
                # Пробуем разные варианты разделителей
                sample = f.read(1024)
                f.seek(0)
                
                # Определяем разделитель
                sniffer = csv.Sniffer()
                delimiter = sniffer.sniff(sample).delimiter
                
                # Читаем CSV
                reader = csv.DictReader(f, delimiter=delimiter)
                
                # Проверяем наличие нужных колонок
                if reader.fieldnames:
                    # Нормализуем имена колонок (убираем пробелы)
                    fieldnames = [field.strip() for field in reader.fieldnames]
                    
                    # Ищем колонки Module и Link
                    module_col = None
                    link_col = None
                    
                    for field in fieldnames:
                        if 'module' in field.lower():
                            module_col = field
                        elif 'link' in field.lower():
                            link_col = field
                    
                    if not module_col or not link_col:
                        self._log(f"⚠️  Не найдены колонки 'Module' и 'Link' в CSV")
                        self._log(f"   Найденные колонки: {fieldnames}")
                        return []
                    
                    # Читаем данные
                    f.seek(0)
                    reader = csv.DictReader(f, delimiter=delimiter)
                    
                    for row in reader:
                        # Получаем значения с учетом пробелов в именах колонок
                        module = row.get('Module', '').strip() or row.get(' Module', '').strip()
                        link = row.get('Link', '').strip() or row.get(' Link', '').strip()
                        
                        if module and link:
                            modules.append({
                                'module': module,
                                'link': link,
                                'filename': self._sanitize_filename(module)
                            })
                
                self._log(f"\n📊 Найдено модулей в CSV: {len(modules)}")
                
                if modules:
                    self._log("\n📋 Список модулей:")
                    for i, m in enumerate(modules, 1):
                        self._log(f"   {i:02d}. {m['module'][:50]}...")
                
                return modules
                
        except Exception as e:
            self._log(f"❌ Ошибка при чтении CSV: {str(e)}")
            return []
    
    def convert_module(self, module: dict) -> bool:
        """
        Конвертация одного модуля
        
        :param module: Словарь с информацией о модуле
        :return: Успешность конвертации
        """
        module_name = module['module']
        link = module['link']
        filename = module['filename']
        
        self._log(f"\n{'='*50}")
        self._log(f"🎬 Обработка модуля: {module_name}")
        self._log(f"   Ссылка: {link[:100]}...")
        
        # Создаем поддиректорию для модуля
        module_dir = self.output_dir / filename
        module_dir.mkdir(exist_ok=True)
        
        # Путь для выходного файла
        output_file = module_dir / f"{filename}.mp4"
        
        # Проверяем, не был ли файл уже обработан
        if output_file.exists() and output_file.stat().st_size > 0:
            self._log(f"✓ Файл уже существует, пропускаем: {output_file.name}")
            self.skipped_modules.append(module_name)
            return True
        
        # Формируем команду для m3u8_converter.py
        cmd = [
            sys.executable,
            "m3u8_converter.py",
            link,
            "-o", str(output_file),
            "--filename", filename
        ]
        
        self._log(f"   Выходной файл: {output_file}")
        self._log(f"   Запускаем конвертер...")
        
        try:
            # Запускаем конвертер
            start_time = time.time()
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=1800  # 30 минут таймаут
            )
            
            elapsed_time = time.time() - start_time
            
            if result.returncode == 0:
                # Проверяем, что файл создан
                if output_file.exists() and output_file.stat().st_size > 0:
                    size_mb = output_file.stat().st_size / (1024 * 1024)
                    self._log(f"✅ Успешно конвертирован за {elapsed_time:.1f}с")
                    self._log(f"   Размер файла: {size_mb:.2f} MB")
                    
                    # Сохраняем информацию о модуле
                    info_file = module_dir / "module_info.txt"
                    with open(info_file, 'w', encoding='utf-8') as f:
                        f.write(f"Module: {module_name}\n")
                        f.write(f"Link: {link}\n")
                        f.write(f"Output: {output_file.name}\n")
                        f.write(f"Size: {size_mb:.2f} MB\n")
                        f.write(f"Processing time: {elapsed_time:.1f}s\n")
                        f.write(f"Processed at: {datetime.now()}\n")
                    
                    return True
                else:
                    self._log(f"❌ Файл не был создан")
                    self.failed_modules.append(module_name)
                    return False
            else:
                self._log(f"❌ Ошибка при конвертации (код: {result.returncode})")
                if result.stderr:
                    error_lines = result.stderr.strip().split('\n')[-5:]  # Последние 5 строк ошибки
                    for line in error_lines:
                        self._log(f"   {line}")
                self.failed_modules.append(module_name)
                return False
                
        except subprocess.TimeoutExpired:
            self._log(f"❌ Таймаут при конвертации (более 30 минут)")
            self.failed_modules.append(module_name)
            return False
        except Exception as e:
            self._log(f"❌ Ошибка: {str(e)}")
            self.failed_modules.append(module_name)
            return False
    
    def generate_report(self):
        """Генерация финального отчета"""
        report_file = self.output_dir / "processing_report.txt"
        
        with open(report_file, 'w', encoding='utf-8') as f:
            f.write("="*60 + "\n")
            f.write("ОТЧЕТ О ПАКЕТНОЙ ОБРАБОТКЕ\n")
            f.write("="*60 + "\n\n")
            
            f.write(f"Время выполнения: {datetime.now()}\n")
            f.write(f"CSV файл: {self.csv_file}\n")
            f.write(f"Выходная директория: {self.output_dir}\n\n")
            
            f.write("СТАТИСТИКА:\n")
            f.write("-"*40 + "\n")
            f.write(f"Всего модулей: {self.total_modules}\n")
            f.write(f"Успешно обработано: {self.processed_modules}\n")
            f.write(f"Пропущено (уже существуют): {len(self.skipped_modules)}\n")
            f.write(f"Ошибки: {len(self.failed_modules)}\n\n")
            
            if self.skipped_modules:
                f.write("ПРОПУЩЕННЫЕ МОДУЛИ:\n")
                f.write("-"*40 + "\n")
                for module in self.skipped_modules:
                    f.write(f"  - {module}\n")
                f.write("\n")
            
            if self.failed_modules:
                f.write("МОДУЛИ С ОШИБКАМИ:\n")
                f.write("-"*40 + "\n")
                for module in self.failed_modules:
                    f.write(f"  - {module}\n")
                f.write("\n")
            
            f.write("ПОДРОБНЫЙ ЛОГ:\n")
            f.write("-"*40 + "\n")
            for log_entry in self.log_messages:
                f.write(log_entry + "\n")
        
        self._log(f"\n📋 Отчет сохранен: {report_file}")
    
    def run(self, start_from: int = 0, max_modules: int = None):
        """
        Запуск пакетной обработки
        
        :param start_from: С какого модуля начать (0-based index)
        :param max_modules: Максимальное количество модулей для обработки
        """
        self._log("\n🚀 ЗАПУСК ПАКЕТНОЙ ОБРАБОТКИ")
        
        # Читаем CSV
        modules = self.read_csv()
        
        if not modules:
            self._log("❌ Нет модулей для обработки")
            return False
        
        self.total_modules = len(modules)
        
        # Определяем диапазон для обработки
        end_at = len(modules)
        if max_modules:
            end_at = min(start_from + max_modules, len(modules))
        
        modules_to_process = modules[start_from:end_at]
        
        if start_from > 0 or max_modules:
            self._log(f"\n📌 Обработка модулей с {start_from+1} по {end_at} из {self.total_modules}")
        
        # Обрабатываем каждый модуль
        start_time = time.time()
        
        for i, module in enumerate(modules_to_process, start=start_from+1):
            self._log(f"\n{'='*50}")
            self._log(f"📦 Прогресс: {i}/{self.total_modules}")
            
            if self.convert_module(module):
                if module['module'] not in self.skipped_modules:
                    self.processed_modules += 1
            
            # Показываем промежуточную статистику
            if i % 5 == 0:  # Каждые 5 модулей
                elapsed = time.time() - start_time
                avg_time = elapsed / i if i > 0 else 0
                remaining = (self.total_modules - i) * avg_time
                
                self._log(f"\n⏱️  Прошло времени: {self._format_time(elapsed)}")
                self._log(f"   Осталось примерно: {self._format_time(remaining)}")
        
        # Финальная статистика
        total_time = time.time() - start_time
        
        self._log(f"\n{'='*60}")
        self._log("✨ ОБРАБОТКА ЗАВЕРШЕНА!")
        self._log(f"{'='*60}")
        self._log(f"\n📊 Итоговая статистика:")
        self._log(f"   Всего модулей: {self.total_modules}")
        self._log(f"   Успешно обработано: {self.processed_modules}")
        self._log(f"   Пропущено: {len(self.skipped_modules)}")
        self._log(f"   Ошибки: {len(self.failed_modules)}")
        self._log(f"   Общее время: {self._format_time(total_time)}")
        
        if self.processed_modules > 0:
            avg_time_per_module = total_time / self.processed_modules
            self._log(f"   Среднее время на модуль: {self._format_time(avg_time_per_module)}")
        
        # Генерируем отчет
        self.generate_report()
        
        self._log(f"\n📁 Все результаты сохранены в: {self.output_dir}")
        
        return len(self.failed_modules) == 0
    
    def _format_time(self, seconds: float) -> str:
        """Форматирование времени"""
        if seconds < 60:
            return f"{seconds:.0f}с"
        elif seconds < 3600:
            minutes = seconds // 60
            secs = seconds % 60
            return f"{minutes:.0f}м {secs:.0f}с"
        else:
            hours = seconds // 3600
            minutes = (seconds % 3600) // 60
            return f"{hours:.0f}ч {minutes:.0f}м"


def main():
    parser = argparse.ArgumentParser(
        description="Пакетная обработка m3u8 ссылок из CSV файла",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Формат CSV файла:
  Module,Link
  "Название модуля 1","https://example.com/video1.m3u8"
  "Название модуля 2","https://example.com/video2.m3u8"

Примеры использования:
  # Обработать все модули из playlist.csv
  python batch_processor.py
  
  # Использовать другой CSV файл
  python batch_processor.py -f my_playlist.csv
  
  # Указать директорию для результатов
  python batch_processor.py -o my_videos
  
  # Начать с определенного модуля (полезно при возобновлении)
  python batch_processor.py --start-from 5
  
  # Обработать только первые N модулей
  python batch_processor.py --max 10
  
  # Комбинация параметров
  python batch_processor.py --start-from 10 --max 5
        """
    )
    
    parser.add_argument(
        "-f", "--file",
        default="playlist.csv",
        help="Путь к CSV файлу (по умолчанию: playlist.csv)"
    )
    
    parser.add_argument(
        "-o", "--output",
        help="Директория для сохранения результатов",
        default=None
    )
    
    parser.add_argument(
        "--start-from",
        type=int,
        default=0,
        help="С какого модуля начать (0-based, по умолчанию: 0)"
    )
    
    parser.add_argument(
        "--max",
        type=int,
        help="Максимальное количество модулей для обработки"
    )
    
    args = parser.parse_args()
    
    try:
        # Создаем процессор
        processor = BatchProcessor(args.file, args.output)
        
        # Запускаем обработку
        success = processor.run(
            start_from=args.start_from,
            max_modules=args.max
        )
        
        # Возвращаем код выхода
        sys.exit(0 if success else 1)
        
    except FileNotFoundError as e:
        print(f"❌ {e}")
        print("\n💡 Убедитесь, что файл playlist.csv находится в текущей директории")
        print("   Формат файла:")
        print("   Module,Link")
        print('   "Название модуля","https://example.com/video.m3u8"')
        sys.exit(1)
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()