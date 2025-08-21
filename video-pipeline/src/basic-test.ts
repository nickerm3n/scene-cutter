import { FileUtils } from './utils/file-utils.js'
import { CourseModule } from './types/index.js'

async function basicTest() {
  try {
    console.log('🧪 Basic file operations test...')
    
    const inputDir = 'course_output_20250821_122616'
    const testModuleName = '1._28._Third-Party_MCP_Hubs'
    
    // Check if input directory exists
    if (!await FileUtils.directoryExists(inputDir)) {
      throw new Error(`Input directory does not exist: ${inputDir}`)
    }

    console.log(`✅ Input directory exists: ${inputDir}`)

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

    // Test metadata reading
    console.log('\n📊 Testing metadata reading...')
    if (await FileUtils.fileExists(module.metadataPath!)) {
      const metadata = await FileUtils.readJson(module.metadataPath!)
      console.log(`✅ Read metadata`)
      console.log(`📊 Metadata keys: ${Object.keys(metadata).join(', ')}`)
    } else {
      console.log('⚠️ Metadata file not found')
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

    console.log('\n✅ Basic test completed successfully!')

  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

// Run the test
basicTest()
