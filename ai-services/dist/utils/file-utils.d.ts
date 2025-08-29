import { CourseModule } from '../types/index.js';
export declare class FileUtils {
    static readFile(filePath: string): Promise<string>;
    static writeFile(filePath: string, content: string): Promise<void>;
    static readJson(filePath: string): Promise<any>;
    static writeJson(filePath: string, data: any): Promise<void>;
    static getDirectories(dirPath: string): Promise<string[]>;
    static fileExists(filePath: string): Promise<boolean>;
    static directoryExists(dirPath: string): Promise<boolean>;
    static parseModuleFromDirectory(dirName: string, basePath: string): CourseModule;
}
