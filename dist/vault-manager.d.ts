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
export declare class VaultManager {
    private defaultVaultPath;
    constructor();
    private getVaultPath;
    searchNotes(searchTerm: string, searchType?: 'filename' | 'content' | 'both', vaultPath?: string): Promise<NoteSearchResult[]>;
    getNoteContent(notePath: string, vaultPath?: string): Promise<string>;
    getBacklinks(notePath: string, vaultPath?: string): Promise<Backlink[]>;
    getAllNotes(vaultPath?: string): Promise<string[]>;
    writeNote(notePath: string, content: string, vaultPath?: string): Promise<void>;
    createNote(notePath: string, title: string, content?: string, tags?: string[], vaultPath?: string): Promise<void>;
    appendToNote(notePath: string, content: string, vaultPath?: string): Promise<void>;
    updateNoteSection(notePath: string, sectionHeading: string, newContent: string, vaultPath?: string): Promise<void>;
    private getNoteTitle;
    private getContext;
}
//# sourceMappingURL=vault-manager.d.ts.map