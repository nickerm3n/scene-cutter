import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { FileUtils } from '../utils/file-utils.js';
import { SimpleHtmlParser } from '../utils/simple-html-parser.js';
import path from 'path';
import fs from 'fs-extra';
export class ContentProcessor {
    config;
    model;
    constructor(config) {
        this.config = config;
        this.model = new ChatOpenAI({
            openAIApiKey: config.openaiApiKey,
            modelName: 'gpt-4o', // Using GPT-4o for vision capabilities
            temperature: config.temperature,
            maxTokens: config.maxTokens,
        });
    }
    async processModule(module) {
        try {
            console.log(`Processing module with vision: ${module.title}`);
            // Load module content
            const content = await this.loadModuleContent(module);
            // Extract timestamps and images
            const timestampedContent = await this.extractTimestampedContent(module);
            // Load template
            const template = await this.loadTemplate();
            // Process content with images
            const processedContent = await this.processWithImages(content.transcript, timestampedContent, template, module.title);
            const processedModule = {
                originalModule: module,
                processedContent: processedContent,
                markdownContent: processedContent
            };
            console.log(`Successfully processed module with vision: ${module.title}`);
            return processedModule;
        }
        catch (error) {
            throw new Error(`Failed to process module ${module.title} with vision: ${error}`);
        }
    }
    async processAllModules(modules) {
        const processedModules = [];
        for (const module of modules) {
            try {
                const processed = await this.processModule(module);
                processedModules.push(processed);
                // Save individual module result
                await this.saveProcessedModule(processed);
                // Add delay to avoid rate limiting
                await this.delay(1000);
            }
            catch (error) {
                console.error(`Failed to process module ${module.title}:`, error);
                // Continue with next module
            }
        }
        return processedModules;
    }
    async loadModuleContent(module) {
        let transcript = '';
        let htmlContent = '';
        let metadata = {};
        let scenes = [];
        // Load transcript from HTML file if available
        if (await FileUtils.fileExists(module.htmlPath)) {
            try {
                transcript = await SimpleHtmlParser.extractTranscriptFromHtml(module.htmlPath);
                htmlContent = await FileUtils.readFile(module.htmlPath);
            }
            catch (error) {
                console.warn(`Failed to load HTML content for ${module.title}:`, error);
            }
        }
        // Fallback to transcript.txt if HTML parsing failed
        if (!transcript && await FileUtils.fileExists(module.transcriptPath)) {
            try {
                transcript = await FileUtils.readFile(module.transcriptPath);
            }
            catch (error) {
                console.warn(`Failed to load transcript for ${module.title}:`, error);
            }
        }
        // Load metadata if available
        if (await FileUtils.fileExists(module.metadataPath)) {
            try {
                metadata = await FileUtils.readJson(module.metadataPath);
            }
            catch (error) {
                console.warn(`Failed to load metadata for ${module.title}:`, error);
            }
        }
        // Load scenes if available
        if (await FileUtils.directoryExists(module.scenesPath)) {
            try {
                const scenesDir = module.scenesPath;
                const sceneFiles = await FileUtils.getDirectories(scenesDir);
                scenes = sceneFiles.map(dir => ({ name: dir, path: `${scenesDir}/${dir}` }));
            }
            catch (error) {
                console.warn(`Failed to load scenes for ${module.title}:`, error);
            }
        }
        if (!transcript) {
            throw new Error(`No transcript content found for module ${module.title}`);
        }
        return {
            transcript,
            htmlContent,
            metadata,
            scenes
        };
    }
    async extractTimestampedContent(module) {
        const timestampedContent = [];
        // Extract timestamps from HTML if available
        if (await FileUtils.fileExists(module.htmlPath)) {
            const structured = await SimpleHtmlParser.extractStructuredContent(module.htmlPath);
            for (const timestamp of structured.timestamps) {
                const images = await this.findImagesForTimestamp(timestamp.time, module);
                timestampedContent.push({
                    timestamp: timestamp.time,
                    text: timestamp.text,
                    images: images
                });
            }
        }
        // Also extract images from frames directory
        const framesDir = path.join(module.scenesPath, 'clips', 'frames');
        if (await FileUtils.directoryExists(framesDir)) {
            const frameImages = await this.extractFrameImages(framesDir);
            // Match frames with timestamps if possible
            for (const frame of frameImages) {
                const matchingContent = timestampedContent.find(tc => this.timestampsMatch(tc.timestamp, frame.timestamp));
                if (matchingContent) {
                    matchingContent.images.push(frame);
                }
                else {
                    // Create new timestamped content for this frame
                    timestampedContent.push({
                        timestamp: frame.timestamp,
                        text: '',
                        images: [frame]
                    });
                }
            }
        }
        return timestampedContent.sort((a, b) => this.parseTimestamp(a.timestamp) - this.parseTimestamp(b.timestamp));
    }
    async findImagesForTimestamp(timestamp, module) {
        const images = [];
        // Look for images in frames directory
        const framesDir = path.join(module.scenesPath, 'clips', 'frames');
        if (await FileUtils.directoryExists(framesDir)) {
            const frameImages = await this.extractFrameImages(framesDir);
            // Find images that match this timestamp
            const matchingFrames = frameImages.filter(frame => this.timestampsMatch(timestamp, frame.timestamp));
            images.push(...matchingFrames);
        }
        return images;
    }
    async extractFrameImages(framesDir) {
        const images = [];
        try {
            const files = await fs.readdir(framesDir);
            for (const file of files) {
                if (file.match(/\.(jpg|jpeg|png|gif)$/i)) {
                    // Extract timestamp from filename (assuming format like "frame_001234.jpg")
                    const timestampMatch = file.match(/frame_(\d+)\./);
                    if (timestampMatch) {
                        const frameNumber = parseInt(timestampMatch[1]);
                        const timestamp = this.frameNumberToTimestamp(frameNumber);
                        images.push({
                            timestamp: timestamp,
                            imagePath: path.join(framesDir, file),
                            description: `Frame ${frameNumber}`
                        });
                    }
                }
            }
        }
        catch (error) {
            console.warn(`Failed to extract frame images from ${framesDir}:`, error);
        }
        return images;
    }
    frameNumberToTimestamp(frameNumber) {
        // Assuming 30 FPS, convert frame number to timestamp
        const seconds = Math.floor(frameNumber / 30);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    timestampsMatch(ts1, ts2) {
        const time1 = this.parseTimestamp(ts1);
        const time2 = this.parseTimestamp(ts2);
        // Allow 2 second tolerance
        return Math.abs(time1 - time2) <= 2;
    }
    parseTimestamp(timestamp) {
        const match = timestamp.match(/(\d+):(\d+)/);
        if (match) {
            const minutes = parseInt(match[1]);
            const seconds = parseInt(match[2]);
            return minutes * 60 + seconds;
        }
        return 0;
    }
    async processWithImages(transcript, timestampedContent, template, moduleTitle) {
        try {
            // Create content with image references
            let contentWithImages = transcript + '\n\n';
            for (const content of timestampedContent) {
                if (content.text) {
                    contentWithImages += `[${content.timestamp}] ${content.text}\n`;
                }
                for (const image of content.images) {
                    contentWithImages += `[IMAGE: ${image.imagePath} at ${content.timestamp}]\n`;
                }
            }
            // Process with vision model
            const messages = [
                new SystemMessage(`You are an expert content processor that converts course transcripts with images into structured markdown content.

Your task is to:
1. Analyze the provided transcript and image references
2. Follow the provided template structure exactly
3. Generate high-quality, well-structured markdown content
4. Include image references in appropriate places using markdown syntax: ![description](image_path)
5. Maintain the original meaning while improving clarity and structure
6. Place images contextually where they enhance the content

Template to follow:
${template}

Important guidelines:
- Use proper markdown formatting
- Include images where they add value to the explanation
- Use relative paths for images (e.g., "./images/frame_001.jpg")
- Maintain logical flow and structure
- Ensure content is educational and engaging
- Follow the template structure precisely`),
                new HumanMessage({
                    content: [
                        {
                            type: "text",
                            text: `Module Title: ${moduleTitle}

Content with image references:
${contentWithImages}

Please process this content and generate structured markdown with appropriate image placements.`
                        }
                    ]
                })
            ];
            // Add images to the message if available
            const imagesToInclude = timestampedContent
                .flatMap(tc => tc.images)
                .slice(0, 10); // Limit to first 10 images to avoid token limits
            for (const image of imagesToInclude) {
                try {
                    const imageBuffer = await fs.readFile(image.imagePath);
                    const base64Image = imageBuffer.toString('base64');
                    messages[1].content.push({
                        type: "image_url",
                        image_url: {
                            url: `data:image/jpeg;base64,${base64Image}`
                        }
                    });
                }
                catch (error) {
                    console.warn(`Failed to include image ${image.imagePath}:`, error);
                }
            }
            const response = await this.model.invoke(messages);
            return response.content;
        }
        catch (error) {
            throw new Error(`Failed to process content with images: ${error}`);
        }
    }
    async loadTemplate() {
        try {
            const templatePath = path.join(process.cwd(), this.config.templateFile);
            return await FileUtils.readFile(templatePath);
        }
        catch (error) {
            console.warn(`Template file not found, using default template:`, error);
            return this.getDefaultTemplate();
        }
    }
    async saveProcessedModule(processedModule) {
        const outputPath = path.join(this.config.outputDir, `${processedModule.originalModule.id}.md`);
        await FileUtils.writeFile(outputPath, processedModule.markdownContent);
        console.log(`Saved processed module to: ${outputPath}`);
    }
    async saveAllProcessedModules(processedModules) {
        // Create output directory
        await FileUtils.writeFile(path.join(this.config.outputDir, 'README.md'), this.generateReadme(processedModules));
        // Save individual modules
        for (const module of processedModules) {
            await this.saveProcessedModule(module);
        }
        // Save summary
        await FileUtils.writeJson(path.join(this.config.outputDir, 'summary.json'), {
            totalModules: processedModules.length,
            modules: processedModules.map(m => ({
                id: m.originalModule.id,
                title: m.originalModule.title,
                order: m.originalModule.order
            }))
        });
    }
    getDefaultTemplate() {
        return `# {MODULE_TITLE}

## Overview
{OVERVIEW_SECTION}

## Key Concepts
{KEY_CONCEPTS_SECTION}

## Main Content
{MAIN_CONTENT_SECTION}

## Visual Examples
{VISUAL_EXAMPLES_SECTION}

## Summary
{SUMMARY_SECTION}

## Next Steps
{NEXT_STEPS_SECTION}`;
    }
    generateReadme(processedModules) {
        const sortedModules = processedModules.sort((a, b) => a.originalModule.order - b.originalModule.order);
        let readme = `# Vision-Enhanced Course Content

This directory contains the processed course modules with integrated images and visual content.

## Modules

`;
        for (const module of sortedModules) {
            readme += `### ${module.originalModule.order}. ${module.originalModule.title}
- **File:** \`${module.originalModule.id}.md\`
- **Original ID:** ${module.originalModule.id}

`;
        }
        readme += `
## Processing Information

- **Total Modules:** ${processedModules.length}
- **Processing Date:** ${new Date().toISOString()}
- **Template Used:** ${this.config.templateFile}
- **Processor:** Vision-Enhanced with GPT-4o

## Vision Processing Features

The content was processed using vision capabilities with the following features:
1. **Image Extraction**: Automatically extracts frames from video content
2. **Timestamp Matching**: Matches images with transcript timestamps
3. **Contextual Placement**: Places images where they enhance understanding
4. **Markdown Integration**: Embeds images using proper markdown syntax

## Notes

This content was automatically generated using vision-enhanced processing. Images are referenced using relative paths and should be available in the corresponding module directories.
`;
        return readme;
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
