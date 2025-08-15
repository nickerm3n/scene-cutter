#!/usr/bin/env python3
"""
Скрипт для обнаружения и извлечения сцен из видео
Шаг 2: Детектор сцен с PySceneDetect
"""

import os
import sys
import argparse
from pathlib import Path
from typing import List, Tuple, Optional
import json

try:
    from scenedetect import detect, ContentDetector, AdaptiveDetector
    from scenedetect.video_manager import VideoManager
    from scenedetect.scene_manager import SceneManager
    from scenedetect.frame_timecode import FrameTimecode
    from scenedetect.stats_manager import StatsManager
except ImportError:
    print("❌ PySceneDetect не установлен!")
    print("   Установите: pip install scenedetect[opencv]")
    sys.exit(1)

try:
    import cv2
except ImportError:
    print("❌ OpenCV не установлен!")
    print("   Установите: pip install opencv-python")
    sys.exit(1)


class SceneExtractor:
    def __init__(self, video_path: str, output_dir: str = None):
        """
        Инициализация детектора сцен
        
        :param video_path: Путь к видео файлу
        :param output_dir: Директория для сохранения результатов
        """
        self.video_path = Path(video_path)
        if not self.video_path.exists():
            raise FileNotFoundError(f"Видео файл не найден: {video_path}")
        
        # Создаем директорию для результатов
        if output_dir:
            self.output_dir = Path(output_dir)
        else:
            self.output_dir = self.video_path.parent / f"{self.video_path.stem}_scenes"
        
        self.output_dir.mkdir(exist_ok=True)
        
        # Поддиректории для разных типов вывода
        self.frames_dir = self.output_dir / "frames"
        self.clips_dir = self.output_dir / "clips"
        self.frames_dir.mkdir(exist_ok=True)
        self.clips_dir.mkdir(exist_ok=True)
        
        self.scenes = []
        self.scene_list = []
        
    def detect_scenes(self, 
                     threshold: float = 30.0,
                     min_scene_len: float = 0.5,
                     detector_type: str = 'content') -> List[Tuple[FrameTimecode, FrameTimecode]]:
        """
        Обнаружение сцен в видео
        
        :param threshold: Порог чувствительности (1-100, меньше = больше сцен)
        :param min_scene_len: Минимальная длина сцены в секундах
        :param detector_type: Тип детектора ('content' или 'adaptive')
        :return: Список сцен с временными метками
        """
        # Получаем информацию о видео
        cap = cv2.VideoCapture(str(self.video_path))
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = frame_count / fps if fps > 0 else 0
        cap.release()
        
        print(f"🔍 Анализируем видео: {self.video_path.name}")
        print(f"   Длительность: {duration:.2f}с")
        print(f"   Кадров: {frame_count}")
        print(f"   FPS: {fps:.2f}")
        print(f"   Детектор: {detector_type}")
        print(f"   Порог: {threshold}")
        print(f"   Мин. длина сцены: {min_scene_len}с")
        
        # Выбираем детектор
        if detector_type == 'adaptive':
            detector = AdaptiveDetector(
                adaptive_threshold=threshold,
                min_scene_len=int(min_scene_len * 30)  # Конвертируем в кадры (примерно 30fps)
            )
        else:
            detector = ContentDetector(
                threshold=threshold,
                min_scene_len=int(min_scene_len * 30)
            )
        
        # Обнаруживаем сцены
        try:
            self.scene_list = detect(str(self.video_path), detector)
            
            print(f"\n✅ Найдено сцен: {len(self.scene_list)}")
            
            # Сохраняем информацию о сценах
            self.scenes = []
            for i, (start_time, end_time) in enumerate(self.scene_list):
                duration = end_time - start_time
                scene_info = {
                    'index': i,
                    'start_time': start_time.get_seconds(),
                    'end_time': end_time.get_seconds(),
                    'duration': duration.get_seconds(),
                    'start_frame': start_time.get_frames(),
                    'end_frame': end_time.get_frames()
                }
                self.scenes.append(scene_info)
                
                print(f"   Сцена {i+1:03d}: {self._format_time(scene_info['start_time'])} - "
                      f"{self._format_time(scene_info['end_time'])} "
                      f"(длительность: {scene_info['duration']:.2f}с)")
            
            # Сохраняем метаданные
            self._save_metadata()
            
            return self.scene_list
            
        except Exception as e:
            print(f"❌ Ошибка при обнаружении сцен: {str(e)}")
            return []
    
    def extract_frames(self, 
                      frame_type: str = 'middle',
                      quality: int = 95) -> List[str]:
        """
        Извлечение кадров из каждой сцены
        
        :param frame_type: Тип кадра ('first', 'middle', 'last', 'best')
        :param quality: Качество JPEG (1-100)
        :return: Список путей к сохраненным кадрам
        """
        if not self.scenes:
            print("⚠️  Сначала необходимо обнаружить сцены!")
            return []
        
        print(f"\n📸 Извлекаем кадры ({frame_type}) из {len(self.scenes)} сцен...")
        
        cap = cv2.VideoCapture(str(self.video_path))
        if not cap.isOpened():
            print(f"❌ Не удалось открыть видео: {self.video_path}")
            return []
        
        saved_frames = []
        
        try:
            for scene in self.scenes:
                frame_num = self._get_frame_number(scene, frame_type)
                
                # Переходим к нужному кадру
                cap.set(cv2.CAP_PROP_POS_FRAMES, frame_num)
                ret, frame = cap.read()
                
                if ret:
                    # Формируем имя файла
                    time_str = self._format_time(scene['start_time'], for_filename=True)
                    frame_path = self.frames_dir / f"scene_{scene['index']+1:03d}_{time_str}.jpg"
                    
                    # Сохраняем кадр
                    cv2.imwrite(str(frame_path), frame, 
                               [cv2.IMWRITE_JPEG_QUALITY, quality])
                    
                    saved_frames.append(str(frame_path))
                    print(f"   ✓ Сцена {scene['index']+1:03d} -> {frame_path.name}")
                else:
                    print(f"   ✗ Не удалось извлечь кадр для сцены {scene['index']+1}")
        
        finally:
            cap.release()
        
        print(f"\n✅ Сохранено кадров: {len(saved_frames)}")
        return saved_frames
    
    def extract_clips(self, use_ffmpeg: bool = True) -> List[str]:
        """
        Извлечение видео клипов для каждой сцены
        
        :param use_ffmpeg: Использовать FFmpeg (True) или OpenCV (False)
        :return: Список путей к сохраненным клипам
        """
        if not self.scenes:
            print("⚠️  Сначала необходимо обнаружить сцены!")
            return []
        
        print(f"\n🎬 Извлекаем клипы из {len(self.scenes)} сцен...")
        
        saved_clips = []
        
        if use_ffmpeg:
            import subprocess
            
            for scene in self.scenes:
                # Формируем имя файла
                time_str = self._format_time(scene['start_time'], for_filename=True)
                clip_path = self.clips_dir / f"scene_{scene['index']+1:03d}_{time_str}.mp4"
                
                # Команда FFmpeg для извлечения клипа
                cmd = [
                    "ffmpeg",
                    "-i", str(self.video_path),
                    "-ss", str(scene['start_time']),
                    "-t", str(scene['duration']),
                    "-c", "copy",  # Копируем без перекодирования
                    "-avoid_negative_ts", "make_zero",
                    "-y",
                    str(clip_path)
                ]
                
                try:
                    result = subprocess.run(cmd, 
                                          capture_output=True, 
                                          text=True)
                    if result.returncode == 0:
                        saved_clips.append(str(clip_path))
                        print(f"   ✓ Сцена {scene['index']+1:03d} -> {clip_path.name} "
                              f"({scene['duration']:.2f}с)")
                    else:
                        print(f"   ✗ Ошибка при извлечении сцены {scene['index']+1}")
                except Exception as e:
                    print(f"   ✗ Ошибка: {str(e)}")
        else:
            # Используем OpenCV (медленнее, но не требует FFmpeg)
            cap = cv2.VideoCapture(str(self.video_path))
            fps = cap.get(cv2.CAP_PROP_FPS)
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            
            for scene in self.scenes:
                time_str = self._format_time(scene['start_time'], for_filename=True)
                clip_path = self.clips_dir / f"scene_{scene['index']+1:03d}_{time_str}.mp4"
                
                # Настраиваем видео writer
                cap.set(cv2.CAP_PROP_POS_FRAMES, scene['start_frame'])
                ret, frame = cap.read()
                if not ret:
                    continue
                    
                height, width = frame.shape[:2]
                out = cv2.VideoWriter(str(clip_path), fourcc, fps, (width, height))
                
                # Записываем кадры
                for frame_num in range(scene['start_frame'], scene['end_frame']):
                    cap.set(cv2.CAP_PROP_POS_FRAMES, frame_num)
                    ret, frame = cap.read()
                    if ret:
                        out.write(frame)
                
                out.release()
                saved_clips.append(str(clip_path))
                print(f"   ✓ Сцена {scene['index']+1:03d} -> {clip_path.name}")
            
            cap.release()
        
        print(f"\n✅ Сохранено клипов: {len(saved_clips)}")
        return saved_clips
    
    def split_equal_parts(self, num_parts: int = 10) -> List[Tuple[float, float]]:
        """
        Разбить видео на равные части (альтернатива детекции сцен)
        
        :param num_parts: Количество частей
        :return: Список временных меток
        """
        cap = cv2.VideoCapture(str(self.video_path))
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = frame_count / fps if fps > 0 else 0
        cap.release()
        
        print(f"\n✂️ Разбиваем видео на {num_parts} равных частей")
        
        part_duration = duration / num_parts
        self.scenes = []
        
        for i in range(num_parts):
            start_time = i * part_duration
            end_time = min((i + 1) * part_duration, duration)
            
            scene_info = {
                'index': i,
                'start_time': start_time,
                'end_time': end_time,
                'duration': end_time - start_time,
                'start_frame': int(start_time * fps),
                'end_frame': int(end_time * fps)
            }
            self.scenes.append(scene_info)
            
            print(f"   Часть {i+1:03d}: {self._format_time(start_time)} - "
                  f"{self._format_time(end_time)} "
                  f"(длительность: {scene_info['duration']:.2f}с)")
        
        self._save_metadata()
        return self.scenes
    
    def _get_frame_number(self, scene: dict, frame_type: str) -> int:
        """Получение номера кадра в зависимости от типа"""
        if frame_type == 'first':
            return scene['start_frame']
        elif frame_type == 'last':
            return scene['end_frame'] - 1
        elif frame_type == 'middle':
            return (scene['start_frame'] + scene['end_frame']) // 2
        else:  # 'best' - берем кадр чуть после начала (обычно более стабильный)
            offset = min(30, (scene['end_frame'] - scene['start_frame']) // 10)
            return scene['start_frame'] + offset
        """Получение номера кадра в зависимости от типа"""
        if frame_type == 'first':
            return scene['start_frame']
        elif frame_type == 'last':
            return scene['end_frame'] - 1
        elif frame_type == 'middle':
            return (scene['start_frame'] + scene['end_frame']) // 2
        else:  # 'best' - берем кадр чуть после начала (обычно более стабильный)
            offset = min(30, (scene['end_frame'] - scene['start_frame']) // 10)
            return scene['start_frame'] + offset
    
    def _format_time(self, seconds: float, for_filename: bool = False) -> str:
        """Форматирование времени"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        
        if for_filename:
            return f"{hours:02d}h{minutes:02d}m{secs:02d}s"
        else:
            return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    
    def _save_metadata(self):
        """Сохранение метаданных о сценах"""
        metadata = {
            'video': str(self.video_path),
            'total_scenes': len(self.scenes),
            'scenes': self.scenes
        }
        
        metadata_path = self.output_dir / 'scenes_metadata.json'
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)
        
        print(f"\n💾 Метаданные сохранены: {metadata_path}")
    
    def generate_summary(self):
        """Генерация HTML страницы с результатами"""
        if not self.scenes:
            return
        
        html_content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Анализ сцен: {self.video_path.name}</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }}
        h1 {{ color: #333; }}
        .scene {{ 
            background: white; 
            margin: 20px 0; 
            padding: 15px; 
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        .scene img {{ 
            max-width: 100%; 
            height: auto; 
            border-radius: 4px;
        }}
        .scene-info {{ 
            margin: 10px 0; 
            color: #666;
        }}
        .stats {{
            background: #e8f4f8;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
        }}
    </style>
</head>
<body>
    <h1>📹 Анализ сцен: {self.video_path.name}</h1>
    
    <div class="stats">
        <h2>📊 Статистика</h2>
        <p>Всего сцен: <strong>{len(self.scenes)}</strong></p>
        <p>Средняя длительность: <strong>{sum(s['duration'] for s in self.scenes) / len(self.scenes):.2f}</strong> сек</p>
        <p>Общая длительность: <strong>{sum(s['duration'] for s in self.scenes):.2f}</strong> сек</p>
    </div>
    
    <h2>🎬 Сцены</h2>
"""
        
        for scene in self.scenes:
            time_str = self._format_time(scene['start_time'], for_filename=True)
            frame_path = f"frames/scene_{scene['index']+1:03d}_{time_str}.jpg"
            
            html_content += f"""
    <div class="scene">
        <h3>Сцена {scene['index']+1}</h3>
        <img src="{frame_path}" alt="Сцена {scene['index']+1}">
        <div class="scene-info">
            <p>⏱️ Время: {self._format_time(scene['start_time'])} - {self._format_time(scene['end_time'])}</p>
            <p>⏳ Длительность: {scene['duration']:.2f} сек</p>
            <p>🎞️ Кадры: {scene['start_frame']} - {scene['end_frame']}</p>
        </div>
    </div>
"""
        
        html_content += """
</body>
</html>
"""
        
        html_path = self.output_dir / 'summary.html'
        with open(html_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        print(f"📄 HTML отчет: {html_path}")


def main():
    parser = argparse.ArgumentParser(
        description="Детектор и экстрактор сцен из видео",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Примеры использования:
  # Базовое обнаружение сцен
  python scene_detector.py video.mp4
  
  # С извлечением кадров
  python scene_detector.py video.mp4 --extract-frames
  
  # С извлечением клипов
  python scene_detector.py video.mp4 --extract-clips
  
  # Настройка чувствительности (меньше = больше сцен)
  python scene_detector.py video.mp4 --threshold 20
  
  # Полный анализ
  python scene_detector.py video.mp4 --extract-frames --extract-clips --html
        """
    )
    
    parser.add_argument(
        "video",
        help="Путь к видео файлу"
    )
    
    parser.add_argument(
        "-o", "--output",
        help="Директория для сохранения результатов",
        default=None
    )
    
    parser.add_argument(
        "--threshold",
        type=float,
        default=30.0,
        help="Порог чувствительности (1-100, по умолчанию: 30)"
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
        help="Тип детектора (по умолчанию: content)"
    )
    
    parser.add_argument(
        "--extract-frames",
        action="store_true",
        help="Извлечь кадры из сцен"
    )
    
    parser.add_argument(
        "--frame-type",
        choices=['first', 'middle', 'last', 'best'],
        default='middle',
        help="Какой кадр извлекать (по умолчанию: middle)"
    )
    
    parser.add_argument(
        "--extract-clips",
        action="store_true",
        help="Извлечь видео клипы для каждой сцены"
    )
    
    parser.add_argument(
        "--html",
        action="store_true",
        help="Генерировать HTML отчет"
    )
    
    parser.add_argument(
        "--split-equal",
        type=int,
        metavar="N",
        help="Разбить видео на N равных частей вместо детекции сцен"
    )
    
    parser.add_argument(
        "--quality",
        type=int,
        default=95,
        help="Качество JPEG для кадров (1-100, по умолчанию: 95)"
    )
    
    args = parser.parse_args()
    
    # Создаем экстрактор
    extractor = SceneExtractor(args.video, args.output)
    
    # Выбираем метод разбиения
    if args.split_equal:
        # Разбиваем на равные части
        scenes = extractor.split_equal_parts(args.split_equal)
    else:
        # Обнаруживаем сцены автоматически
        scenes = extractor.detect_scenes(
            threshold=args.threshold,
            min_scene_len=args.min_scene_len,
            detector_type=args.detector
        )
    
    if not scenes:
        print("❌ Сцены не найдены")
        sys.exit(1)
    
    # Извлекаем кадры если нужно
    if args.extract_frames:
        extractor.extract_frames(
            frame_type=args.frame_type,
            quality=args.quality
        )
    
    # Извлекаем клипы если нужно
    if args.extract_clips:
        extractor.extract_clips()
    
    # Генерируем HTML отчет
    if args.html:
        extractor.generate_summary()
    
    print(f"\n✨ Готово! Результаты сохранены в: {extractor.output_dir}")


if __name__ == "__main__":
    main()