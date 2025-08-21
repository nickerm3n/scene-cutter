import fs from 'fs-extra'
import path from 'path'
import { CourseModule } from '../types/index.js'

export class FileUtils {
  static async readFile(filePath: string): Promise<string> {
    try {
      return await fs.readFile(filePath, 'utf-8')
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${error}`)
    }
  }

  static async writeFile(filePath: string, content: string): Promise<void> {
    try {
      await fs.ensureDir(path.dirname(filePath))
      await fs.writeFile(filePath, content, 'utf-8')
    } catch (error) {
      throw new Error(`Failed to write file ${filePath}: ${error}`)
    }
  }

  static async readJson(filePath: string): Promise<any> {
    try {
      const content = await this.readFile(filePath)
      return JSON.parse(content)
    } catch (error) {
      throw new Error(`Failed to read JSON file ${filePath}: ${error}`)
    }
  }

  static async writeJson(filePath: string, data: any): Promise<void> {
    try {
      await fs.ensureDir(path.dirname(filePath))
      await fs.writeJson(filePath, data, { spaces: 2 })
    } catch (error) {
      throw new Error(`Failed to write JSON file ${filePath}: ${error}`)
    }
  }

  static async getDirectories(dirPath: string): Promise<string[]> {
    try {
      const items = await fs.readdir(dirPath)
      const directories: string[] = []
      
      for (const item of items) {
        const fullPath = path.join(dirPath, item)
        const stat = await fs.stat(fullPath)
        if (stat.isDirectory()) {
          directories.push(item)
        }
      }
      
      return directories.sort()
    } catch (error) {
      throw new Error(`Failed to read directory ${dirPath}: ${error}`)
    }
  }

  static async fileExists(filePath: string): Promise<boolean> {
    try {
      return await fs.pathExists(filePath)
    } catch (error) {
      return false
    }
  }

  static async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(dirPath)
      return stat.isDirectory()
    } catch (error) {
      return false
    }
  }

  static parseModuleFromDirectory(dirName: string, basePath: string): CourseModule {
    // Parse directory name like "1._28._Third-Party_MCP_Hubs"
    const match = dirName.match(/^(\d+)\._(\d+)\._(.+)$/)
    
    if (!match) {
      throw new Error(`Invalid module directory name format: ${dirName}`)
    }

    const [, sectionNum, lessonNum, title] = match
    const order = parseInt(sectionNum) * 100 + parseInt(lessonNum)
    
    const modulePath = path.join(basePath, dirName)
    
    return {
      id: dirName,
      title: title.replace(/_/g, ' '),
      order,
      videoPath: path.join(modulePath, `${dirName}.mp4`),
      transcriptPath: path.join(modulePath, 'transcript.txt'),
      htmlPath: path.join(modulePath, 'scenes', 'summary.html'),
      metadataPath: path.join(modulePath, 'scenes', 'scenes_metadata.json'),
      scenesPath: path.join(modulePath, 'scenes')
    }
  }
}
