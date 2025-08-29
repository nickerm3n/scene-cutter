export declare class SimpleHtmlParser {
    static extractTranscriptFromHtml(htmlPath: string): Promise<string>;
    static extractStructuredContent(htmlPath: string): Promise<{
        transcript: string;
        timestamps: Array<{
            time: string;
            text: string;
        }>;
        sections: Array<{
            title: string;
            content: string;
        }>;
    }>;
    private static cleanTranscript;
}
