import { VaultManager } from './vault-manager.js';
export declare class QueryProcessor {
    private vaultManager;
    constructor(vaultManager: VaultManager);
    processQuery(query: string, vaultPath?: string): Promise<string>;
    private buildQueryContext;
    private extractSearchTerms;
    private deduplicateResults;
    private generateResponse;
    private evaluateIdeas;
    private suggestRefinements;
    private summarizeFindings;
    private extractTitle;
    private extractKeyPoints;
}
//# sourceMappingURL=query-processor.d.ts.map