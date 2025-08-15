#!/usr/bin/env python3
"""
Скрипт для загрузки и конвертации m3u8 файлов в видео
Шаг 1: Базовая конвертация
"""

import os
import sys
import subprocess
import argparse
from pathlib import Path
from urllib.parse import urlparse


class M3U8Converter:
    def __init__(self, input_path, output_path=None):
        """
        Инициализация конвертера
        
        :param input_path: Путь к m3u8 файлу или URL
        :param output_path: Путь для сохранения результата
        """
        self.input_path = input_path
        self.output_path = output_path or self._generate_output_path()
        
    def _generate_output_path(self):
        """Генерация имени выходного файла"""
        if self._is_url(self.input_path):
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
        cmd.extend(["-y", self.output_path])
        
        print(f"🎬 Начинаем конвертацию...")
        print(f"   Источник: {self.input_path}")
        print(f"   Результат: {self.output_path}")
        print(f"   Кодек: {codec}")
        
        try:
            # Запускаем ffmpeg
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                universal_newlines=True
            )
            
            # Читаем вывод для отображения прогресса
            for line in process.stderr:
                if "time=" in line:
                    # Показываем прогресс
                    time_str = line.split("time=")[1].split()[0]
                    print(f"\r⏳ Обработка: {time_str}", end="", flush=True)
            
            # Ждем завершения
            process.wait()
            
            if process.returncode == 0:
                print(f"\n✅ Конвертация завершена успешно!")
                print(f"   Файл сохранен: {self.output_path}")
                
                # Получаем информацию о файле
                self.get_video_info()
                return True
            else:
                print(f"\n❌ Ошибка при конвертации")
                return False
                
        except KeyboardInterrupt:
            print("\n⚠️  Конвертация прервана пользователем")
            process.terminate()
            return False
        except Exception as e:
            print(f"\n❌ Ошибка: {str(e)}")
            return False
    
    def get_video_info(self):
        """Получение информации о видео файле"""
        if not os.path.exists(self.output_path):
            return
        
        cmd = [
            "ffprobe",
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            self.output_path
        ]
        
        try:
            import json
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode == 0:
                info = json.loads(result.stdout)
                
                # Извлекаем основную информацию
                duration = float(info.get('format', {}).get('duration', 0))
                size_mb = os.path.getsize(self.output_path) / (1024 * 1024)
                
                print(f"\n📊 Информация о видео:")
                print(f"   Длительность: {self._format_duration(duration)}")
                print(f"   Размер: {size_mb:.2f} MB")
                
                # Информация о видео потоке
                for stream in info.get('streams', []):
                    if stream['codec_type'] == 'video':
                        print(f"   Разрешение: {stream['width']}x{stream['height']}")
                        print(f"   FPS: {eval(stream.get('r_frame_rate', '0/1')):.2f}")
                        break
        except:
            pass
    
    def _format_duration(self, seconds):
        """Форматирование длительности в читаемый вид"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        
        if hours > 0:
            return f"{hours}ч {minutes}м {secs}с"
        elif minutes > 0:
            return f"{minutes}м {secs}с"
        else:
            return f"{secs}с"


def main():
    parser = argparse.ArgumentParser(
        description="Конвертер M3U8 файлов в видео",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Примеры использования:
  # Конвертация локального файла
  python m3u8_converter.py video.m3u8
  
  # Конвертация с URL
  python m3u8_converter.py https://example.com/stream.m3u8
  
  # Указание выходного файла
  python m3u8_converter.py input.m3u8 -o output.mp4
  
  # Перекодирование с указанием качества
  python m3u8_converter.py input.m3u8 --codec libx264 --quality 23
        """
    )
    
    parser.add_argument(
        "input",
        help="Путь к m3u8 файлу или URL"
    )
    
    parser.add_argument(
        "-o", "--output",
        help="Путь для сохранения результата (по умолчанию: input_converted.mp4)",
        default=None
    )
    
    parser.add_argument(
        "--codec",
        help="Видео кодек (по умолчанию: copy - без перекодирования)",
        default="copy",
        choices=["copy", "libx264", "libx265"]
    )
    
    parser.add_argument(
        "--quality",
        help="Качество видео CRF (0-51, меньше = лучше, по умолчанию: 23)",
        type=int,
        default=23
    )
    
    args = parser.parse_args()
    
    # Создаем конвертер
    converter = M3U8Converter(args.input, args.output)
    
    # Запускаем конвертацию
    success = converter.convert(codec=args.codec, quality=args.quality)
    
    # Возвращаем код выхода
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()