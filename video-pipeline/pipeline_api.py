#!/usr/bin/env python3
"""
API версия пайплайна для работы с данными курса
Принимает JSON данные вместо CSV файла
"""

import os
import sys
import json
import argparse
import subprocess
import tempfile
from pathlib import Path
from datetime import datetime
import time
from typing import Dict, List, Any

# Импортируем классы из существующих файлов
from pipeline import VideoPipeline


class PipelineAPI:
    def __init__(self, output_dir: str = None, keep_temp: bool = False):
        """
        Инициализация API пайплайна
        
        :param output_dir: Директория для результатов
        :param keep_temp: Сохранять временные файлы
        """
        self.keep_temp = keep_temp
        
        # Создаем основную директорию для результатов
        if output_dir:
            self.output_dir = Path(output_dir)
        else:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            self.output_dir = Path(f"api_pipeline_output_{timestamp}")
        
        self.output_dir.mkdir(exist_ok=True)
        
        # Файл логов
        self.log_file = self.output_dir / "api_pipeline.log"
        
        # Статистика
        self.total_modules = 0
        self.processed_modules = 0
        self.failed_modules = []
        self.skipped_modules = []
        
        # Настройки по умолчанию
        self.config = {
            'conversion': {
                'codec': 'copy',
                'quality': 23
            },
            'scene_detection': {
                'threshold': 5.0,
                'min_scene_len': 0.5,
                'detector': 'content',
                'extract_frames': True,
                'frame_type': 'middle',
                'extract_clips': False,
                'generate_html': True,
                'split_equal': None
            }
        }
        
        self._init_logging()
    
    def _init_logging(self):
        """Инициализация логирования"""
        self.log_messages = []
        self._log(f"API Pipeline started: {datetime.now()}")
        self._log(f"Output directory: {self.output_dir}")
    
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
        Очистка названия модуля для использования как имя файла
        
        :param module_name: Оригинальное название модуля
        :return: Очищенное имя файла
        """
        import re
        
        # Убираем номер в начале (например, "7. Creating..." -> "Creating...")
        module_name = re.sub(r'^\d+\.\s*', '', module_name)
        
        # Заменяем недопустимые символы
        invalid_chars = '<>:"/\\|?*'
        for char in invalid_chars:
            module_name = module_name.replace(char, '_')
        
        # Ограничиваем длину
        if len(module_name) > 100:
            module_name = module_name[:100]
        
        # Убираем пробелы в начале и конце
        module_name = module_name.strip()
        
        # Заменяем множественные пробелы на один
        module_name = re.sub(r'\s+', ' ', module_name)
        
        # Заменяем пробелы на подчеркивания
        module_name = module_name.replace(' ', '_')
        
        return module_name or "module"
    
    def process_course_data(self, course_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Обработка данных курса
        
        :param course_data: Данные курса в формате JSON
        :return: Список модулей для обработки
        """
        modules = []
        
        try:
            # Извлекаем информацию о курсе
            course_title = course_data.get('title', 'Unknown Course')
            course_url = course_data.get('url', '')
            sections = course_data.get('sections', [])
            
            self._log(f"📚 Processing course: {course_title}")
            self._log(f"   URL: {course_url}")
            self._log(f"   Sections: {len(sections)}")
            
            # Обрабатываем каждую секцию
            for section_idx, section in enumerate(sections, 1):
                section_title = section.get('title', f'Section {section_idx}')
                items = section.get('items', [])
                
                self._log(f"   📖 Section {section_idx}: {section_title} ({len(items)} items)")
                
                # Обрабатываем каждый элемент секции
                for item_idx, item in enumerate(items, 1):
                    item_title = item.get('title', f'Item {item_idx}')
                    video_url = item.get('videoUrl', '')
                    transcript = item.get('transcript', '')
                    
                    if video_url:
                        # Создаем полное название модуля
                        full_title = f"{section_idx}.{item_idx}. {item_title}"
                        
                        modules.append({
                            'module': full_title,
                            'link': video_url,
                            'transcript': transcript,
                            'filename': self._sanitize_filename(full_title),
                            'section': section_title,
                            'item': item_title
                        })
            
            self._log(f"\n📊 Found modules to process: {len(modules)}")
            
            if modules:
                self._log("\n📋 Module list:")
                for i, m in enumerate(modules, 1):
                    self._log(f"   {i:02d}. {m['module'][:50]}...")
            
            return modules
            
        except Exception as e:
            self._log(f"❌ Error processing course data: {str(e)}")
            return []
    
    def step1_convert_module(self, module: Dict[str, Any]) -> bool:
        """
        Шаг 1: Конвертация модуля через m3u8_converter
        
        :param module: Словарь с информацией о модуле
        :return: Успешность конвертации
        """
        module_name = module['module']
        link = module['link']
        filename = module['filename']
        
        self._log(f"\n{'='*50}")
        self._log(f"🎬 STEP 1: MODULE CONVERSION")
        self._log(f"   Module: {module_name}")
        self._log(f"   Link: {link[:100]}...")
        
        # Создаем поддиректорию для модуля
        module_dir = self.output_dir / filename
        module_dir.mkdir(exist_ok=True)
        
        # Путь для выходного файла
        output_file = module_dir / f"{filename}.mp4"
        
        # Проверяем, был ли файл уже обработан
        if output_file.exists() and output_file.stat().st_size > 0:
            self._log(f"✓ Video already exists, skipping conversion: {output_file.name}")
            return True
        
        # Формируем команду для m3u8_converter.py
        cmd = [
            sys.executable,
            "m3u8_converter.py",
            link,
            "-o", str(output_file),
            "--filename", filename,
            "--codec", self.config['conversion']['codec']
        ]
        
        if self.config['conversion']['codec'] != 'copy':
            cmd.extend(["--quality", str(self.config['conversion']['quality'])])
        
        self._log(f"   Output file: {output_file}")
        self._log(f"   Starting converter...")
        
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
                # Проверяем, был ли создан файл
                if output_file.exists() and output_file.stat().st_size > 0:
                    size_mb = output_file.stat().st_size / (1024 * 1024)
                    self._log(f"✅ Conversion successful in {elapsed_time:.1f}s")
                    self._log(f"   File size: {size_mb:.2f} MB")
                    return True
                else:
                    self._log(f"❌ File was not created")
                    return False
            else:
                self._log(f"❌ Error during conversion (code: {result.returncode})")
                if result.stderr:
                    error_lines = result.stderr.strip().split('\n')[-5:]  # Последние 5 строк ошибок
                    for line in error_lines:
                        self._log(f"   {line}")
                return False
                
        except subprocess.TimeoutExpired:
            self._log(f"❌ Timeout during conversion (more than 30 minutes)")
            return False
        except Exception as e:
            self._log(f"❌ Error: {str(e)}")
            return False
    
    def step2_detect_scenes(self, module: Dict[str, Any]) -> bool:
        """
        Шаг 2: Обработка сцен через scene_detector
        
        :param module: Словарь с информацией о модуле
        :return: Успешность обработки сцен
        """
        module_name = module['module']
        filename = module['filename']
        transcript = module.get('transcript', '')
        
        self._log(f"\n{'='*50}")
        self._log(f"🔍 STEP 2: SCENE PROCESSING")
        self._log(f"   Module: {module_name}")
        
        # Пути к файлам
        module_dir = self.output_dir / filename
        video_file = module_dir / f"{filename}.mp4"
        scenes_dir = module_dir / "scenes"
        
        # Проверяем существование видео
        if not video_file.exists():
            self._log(f"❌ Video file not found: {video_file}")
            return False
        
        # Проверяем, были ли сцены уже обработаны
        if scenes_dir.exists() and any(scenes_dir.iterdir()):
            self._log(f"✓ Scenes already processed, skipping: {scenes_dir}")
            return True
        
        # Формируем команду для scene_detector.py
        cmd = [
            sys.executable,
            "scene_detector.py",
            str(video_file),
            "-o", str(scenes_dir),
            "--threshold", str(self.config['scene_detection']['threshold']),
            "--min-scene-len", str(self.config['scene_detection']['min_scene_len']),
            "--detector", self.config['scene_detection']['detector']
        ]
        
        # Добавляем транскрипт, если доступен
        if transcript:
            # Сохраняем транскрипт во временный файл, чтобы избежать проблем с длиной командной строки
            transcript_file = module_dir / "transcript.txt"
            with open(transcript_file, 'w', encoding='utf-8') as f:
                f.write(transcript)
            cmd.extend(["--transcript", str(transcript_file)])
        
        # Добавляем опциональные параметры
        if self.config['scene_detection'].get('split_equal'):
            cmd.extend(["--split-equal", str(self.config['scene_detection']['split_equal'])])
        
        if self.config['scene_detection']['extract_frames']:
            cmd.append("--extract-frames")
            cmd.extend(["--frame-type", self.config['scene_detection']['frame_type']])
        
        if self.config['scene_detection']['extract_clips']:
            cmd.append("--extract-clips")
        
        if self.config['scene_detection']['generate_html']:
            cmd.append("--html")
        
        self._log(f"   Video file: {video_file}")
        self._log(f"   Scenes directory: {scenes_dir}")
        self._log(f"   Starting scene detector...")
        
        try:
            # Запускаем детектор
            start_time = time.time()
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=1800  # 30 минут таймаут
            )
            
            elapsed_time = time.time() - start_time
            
            # Выводим результат
            if result.stdout:
                for line in result.stdout.strip().split('\n'):
                    self._log(f"   {line}")
            
            if result.returncode == 0:
                self._log(f"✅ Scene processing completed in {elapsed_time:.1f}s")
                
                # Проверяем результаты
                self._check_scene_results(scenes_dir)
                return True
            else:
                self._log(f"❌ Error during scene processing (code: {result.returncode})")
                if result.stderr:
                    error_lines = result.stderr.strip().split('\n')[-5:]
                    for line in error_lines:
                        self._log(f"   {line}")
                return False
                
        except subprocess.TimeoutExpired:
            self._log(f"❌ Timeout during scene processing (more than 30 minutes)")
            return False
        except Exception as e:
            self._log(f"❌ Error: {str(e)}")
            return False
    
    def _check_scene_results(self, scenes_dir: Path):
        """Проверка результатов обработки сцен"""
        if not scenes_dir.exists():
            return
        
        # Читаем метаданные
        metadata_file = scenes_dir / "scenes_metadata.json"
        if metadata_file.exists():
            with open(metadata_file, 'r') as f:
                metadata = json.load(f)
                total_scenes = metadata.get('total_scenes', 0)
                self._log(f"\n📊 Scene statistics:")
                self._log(f"   Found scenes: {total_scenes}")
        
        # Подсчитываем файлы
        frames_dir = scenes_dir / "frames"
        clips_dir = scenes_dir / "clips"
        
        if frames_dir.exists():
            frame_count = len(list(frames_dir.glob("*.jpg")))
            self._log(f"   Extracted frames: {frame_count}")
        
        if clips_dir.exists():
            clip_count = len(list(clips_dir.glob("*.mp4")))
            self._log(f"   Extracted clips: {clip_count}")
        
        # Проверяем HTML отчет
        html_file = scenes_dir / "summary.html"
        if html_file.exists():
            self._log(f"   📄 HTML report: {html_file}")
    
    def process_module(self, module: Dict[str, Any]) -> bool:
        """
        Полная обработка одного модуля
        
        :param module: Словарь с информацией о модуле
        :return: Успешность обработки
        """
        module_name = module['module']
        
        self._log(f"\n{'='*60}")
        self._log(f"📦 PROCESSING MODULE: {module_name}")
        self._log(f"{'='*60}")
        
        # Шаг 1: Конвертация
        if not self.step1_convert_module(module):
            self._log(f"❌ Error at conversion step")
            self.failed_modules.append(module_name)
            return False
        
        # Шаг 2: Обработка сцен
        if not self.step2_detect_scenes(module):
            self._log(f"❌ Error at scene processing step")
            self.failed_modules.append(module_name)
            return False
        
        self._log(f"✅ Module successfully processed")
        self.processed_modules += 1
        return True
    
    def cleanup(self):
        """Очистка временных файлов"""
        if not self.keep_temp:
            self._log("\n🧹 Removing temporary files...")
            
            # Удаляем конвертированные видео файлы
            for module_dir in self.output_dir.iterdir():
                if module_dir.is_dir():
                    video_files = list(module_dir.glob("*.mp4"))
                    for video_file in video_files:
                        try:
                            os.remove(video_file)
                            self._log(f"   Removed: {video_file.name}")
                        except Exception as e:
                            self._log(f"   Error removing {video_file.name}: {e}")
    
    def generate_report(self):
        """Генерация финального отчета"""
        report_file = self.output_dir / "api_pipeline_report.txt"
        
        with open(report_file, 'w', encoding='utf-8') as f:
            f.write("="*60 + "\n")
            f.write("API PIPELINE EXECUTION REPORT\n")
            f.write("="*60 + "\n\n")
            
            f.write(f"Execution time: {datetime.now()}\n")
            f.write(f"Output directory: {self.output_dir}\n\n")
            
            f.write("CONFIGURATION:\n")
            f.write(json.dumps(self.config, indent=2, ensure_ascii=False))
            f.write("\n\n")
            
            f.write("STATISTICS:\n")
            f.write("-"*40 + "\n")
            f.write(f"Total modules: {self.total_modules}\n")
            f.write(f"Successfully processed: {self.processed_modules}\n")
            f.write(f"Skipped: {len(self.skipped_modules)}\n")
            f.write(f"Errors: {len(self.failed_modules)}\n\n")
            
            if self.failed_modules:
                f.write("MODULES WITH ERRORS:\n")
                f.write("-"*40 + "\n")
                for module in self.failed_modules:
                    f.write(f"  - {module}\n")
                f.write("\n")
            
            f.write("DETAILED LOG:\n")
            f.write("-"*40 + "\n")
            for log_entry in self.log_messages:
                f.write(log_entry + '\n')
        
        self._log(f"\n📋 Report saved: {report_file}")
    
    def update_config(self, config_dict: Dict[str, Any]):
        """Обновление конфигурации"""
        for key, value in config_dict.items():
            if key in self.config and isinstance(value, dict):
                self.config[key].update(value)
            else:
                self.config[key] = value
    
    def run(self, course_data: Dict[str, Any], start_from: int = 0, max_modules: int = None) -> Dict[str, Any]:
        """
        Запуск полного пайплайна
        
        :param course_data: Данные курса
        :param start_from: С какого модуля начать (0-based индекс)
        :param max_modules: Максимальное количество модулей для обработки
        :return: Результат выполнения
        """
        self._log("\n🚀 STARTING API PIPELINE")
        
        # Обрабатываем данные курса
        modules = self.process_course_data(course_data)
        
        if not modules:
            self._log("❌ No modules to process")
            return {
                'success': False,
                'error': 'No modules found in course data',
                'output_dir': str(self.output_dir)
            }
        
        self.total_modules = len(modules)
        
        # Определяем диапазон обработки
        end_at = len(modules)
        if max_modules:
            end_at = min(start_from + max_modules, len(modules))
        
        modules_to_process = modules[start_from:end_at]
        
        if start_from > 0 or max_modules:
            self._log(f"\n📌 Processing modules from {start_from+1} to {end_at} of {self.total_modules}")
        
        # Обрабатываем каждый модуль
        start_time = time.time()
        
        for i, module in enumerate(modules_to_process, start=start_from+1):
            self._log(f"\n{'='*50}")
            self._log(f"📦 Progress: {i}/{self.total_modules}")
            
            if not self.process_module(module):
                self._log(f"❌ Error processing module {i}")
            
            # Показываем промежуточную статистику
            if i % 5 == 0:  # Каждые 5 модулей
                elapsed = time.time() - start_time
                avg_time = elapsed / i if i > 0 else 0
                remaining = (self.total_modules - i) * avg_time
                
                self._log(f"\n⏱️  Time elapsed: {self._format_time(elapsed)}")
                self._log(f"   Estimated remaining: {self._format_time(remaining)}")
        
        # Финальная статистика
        total_time = time.time() - start_time
        
        self._log(f"\n{'='*60}")
        self._log("✨ API PIPELINE COMPLETED!")
        self._log(f"{'='*60}")
        self._log(f"\n📊 Final statistics:")
        self._log(f"   Total modules: {self.total_modules}")
        self._log(f"   Successfully processed: {self.processed_modules}")
        self._log(f"   Skipped: {len(self.skipped_modules)}")
        self._log(f"   Errors: {len(self.failed_modules)}")
        self._log(f"   Total time: {self._format_time(total_time)}")
        
        if self.processed_modules > 0:
            avg_time_per_module = total_time / self.processed_modules
            self._log(f"   Average time per module: {self._format_time(avg_time_per_module)}")
        
        # Очистка (если нужно)
        if not self.keep_temp:
            self.cleanup()
        
        # Генерируем отчет
        self.generate_report()
        
        self._log(f"\n📁 All results saved in: {self.output_dir}")
        
        # Возвращаем результат
        return {
            'success': len(self.failed_modules) == 0,
            'total_modules': self.total_modules,
            'processed_modules': self.processed_modules,
            'failed_modules': self.failed_modules,
            'skipped_modules': self.skipped_modules,
            'total_time': total_time,
            'output_dir': str(self.output_dir),
            'log_file': str(self.log_file)
        }
    
    def _format_time(self, seconds: float) -> str:
        """Форматирование времени"""
        if seconds < 60:
            return f"{seconds:.0f}s"
        elif seconds < 3600:
            minutes = seconds // 60
            secs = seconds % 60
            return f"{minutes:.0f}m {secs:.0f}s"
        else:
            hours = seconds // 3600
            minutes = (seconds % 3600) // 60
            return f"{hours:.0f}h {minutes:.0f}m"


def main():
    parser = argparse.ArgumentParser(
        description="API Pipeline for processing course data",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Usage examples:
  # Process course data from JSON string
  python pipeline_api.py --data '{"title": "Course", "sections": [...]}'
  
  # Process course data from JSON file
  python pipeline_api.py --data-file course_data.json
  
  # Specify output directory
  python pipeline_api.py --data '{"title": "Course", "sections": [...]}' -o results
  
  # Process with custom settings
  python pipeline_api.py --data '{"title": "Course", "sections": [...]}' --threshold 10 --extract-clips
        """
    )
    
    parser.add_argument(
        "--data",
        help="Course data as JSON string"
    )
    
    parser.add_argument(
        "--data-file",
        help="Path to JSON file with course data"
    )
    
    parser.add_argument(
        "-o", "--output",
        help="Directory for saving results",
        default=None
    )
    
    parser.add_argument(
        "--start-from",
        type=int,
        default=0,
        help="Which module to start from (0-based, default: 0)"
    )
    
    parser.add_argument(
        "--max",
        type=int,
        help="Maximum number of modules to process"
    )
    
    # Conversion parameters
    parser.add_argument(
        "--codec",
        choices=['copy', 'libx264', 'libx265'],
        default='copy',
        help="Video codec for conversion (default: copy)"
    )
    
    parser.add_argument(
        "--quality",
        type=int,
        default=23,
        help="Video quality when re-encoding (0-51, default: 23)"
    )
    
    # Scene detection parameters
    parser.add_argument(
        "--threshold",
        type=float,
        default=5.0,
        help="Scene detection threshold (1-100, default: 5)"
    )
    
    parser.add_argument(
        "--min-scene-len",
        type=float,
        default=0.5,
        help="Minimum scene length in seconds (default: 0.5)"
    )
    
    parser.add_argument(
        "--detector",
        choices=['content', 'adaptive'],
        default='content',
        help="Scene detector type (default: content)"
    )
    
    parser.add_argument(
        "--split-equal",
        type=int,
        metavar="N",
        help="Split into N equal parts instead of detection"
    )
    
    # Extraction parameters
    parser.add_argument(
        "--extract-frames",
        action="store_true",
        default=True,
        help="Extract frames from scenes (default: yes)"
    )
    
    parser.add_argument(
        "--no-extract-frames",
        dest="extract_frames",
        action="store_false",
        help="Don't extract frames"
    )
    
    parser.add_argument(
        "--frame-type",
        choices=['first', 'middle', 'last', 'best'],
        default='middle',
        help="Frame type for extraction (default: middle)"
    )
    
    parser.add_argument(
        "--extract-clips",
        action="store_true",
        help="Extract video clips for each scene"
    )
    
    parser.add_argument(
        "--no-html",
        dest="generate_html",
        action="store_false",
        default=True,
        help="Don't generate HTML report"
    )
    
    parser.add_argument(
        "--keep-temp",
        action="store_true",
        help="Keep temporary files (converted videos)"
    )
    
    args = parser.parse_args()
    
    try:
        # Получаем данные курса
        course_data = None
        
        if args.data:
            course_data = json.loads(args.data)
        elif args.data_file:
            with open(args.data_file, 'r', encoding='utf-8') as f:
                course_data = json.load(f)
        else:
            print("❌ Error: Either --data or --data-file must be specified")
            sys.exit(1)
        
        # Создаем пайплайн
        pipeline = PipelineAPI(
            args.output,
            args.keep_temp
        )
        
        # Обновляем конфигурацию
        config = {
            'conversion': {
                'codec': args.codec,
                'quality': args.quality
            },
            'scene_detection': {
                'threshold': args.threshold,
                'min_scene_len': args.min_scene_len,
                'detector': args.detector,
                'extract_frames': args.extract_frames,
                'frame_type': args.frame_type,
                'extract_clips': args.extract_clips,
                'generate_html': args.generate_html,
                'split_equal': args.split_equal
            }
        }
        pipeline.update_config(config)
        
        # Запускаем пайплайн
        result = pipeline.run(
            course_data,
            start_from=args.start_from,
            max_modules=args.max
        )
        
        # Выводим результат
        print(f"\n📋 Pipeline Result:")
        print(json.dumps(result, indent=2, ensure_ascii=False))
        
        # Возвращаем код выхода
        sys.exit(0 if result['success'] else 1)
        
    except json.JSONDecodeError as e:
        print(f"❌ Error parsing JSON: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
