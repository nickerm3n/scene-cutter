#!/usr/bin/env python3
"""
Script for downloading and converting m3u8 files to video
Updated version for working with batch processor
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
        Initialize converter
        
        :param input_path: Path to m3u8 file or URL
        :param output_path: Path for saving result
        :param filename: Filename (if passed from batch processor)
        """
        self.input_path = input_path
        self.filename = filename
        
        if output_path:
            self.output_path = Path(output_path)
        else:
            self.output_path = Path(self._generate_output_path())
        
    def _generate_output_path(self):
        """Generate output filename"""
        if self.filename:
            # If filename is passed from batch processor
            return f"{self.filename}.mp4"
        elif self._is_url(self.input_path):
            # If it's a URL, use the last part of the path
            parsed = urlparse(self.input_path)
            filename = Path(parsed.path).stem or "output"
        else:
            # If local file
            filename = Path(self.input_path).stem
        
        return f"{filename}_converted.mp4"
    
    def _is_url(self, path):
        """Check if path is URL"""
        try:
            result = urlparse(path)
            return all([result.scheme, result.netloc])
        except:
            return False
    
    def check_ffmpeg(self):
        """Check if ffmpeg is available"""
        try:
            subprocess.run(["ffmpeg", "-version"], 
                         capture_output=True, 
                         check=True)
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("❌ FFmpeg not found. Install FFmpeg to continue.")
            print("   Ubuntu/Debian: sudo apt-get install ffmpeg")
            print("   MacOS: brew install ffmpeg")
            print("   Windows: download from https://ffmpeg.org/download.html")
            return False
    
    def convert(self, codec='copy', quality=None):
        """
        Convert m3u8 to video file
        
        :param codec: Video codec ('copy' for copying without re-encoding)
        :param quality: Video quality (for re-encoding, e.g. '23' for CRF)
        """
        if not self.check_ffmpeg():
            return False
        
        # Form ffmpeg command with necessary parameters for m3u8
        cmd = [
            "ffmpeg",
            "-protocol_whitelist", "file,crypto,data,https,tcp,tls",
            "-allowed_extensions", "ALL",
            "-i", self.input_path,
        ]
        
        # Add encoding parameters
        if codec == 'copy':
            cmd.extend([
                "-c", "copy",
                "-bsf:a", "aac_adtstoasc"  # Important for AAC audio in MP4
            ])
        else:
            cmd.extend([
                "-c:v", codec,
                "-c:a", "aac",  # Re-encode audio to AAC for compatibility
                "-bsf:a", "aac_adtstoasc"
            ])
            # Add quality parameter if specified
            if quality:
                cmd.extend(["-crf", str(quality)])
        
        # Add parameter for overwriting file
        cmd.extend(["-y", str(self.output_path)])
        
        print(f"🎬 Starting conversion...")
        print(f"   Source: {self.input_path}")
        print(f"   Result: {self.output_path}")
        print(f"   Codec: {codec}")
        
        try:
            # Run ffmpeg
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=True
            )
            
            print(f"✅ Conversion completed successfully!")
            
            # Check file size
            if self.output_path.exists():
                size_mb = self.output_path.stat().st_size / (1024 * 1024)
                print(f"   File size: {size_mb:.2f} MB")
            
            return True
            
        except subprocess.CalledProcessError as e:
            print(f"❌ Error during conversion:")
            if e.stderr:
                print(f"   {e.stderr}")
            return False
        except Exception as e:
            print(f"❌ Unexpected error: {e}")
            return False


def main():
    parser = argparse.ArgumentParser(
        description="Convert m3u8 files to MP4",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Usage examples:
  # Convert URL
  python m3u8_converter.py "https://example.com/video.m3u8"
  
  # Convert local file
  python m3u8_converter.py video.m3u8
  
  # With output file specified
  python m3u8_converter.py video.m3u8 -o output.mp4
  
  # With filename from batch processor
  python m3u8_converter.py video.m3u8 --filename "my_video"
  
  # With re-encoding
  python m3u8_converter.py video.m3u8 --codec libx264 --quality 23
        """
    )
    
    parser.add_argument(
        "input",
        help="Path to m3u8 file or URL"
    )
    
    parser.add_argument(
        "-o", "--output",
        help="Path for saving result"
    )
    
    parser.add_argument(
        "--filename",
        help="Filename (used if --output is not specified)"
    )
    
    parser.add_argument(
        "--codec",
        choices=['copy', 'libx264', 'libx265'],
        default='copy',
        help="Video codec (default: copy)"
    )
    
    parser.add_argument(
        "--quality",
        type=int,
        help="Video quality when re-encoding (0-51)"
    )
    
    args = parser.parse_args()
    
    try:
        # Create converter
        converter = M3U8Converter(
            args.input,
            args.output,
            args.filename
        )
        
        # Start conversion
        success = converter.convert(args.codec, args.quality)
        
        if success:
            print(f"\n📁 File saved: {converter.output_path}")
            sys.exit(0)
        else:
            sys.exit(1)
            
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()