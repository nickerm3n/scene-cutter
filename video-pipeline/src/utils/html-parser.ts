import * as cheerio from 'cheerio'
import { FileUtils } from './file-utils.js'

export class HtmlParser {
  static async extractTranscriptFromHtml(htmlPath: string): Promise<string> {
    try {
      const htmlContent = await FileUtils.readFile(htmlPath)
      const $ = cheerio.load(htmlContent)
      
      // Remove script and style elements
      $('script, style').remove()
      
      // Extract text content
      let transcript = $('body').text()
      
      // Clean up the transcript
      transcript = this.cleanTranscript(transcript)
      
      return transcript
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
      const $ = cheerio.load(htmlContent)
      
      // Remove script and style elements
      $('script, style').remove()
      
      const transcript = this.cleanTranscript($('body').text())
      
      // Extract timestamps if they exist
      const timestamps: Array<{ time: string; text: string }> = []
      $('[data-time], .timestamp, .time').each((_, element) => {
        const $el = $(element)
        const time = $el.attr('data-time') || $el.text().match(/\d{1,2}:\d{2}/)?.[0] || ''
        const text = $el.text().replace(/\d{1,2}:\d{2}/, '').trim()
        if (time && text) {
          timestamps.push({ time, text })
        }
      })
      
      // Extract sections if they exist
      const sections: Array<{ title: string; content: string }> = []
      $('h1, h2, h3, h4, h5, h6').each((_, element) => {
        const $el = $(element)
        const title = $el.text().trim()
        const content = $el.nextUntil('h1, h2, h3, h4, h5, h6').text().trim()
        if (title && content) {
          sections.push({ title, content })
        }
      })
      
      return {
        transcript,
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
