import { CourseModule, ProcessedModule, PipelineConfig } from '../types/index.js';
export declare class ContentProcessor {
    private config;
    private model;
    constructor(config: PipelineConfig);
    processModule(module: CourseModule): Promise<ProcessedModule>;
    processAllModules(modules: CourseModule[]): Promise<ProcessedModule[]>;
    private loadModuleContent;
    private extractTimestampedContent;
    private findImagesForTimestamp;
    private extractFrameImages;
    private frameNumberToTimestamp;
    private timestampsMatch;
    private parseTimestamp;
    private processWithImages;
    private loadTemplate;
    private saveProcessedModule;
    saveAllProcessedModules(processedModules: ProcessedModule[]): Promise<void>;
    private getDefaultTemplate;
    private generateReadme;
    private delay;
}
