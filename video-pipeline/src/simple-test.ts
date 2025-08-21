import { FileUtils } from './utils/file-utils.js'
import { HtmlParser } from './utils/html-parser.js'
import { CourseModule } from './types/index.js'

async function simpleTest() {
  try {
    console.log('🧪 Simple parsing test...')
    
    const inputDir = 'course_output_20250821_122616'
    const testModuleName = '1._28._Third-Party_MCP_Hubs'
    
    // Check if input directory exists
    if (!await FileUtils.directoryExists(inputDir)) {
      throw new Error(`Input directory does not exist: ${inputDir}`)
    }

    // Parse module
    const module = FileUtils.parseModuleFromDirectory(testModuleName, inputDir)
    console.log(`📚 Parsed module: ${module.title}`)
    console.log(`📁 Module ID: ${module.id}`)
    console.log(`🔢 Order: ${module.order}`)

    // Test HTML parsing
    console.log('\n📄 Testing HTML parsing...')
    if (await FileUtils.fileExists(module.htmlPath!)) {
      const transcript = await HtmlParser.extractTranscriptFromHtml(module.htmlPath!)
      console.log(`✅ Extracted transcript (${transcript.length} characters)`)
      console.log(`📝 First 200 characters:`)
      console.log(transcript.substring(0, 200) + '...')
    } else {
      console.log('⚠️ HTML file not found')
    }

    // Test transcript.txt reading
    console.log('\n📄 Testing transcript.txt reading...')
    if (await FileUtils.fileExists(module.transcriptPath!)) {
      const transcript = await FileUtils.readFile(module.transcriptPath!)
      console.log(`✅ Read transcript.txt (${transcript.length} characters)`)
      console.log(`📝 First 200 characters:`)
      console.log(transcript.substring(0, 200) + '...')
    } else {
      console.log('⚠️ transcript.txt not found')
    }

    console.log('\n✅ Simple test completed successfully!')

  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

// Run the test
simpleTest()
