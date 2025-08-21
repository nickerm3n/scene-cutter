import dotenv from 'dotenv'
import { FileUtils } from './utils/file-utils.js'
import { VisionProcessor } from './services/vision-processor.js'
import { PipelineConfig, CourseModule } from './types/index.js'

// Load environment variables
dotenv.config()

async function testVision() {
  try {
    console.log('🧪 Testing Vision processor...')
    
    // Configuration
    const config: PipelineConfig = {
      inputDir: process.env.INPUT_DIR || 'course_output_20250821_122616',
      outputDir: 'vision_test_output',
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

    // Test with a specific module
    const testModuleName = '1._28._Third-Party_MCP_Hubs'
    const modulePath = `${config.inputDir}/${testModuleName}`
    
    if (!await FileUtils.directoryExists(modulePath)) {
      throw new Error(`Test module directory does not exist: ${modulePath}`)
    }

    // Parse module
    const module = FileUtils.parseModuleFromDirectory(testModuleName, config.inputDir)
    console.log(`📚 Testing module: ${module.title}`)

    // Check for images
    const framesDir = `${module.scenesPath}/clips/frames`
    if (await FileUtils.directoryExists(framesDir)) {
      console.log(`🖼️ Found frames directory: ${framesDir}`)
    } else {
      console.log(`⚠️ No frames directory found at: ${framesDir}`)
    }

    // Initialize vision processor
    const processor = new VisionProcessor(config)

    // Process single module
    console.log('\n🔄 Processing module with vision capabilities...')
    console.log('📊 Vision processing steps:')
    console.log('   1. Extract frames from video content')
    console.log('   2. Match images with transcript timestamps')
    console.log('   3. Analyze images with GPT-4o vision')
    console.log('   4. Generate markdown with contextual image placement')
    
    const processedModule = await processor.processModule(module)
    
    console.log(`✅ Vision processing successful!`)
    console.log(`📊 Generated content length: ${processedModule.markdownContent.length} characters`)
    console.log(`💡 First 500 characters of generated content:`)
    console.log(processedModule.markdownContent.substring(0, 500) + '...')

    // Save test output
    const outputPath = `${config.outputDir}/vision_test_${module.id}.md`
    await FileUtils.writeFile(outputPath, processedModule.markdownContent)
    console.log(`💾 Test output saved to: ${outputPath}`)

    console.log('\n✅ Vision test completed successfully!')

  } catch (error) {
    console.error('❌ Vision test failed:', error)
    process.exit(1)
  }
}

// Run the test
testVision()
