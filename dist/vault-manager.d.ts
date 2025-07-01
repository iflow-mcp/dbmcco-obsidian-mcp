export interface NoteSearchResult {
    path: string;
    title: string;
    matches: string[];
    matchType: 'filename' | 'content' | 'both';
}
export interface Backlink {
    sourcePath: string;
    sourceTitle: string;
    linkText: string;
    context: string;
}
export interface DirectoryListing {
    name: string;
    path: string;
    type: 'directory' | 'file';
    noteCount?: number;
}
export interface DocumentSection {
    heading: string;
    content: string;
    level: number;
    startLine: number;
}
export interface EnhancedNoteSearchResult extends NoteSearchResult {
    relevanceScore?: number;
    context?: string;
    searchMethod?: 'direct' | 'link' | 'tag' | 'structural';
}
export declare class VaultManager {
    private defaultVaultPath;
    constructor();
    private getVaultPath;
    searchNotes(searchTerm: string, searchType?: 'filename' | 'content' | 'both', vaultPath?: string): Promise<NoteSearchResult[]>;
    getNoteContent(notePath: string, vaultPath?: string): Promise<string>;
    getBacklinks(notePath: string, vaultPath?: string): Promise<Backlink[]>;
    getAllNotes(vaultPath?: string): Promise<string[]>;
    listDirectories(directoryPath?: string, vaultPath?: string): Promise<DirectoryListing[]>;
    buildLinkGraph(vaultPath?: string): Promise<Map<string, Set<string>>>;
    buildTagHierarchy(vaultPath?: string): Promise<Map<string, string[]>>;
    intelligentSearch(query: string, vaultPath?: string): Promise<EnhancedNoteSearchResult[]>;
    private searchNotesEnhanced;
    private findByLinkProximity;
    private expandedTagSearch;
    private structuralSearch;
    private mergeAndRankResults;
    private extractWikiLinks;
    private extractTags;
    private expandQueryByTags;
    private parseDocumentSections;
    private calculateStructuralRelevance;
    writeNote(notePath: string, content: string, vaultPath?: string): Promise<void>;
    createNote(notePath: string, title: string, content?: string, tags?: string[], vaultPath?: string): Promise<void>;
    appendToNote(notePath: string, content: string, vaultPath?: string): Promise<void>;
    updateNoteSection(notePath: string, sectionHeading: string, newContent: string, vaultPath?: string): Promise<void>;
    private getNoteTitle;
    getContext(lines: string[], lineIndex: number, contextLines?: number): string;
}
//# sourceMappingURL=vault-manager.d.ts.map