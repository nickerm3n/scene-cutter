#!/usr/bin/env python3
"""
Script for detecting and extracting scenes from video
Step 2: Scene detector with PySceneDetect
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
    print("❌ PySceneDetect not installed!")
    print("   Install: pip install scenedetect[opencv]")
    sys.exit(1)

try:
    import cv2
except ImportError:
    print("❌ OpenCV not installed!")
    print("   Install: pip install opencv-python")
    sys.exit(1)


class SceneExtractor:
    def __init__(self, video_path: str, output_dir: str = None):
        """
        Initialize scene detector
        
        :param video_path: Path to video file
        :param output_dir: Directory for saving results
        """
        self.video_path = Path(video_path)
        if not self.video_path.exists():
            raise FileNotFoundError(f"Video file not found: {video_path}")
        
        # Create directory for results
        if output_dir:
            self.output_dir = Path(output_dir)
        else:
            self.output_dir = self.video_path.parent / f"{self.video_path.stem}_scenes"
        
        self.output_dir.mkdir(exist_ok=True)
        
        # Subdirectories for different output types
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
        Detect scenes in video
        
        :param threshold: Sensitivity threshold (1-100, lower = more scenes)
        :param min_scene_len: Minimum scene length in seconds
        :param detector_type: Detector type ('content' or 'adaptive')
        :return: List of scenes with timestamps
        """
        # Get video information
        cap = cv2.VideoCapture(str(self.video_path))
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = frame_count / fps if fps > 0 else 0
        cap.release()
        
        print(f"🔍 Analyzing video: {self.video_path.name}")
        print(f"   Duration: {duration:.2f}s")
        print(f"   Frames: {frame_count}")
        print(f"   FPS: {fps:.2f}")
        print(f"   Detector: {detector_type}")
        print(f"   Threshold: {threshold}")
        print(f"   Min scene length: {min_scene_len}s")
        
        # Choose detector
        if detector_type == 'adaptive':
            detector = AdaptiveDetector(
                adaptive_threshold=threshold,
                min_scene_len=int(min_scene_len * 30)  # Convert to frames (approximately 30fps)
            )
        else:
            detector = ContentDetector(
                threshold=threshold,
                min_scene_len=int(min_scene_len * 30)
            )
        
        # Detect scenes
        scene_list = detect(str(self.video_path), detector)
        
        if not scene_list:
            print("⚠️  No scenes detected")
            return []
        
        print(f"\n✅ Found scenes: {len(scene_list)}")
        
        # Display scene information
        for i, (start, end) in enumerate(scene_list, 1):
            start_time = start.get_seconds()
            end_time = end.get_seconds()
            scene_duration = end_time - start_time
            
            print(f"   Scene {i:03d}: {self._format_time(start_time)} - {self._format_time(end_time)} (duration: {scene_duration:.2f}s)")
        
        self.scene_list = scene_list
        return scene_list
    
    def _format_time(self, seconds: float) -> str:
        """Format time in HH:MM:SS format"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        return f"{hours:02d}h{minutes:02d}m{secs:02d}s"
    
    def extract_frames(self, frame_type: str = 'middle') -> int:
        """
        Extract frames from scenes
        
        :param frame_type: Type of frame to extract ('first', 'middle', 'last', 'best')
        :return: Number of extracted frames
        """
        if not self.scene_list:
            print("❌ No scenes to extract frames from")
            return 0
        
        print(f"\n📸 Extracting frames ({frame_type}) from {len(self.scene_list)} scenes...")
        
        # Get video FPS for frame calculations
        cap = cv2.VideoCapture(str(self.video_path))
        fps = cap.get(cv2.CAP_PROP_FPS)
        cap.release()
        
        extracted_count = 0
        
        for i, (start, end) in enumerate(self.scene_list, 1):
            # Determine frame position
            if frame_type == 'first':
                frame_time = start
            elif frame_type == 'last':
                frame_time = end
            elif frame_type == 'middle':
                middle_time = (start.get_seconds() + end.get_seconds()) / 2
                frame_time = FrameTimecode(middle_time, fps=fps)
            elif frame_type == 'best':
                # For best frame, we'll use middle for now
                middle_time = (start.get_seconds() + end.get_seconds()) / 2
                frame_time = FrameTimecode(middle_time, fps=fps)
            else:
                frame_time = start
            
            # Extract frame
            frame_filename = f"scene_{i:03d}_{self._format_time(start.get_seconds())}.jpg"
            frame_path = self.frames_dir / frame_filename
            
            if self._extract_frame(frame_time, frame_path):
                print(f"   ✓ Scene {i:03d} -> {frame_filename}")
                extracted_count += 1
            else:
                print(f"   ❌ Failed to extract frame from scene {i:03d}")
        
        print(f"\n✅ Saved frames: {extracted_count}")
        return extracted_count
    
    def _extract_frame(self, frame_time: FrameTimecode, output_path: Path) -> bool:
        """Extract single frame at specified time"""
        try:
            cap = cv2.VideoCapture(str(self.video_path))
            
            # Set position
            frame_number = int(frame_time.get_frames())
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_number)
            
            # Read frame
            ret, frame = cap.read()
            cap.release()
            
            if ret:
                cv2.imwrite(str(output_path), frame)
                return True
            else:
                return False
                
        except Exception as e:
            print(f"   Error extracting frame: {e}")
            return False
    
    def extract_clips(self) -> int:
        """
        Extract video clips for each scene
        
        :return: Number of extracted clips
        """
        if not self.scene_list:
            print("❌ No scenes to extract clips from")
            return 0
        
        print(f"\n🎬 Extracting clips from {len(self.scene_list)} scenes...")
        
        extracted_count = 0
        
        for i, (start, end) in enumerate(self.scene_list, 1):
            clip_filename = f"scene_{i:03d}_{self._format_time(start.get_seconds())}.mp4"
            clip_path = self.clips_dir / clip_filename
            
            if self._extract_clip(start, end, clip_path):
                print(f"   ✓ Scene {i:03d} -> {clip_filename}")
                extracted_count += 1
            else:
                print(f"   ❌ Failed to extract clip from scene {i:03d}")
        
        print(f"\n✅ Saved clips: {extracted_count}")
        return extracted_count
    
    def _extract_clip(self, start: FrameTimecode, end: FrameTimecode, output_path: Path) -> bool:
        """Extract video clip between start and end times"""
        try:
            import subprocess
            
            start_time = start.get_seconds()
            duration = end.get_seconds() - start_time
            
            cmd = [
                "ffmpeg",
                "-i", str(self.video_path),
                "-ss", str(start_time),
                "-t", str(duration),
                "-c", "copy",
                "-y", str(output_path)
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            return result.returncode == 0
            
        except Exception as e:
            print(f"   Error extracting clip: {e}")
            return False
    
    def save_metadata(self):
        """Save scene metadata to JSON file"""
        metadata = {
            "video_file": str(self.video_path),
            "total_scenes": len(self.scene_list),
            "scenes": []
        }
        
        for i, (start, end) in enumerate(self.scene_list, 1):
            scene_info = {
                "scene_number": i,
                "start_time": start.get_seconds(),
                "end_time": end.get_seconds(),
                "duration": end.get_seconds() - start.get_seconds(),
                "start_frame": start.get_frames(),
                "end_frame": end.get_frames()
            }
            metadata["scenes"].append(scene_info)
        
        metadata_file = self.output_dir / "scenes_metadata.json"
        with open(metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        print(f"💾 Metadata saved: {metadata_file}")
    
    def generate_html_report(self):
        """Generate HTML report with scene information"""
        if not self.scene_list:
            return
        
        html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <title>Scene Detection Report - {self.video_path.name}</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; }}
        .header {{ background: #f0f0f0; padding: 20px; border-radius: 5px; }}
        .scene {{ margin: 10px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }}
        .scene-number {{ font-weight: bold; color: #333; }}
        .scene-time {{ color: #666; }}
        .scene-duration {{ color: #888; }}
        .frame-preview {{ margin-top: 10px; }}
        .frame-preview img {{ max-width: 200px; border: 1px solid #ccc; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>Scene Detection Report</h1>
        <p><strong>Video:</strong> {self.video_path.name}</p>
        <p><strong>Total Scenes:</strong> {len(self.scene_list)}</p>
    </div>
"""
        
        for i, (start, end) in enumerate(self.scene_list, 1):
            start_time = start.get_seconds()
            end_time = end.get_seconds()
            duration = end_time - start_time
            
            # Check if frame exists
            frame_filename = f"scene_{i:03d}_{self._format_time(start_time)}.jpg"
            frame_path = self.frames_dir / frame_filename
            
            frame_html = ""
            if frame_path.exists():
                frame_html = f"""
        <div class="frame-preview">
            <img src="frames/{frame_filename}" alt="Scene {i}">
        </div>"""
            
            html_content += f"""
    <div class="scene">
        <div class="scene-number">Scene {i}</div>
        <div class="scene-time">{self._format_time(start_time)} - {self._format_time(end_time)}</div>
        <div class="scene-duration">Duration: {duration:.2f}s</div>{frame_html}
    </div>
"""
        
        html_content += """
</body>
</html>
"""
        
        html_file = self.output_dir / "summary.html"
        with open(html_file, 'w') as f:
            f.write(html_content)
        
        print(f"📄 HTML report: {html_file}")


def main():
    parser = argparse.ArgumentParser(
        description="Detect and extract scenes from video",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Usage examples:
  # Basic scene detection
  python scene_detector.py video.mp4
  
  # With custom threshold
  python scene_detector.py video.mp4 --threshold 10
  
  # Extract frames from scenes
  python scene_detector.py video.mp4 --extract-frames
  
  # Extract clips and frames
  python scene_detector.py video.mp4 --extract-frames --extract-clips
  
  # Split into equal parts instead of detection
  python scene_detector.py video.mp4 --split-equal 20
        """
    )
    
    parser.add_argument(
        "video",
        help="Path to video file"
    )
    
    parser.add_argument(
        "-o", "--output",
        help="Output directory for results"
    )
    
    parser.add_argument(
        "--threshold",
        type=float,
        default=30.0,
        help="Detection threshold (1-100, lower = more scenes, default: 30)"
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
        help="Detector type (default: content)"
    )
    
    parser.add_argument(
        "--split-equal",
        type=int,
        metavar="N",
        help="Split into N equal parts instead of scene detection"
    )
    
    parser.add_argument(
        "--extract-frames",
        action="store_true",
        help="Extract frames from scenes"
    )
    
    parser.add_argument(
        "--frame-type",
        choices=['first', 'middle', 'last', 'best'],
        default='middle',
        help="Frame type to extract (default: middle)"
    )
    
    parser.add_argument(
        "--extract-clips",
        action="store_true",
        help="Extract video clips for each scene"
    )
    
    parser.add_argument(
        "--html",
        action="store_true",
        help="Generate HTML report"
    )
    
    args = parser.parse_args()
    
    try:
        # Create extractor
        extractor = SceneExtractor(args.video, args.output)
        
        if args.split_equal:
            # Split into equal parts
            print(f"🔪 Splitting video into {args.split_equal} equal parts...")
            # This would need to be implemented
            print("❌ Equal splitting not implemented yet")
            return
        
        # Detect scenes
        scenes = extractor.detect_scenes(
            threshold=args.threshold,
            min_scene_len=args.min_scene_len,
            detector_type=args.detector
        )
        
        if not scenes:
            print("❌ No scenes detected")
            return
        
        # Save metadata
        extractor.save_metadata()
        
        # Extract frames if requested
        if args.extract_frames:
            extractor.extract_frames(args.frame_type)
        
        # Extract clips if requested
        if args.extract_clips:
            extractor.extract_clips()
        
        # Generate HTML report if requested
        if args.html:
            extractor.generate_html_report()
        
        print(f"\n✨ Done! Results saved in: {extractor.output_dir}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()