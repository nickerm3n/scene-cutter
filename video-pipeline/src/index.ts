import dotenv from 'dotenv'
import path from 'path'
import { FileUtils } from './utils/file-utils.js'
import { ContentProcessor } from './services/content-processor.js'
import { PipelineConfig, CourseModule } from './types/index.js'

// Load environment variables
dotenv.config()

async function main() {
  try {
    console.log('🚀 Starting Course Content Pipeline...')

    console.log('===>', process.env.OPENAI_API_KEY)
    
    // Configuration
    const config: PipelineConfig = {
      inputDir: process.env.INPUT_DIR || 'course_output_20250821_122616',
      outputDir: process.env.OUTPUT_DIR || 'processed_course',
      templateFile: process.env.TEMPLATE_FILE || 'template.md',
      openaiApiKey: process.env.OPENAI_API_KEY || '',
      model: 'gpt-4-turbo-preview',
      temperature: 0.3,
      maxTokens: 4000
    }

    // Validate configuration
    if (!config.openaiApiKey) {
      throw new Error('OPENAI_API_KEY is required. Please set it in your .env file.')
    }

    console.log(`📁 Input directory: ${config.inputDir}`)
    console.log(`📁 Output directory: ${config.outputDir}`)
    console.log(`📄 Template file: ${config.templateFile}`)

    // Check if input directory exists
    if (!await FileUtils.directoryExists(config.inputDir)) {
      throw new Error(`Input directory does not exist: ${config.inputDir}`)
    }

    // Get all module directories
    const moduleDirectories = await FileUtils.getDirectories(config.inputDir)
    console.log(`📚 Found ${moduleDirectories.length} modules`)

    const filterTest = moduleDirectories.find(dir => dir.includes('5._33._Understanding_how_MCPs_Handle_Paths'))
    const filteredModuleDirectories = filterTest ? [filterTest] : moduleDirectories

    // Parse modules
    const modules: CourseModule[] = []
    for (const dirName of filteredModuleDirectories) {
      try {
        const module = FileUtils.parseModuleFromDirectory(dirName, config.inputDir)
        modules.push(module)
      } catch (error) {
        console.warn(`Skipping invalid module directory: ${dirName} - ${error}`)
      }
    }

    // Sort modules by order
    modules.sort((a, b) => a.order - b.order)
    console.log(`✅ Parsed ${modules.length} valid modules`)

    // Initialize content processor
    const processor = new ContentProcessor(config)

    // Process modules
    console.log('\n🔄 Starting content processing...')
    const processedModules = await processor.processAllModules(modules)

    // Save results
    console.log('\n💾 Saving processed content...')
    await processor.saveAllProcessedModules(processedModules)

    console.log(`\n✅ Pipeline completed successfully!`)
    console.log(`📊 Processed ${processedModules.length} modules`)
    console.log(`📁 Output saved to: ${config.outputDir}`)

  } catch (error) {
    console.error('❌ Pipeline failed:', error)
    process.exit(1)
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Pipeline interrupted by user')
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n🛑 Pipeline terminated')
  process.exit(0)
})

// Run the pipeline
main()
