import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { PipelineConfig, LLMResponse } from '../types/index.js'

export class LLMService {
  private model: ChatOpenAI
  private config: PipelineConfig

  constructor(config: PipelineConfig) {
    this.config = config
    this.model = new ChatOpenAI({
      openAIApiKey: config.openaiApiKey,
      modelName: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    })
  }

  async processContent(
    transcript: string,
    template: string,
    moduleTitle: string
  ): Promise<LLMResponse> {
    try {
      const systemPrompt = this.createSystemPrompt(template)
      const userPrompt = this.createUserPrompt(transcript, moduleTitle)

      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(userPrompt)
      ]

      const response = await this.model.invoke(messages)
      
      return {
        content: response.content as string,
        usage: response.usage
      }
    } catch (error) {
      throw new Error(`LLM processing failed: ${error}`)
    }
  }

  async processContentInChunks(
    transcript: string,
    template: string,
    moduleTitle: string,
    chunkSize: number = 4000
  ): Promise<LLMResponse> {
    try {
      // Split transcript into chunks
      const chunks = this.splitIntoChunks(transcript, chunkSize)
      
      let fullResponse = ''
      let totalUsage = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      }

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        const isFirstChunk = i === 0
        const isLastChunk = i === chunks.length - 1
        
        const systemPrompt = this.createSystemPrompt(template, isFirstChunk, isLastChunk)
        const userPrompt = this.createUserPrompt(chunk, moduleTitle, i + 1, chunks.length)

        const messages = [
          new SystemMessage(systemPrompt),
          new HumanMessage(userPrompt)
        ]

        const response = await this.model.invoke(messages)
        
        fullResponse += response.content as string
        
        if (response.usage) {
          totalUsage.promptTokens += response.usage.promptTokens || 0
          totalUsage.completionTokens += response.usage.completionTokens || 0
          totalUsage.totalTokens += response.usage.totalTokens || 0
        }
      }

      return {
        content: fullResponse,
        usage: totalUsage
      }
    } catch (error) {
      throw new Error(`LLM chunk processing failed: ${error}`)
    }
  }

  private createSystemPrompt(
    template: string,
    isFirstChunk: boolean = true,
    isLastChunk: boolean = true
  ): string {
    let prompt = `You are an expert content processor that converts course transcripts into structured markdown content.

Your task is to:
1. Analyze the provided transcript
2. Follow the provided template structure exactly
3. Generate high-quality, well-structured markdown content
4. Maintain the original meaning while improving clarity and structure

Template to follow:
${template}

Important guidelines:
- Use proper markdown formatting
- Maintain logical flow and structure
- Include relevant headings, lists, and code blocks where appropriate
- Ensure content is educational and engaging
- Follow the template structure precisely`

    if (!isFirstChunk) {
      prompt += '\n\nThis is a continuation of previous content. Maintain consistency with the previous parts.'
    }
    
    if (!isLastChunk) {
      prompt += '\n\nThis content will be continued. End appropriately to allow for continuation.'
    }

    return prompt
  }

  private createUserPrompt(
    transcript: string,
    moduleTitle: string,
    chunkNumber?: number,
    totalChunks?: number
  ): string {
    let prompt = `Module Title: ${moduleTitle}

Transcript content:
${transcript}`

    if (chunkNumber && totalChunks) {
      prompt += `\n\nThis is chunk ${chunkNumber} of ${totalChunks}.`
    }

    prompt += `\n\nPlease process this transcript according to the template and generate the markdown content.`

    return prompt
  }

  private splitIntoChunks(text: string, chunkSize: number): string[] {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
    const chunks: string[] = []
    let currentChunk = ''

    for (const sentence of sentences) {
      const sentenceWithPunctuation = sentence.trim() + '.'
      
      if ((currentChunk + sentenceWithPunctuation).length > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim())
        currentChunk = sentenceWithPunctuation
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentenceWithPunctuation
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim())
    }

    return chunks
  }
}
