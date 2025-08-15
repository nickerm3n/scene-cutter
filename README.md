# Course Parser - Video Course Processing System

Updated system for automatic video processing from CSV files with m3u8 conversion and scene detection support.

## Features

- 📁 Read video list from CSV file
- 🎬 Convert m3u8 links to MP4 video
- 🔍 Automatic scene detection in video
- 📸 Extract key frames from each scene
- 📄 Generate HTML reports
- 📊 Detailed statistics and logging

## File Structure

```
course-parser/
├── playlist.csv              # CSV file with modules and links
├── pipeline.py               # Main pipeline script
├── m3u8_converter.py         # m3u8 to MP4 converter
├── scene_detector.py         # Scene detector
├── batch_processor.py        # Batch processor (deprecated)
└── README.md                 # This documentation
```

## CSV File Format

Create a `playlist.csv` file in the following format:

```csv
Module,Link
"7. Creating a Free Gemini AI API Token","https://example.com/video1.m3u8"
"8. Advanced API Usage","https://example.com/video2.m3u8"
```

## Usage

### Basic Launch

```bash
# Process all modules from playlist.csv
python3 pipeline.py
```

### Advanced Options

```bash
# Use different CSV file
python3 pipeline.py -f my_playlist.csv

# Specify directory for results
python3 pipeline.py -o my_results

# Start from specific module (useful for resuming)
python3 pipeline.py --start-from 5

# Process only first N modules
python3 pipeline.py --max 10

# Configure scene detection threshold
python3 pipeline.py --threshold 10 --min-scene-len 1.0

# Extract clips and keep temporary files
python3 pipeline.py --extract-clips --keep-temp

# Full configuration
python3 pipeline.py \
  -f my_playlist.csv \
  -o results \
  --threshold 5 \
  --extract-frames \
  --extract-clips \
  --frame-type middle \
  --keep-temp
```

## Parameters

### Main Parameters

- `-f, --file` - Path to CSV file (default: playlist.csv)
- `-o, --output` - Directory for results
- `--start-from` - Which module to start from (0-based)
- `--max` - Maximum number of modules to process

### Conversion Parameters

- `--codec` - Video codec (copy, libx264, libx265, default: copy)
- `--quality` - Video quality when re-encoding (0-51, default: 23)

### Scene Detection Parameters

- `--threshold` - Scene detection threshold (1-100, default: 5)
- `--min-scene-len` - Minimum scene length in seconds (default: 0.5)
- `--detector` - Detector type (content, adaptive, default: content)
- `--split-equal` - Split into N equal parts instead of detection

### Extraction Parameters

- `--extract-frames` - Extract frames from scenes (default: yes)
- `--frame-type` - Frame type (first, middle, last, best, default: middle)
- `--extract-clips` - Extract video clips for each scene
- `--no-html` - Don't generate HTML report
- `--keep-temp` - Keep temporary files (converted videos)

## Results Structure

After pipeline execution, the following structure is created:

```
pipeline_output_YYYYMMDD_HHMMSS/
├── Module_Name_1/
│   ├── Module_Name_1.mp4          # Converted video (if --keep-temp)
│   └── scenes/
│       ├── frames/                 # Extracted frames
│       │   ├── scene_001_00h00m00s.jpg
│       │   ├── scene_002_00h01m19s.jpg
│       │   └── ...
│       ├── clips/                  # Video clips (if --extract-clips)
│       ├── scenes_metadata.json    # Scene metadata
│       └── summary.html           # HTML report
├── Module_Name_2/
│   └── ...
├── pipeline.log                   # Detailed execution log
└── pipeline_report.txt            # Final report
```

## Usage Examples

### Process one module for testing

```bash
python3 pipeline.py --max 1
```

### Resume processing from module 5

```bash
python3 pipeline.py --start-from 5
```

### Process with lecture settings

```bash
python3 pipeline.py \
  --threshold 3 \
  --min-scene-len 2.0 \
  --extract-frames \
  --frame-type middle \
  --extract-clips \
  --keep-temp
```

### Process with equal splitting

```bash
python3 pipeline.py --split-equal 20
```

## Requirements

- Python 3.7+
- FFmpeg
- PySceneDetect
- OpenCV

### Install Dependencies

```bash
# FFmpeg (macOS)
brew install ffmpeg

# Python dependencies
pip install scenedetect[opencv] opencv-python
```

## Logging

The system creates detailed logs:

- `pipeline.log` - Detailed execution log
- `pipeline_report.txt` - Final report with statistics
- Console output with real-time progress

## Error Handling

- System continues working even with errors in individual modules
- Detailed error information is written to log
- Ability to resume from any module
- Timeouts to prevent hanging

## Performance

- Parallel processing not supported (for stability)
- Recommended to process no more than 10-20 modules at once
- Processing time depends on video size and detection settings
- Average time: 1-3 minutes per module
