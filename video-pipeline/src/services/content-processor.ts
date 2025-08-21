import { FileUtils } from '../utils/file-utils.js'
import { HtmlParser } from '../utils/html-parser.js'
import { LLMService } from './llm-service.js'
import { CourseModule, ModuleContent, ProcessedModule, PipelineConfig } from '../types/index.js'
import path from 'path'

export class ContentProcessor {
  private llmService: LLMService
  private config: PipelineConfig

  constructor(config: PipelineConfig) {
    this.config = config
    this.llmService = new LLMService(config)
  }

  async processModule(module: CourseModule): Promise<ProcessedModule> {
    try {
      console.log(`Processing module: ${module.title}`)
      
      // Load module content
      const content = await this.loadModuleContent(module)
      
      // Load template
      const template = await this.loadTemplate()
      
      // Process content through LLM
      const llmResponse = await this.llmService.processContentInChunks(
        content.transcript,
        template,
        module.title
      )
      
      const processedModule: ProcessedModule = {
        originalModule: module,
        processedContent: llmResponse.content,
        markdownContent: llmResponse.content
      }
      
      console.log(`Successfully processed module: ${module.title}`)
      if (llmResponse.usage) {
        console.log(`Token usage: ${llmResponse.usage.totalTokens} tokens`)
      }
      
      return processedModule
    } catch (error) {
      throw new Error(`Failed to process module ${module.title}: ${error}`)
    }
  }

  async processAllModules(modules: CourseModule[]): Promise<ProcessedModule[]> {
    const processedModules: ProcessedModule[] = []
    
    for (const module of modules) {
      try {
        const processed = await this.processModule(module)
        processedModules.push(processed)
        
        // Save individual module result
        await this.saveProcessedModule(processed)
        
        // Add delay to avoid rate limiting
        await this.delay(1000)
      } catch (error) {
        console.error(`Failed to process module ${module.title}:`, error)
        // Continue with next module
      }
    }
    
    return processedModules
  }

  async loadModuleContent(module: CourseModule): Promise<ModuleContent> {
    let transcript = ''
    let htmlContent = ''
    let metadata = {}
    let scenes: any[] = []

    // Load transcript from HTML file if available
    if (await FileUtils.fileExists(module.htmlPath!)) {
      try {
        transcript = await HtmlParser.extractTranscriptFromHtml(module.htmlPath!)
        htmlContent = await FileUtils.readFile(module.htmlPath!)
      } catch (error) {
        console.warn(`Failed to load HTML content for ${module.title}:`, error)
      }
    }

    // Fallback to transcript.txt if HTML parsing failed
    if (!transcript && await FileUtils.fileExists(module.transcriptPath!)) {
      try {
        transcript = await FileUtils.readFile(module.transcriptPath!)
      } catch (error) {
        console.warn(`Failed to load transcript for ${module.title}:`, error)
      }
    }

    // Load metadata if available
    if (await FileUtils.fileExists(module.metadataPath!)) {
      try {
        metadata = await FileUtils.readJson(module.metadataPath!)
      } catch (error) {
        console.warn(`Failed to load metadata for ${module.title}:`, error)
      }
    }

    // Load scenes if available
    if (await FileUtils.directoryExists(module.scenesPath!)) {
      try {
        const scenesDir = module.scenesPath!
        const sceneFiles = await FileUtils.getDirectories(scenesDir)
        scenes = sceneFiles.map(dir => ({ name: dir, path: `${scenesDir}/${dir}` }))
      } catch (error) {
        console.warn(`Failed to load scenes for ${module.title}:`, error)
      }
    }

    if (!transcript) {
      throw new Error(`No transcript content found for module ${module.title}`)
    }

    return {
      transcript,
      htmlContent,
      metadata,
      scenes
    }
  }

  async loadTemplate(): Promise<string> {
    try {
      const templatePath = path.join(process.cwd(), this.config.templateFile)
      return await FileUtils.readFile(templatePath)
    } catch (error) {
      // Return a default template if file not found
      console.warn(`Template file not found, using default template:`, error)
      return this.getDefaultTemplate()
    }
  }

  async saveProcessedModule(processedModule: ProcessedModule): Promise<void> {
    const outputPath = path.join(
      this.config.outputDir,
      `${processedModule.originalModule.id}.md`
    )
    
    await FileUtils.writeFile(outputPath, processedModule.markdownContent)
    console.log(`Saved processed module to: ${outputPath}`)
  }

  async saveAllProcessedModules(processedModules: ProcessedModule[]): Promise<void> {
    // Create output directory
    await FileUtils.writeFile(
      path.join(this.config.outputDir, 'README.md'),
      this.generateReadme(processedModules)
    )
    
    // Save individual modules
    for (const module of processedModules) {
      await this.saveProcessedModule(module)
    }
    
    // Save summary
    await FileUtils.writeJson(
      path.join(this.config.outputDir, 'summary.json'),
      {
        totalModules: processedModules.length,
        modules: processedModules.map(m => ({
          id: m.originalModule.id,
          title: m.originalModule.title,
          order: m.originalModule.order
        }))
      }
    )
  }

  private getDefaultTemplate(): string {
    return `# {MODULE_TITLE}

## Overview
{OVERVIEW_SECTION}

## Key Concepts
{KEY_CONCEPTS_SECTION}

## Main Content
{MAIN_CONTENT_SECTION}

## Summary
{SUMMARY_SECTION}

## Next Steps
{NEXT_STEPS_SECTION}`
  }

  private generateReadme(processedModules: ProcessedModule[]): string {
    const sortedModules = processedModules.sort((a, b) => a.originalModule.order - b.originalModule.order)
    
    let readme = `# Processed Course Content

This directory contains the processed course modules converted from video transcripts to structured markdown content.

## Modules

`
    
    for (const module of sortedModules) {
      readme += `### ${module.originalModule.order}. ${module.originalModule.title}
- **File:** \`${module.originalModule.id}.md\`
- **Original ID:** ${module.originalModule.id}

`
    }
    
    readme += `
## Processing Information

- **Total Modules:** ${processedModules.length}
- **Processing Date:** ${new Date().toISOString()}
- **Template Used:** ${this.config.templateFile}

## Notes

This content was automatically generated from video transcripts using LLM processing. Please review and edit as needed for accuracy and completeness.
`
    
    return readme
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
