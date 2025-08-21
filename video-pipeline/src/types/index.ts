export interface CourseModule {
  id: string
  title: string
  order: number
  videoPath?: string
  transcriptPath?: string
  htmlPath?: string
  metadataPath?: string
  scenesPath?: string
}

export interface ModuleContent {
  transcript: string
  htmlContent: string
  metadata: any
  scenes: any[]
}

export interface ProcessedModule {
  originalModule: CourseModule
  processedContent: string
  markdownContent: string
}

export interface PipelineConfig {
  inputDir: string
  outputDir: string
  templateFile: string
  openaiApiKey: string
  model: string
  temperature: number
  maxTokens: number
}

export interface LLMResponse {
  content: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}
