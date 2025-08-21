import dotenv from 'dotenv'
import { FileUtils } from './utils/file-utils.js'
import { HtmlParser } from './utils/html-parser.js'
import { LLMService } from './services/llm-service.js'
import { PipelineConfig, CourseModule } from './types/index.js'

// Load environment variables
dotenv.config()

async function testSingleModule() {
  try {
    console.log('🧪 Testing single module processing...')
    
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

    // Test HTML parsing
    console.log('\n📄 Testing HTML parsing...')
    if (await FileUtils.fileExists(module.htmlPath!)) {
      const transcript = await HtmlParser.extractTranscriptFromHtml(module.htmlPath!)
      console.log(`✅ Extracted transcript (${transcript.length} characters)`)
      console.log(`📝 First 200 characters: ${transcript.substring(0, 200)}...`)
    } else {
      console.log('⚠️ HTML file not found, checking transcript.txt...')
      if (await FileUtils.fileExists(module.transcriptPath!)) {
        const transcript = await FileUtils.readFile(module.transcriptPath!)
        console.log(`✅ Found transcript.txt (${transcript.length} characters)`)
        console.log(`📝 First 200 characters: ${transcript.substring(0, 200)}...`)
      } else {
        throw new Error('No transcript content found')
      }
    }

    // Test LLM processing (optional - comment out if you don't want to use API credits)
    console.log('\n🤖 Testing LLM processing...')
    const llmService = new LLMService(config)
    
    // Load template
    const templatePath = `${config.templateFile}`
    let template = ''
    try {
      template = await FileUtils.readFile(templatePath)
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

    // Get transcript content
    let transcript = ''
    if (await FileUtils.fileExists(module.htmlPath!)) {
      transcript = await HtmlParser.extractTranscriptFromHtml(module.htmlPath!)
    } else if (await FileUtils.fileExists(module.transcriptPath!)) {
      transcript = await FileUtils.readFile(module.transcriptPath!)
    }

    if (!transcript) {
      throw new Error('No transcript content available for testing')
    }

    // Process with LLM (using a small chunk for testing)
    const testChunk = transcript.substring(0, 1000) // First 1000 characters
    console.log(`📤 Sending ${testChunk.length} characters to LLM...`)
    
    const llmResponse = await llmService.processContent(
      testChunk,
      template,
      module.title
    )
    
    console.log(`✅ LLM processing successful!`)
    console.log(`📊 Response length: ${llmResponse.content.length} characters`)
    console.log(`💡 First 300 characters of response:`)
    console.log(llmResponse.content.substring(0, 300) + '...')
    
    if (llmResponse.usage) {
      console.log(`🔢 Token usage: ${llmResponse.usage.totalTokens} tokens`)
    }

    // Save test output
    const outputPath = `${config.outputDir}/test_${module.id}.md`
    await FileUtils.writeFile(outputPath, llmResponse.content)
    console.log(`💾 Test output saved to: ${outputPath}`)

    console.log('\n✅ Single module test completed successfully!')

  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

// Run the test
testSingleModule()
