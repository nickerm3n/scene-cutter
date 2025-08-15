#!/usr/bin/env python3
"""
Скрипт для загрузки и конвертации m3u8 файлов в видео
Обновленная версия для работы с batch processor
"""

import os
import sys
import subprocess
import argparse
from pathlib import Path
from urllib.parse import urlparse


class M3U8Converter:
    def __init__(self, input_path, output_path=None, filename=None):
        """
        Инициализация конвертера
        
        :param input_path: Путь к m3u8 файлу или URL
        :param output_path: Путь для сохранения результата
        :param filename: Имя файла (если передается от batch processor)
        """
        self.input_path = input_path
        self.filename = filename
        
        if output_path:
            self.output_path = Path(output_path)
        else:
            self.output_path = Path(self._generate_output_path())
        
    def _generate_output_path(self):
        """Генерация имени выходного файла"""
        if self.filename:
            # Если имя файла передано от batch processor
            return f"{self.filename}.mp4"
        elif self._is_url(self.input_path):
            # Если это URL, используем последнюю часть пути
            parsed = urlparse(self.input_path)
            filename = Path(parsed.path).stem or "output"
        else:
            # Если локальный файл
            filename = Path(self.input_path).stem
        
        return f"{filename}_converted.mp4"
    
    def _is_url(self, path):
        """Проверка, является ли путь URL"""
        try:
            result = urlparse(path)
            return all([result.scheme, result.netloc])
        except:
            return False
    
    def check_ffmpeg(self):
        """Проверка наличия ffmpeg"""
        try:
            subprocess.run(["ffmpeg", "-version"], 
                         capture_output=True, 
                         check=True)
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("❌ FFmpeg не найден. Установите FFmpeg для продолжения.")
            print("   Ubuntu/Debian: sudo apt-get install ffmpeg")
            print("   MacOS: brew install ffmpeg")
            print("   Windows: скачайте с https://ffmpeg.org/download.html")
            return False
    
    def convert(self, codec='copy', quality=None):
        """
        Конвертация m3u8 в видео файл
        
        :param codec: Видео кодек ('copy' для копирования без перекодирования)
        :param quality: Качество видео (для перекодирования, например '23' для CRF)
        """
        if not self.check_ffmpeg():
            return False
        
        # Формируем команду ffmpeg с необходимыми параметрами для m3u8
        cmd = [
            "ffmpeg",
            "-protocol_whitelist", "file,crypto,data,https,tcp,tls",
            "-allowed_extensions", "ALL",
            "-i", self.input_path,
        ]
        
        # Добавляем параметры кодирования
        if codec == 'copy':
            cmd.extend([
                "-c", "copy",
                "-bsf:a", "aac_adtstoasc"  # Важно для AAC аудио в MP4
            ])
        else:
            cmd.extend([
                "-c:v", codec,
                "-c:a", "aac",  # Перекодируем аудио в AAC для совместимости
                "-bsf:a", "aac_adtstoasc"
            ])
            # Добавляем параметр качества если указан
            if quality:
                cmd.extend(["-crf", str(quality)])
        
        # Добавляем параметр для перезаписи файла
        cmd.extend(["-y", str(self.output_path)])
        
        print(f"🎬 Начинаем конвертацию...")
        print(f"   Источник: {self.input_path}")
        print(f"   Результат: {self.output_path}")
        print(f"   Кодек: {codec}")
        
        try:
            # Запускаем ffmpeg
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=True
            )
            
            print(f"✅ Конвертация завершена успешно!")
            
            # Проверяем размер файла
            if self.output_path.exists():
                size_mb = self.output_path.stat().st_size / (1024 * 1024)
                print(f"   Размер файла: {size_mb:.2f} MB")
            
            return True
            
        except subprocess.CalledProcessError as e:
            print(f"❌ Ошибка при конвертации:")
            if e.stderr:
                print(f"   {e.stderr}")
            return False
        except Exception as e:
            print(f"❌ Неожиданная ошибка: {e}")
            return False


def main():
    parser = argparse.ArgumentParser(
        description="Конвертация m3u8 файлов в MP4",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Примеры использования:
  # Конвертация URL
  python m3u8_converter.py "https://example.com/video.m3u8"
  
  # Конвертация локального файла
  python m3u8_converter.py video.m3u8
  
  # С указанием выходного файла
  python m3u8_converter.py video.m3u8 -o output.mp4
  
  # С именем файла от batch processor
  python m3u8_converter.py video.m3u8 --filename "my_video"
  
  # С перекодированием
  python m3u8_converter.py video.m3u8 --codec libx264 --quality 23
        """
    )
    
    parser.add_argument(
        "input",
        help="Путь к m3u8 файлу или URL"
    )
    
    parser.add_argument(
        "-o", "--output",
        help="Путь для сохранения результата"
    )
    
    parser.add_argument(
        "--filename",
        help="Имя файла (используется если не указан --output)"
    )
    
    parser.add_argument(
        "--codec",
        choices=['copy', 'libx264', 'libx265'],
        default='copy',
        help="Видео кодек (по умолчанию: copy)"
    )
    
    parser.add_argument(
        "--quality",
        type=int,
        help="Качество видео при перекодировании (0-51)"
    )
    
    args = parser.parse_args()
    
    try:
        # Создаем конвертер
        converter = M3U8Converter(
            args.input,
            args.output,
            args.filename
        )
        
        # Запускаем конвертацию
        success = converter.convert(args.codec, args.quality)
        
        if success:
            print(f"\n📁 Файл сохранен: {converter.output_path}")
            sys.exit(0)
        else:
            sys.exit(1)
            
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()