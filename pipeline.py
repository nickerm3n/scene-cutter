#!/usr/bin/env python3
"""
Главный скрипт для полного pipeline обработки видео
Шаг 3: Объединение конвертации m3u8 и извлечения сцен
"""

import os
import sys
import argparse
import subprocess
import json
import shutil
from pathlib import Path
from datetime import datetime


class VideoPipeline:
    def __init__(self, input_path: str, output_dir: str = None, keep_temp: bool = False):
        """
        Инициализация pipeline
        
        :param input_path: Путь к m3u8 файлу
        :param output_dir: Директория для результатов
        :param keep_temp: Сохранять ли промежуточные файлы
        """
        self.input_path = Path(input_path)
        self.keep_temp = keep_temp
        
        # Создаем главную директорию для результатов
        if output_dir:
            self.output_dir = Path(output_dir)
        else:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            self.output_dir = Path(f"pipeline_output_{timestamp}")
        
        self.output_dir.mkdir(exist_ok=True)
        
        # Пути к файлам
        self.converted_video = None
        self.scenes_dir = None
        self.log_file = self.output_dir / "pipeline.log"
        
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
        self._log(f"Pipeline запущен: {datetime.now()}")
        self._log(f"Входной файл: {self.input_path}")
        self._log(f"Выходная директория: {self.output_dir}")
    
    def _log(self, message: str):
        """Логирование сообщений"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        log_entry = f"[{timestamp}] {message}"
        print(log_entry)
        self.log_messages.append(log_entry)
        
        # Сохраняем в файл
        with open(self.log_file, 'a', encoding='utf-8') as f:
            f.write(log_entry + '\n')
    
    def update_config(self, config_dict: dict):
        """Обновление конфигурации"""
        for key, value in config_dict.items():
            if key in self.config and isinstance(value, dict):
                self.config[key].update(value)
            else:
                self.config[key] = value
    
    def step1_convert_m3u8(self) -> bool:
        """
        Шаг 1: Конвертация m3u8 в MP4
        """
        self._log("\n" + "="*50)
        self._log("ШАГ 1: КОНВЕРТАЦИЯ M3U8 → MP4")
        self._log("="*50)
        
        # Проверяем существование файла
        if not self.input_path.exists():
            self._log(f"❌ Файл не найден: {self.input_path}")
            return False
        
        # Определяем выходной файл
        self.converted_video = self.output_dir / f"{self.input_path.stem}_converted.mp4"
        
        # Формируем команду для m3u8_converter.py
        cmd = [
            sys.executable,
            "m3u8_converter.py",
            str(self.input_path),
            "-o", str(self.converted_video),
            "--codec", self.config['conversion']['codec']
        ]
        
        if self.config['conversion']['codec'] != 'copy':
            cmd.extend(["--quality", str(self.config['conversion']['quality'])])
        
        self._log(f"Запускаем конвертер...")
        self._log(f"Команда: {' '.join(cmd)}")
        
        try:
            # Запускаем конвертер
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=False
            )
            
            if result.returncode == 0:
                self._log(f"✅ Конвертация успешна: {self.converted_video}")
                
                # Проверяем размер файла
                if self.converted_video.exists():
                    size_mb = self.converted_video.stat().st_size / (1024 * 1024)
                    self._log(f"   Размер файла: {size_mb:.2f} MB")
                    return True
                else:
                    self._log(f"❌ Файл не создан")
                    return False
            else:
                self._log(f"❌ Ошибка конвертации:")
                if result.stderr:
                    self._log(f"   {result.stderr}")
                return False
                
        except FileNotFoundError:
            self._log("❌ Скрипт m3u8_converter.py не найден в текущей директории")
            self._log("   Убедитесь, что файл находится в той же папке")
            return False
        except Exception as e:
            self._log(f"❌ Ошибка: {str(e)}")
            return False
    
    def step2_detect_scenes(self) -> bool:
        """
        Шаг 2: Обнаружение и извлечение сцен
        """
        self._log("\n" + "="*50)
        self._log("ШАГ 2: ОБНАРУЖЕНИЕ И ИЗВЛЕЧЕНИЕ СЦЕН")
        self._log("="*50)
        
        if not self.converted_video or not self.converted_video.exists():
            self._log("❌ Конвертированное видео не найдено")
            return False
        
        # Директория для сцен
        self.scenes_dir = self.output_dir / "scenes"
        
        # Формируем команду для scene_detector.py
        cmd = [
            sys.executable,
            "scene_detector.py",
            str(self.converted_video),
            "-o", str(self.scenes_dir),
            "--threshold", str(self.config['scene_detection']['threshold']),
            "--min-scene-len", str(self.config['scene_detection']['min_scene_len']),
            "--detector", self.config['scene_detection']['detector']
        ]
        
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
        
        self._log(f"Запускаем детектор сцен...")
        self._log(f"Команда: {' '.join(cmd)}")
        
        try:
            # Запускаем детектор
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=False
            )
            
            # Выводим результат
            if result.stdout:
                for line in result.stdout.strip().split('\n'):
                    self._log(f"   {line}")
            
            if result.returncode == 0:
                self._log(f"✅ Обработка сцен завершена")
                
                # Проверяем результаты
                self._check_results()
                return True
            else:
                self._log(f"❌ Ошибка при обработке сцен")
                if result.stderr:
                    self._log(f"   {result.stderr}")
                return False
                
        except FileNotFoundError:
            self._log("❌ Скрипт scene_detector.py не найден в текущей директории")
            self._log("   Убедитесь, что файл находится в той же папке")
            return False
        except Exception as e:
            self._log(f"❌ Ошибка: {str(e)}")
            return False
    
    def _check_results(self):
        """Проверка результатов обработки"""
        if not self.scenes_dir or not self.scenes_dir.exists():
            return
        
        # Читаем метаданные
        metadata_file = self.scenes_dir / "scenes_metadata.json"
        if metadata_file.exists():
            with open(metadata_file, 'r') as f:
                metadata = json.load(f)
                total_scenes = metadata.get('total_scenes', 0)
                self._log(f"\n📊 Статистика:")
                self._log(f"   Найдено сцен: {total_scenes}")
        
        # Подсчитываем файлы
        frames_dir = self.scenes_dir / "frames"
        clips_dir = self.scenes_dir / "clips"
        
        if frames_dir.exists():
            frame_count = len(list(frames_dir.glob("*.jpg")))
            self._log(f"   Извлечено кадров: {frame_count}")
        
        if clips_dir.exists():
            clip_count = len(list(clips_dir.glob("*.mp4")))
            self._log(f"   Извлечено клипов: {clip_count}")
        
        # Проверяем HTML отчет
        html_file = self.scenes_dir / "summary.html"
        if html_file.exists():
            self._log(f"   📄 HTML отчет: {html_file}")
    
    def cleanup(self):
        """Очистка временных файлов"""
        if not self.keep_temp and self.converted_video and self.converted_video.exists():
            self._log("\n🧹 Удаляем временные файлы...")
            try:
                os.remove(self.converted_video)
                self._log(f"   Удален: {self.converted_video.name}")
            except Exception as e:
                self._log(f"   Ошибка при удалении: {e}")
    
    def generate_final_report(self):
        """Генерация финального отчета"""
        report_file = self.output_dir / "pipeline_report.txt"
        
        with open(report_file, 'w', encoding='utf-8') as f:
            f.write("="*60 + "\n")
            f.write("ОТЧЕТ О ВЫПОЛНЕНИИ PIPELINE\n")
            f.write("="*60 + "\n\n")
            
            f.write(f"Время выполнения: {datetime.now()}\n")
            f.write(f"Входной файл: {self.input_path}\n")
            f.write(f"Выходная директория: {self.output_dir}\n\n")
            
            f.write("КОНФИГУРАЦИЯ:\n")
            f.write(json.dumps(self.config, indent=2, ensure_ascii=False))
            f.write("\n\n")
            
            f.write("ЛОГ ВЫПОЛНЕНИЯ:\n")
            f.write("-"*60 + "\n")
            for log_entry in self.log_messages:
                f.write(log_entry + "\n")
        
        self._log(f"\n📋 Финальный отчет: {report_file}")
    
    def run(self) -> bool:
        """
        Запуск полного pipeline
        """
        self._log("\n🚀 ЗАПУСК PIPELINE")
        
        # Шаг 1: Конвертация
        if not self.step1_convert_m3u8():
            self._log("\n❌ Pipeline прерван на шаге конвертации")
            return False
        
        # Шаг 2: Обработка сцен
        if not self.step2_detect_scenes():
            self._log("\n❌ Pipeline прерван на шаге обработки сцен")
            return False
        
        # Очистка (если нужно)
        if not self.keep_temp:
            self.cleanup()
        
        # Генерация отчета
        self.generate_final_report()
        
        self._log("\n" + "="*50)
        self._log("✨ PIPELINE УСПЕШНО ЗАВЕРШЕН!")
        self._log(f"📁 Результаты сохранены в: {self.output_dir}")
        self._log("="*50)
        
        return True


def main():
    parser = argparse.ArgumentParser(
        description="Pipeline для конвертации m3u8 и извлечения сцен",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Примеры использования:
  # Базовый запуск
  python pipeline.py video.m3u8
  
  # С настройкой порога детекции
  python pipeline.py video.m3u8 --threshold 10
  
  # Разбить на равные части вместо детекции
  python pipeline.py video.m3u8 --split-equal 20
  
  # С извлечением клипов и сохранением временных файлов
  python pipeline.py video.m3u8 --extract-clips --keep-temp
  
  # Полная настройка
  python pipeline.py video.m3u8 \\
    --output results \\
    --threshold 5 \\
    --extract-frames \\
    --extract-clips \\
    --frame-type best
        """
    )
    
    parser.add_argument(
        "input",
        help="Путь к m3u8 файлу"
    )
    
    parser.add_argument(
        "-o", "--output",
        help="Директория для результатов",
        default=None
    )
    
    # Параметры конвертации
    parser.add_argument(
        "--codec",
        choices=['copy', 'libx264', 'libx265'],
        default='copy',
        help="Видео кодек для конвертации (по умолчанию: copy)"
    )
    
    parser.add_argument(
        "--quality",
        type=int,
        default=23,
        help="Качество видео при перекодировании (0-51, по умолчанию: 23)"
    )
    
    # Параметры детекции сцен
    parser.add_argument(
        "--threshold",
        type=float,
        default=5.0,
        help="Порог детекции сцен (1-100, по умолчанию: 5)"
    )
    
    parser.add_argument(
        "--min-scene-len",
        type=float,
        default=0.5,
        help="Минимальная длина сцены в секундах (по умолчанию: 0.5)"
    )
    
    parser.add_argument(
        "--detector",
        choices=['content', 'adaptive'],
        default='content',
        help="Тип детектора сцен (по умолчанию: content)"
    )
    
    parser.add_argument(
        "--split-equal",
        type=int,
        metavar="N",
        help="Разбить на N равных частей вместо детекции"
    )
    
    # Параметры извлечения
    parser.add_argument(
        "--extract-frames",
        action="store_true",
        default=True,
        help="Извлекать кадры из сцен (по умолчанию: да)"
    )
    
    parser.add_argument(
        "--no-extract-frames",
        dest="extract_frames",
        action="store_false",
        help="Не извлекать кадры"
    )
    
    parser.add_argument(
        "--frame-type",
        choices=['first', 'middle', 'last', 'best'],
        default='middle',
        help="Тип кадра для извлечения (по умолчанию: middle)"
    )
    
    parser.add_argument(
        "--extract-clips",
        action="store_true",
        help="Извлекать видео клипы для каждой сцены"
    )
    
    parser.add_argument(
        "--no-html",
        dest="generate_html",
        action="store_false",
        default=True,
        help="Не генерировать HTML отчет"
    )
    
    parser.add_argument(
        "--keep-temp",
        action="store_true",
        help="Сохранить промежуточные файлы (конвертированное видео)"
    )
    
    args = parser.parse_args()
    
    # Создаем pipeline
    pipeline = VideoPipeline(
        args.input,
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
    
    # Запускаем pipeline
    success = pipeline.run()
    
    # Возвращаем код выхода
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()