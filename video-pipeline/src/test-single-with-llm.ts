import dotenv from 'dotenv'
import { FileUtils } from './utils/file-utils.js'
import { SimpleHtmlParser } from './utils/simple-html-parser.js'
import { SimpleLLMService } from './services/simple-llm-service.js'
import { PipelineConfig, CourseModule } from './types/index.js'

// Load environment variables
dotenv.config()

async function testSingleModuleWithLLM() {
  try {
    console.log('🧪 Testing single module processing with LLM...')
    
    // Configuration
    const config: PipelineConfig = {
      inputDir: process.env.INPUT_DIR || 'course_output_20250821_122616',
      outputDir: 'test_output',
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

    // Test with a specific module
    const testModuleName = '1._28._Third-Party_MCP_Hubs'
    const modulePath = `${config.inputDir}/${testModuleName}`
    
    if (!await FileUtils.directoryExists(modulePath)) {
      throw new Error(`Test module directory does not exist: ${modulePath}`)
    }

    // Parse module
    const module = FileUtils.parseModuleFromDirectory(testModuleName, config.inputDir)
    console.log(`📚 Testing module: ${module.title}`)

    // Get transcript content
    let transcript = ''
    if (await FileUtils.fileExists(module.htmlPath!)) {
      transcript = await SimpleHtmlParser.extractTranscriptFromHtml(module.htmlPath!)
      console.log(`✅ Extracted transcript from HTML (${transcript.length} characters)`)
    } else if (await FileUtils.fileExists(module.transcriptPath!)) {
      transcript = await FileUtils.readFile(module.transcriptPath!)
      console.log(`✅ Read transcript from txt file (${transcript.length} characters)`)
    } else {
      throw new Error('No transcript content found')
    }

    // Load template
    let template = ''
    try {
      template = await FileUtils.readFile(config.templateFile)
      console.log(`✅ Loaded template from ${config.templateFile}`)
    } catch (error) {
      console.log('⚠️ Template file not found, using default template')
      template = `# {MODULE_TITLE}

## Overview
{OVERVIEW_SECTION}

## Key Concepts
{KEY_CONCEPTS_SECTION}

## Main Content
{MAIN_CONTENT_SECTION}

## Summary
{SUMMARY_SECTION}`
    }

    // Initialize LLM service
    const llmService = new SimpleLLMService({
      openaiApiKey: config.openaiApiKey,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens
    })

    // Process with LLM (using a small chunk for testing)
    const testChunk = transcript.substring(0, 2000) // First 2000 characters
    console.log(`📤 Sending ${testChunk.length} characters to LLM...`)
    
    const llmResponse = await llmService.processContent(
      testChunk,
      template,
      module.title
    )
    
    console.log(`✅ LLM processing successful!`)
    console.log(`📊 Response length: ${llmResponse.content.length} characters`)
    console.log(`💡 First 500 characters of response:`)
    console.log(llmResponse.content.substring(0, 500) + '...')
    
    if (llmResponse.usage) {
      console.log(`🔢 Token usage: ${llmResponse.usage.totalTokens} tokens`)
      console.log(`📤 Prompt tokens: ${llmResponse.usage.promptTokens}`)
      console.log(`📥 Completion tokens: ${llmResponse.usage.completionTokens}`)
    }

    // Save test output
    const outputPath = `${config.outputDir}/test_${module.id}.md`
    await FileUtils.writeFile(outputPath, llmResponse.content)
    console.log(`💾 Test output saved to: ${outputPath}`)

    console.log('\n✅ Single module LLM test completed successfully!')

  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

// Run the test
testSingleModuleWithLLM()
