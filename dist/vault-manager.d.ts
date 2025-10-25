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
export interface StoryPathOptions {
    supportingLimit?: number;
    counterpointLimit?: number;
    includeActionItems?: boolean;
    vaultPath?: string;
}
export interface ContextualCompanion {
    path: string;
    title: string;
    score: number;
    reason: string;
    linkTypes: string[];
}
export interface ContextualCompanionOptions {
    notePath?: string;
    topic?: string;
    limit?: number;
    vaultPath?: string;
}
export interface FreshEnergyOptions {
    hoursBack?: number;
    limit?: number;
    minWords?: number;
    vaultPath?: string;
}
export interface FreshEnergyFinding {
    path: string;
    title: string;
    modifiedAt: string;
    backlinks: number;
    outgoingLinks: number;
    tags: string[];
    actionItems: string[];
    preview: string;
}
export interface InitiativeBridgeOptions {
    initiative: string;
    frontmatterField?: string;
    limit?: number;
    vaultPath?: string;
}
export interface InitiativeBridgeFinding {
    path: string;
    title: string;
    matchedField: string;
    tasks: string[];
    lastModified: string;
    coverage: {
        backlinks: number;
        outgoing: number;
    };
}
export interface PatternEchoOptions {
    snippet: string;
    limit?: number;
    vaultPath?: string;
}
export interface PatternEchoResult {
    path: string;
    title: string;
    matchedLines: string[];
    similarityScore: number;
}
export interface SynthesisReadyOptions {
    minClusterSize?: number;
    vaultPath?: string;
}
export interface SynthesisReadyFinding {
    hubNote: string;
    title: string;
    cluster: string[];
    missingSummaryNote: boolean;
    suggestion: string;
}
export interface NoteAuditOptions {
    hoursBack?: number;
    limit?: number;
    requiredFields?: string[];
    requireHeadings?: boolean;
    vaultPath?: string;
}
export interface NoteAuditFinding {
    path: string;
    modifiedAt: string;
    missingFrontmatter: boolean;
    missingFields: string[];
    hasHeadings: boolean;
    wordCount: number;
    preview: string;
}
export declare class VaultManager {
    private defaultVaultPath;
    private frontmatterFailureCount;
    private readonly frontmatterFailureLimit;
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
    auditRecentNotes(options?: NoteAuditOptions): Promise<NoteAuditFinding[]>;
    generateContextualCompanions(options: ContextualCompanionOptions): Promise<ContextualCompanion[]>;
    findFreshEnergyNotes(options?: FreshEnergyOptions): Promise<FreshEnergyFinding[]>;
    bridgeInitiativeOpportunity(options: InitiativeBridgeOptions): Promise<InitiativeBridgeFinding[]>;
    patternEcho(options: PatternEchoOptions): Promise<PatternEchoResult[]>;
    findSynthesisReadyClusters(options?: SynthesisReadyOptions): Promise<SynthesisReadyFinding[]>;
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
    generateStoryPath(notePath: string, options?: StoryPathOptions): Promise<string>;
    private resolveNoteReference;
    private noteKey;
    private extractLinkContext;
    private escapeRegExp;
    private extractSummary;
    private extractActionItems;
    private extractKeyPointsForStory;
    private parseNote;
    private formatContextForBlockquote;
    private normalizeContextForExcerpt;
    private hasFrontmatterField;
    private extractTagsFromFrontmatter;
    private safeParseMatter;
    private extractKeywords;
    private calculateKeywordOverlap;
    private calculateTokenOverlap;
    private tokenize;
    private bumpScore;
    private appendReason;
    private safeStat;
    private calculateRecencyBoost;
    private findMatchingLines;
    private valueMatchesInitiative;
    private summaryNoteExists;
    private get stopWords();
    private _stopWords?;
}
//# sourceMappingURL=vault-manager.d.ts.map