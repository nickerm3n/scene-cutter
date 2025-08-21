# Course Content Pipeline

TypeScript-based pipeline for processing course content through LLM with template-based regeneration.

## Features

- 📚 **Module Processing**: Automatically processes course modules from video transcripts
- 🤖 **LLM Integration**: Uses OpenAI GPT-4 for content regeneration
- 🖼️ **Vision Processing**: Integrates images and visual content using GPT-4o
- 📄 **HTML Parsing**: Extracts transcripts from HTML files with structured content
- 🎯 **Template-Based**: Follows customizable markdown templates
- 📁 **Batch Processing**: Processes multiple modules with progress tracking
- 💾 **Structured Output**: Generates organized markdown files with metadata
- ⏰ **Timestamp Matching**: Matches images with transcript timestamps

## Quick Start

### 1. Install Dependencies

```bash
cd video-pipeline
npm install
```

### 2. Configure Environment

Copy the environment template and configure your API keys:

```bash
cp env.example .env
```

Edit `.env` file:
```env
OPENAI_API_KEY=your_openai_api_key_here
INPUT_DIR=course_output_20250821_122616
OUTPUT_DIR=processed_course
TEMPLATE_FILE=template.md
```

### 3. Test the Pipeline

```bash
# Test basic file operations
npm run test:basic

# Test HTML parsing
npm run test:html

# Test single module with LLM (requires API key)
npm run test:llm

# Test vision processing with images (requires API key)
npm run test:vision

# Run full pipeline
npm run start:simple

# Run vision-enhanced pipeline
npm run start:vision
```

## Project Structure

```
video-pipeline/
├── src/
│   ├── types/                    # TypeScript interfaces
│   ├── utils/                    # File and HTML parsing utilities
│   │   ├── file-utils.ts         # File system operations
│   │   └── simple-html-parser.ts # HTML parsing without external deps
│   ├── services/                 # LLM and content processing services
│   │   ├── simple-llm-service.ts # OpenAI API integration
│   │   ├── simple-content-processor.ts # Main processing logic
│   │   └── vision-processor.ts   # Vision-enhanced processing
│   ├── index.ts                  # Main pipeline (with LangChain)
│   ├── simple-index.ts           # Simplified main pipeline
│   ├── vision-index.ts           # Vision-enhanced pipeline
│   └── test-*.ts                 # Test scripts
├── template.md                   # Content generation template
├── package.json                  # Dependencies and scripts
├── tsconfig.json                 # TypeScript configuration
└── env.example                   # Environment variables template
```

## Available Scripts

- `npm run test:basic` - Test basic file operations
- `npm run test:html` - Test HTML parsing functionality
- `npm run test:llm` - Test single module with LLM processing
- `npm run test:vision` - Test vision-enhanced processing with images
- `npm run start:simple` - Run full pipeline with simplified components
- `npm run start:vision` - Run vision-enhanced pipeline with image processing
- `npm run dev` - Run original pipeline (requires LangChain)
- `npm run build` - Build TypeScript to JavaScript

## Input Structure

The pipeline expects course modules in the following structure:

```
course_output_20250821_122616/
├── 1._28._Third-Party_MCP_Hubs/
│   ├── 1._28._Third-Party_MCP_Hubs.mp4
│   ├── transcript.txt
│   └── scenes/
│       ├── summary.html          # Main transcript source
│       ├── scenes_metadata.json
│       ├── clips/
│       └── frames/
├── 2._29._Another_Module/
│   └── ...
```

### Module Directory Naming

Modules should follow the pattern: `{section}._{lesson}._{title}`
- Example: `1._28._Third-Party_MCP_Hubs`

## Output Structure

Processed content is saved in the following structure:

```
processed_course/
├── README.md                    # Overview of processed modules
├── summary.json                 # Processing metadata
├── 1._28._Third-Party_MCP_Hubs.md
├── 2._29._Another_Module.md
└── ...
```

## Configuration

### Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key (required)
- `INPUT_DIR`: Directory containing course modules (default: `course_output_20250821_122616`)
- `OUTPUT_DIR`: Directory for processed content (default: `processed_course`)
- `TEMPLATE_FILE`: Markdown template file (default: `template.md`)

### LLM Configuration

The pipeline uses the following LLM settings:
- **Model**: `gpt-4-turbo-preview` (standard) / `gpt-4o` (vision)
- **Temperature**: `0.3` (balanced creativity and consistency)
- **Max Tokens**: `4000` (per chunk)

### Vision Processing

The vision-enhanced pipeline includes:
- **Image Extraction**: Automatically extracts frames from video content
- **Timestamp Matching**: Matches images with transcript timestamps
- **Contextual Placement**: Places images where they enhance understanding
- **Markdown Integration**: Embeds images using proper markdown syntax

## Customization

### Template Modification

Edit `template.md` to customize the output format:

```markdown
# {MODULE_TITLE}

## Overview
{OVERVIEW_SECTION}

## Key Concepts
{KEY_CONCEPTS_SECTION}

## Main Content
{MAIN_CONTENT_SECTION}
```

### Processing Logic

The pipeline processes content in the following order:

1. **Content Extraction**: Reads HTML files and extracts transcripts
2. **Chunking**: Splits long transcripts into manageable chunks
3. **LLM Processing**: Sends chunks to OpenAI with template instructions
4. **Content Assembly**: Combines processed chunks into final markdown
5. **Output Generation**: Saves structured content to files

### Vision Processing Logic

The vision-enhanced pipeline adds:

1. **Image Extraction**: Extracts frames from video content
2. **Timestamp Matching**: Matches images with transcript timestamps
3. **Vision Analysis**: Analyzes images with GPT-4o vision capabilities
4. **Contextual Integration**: Places images contextually in markdown
5. **Enhanced Output**: Generates markdown with embedded image references

## Testing

### Step-by-Step Testing

1. **Basic File Operations**: `npm run test:basic`
   - Tests file reading, directory parsing, module discovery

2. **HTML Parsing**: `npm run test:html`
   - Tests HTML transcript extraction and structured content parsing

3. **LLM Processing**: `npm run test:llm`
   - Tests OpenAI API integration with a single module

4. **Vision Processing**: `npm run test:vision`
   - Tests vision-enhanced processing with images

5. **Full Pipeline**: `npm run start:simple`
   - Processes all modules in the input directory

6. **Vision Pipeline**: `npm run start:vision`
   - Processes all modules with vision capabilities

### Test Output

Each test generates output in the `test_output/` directory for inspection.

## Error Handling

The pipeline includes robust error handling:

- **Module Skipping**: Invalid modules are skipped with warnings
- **Content Fallback**: Falls back to `transcript.txt` if HTML parsing fails
- **Rate Limiting**: Includes delays between API calls
- **Graceful Shutdown**: Handles interruption signals

## Troubleshooting

### Common Issues

1. **API Key Error**: Ensure `OPENAI_API_KEY` is set in `.env`
2. **Input Directory**: Verify the input directory exists and contains modules
3. **Template File**: Check that `template.md` exists in the project root
4. **Rate Limiting**: The pipeline includes delays, but you may need to adjust for your API limits

### Node.js Version

The pipeline is tested with Node.js 18. If you encounter issues with newer dependencies, try using the simplified components that don't rely on LangChain.

## Development

### Adding Features

1. **New Content Sources**: Extend `SimpleHtmlParser` class
2. **Different LLM Providers**: Modify `SimpleLLMService` class
3. **Custom Templates**: Update template processing logic
4. **Additional Metadata**: Extend `ModuleContent` interface

### Architecture

The pipeline uses a modular architecture:

- **FileUtils**: Handles all file system operations
- **SimpleHtmlParser**: Extracts content from HTML files
- **SimpleLLMService**: Manages OpenAI API interactions
- **SimpleContentProcessor**: Orchestrates the entire process

## License

MIT License - see LICENSE file for details.
