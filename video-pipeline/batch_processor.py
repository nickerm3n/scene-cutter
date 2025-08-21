#!/usr/bin/env python3
"""
Script for batch processing links from CSV file
Reads playlist.csv and converts all m3u8 links
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
        Initialize processor
        
        :param csv_file: Path to CSV file
        :param output_dir: Directory for saving results
        """
        self.csv_file = Path(csv_file)
        
        # Check file existence
        if not self.csv_file.exists():
            raise FileNotFoundError(f"CSV file not found: {csv_file}")
        
        # Create directory for results
        if output_dir:
            self.output_dir = Path(output_dir)
        else:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            self.output_dir = Path(f"batch_output_{timestamp}")
        
        self.output_dir.mkdir(exist_ok=True)
        
        # Log file
        self.log_file = self.output_dir / "batch_processing.log"
        
        # Statistics
        self.total_modules = 0
        self.processed_modules = 0
        self.failed_modules = []
        self.skipped_modules = []
        
        self._init_logging()
    
    def _init_logging(self):
        """Initialize logging"""
        self.log_messages = []
        self._log(f"="*60)
        self._log(f"Batch Processor started: {datetime.now()}")
        self._log(f"CSV file: {self.csv_file}")
        self._log(f"Output directory: {self.output_dir}")
        self._log(f"="*60)
    
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
    
    def convert_module(self, module: dict) -> bool:
        """
        Convert one module
        
        :param module: Dictionary with module information
        :return: Conversion success
        """
        module_name = module['module']
        link = module['link']
        filename = module['filename']
        
        self._log(f"\n{'='*50}")
        self._log(f"🎬 Processing module: {module_name}")
        self._log(f"   Link: {link[:100]}...")
        
        # Create subdirectory for module
        module_dir = self.output_dir / filename
        module_dir.mkdir(exist_ok=True)
        
        # Path for output file
        output_file = module_dir / f"{filename}.mp4"
        
        # Check if file was already processed
        if output_file.exists() and output_file.stat().st_size > 0:
            self._log(f"✓ File already exists, skipping: {output_file.name}")
            self.skipped_modules.append(module_name)
            return True
        
        # Form command for m3u8_converter.py
        cmd = [
            sys.executable,
            "m3u8_converter.py",
            link,
            "-o", str(output_file),
            "--filename", filename
        ]
        
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
                    self._log(f"✅ Successfully converted in {elapsed_time:.1f}s")
                    self._log(f"   File size: {size_mb:.2f} MB")
                    
                    # Save module information
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
                    self._log(f"❌ File was not created")
                    self.failed_modules.append(module_name)
                    return False
            else:
                self._log(f"❌ Error during conversion (code: {result.returncode})")
                if result.stderr:
                    error_lines = result.stderr.strip().split('\n')[-5:]  # Last 5 error lines
                    for line in error_lines:
                        self._log(f"   {line}")
                self.failed_modules.append(module_name)
                return False
                
        except subprocess.TimeoutExpired:
            self._log(f"❌ Timeout during conversion (more than 30 minutes)")
            self.failed_modules.append(module_name)
            return False
        except Exception as e:
            self._log(f"❌ Error: {str(e)}")
            self.failed_modules.append(module_name)
            return False
    
    def generate_report(self):
        """Generate final report"""
        report_file = self.output_dir / "processing_report.txt"
        
        with open(report_file, 'w', encoding='utf-8') as f:
            f.write("="*60 + "\n")
            f.write("BATCH PROCESSING REPORT\n")
            f.write("="*60 + "\n\n")
            
            f.write(f"Execution time: {datetime.now()}\n")
            f.write(f"CSV file: {self.csv_file}\n")
            f.write(f"Output directory: {self.output_dir}\n\n")
            
            f.write("STATISTICS:\n")
            f.write("-"*40 + "\n")
            f.write(f"Total modules: {self.total_modules}\n")
            f.write(f"Successfully processed: {self.processed_modules}\n")
            f.write(f"Skipped (already exist): {len(self.skipped_modules)}\n")
            f.write(f"Errors: {len(self.failed_modules)}\n\n")
            
            if self.skipped_modules:
                f.write("SKIPPED MODULES:\n")
                f.write("-"*40 + "\n")
                for module in self.skipped_modules:
                    f.write(f"  - {module}\n")
                f.write("\n")
            
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
    
    def run(self, start_from: int = 0, max_modules: int = None):
        """
        Start batch processing
        
        :param start_from: Which module to start from (0-based index)
        :param max_modules: Maximum number of modules to process
        """
        self._log("\n🚀 STARTING BATCH PROCESSING")
        
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
            
            if self.convert_module(module):
                if module['module'] not in self.skipped_modules:
                    self.processed_modules += 1
            
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
        self._log("✨ PROCESSING COMPLETED!")
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
        description="Batch processing of m3u8 links from CSV file",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
CSV file format:
  Module,Link
  "Module name 1","https://example.com/video1.m3u8"
  "Module name 2","https://example.com/video2.m3u8"

Usage examples:
  # Process all modules from playlist.csv
  python batch_processor.py
  
  # Use different CSV file
  python batch_processor.py -f my_playlist.csv
  
  # Specify directory for results
  python batch_processor.py -o my_videos
  
  # Start from specific module (useful for resuming)
  python batch_processor.py --start-from 5
  
  # Process only first N modules
  python batch_processor.py --max 10
  
  # Combine parameters
  python batch_processor.py --start-from 10 --max 5
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
    
    args = parser.parse_args()
    
    try:
        # Create processor
        processor = BatchProcessor(args.file, args.output)
        
        # Start processing
        success = processor.run(
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