# Changelog

## [2025-08-15] - Added Transcript Support

### Added
- **Transcript support in CSV files**: Added optional `Transcript` column to CSV format
- **HTML report enhancement**: Transcript is now displayed in HTML reports above scene information
- **Automatic transcript processing**: Pipeline automatically reads and passes transcript to scene detector
- **Styled transcript section**: Transcript is displayed in a formatted, scrollable section with clean styling

### Modified
- **pipeline.py**: Updated CSV reading to include transcript field
- **scene_detector.py**: Added transcript parameter support and HTML generation
- **README.md**: Updated documentation to include transcript format and features

### Technical Details
- Transcript is passed via temporary file to avoid command line length limitations
- HTML styling includes responsive design with max-height and scroll for long transcripts
- Transcript text is properly escaped and formatted with line breaks
- Backward compatibility maintained - transcript column is optional

### Files Changed
- `pipeline.py` - CSV reading and transcript passing
- `scene_detector.py` - HTML generation with transcript
- `README.md` - Documentation updates
- `demo_transcript.html` - Example HTML report (for reference)
