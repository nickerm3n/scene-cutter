import { FileUtils } from './file-utils.js'

export class SimpleHtmlParser {
  static async extractTranscriptFromHtml(htmlPath: string): Promise<string> {
    try {
      const htmlContent = await FileUtils.readFile(htmlPath)
      
      // Simple regex-based extraction
      // Remove script and style tags
      let cleanedHtml = htmlContent
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
        .replace(/<meta[^>]*>/gi, '')
        .replace(/<link[^>]*>/gi, '')
        .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '')
      
      // Extract text content
      let text = cleanedHtml
        .replace(/<[^>]+>/g, ' ') // Replace HTML tags with spaces
        .replace(/&nbsp;/g, ' ') // Replace HTML entities
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
      
      // Clean up whitespace
      text = this.cleanTranscript(text)
      
      return text
    } catch (error) {
      throw new Error(`Failed to parse HTML file ${htmlPath}: ${error}`)
    }
  }

  static async extractStructuredContent(htmlPath: string): Promise<{
    transcript: string
    timestamps: Array<{ time: string; text: string }>
    sections: Array<{ title: string; content: string }>
  }> {
    try {
      const htmlContent = await FileUtils.readFile(htmlPath)
      
      const transcript = this.extractTranscriptFromHtml(htmlPath)
      
      // Extract timestamps using regex
      const timestamps: Array<{ time: string; text: string }> = []
      const timeRegex = /(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–—]\s*(.+?)(?=\d{1,2}:\d{2}|$)/g
      let match
      
      while ((match = timeRegex.exec(htmlContent)) !== null) {
        const time = match[1]
        const text = match[2].trim()
        if (time && text) {
          timestamps.push({ time, text })
        }
      }
      
      // Extract sections using heading tags
      const sections: Array<{ title: string; content: string }> = []
      const headingRegex = /<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi
      const headingMatches = htmlContent.match(headingRegex) || []
      
      for (const headingMatch of headingMatches) {
        const title = headingMatch.replace(/<[^>]+>/g, '').trim()
        if (title) {
          // Extract content after heading until next heading
          const headingIndex = htmlContent.indexOf(headingMatch)
          const nextHeadingIndex = htmlContent.indexOf('<h', headingIndex + headingMatch.length)
          const contentEnd = nextHeadingIndex > -1 ? nextHeadingIndex : htmlContent.length
          const content = htmlContent.substring(headingIndex + headingMatch.length, contentEnd)
            .replace(/<[^>]+>/g, ' ')
            .trim()
          
          if (content) {
            sections.push({ title, content })
          }
        }
      }
      
      return {
        transcript: await transcript,
        timestamps,
        sections
      }
    } catch (error) {
      throw new Error(`Failed to extract structured content from HTML file ${htmlPath}: ${error}`)
    }
  }

  private static cleanTranscript(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n+/g, '\n') // Replace multiple newlines with single newline
      .trim()
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n')
  }
}
