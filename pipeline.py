#!/usr/bin/env python3
"""
Updated pipeline for processing videos from CSV file
Reads CSV, downloads videos through converter, processes through scene detector
"""

import os
import sys
import csv
import argparse
import subprocess
import json
import shutil
from pathlib import Path
from datetime import datetime
import time
import re


class VideoPipeline:
    def __init__(self, csv_file: str = "playlist.csv", output_dir: str = None, keep_temp: bool = False):
        """
        Initialize pipeline
        
        :param csv_file: Path to CSV file with modules
        :param output_dir: Directory for results
        :param keep_temp: Whether to keep temporary files
        """
        self.csv_file = Path(csv_file)
        self.keep_temp = keep_temp
        
        # Check file existence
        if not self.csv_file.exists():
            raise FileNotFoundError(f"CSV file not found: {csv_file}")
        
        # Create main directory for results
        if output_dir:
            self.output_dir = Path(output_dir)
        else:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            self.output_dir = Path(f"pipeline_output_{timestamp}")
        
        self.output_dir.mkdir(exist_ok=True)
        
        # Log file
        self.log_file = self.output_dir / "pipeline.log"
        
        # Statistics
        self.total_modules = 0
        self.processed_modules = 0
        self.failed_modules = []
        self.skipped_modules = []
        
        # Default settings
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
        """Initialize logging"""
        self.log_messages = []
        self._log(f"Pipeline started: {datetime.now()}")
        self._log(f"CSV file: {self.csv_file}")
        self._log(f"Output directory: {self.output_dir}")
    
    def _log(self, message: str):
        """Log messages"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        log_entry = f"[{timestamp}] {message}"
        print(log_entry)
        self.log_messages.append(log_entry)
        
        # Save to file
        with open(self.log_file, 'a', encoding='utf-8') as f:
            f.write(log_entry + '\n')
    
    def _sanitize_filename(self, module_name: str) -> str:
        """
        Clean module name for use as filename
        
        :param module_name: Original module name
        :return: Cleaned filename
        """
        # Remove number at the beginning (e.g., "7. Creating..." -> "Creating...")
        module_name = re.sub(r'^\d+\.\s*', '', module_name)
        
        # Replace invalid characters
        invalid_chars = '<>:"/\\|?*'
        for char in invalid_chars:
            module_name = module_name.replace(char, '_')
        
        # Limit length
        if len(module_name) > 100:
            module_name = module_name[:100]
        
        # Remove spaces at beginning and end
        module_name = module_name.strip()
        
        # Replace multiple spaces with single space
        module_name = re.sub(r'\s+', ' ', module_name)
        
        # Replace spaces with underscores
        module_name = module_name.replace(' ', '_')
        
        return module_name or "module"
    
    def read_csv(self) -> list:
        """
        Read CSV file
        
        :return: List of modules with links
        """
        modules = []
        
        try:
            with open(self.csv_file, 'r', encoding='utf-8') as f:
                # Try different delimiters
                sample = f.read(1024)
                f.seek(0)
                
                # Determine delimiter
                sniffer = csv.Sniffer()
                delimiter = sniffer.sniff(sample).delimiter
                
                # Read CSV
                reader = csv.DictReader(f, delimiter=delimiter)
                
                # Check for required columns
                if reader.fieldnames:
                    # Normalize column names (remove spaces)
                    fieldnames = [field.strip() for field in reader.fieldnames]
                    
                    # Look for Module and Link columns
                    module_col = None
                    link_col = None
                    
                    for field in fieldnames:
                        if 'module' in field.lower():
                            module_col = field
                        elif 'link' in field.lower():
                            link_col = field
                    
                    if not module_col or not link_col:
                        self._log(f"⚠️  'Module' and 'Link' columns not found in CSV")
                        self._log(f"   Found columns: {fieldnames}")
                        return []
                    
                    # Read data
                    f.seek(0)
                    reader = csv.DictReader(f, delimiter=delimiter)
                    
                    for row in reader:
                        # Get values considering spaces in column names
                        module = row.get('Module', '').strip() or row.get(' Module', '').strip()
                        link = row.get('Link', '').strip() or row.get(' Link', '').strip()
                        
                        if module and link:
                            modules.append({
                                'module': module,
                                'link': link,
                                'filename': self._sanitize_filename(module)
                            })
                
                self._log(f"\n📊 Found modules in CSV: {len(modules)}")
                
                if modules:
                    self._log("\n📋 Module list:")
                    for i, m in enumerate(modules, 1):
                        self._log(f"   {i:02d}. {m['module'][:50]}...")
                
                return modules
                
        except Exception as e:
            self._log(f"❌ Error reading CSV: {str(e)}")
            return []
    
    def step1_convert_module(self, module: dict) -> bool:
        """
        Step 1: Convert module through m3u8_converter
        
        :param module: Dictionary with module information
        :return: Conversion success
        """
        module_name = module['module']
        link = module['link']
        filename = module['filename']
        
        self._log(f"\n{'='*50}")
        self._log(f"🎬 STEP 1: MODULE CONVERSION")
        self._log(f"   Module: {module_name}")
        self._log(f"   Link: {link[:100]}...")
        
        # Create subdirectory for module
        module_dir = self.output_dir / filename
        module_dir.mkdir(exist_ok=True)
        
        # Path for output file
        output_file = module_dir / f"{filename}.mp4"
        
        # Check if file was already processed
        if output_file.exists() and output_file.stat().st_size > 0:
            self._log(f"✓ Video already exists, skipping conversion: {output_file.name}")
            return True
        
        # Form command for m3u8_converter.py
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
            # Start converter
            start_time = time.time()
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=1800  # 30 minutes timeout
            )
            
            elapsed_time = time.time() - start_time
            
            if result.returncode == 0:
                # Check if file was created
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
                    error_lines = result.stderr.strip().split('\n')[-5:]  # Last 5 error lines
                    for line in error_lines:
                        self._log(f"   {line}")
                return False
                
        except subprocess.TimeoutExpired:
            self._log(f"❌ Timeout during conversion (more than 30 minutes)")
            return False
        except Exception as e:
            self._log(f"❌ Error: {str(e)}")
            return False
    
    def step2_detect_scenes(self, module: dict) -> bool:
        """
        Step 2: Process scenes through scene_detector
        
        :param module: Dictionary with module information
        :return: Scene processing success
        """
        module_name = module['module']
        filename = module['filename']
        
        self._log(f"\n{'='*50}")
        self._log(f"🔍 STEP 2: SCENE PROCESSING")
        self._log(f"   Module: {module_name}")
        
        # File paths
        module_dir = self.output_dir / filename
        video_file = module_dir / f"{filename}.mp4"
        scenes_dir = module_dir / "scenes"
        
        # Check video existence
        if not video_file.exists():
            self._log(f"❌ Video file not found: {video_file}")
            return False
        
        # Check if scenes were already processed
        if scenes_dir.exists() and any(scenes_dir.iterdir()):
            self._log(f"✓ Scenes already processed, skipping: {scenes_dir}")
            return True
        
        # Form command for scene_detector.py
        cmd = [
            sys.executable,
            "scene_detector.py",
            str(video_file),
            "-o", str(scenes_dir),
            "--threshold", str(self.config['scene_detection']['threshold']),
            "--min-scene-len", str(self.config['scene_detection']['min_scene_len']),
            "--detector", self.config['scene_detection']['detector']
        ]
        
        # Add optional parameters
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
            # Start detector
            start_time = time.time()
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=1800  # 30 minutes timeout
            )
            
            elapsed_time = time.time() - start_time
            
            # Output result
            if result.stdout:
                for line in result.stdout.strip().split('\n'):
                    self._log(f"   {line}")
            
            if result.returncode == 0:
                self._log(f"✅ Scene processing completed in {elapsed_time:.1f}s")
                
                # Check results
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
        """Check scene processing results"""
        if not scenes_dir.exists():
            return
        
        # Read metadata
        metadata_file = scenes_dir / "scenes_metadata.json"
        if metadata_file.exists():
            with open(metadata_file, 'r') as f:
                metadata = json.load(f)
                total_scenes = metadata.get('total_scenes', 0)
                self._log(f"\n📊 Scene statistics:")
                self._log(f"   Found scenes: {total_scenes}")
        
        # Count files
        frames_dir = scenes_dir / "frames"
        clips_dir = scenes_dir / "clips"
        
        if frames_dir.exists():
            frame_count = len(list(frames_dir.glob("*.jpg")))
            self._log(f"   Extracted frames: {frame_count}")
        
        if clips_dir.exists():
            clip_count = len(list(clips_dir.glob("*.mp4")))
            self._log(f"   Extracted clips: {clip_count}")
        
        # Check HTML report
        html_file = scenes_dir / "summary.html"
        if html_file.exists():
            self._log(f"   📄 HTML report: {html_file}")
    
    def process_module(self, module: dict) -> bool:
        """
        Complete processing of one module
        
        :param module: Dictionary with module information
        :return: Processing success
        """
        module_name = module['module']
        
        self._log(f"\n{'='*60}")
        self._log(f"📦 PROCESSING MODULE: {module_name}")
        self._log(f"{'='*60}")
        
        # Step 1: Conversion
        if not self.step1_convert_module(module):
            self._log(f"❌ Error at conversion step")
            self.failed_modules.append(module_name)
            return False
        
        # Step 2: Scene processing
        if not self.step2_detect_scenes(module):
            self._log(f"❌ Error at scene processing step")
            self.failed_modules.append(module_name)
            return False
        
        self._log(f"✅ Module successfully processed")
        self.processed_modules += 1
        return True
    
    def cleanup(self):
        """Clean up temporary files"""
        if not self.keep_temp:
            self._log("\n🧹 Removing temporary files...")
            
            # Remove converted video files
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
        """Generate final report"""
        report_file = self.output_dir / "pipeline_report.txt"
        
        with open(report_file, 'w', encoding='utf-8') as f:
            f.write("="*60 + "\n")
            f.write("PIPELINE EXECUTION REPORT\n")
            f.write("="*60 + "\n\n")
            
            f.write(f"Execution time: {datetime.now()}\n")
            f.write(f"CSV file: {self.csv_file}\n")
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
    
    def update_config(self, config_dict: dict):
        """Update configuration"""
        for key, value in config_dict.items():
            if key in self.config and isinstance(value, dict):
                self.config[key].update(value)
            else:
                self.config[key] = value
    
    def run(self, start_from: int = 0, max_modules: int = None) -> bool:
        """
        Start complete pipeline
        
        :param start_from: Which module to start from (0-based index)
        :param max_modules: Maximum number of modules to process
        """
        self._log("\n🚀 STARTING PIPELINE")
        
        # Read CSV
        modules = self.read_csv()
        
        if not modules:
            self._log("❌ No modules to process")
            return False
        
        self.total_modules = len(modules)
        
        # Determine processing range
        end_at = len(modules)
        if max_modules:
            end_at = min(start_from + max_modules, len(modules))
        
        modules_to_process = modules[start_from:end_at]
        
        if start_from > 0 or max_modules:
            self._log(f"\n📌 Processing modules from {start_from+1} to {end_at} of {self.total_modules}")
        
        # Process each module
        start_time = time.time()
        
        for i, module in enumerate(modules_to_process, start=start_from+1):
            self._log(f"\n{'='*50}")
            self._log(f"📦 Progress: {i}/{self.total_modules}")
            
            if not self.process_module(module):
                self._log(f"❌ Error processing module {i}")
            
            # Show intermediate statistics
            if i % 5 == 0:  # Every 5 modules
                elapsed = time.time() - start_time
                avg_time = elapsed / i if i > 0 else 0
                remaining = (self.total_modules - i) * avg_time
                
                self._log(f"\n⏱️  Time elapsed: {self._format_time(elapsed)}")
                self._log(f"   Estimated remaining: {self._format_time(remaining)}")
        
        # Final statistics
        total_time = time.time() - start_time
        
        self._log(f"\n{'='*60}")
        self._log("✨ PIPELINE COMPLETED!")
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
        
        # Cleanup (if needed)
        if not self.keep_temp:
            self.cleanup()
        
        # Generate report
        self.generate_report()
        
        self._log(f"\n📁 All results saved in: {self.output_dir}")
        
        return len(self.failed_modules) == 0
    
    def _format_time(self, seconds: float) -> str:
        """Format time"""
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
        description="Pipeline for processing videos from CSV file",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
CSV file format:
  Module,Link
  "Module name 1","https://example.com/video1.m3u8"
  "Module name 2","https://example.com/video2.m3u8"

Usage examples:
  # Process all modules from playlist.csv
  python pipeline.py
  
  # Use different CSV file
  python pipeline.py -f my_playlist.csv
  
  # Specify directory for results
  python pipeline.py -o my_results
  
  # Start from specific module
  python pipeline.py --start-from 5
  
  # Process only first N modules
  python pipeline.py --max 10
  
  # Configure scene detection threshold
  python pipeline.py --threshold 10
  
  # Extract clips and keep temporary files
  python pipeline.py --extract-clips --keep-temp
        """
    )
    
    parser.add_argument(
        "-f", "--file",
        default="playlist.csv",
        help="Path to CSV file (default: playlist.csv)"
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
        # Create pipeline
        pipeline = VideoPipeline(
            args.file,
            args.output,
            args.keep_temp
        )
        
        # Update configuration
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
        
        # Start pipeline
        success = pipeline.run(
            start_from=args.start_from,
            max_modules=args.max
        )
        
        # Return exit code
        sys.exit(0 if success else 1)
        
    except FileNotFoundError as e:
        print(f"❌ {e}")
        print("\n💡 Make sure playlist.csv is in the current directory")
        print("   File format:")
        print("   Module,Link")
        print('   "Module name","https://example.com/video.m3u8"')
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()