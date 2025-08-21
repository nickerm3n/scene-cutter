import { FileUtils } from './utils/file-utils.js'
import { SimpleHtmlParser } from './utils/simple-html-parser.js'
import { CourseModule } from './types/index.js'

async function testHtmlParsing() {
  try {
    console.log('🧪 Testing HTML parsing...')
    
    const inputDir = 'course_output_20250821_122616'
    const testModuleName = '1._28._Third-Party_MCP_Hubs'
    
    // Check if input directory exists
    if (!await FileUtils.directoryExists(inputDir)) {
      throw new Error(`Input directory does not exist: ${inputDir}`)
    }

    // Parse module
    const module = FileUtils.parseModuleFromDirectory(testModuleName, inputDir)
    console.log(`📚 Testing module: ${module.title}`)

    // Test HTML parsing
    console.log('\n📄 Testing HTML parsing...')
    if (await FileUtils.fileExists(module.htmlPath!)) {
      const transcript = await SimpleHtmlParser.extractTranscriptFromHtml(module.htmlPath!)
      console.log(`✅ Extracted transcript (${transcript.length} characters)`)
      console.log(`📝 First 300 characters:`)
      console.log(transcript.substring(0, 300) + '...')
      
      // Test structured content extraction
      console.log('\n🔍 Testing structured content extraction...')
      const structured = await SimpleHtmlParser.extractStructuredContent(module.htmlPath!)
      console.log(`✅ Structured content extracted`)
      console.log(`📊 Timestamps found: ${structured.timestamps.length}`)
      console.log(`📊 Sections found: ${structured.sections.length}`)
      
      if (structured.timestamps.length > 0) {
        console.log(`⏰ First timestamp: ${structured.timestamps[0].time} - ${structured.timestamps[0].text.substring(0, 50)}...`)
      }
      
      if (structured.sections.length > 0) {
        console.log(`📑 First section: ${structured.sections[0].title}`)
        console.log(`📝 Section content: ${structured.sections[0].content.substring(0, 100)}...`)
      }
    } else {
      console.log('⚠️ HTML file not found')
    }

    // Compare with transcript.txt
    console.log('\n📄 Comparing with transcript.txt...')
    if (await FileUtils.fileExists(module.transcriptPath!)) {
      const transcriptTxt = await FileUtils.readFile(module.transcriptPath!)
      console.log(`📝 transcript.txt length: ${transcriptTxt.length} characters`)
      console.log(`📝 transcript.txt first 200 chars: ${transcriptTxt.substring(0, 200)}...`)
    }

    console.log('\n✅ HTML parsing test completed successfully!')

  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

// Run the test
testHtmlParsing()
