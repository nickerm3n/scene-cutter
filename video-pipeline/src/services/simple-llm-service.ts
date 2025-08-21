import { LLMResponse } from '../types/index.js'

export class SimpleLLMService {
  private apiKey: string
  private model: string
  private temperature: number
  private maxTokens: number

  constructor(config: {
    openaiApiKey: string
    model: string
    temperature: number
    maxTokens: number
  }) {
    this.apiKey = config.openaiApiKey
    this.model = config.model
    this.temperature = config.temperature
    this.maxTokens = config.maxTokens
  }

  async processContent(
    transcript: string,
    template: string,
    moduleTitle: string
  ): Promise<LLMResponse> {
    try {
      const systemPrompt = this.createSystemPrompt(template)
      const userPrompt = this.createUserPrompt(transcript, moduleTitle)

      const response = await this.callOpenAI(systemPrompt, userPrompt)
      
      return {
        content: response.content,
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

        const response = await this.callOpenAI(systemPrompt, userPrompt)
        
        fullResponse += response.content
        
        if (response.usage) {
          totalUsage.promptTokens += response.usage.promptTokens || 0
          totalUsage.completionTokens += response.usage.completionTokens || 0
          totalUsage.totalTokens += response.usage.totalTokens || 0
        }

        // Add delay between chunks to avoid rate limiting
        if (i < chunks.length - 1) {
          await this.delay(1000)
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

  private async callOpenAI(systemPrompt: string, userPrompt: string): Promise<{
    content: string
    usage?: {
      promptTokens: number
      completionTokens: number
      totalTokens: number
    }
  }> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: this.temperature,
        max_tokens: this.maxTokens
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`)
    }

    const data = await response.json()
    
    return {
      content: data.choices[0].message.content,
      usage: data.usage
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

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
