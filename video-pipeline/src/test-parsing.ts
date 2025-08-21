import { FileUtils } from './utils/file-utils.js'
import { HtmlParser } from './utils/html-parser.js'
import { CourseModule } from './types/index.js'

async function testParsing() {
  try {
    console.log('🧪 Testing file parsing functionality...')
    
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

    // Test file existence checks
    console.log('\n📄 Testing file existence...')
    console.log(`HTML file exists: ${await FileUtils.fileExists(module.htmlPath!)}`)
    console.log(`Transcript file exists: ${await FileUtils.fileExists(module.transcriptPath!)}`)
    console.log(`Metadata file exists: ${await FileUtils.fileExists(module.metadataPath!)}`)
    console.log(`Scenes directory exists: ${await FileUtils.directoryExists(module.scenesPath!)}`)

    // Test HTML parsing
    console.log('\n📄 Testing HTML parsing...')
    if (await FileUtils.fileExists(module.htmlPath!)) {
      const transcript = await HtmlParser.extractTranscriptFromHtml(module.htmlPath!)
      console.log(`✅ Extracted transcript (${transcript.length} characters)`)
      console.log(`📝 First 300 characters:`)
      console.log(transcript.substring(0, 300) + '...')
      
      // Test structured content extraction
      console.log('\n🔍 Testing structured content extraction...')
      const structured = await HtmlParser.extractStructuredContent(module.htmlPath!)
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

    // Test transcript.txt reading
    console.log('\n📄 Testing transcript.txt reading...')
    if (await FileUtils.fileExists(module.transcriptPath!)) {
      const transcript = await FileUtils.readFile(module.transcriptPath!)
      console.log(`✅ Read transcript.txt (${transcript.length} characters)`)
      console.log(`📝 First 300 characters:`)
      console.log(transcript.substring(0, 300) + '...')
    } else {
      console.log('⚠️ transcript.txt not found')
    }

    // Test metadata reading
    console.log('\n📊 Testing metadata reading...')
    if (await FileUtils.fileExists(module.metadataPath!)) {
      const metadata = await FileUtils.readJson(module.metadataPath!)
      console.log(`✅ Read metadata`)
      console.log(`📊 Metadata keys: ${Object.keys(metadata).join(', ')}`)
      console.log(`📊 Metadata preview:`, JSON.stringify(metadata, null, 2).substring(0, 500) + '...')
    } else {
      console.log('⚠️ Metadata file not found')
    }

    // Test scenes directory
    console.log('\n🎬 Testing scenes directory...')
    if (await FileUtils.directoryExists(module.scenesPath!)) {
      const sceneItems = await FileUtils.getDirectories(module.scenesPath!)
      console.log(`✅ Scenes directory contains: ${sceneItems.join(', ')}`)
      
      // Check clips directory
      const clipsPath = `${module.scenesPath}/clips`
      if (await FileUtils.directoryExists(clipsPath)) {
        const clipItems = await FileUtils.getDirectories(clipsPath)
        console.log(`📁 Clips directory contains: ${clipItems.join(', ')}`)
      }
    } else {
      console.log('⚠️ Scenes directory not found')
    }

    // Test getting all modules
    console.log('\n📚 Testing module discovery...')
    const allModules = await FileUtils.getDirectories(inputDir)
    console.log(`✅ Found ${allModules.length} total modules`)
    console.log(`📝 First 5 modules: ${allModules.slice(0, 5).join(', ')}`)

    // Test parsing a few modules
    console.log('\n🔍 Testing module parsing...')
    const parsedModules: CourseModule[] = []
    for (const moduleName of allModules.slice(0, 3)) {
      try {
        const parsedModule = FileUtils.parseModuleFromDirectory(moduleName, inputDir)
        parsedModules.push(parsedModule)
        console.log(`✅ Parsed: ${parsedModule.title} (order: ${parsedModule.order})`)
      } catch (error) {
        console.log(`❌ Failed to parse ${moduleName}: ${error}`)
      }
    }

    // Sort and display
    parsedModules.sort((a, b) => a.order - b.order)
    console.log('\n📊 Parsed modules (sorted by order):')
    parsedModules.forEach(module => {
      console.log(`  ${module.order}. ${module.title}`)
    })

    console.log('\n✅ All parsing tests completed successfully!')

  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

// Run the test
testParsing()
