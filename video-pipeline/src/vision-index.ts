import dotenv from 'dotenv'
import { FileUtils } from './utils/file-utils.js'
import { VisionProcessor } from './services/vision-processor.js'
import { PipelineConfig, CourseModule } from './types/index.js'

// Load environment variables
dotenv.config()

async function main() {
  try {
    console.log('🚀 Starting Vision-Enhanced Course Content Pipeline...')
    
    // Configuration
    const config: PipelineConfig = {
      inputDir: process.env.INPUT_DIR || 'course_output_20250821_122616',
      outputDir: process.env.OUTPUT_DIR || 'vision_processed_course',
      templateFile: process.env.TEMPLATE_FILE || 'template.md',
      openaiApiKey: process.env.OPENAI_API_KEY || '',
      model: 'gpt-4o',
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
    console.log(`🤖 Model: ${config.model} (Vision-enabled)`)

    // Check if input directory exists
    if (!await FileUtils.directoryExists(config.inputDir)) {
      throw new Error(`Input directory does not exist: ${config.inputDir}`)
    }

    // Get all module directories
    const moduleDirectories = await FileUtils.getDirectories(config.inputDir)
    console.log(`📚 Found ${moduleDirectories.length} modules`)

    // Parse modules
    const modules: CourseModule[] = []
    for (const dirName of moduleDirectories) {
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

    // Initialize vision processor
    const processor = new VisionProcessor(config)

    // Process modules
    console.log('\n🔄 Starting vision-enhanced content processing...')
    console.log('📊 Vision processing features:')
    console.log('   1. Extract frames from video content')
    console.log('   2. Match images with transcript timestamps')
    console.log('   3. Analyze images with GPT-4o vision')
    console.log('   4. Generate markdown with contextual image placement')
    
    const processedModules = await processor.processAllModules(modules)

    // Save results
    console.log('\n💾 Saving processed content...')
    await processor.saveAllProcessedModules(processedModules)

    console.log(`\n✅ Vision pipeline completed successfully!`)
    console.log(`📊 Processed ${processedModules.length} modules`)
    console.log(`📁 Output saved to: ${config.outputDir}`)
    console.log(`🖼️ Each module enhanced with visual content and image references`)

  } catch (error) {
    console.error('❌ Vision pipeline failed:', error)
    process.exit(1)
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Vision pipeline interrupted by user')
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n🛑 Vision pipeline terminated')
  process.exit(0)
})

// Run the pipeline
main()
