// ABOUTME: Natural language query processing for Obsidian vault content
// Extracts search terms, builds context, and generates responses based on query intent
import { VaultManager, NoteSearchResult, Backlink } from './vault-manager.js';

interface QueryContext {
  query: string;
  searchResults: NoteSearchResult[];
  relatedNotes: Map<string, string>;
  backlinks: Map<string, Backlink[]>;
}

export class QueryProcessor {
  constructor(private vaultManager: VaultManager) {}

  async processQuery(query: string, vaultPath?: string): Promise<string> {
    const context = await this.buildQueryContext(query, vaultPath);
    return this.generateResponse(context);
  }

  private async buildQueryContext(query: string, vaultPath?: string): Promise<QueryContext> {
    // Extract potential search terms from the query
    const searchTerms = this.extractSearchTerms(query);
    
    // Search for relevant notes
    const searchResults: NoteSearchResult[] = [];
    for (const term of searchTerms) {
      const results = await this.vaultManager.searchNotes(term, 'both', vaultPath);
      searchResults.push(...results);
    }

    // Remove duplicates
    const uniqueResults = this.deduplicateResults(searchResults);

    // Get content of most relevant notes
    const relatedNotes = new Map<string, string>();
    const topNotes = uniqueResults.slice(0, 5); // Get top 5 most relevant
    
    for (const note of topNotes) {
      try {
        const content = await this.vaultManager.getNoteContent(note.path, vaultPath);
        relatedNotes.set(note.path, content);
      } catch (error) {
        console.error(`Failed to read note ${note.path}:`, error);
      }
    }

    // Get backlinks for relevant notes
    const backlinks = new Map<string, Backlink[]>();
    for (const note of topNotes) {
      try {
        const noteBacklinks = await this.vaultManager.getBacklinks(note.path, vaultPath);
        if (noteBacklinks.length > 0) {
          backlinks.set(note.path, noteBacklinks);
        }
      } catch (error) {
        console.error(`Failed to get backlinks for ${note.path}:`, error);
      }
    }

    return {
      query,
      searchResults: uniqueResults,
      relatedNotes,
      backlinks,
    };
  }

  private extractSearchTerms(query: string): string[] {
    // Extract key terms from the query
    const terms: string[] = [];
    
    // Look for quoted terms first
    const quotedTerms = query.match(/"([^"]+)"/g);
    if (quotedTerms) {
      terms.push(...quotedTerms.map(t => t.replace(/"/g, '')));
    }

    // Extract capitalized words (likely proper nouns)
    const capitalizedWords = query.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g);
    if (capitalizedWords) {
      terms.push(...capitalizedWords);
    }

    // Extract longer words (likely important terms)
    const words = query.toLowerCase().split(/\s+/);
    const importantWords = words.filter(word => 
      word.length > 4 && 
      !['about', 'please', 'could', 'would', 'should', 'might', 'evaluate', 'suggest', 'working'].includes(word)
    );
    terms.push(...importantWords);

    // Remove duplicates
    return [...new Set(terms)];
  }

  private deduplicateResults(results: NoteSearchResult[]): NoteSearchResult[] {
    const seen = new Set<string>();
    return results.filter(result => {
      if (seen.has(result.path)) {
        return false;
      }
      seen.add(result.path);
      return true;
    });
  }

  private generateResponse(context: QueryContext): string {
    const { query, searchResults, relatedNotes, backlinks } = context;

    if (searchResults.length === 0) {
      return `I couldn't find any notes related to "${query}" in your vault. Try using different search terms or checking if the notes exist.`;
    }

    let response = `Based on your query "${query}", I found ${searchResults.length} relevant notes.\n\n`;

    // Analyze the query intent
    const isEvaluationRequest = /evaluat|assess|review|analyz/i.test(query);
    const isSuggestionRequest = /suggest|recommend|refine|improve/i.test(query);
    const isIdeasRequest = /idea|concept|thought/i.test(query);

    // Process the content based on the query type
    if (isEvaluationRequest && isIdeasRequest) {
      response += this.evaluateIdeas(relatedNotes, backlinks);
    } else if (isSuggestionRequest) {
      response += this.suggestRefinements(relatedNotes, backlinks);
    } else {
      response += this.summarizeFindings(searchResults, relatedNotes, backlinks);
    }

    return response;
  }

  private evaluateIdeas(notes: Map<string, string>, backlinks: Map<string, Backlink[]>): string {
    let evaluation = "## Evaluation of Ideas\n\n";

    for (const [notePath, content] of notes) {
      const title = this.extractTitle(content, notePath);
      evaluation += `### ${title}\n\n`;

      // Extract key points from the content
      const keyPoints = this.extractKeyPoints(content);
      if (keyPoints.length > 0) {
        evaluation += "**Key Points:**\n";
        keyPoints.forEach(point => {
          evaluation += `- ${point}\n`;
        });
        evaluation += "\n";
      }

      // Check connections via backlinks
      const noteBacklinks = backlinks.get(notePath);
      if (noteBacklinks && noteBacklinks.length > 0) {
        evaluation += `**Connections:** This idea is referenced in ${noteBacklinks.length} other notes, suggesting it's well-integrated into your knowledge base.\n\n`;
      }
    }

    return evaluation;
  }

  private suggestRefinements(notes: Map<string, string>, backlinks: Map<string, Backlink[]>): string {
    let suggestions = "## Suggested Refinements\n\n";

    for (const [notePath, content] of notes) {
      const title = this.extractTitle(content, notePath);
      suggestions += `### For "${title}"\n\n`;

      // Analyze content structure
      const hasHeadings = /^#{1,6}\s+/m.test(content);
      const hasBullets = /^[\-\*]\s+/m.test(content);
      const wordCount = content.split(/\s+/).length;

      // Provide specific suggestions
      if (wordCount < 100) {
        suggestions += "- **Expand the content**: This note is quite brief. Consider adding more detail, examples, or context.\n";
      }

      if (!hasHeadings && wordCount > 200) {
        suggestions += "- **Add structure**: Consider organizing with headings to improve readability.\n";
      }

      if (!hasBullets && wordCount > 150) {
        suggestions += "- **Use bullet points**: Break down complex ideas into digestible points.\n";
      }

      const noteBacklinks = backlinks.get(notePath);
      if (!noteBacklinks || noteBacklinks.length === 0) {
        suggestions += "- **Create connections**: This note appears isolated. Consider linking it to related concepts.\n";
      }

      // Check for action items or next steps
      if (!/next|todo|action|step/i.test(content)) {
        suggestions += "- **Add actionable items**: Consider including next steps or action items.\n";
      }

      suggestions += "\n";
    }

    return suggestions;
  }

  private summarizeFindings(
    searchResults: NoteSearchResult[],
    relatedNotes: Map<string, string>,
    backlinks: Map<string, Backlink[]>
  ): string {
    let summary = "## Summary of Findings\n\n";

    // List found notes
    summary += "**Relevant Notes:**\n";
    searchResults.slice(0, 10).forEach(result => {
      summary += `- **${result.title}** (${result.path})\n`;
      if (result.matches.length > 0) {
        summary += `  - ${result.matches[0]}\n`;
      }
    });

    summary += "\n";

    // Add context from top notes
    if (relatedNotes.size > 0) {
      summary += "**Key Content:**\n\n";
      for (const [notePath, content] of relatedNotes) {
        const title = this.extractTitle(content, notePath);
        const preview = content.substring(0, 200).replace(/\n/g, ' ').trim();
        summary += `From "${title}":\n> ${preview}...\n\n`;
      }
    }

    // Mention connections
    const totalBacklinks = Array.from(backlinks.values()).reduce((sum, bl) => sum + bl.length, 0);
    if (totalBacklinks > 0) {
      summary += `**Network Effect:** These notes have ${totalBacklinks} total backlinks, indicating strong integration within your vault.\n`;
    }

    return summary;
  }

  private extractTitle(content: string, fallbackPath: string): string {
    // Try to extract title from first heading
    const headingMatch = content.match(/^#\s+(.+)$/m);
    if (headingMatch) return headingMatch[1];

    // Fallback to filename
    return fallbackPath.replace(/\.md$/, '').split('/').pop() || 'Untitled';
  }

  private extractKeyPoints(content: string): string[] {
    const points: string[] = [];
    
    // Extract bullet points
    const bullets = content.match(/^[\-\*]\s+(.+)$/gm);
    if (bullets) {
      points.push(...bullets.map(b => b.replace(/^[\-\*]\s+/, '').trim()).slice(0, 5));
    }

    // If no bullets, extract first few sentences
    if (points.length === 0) {
      const sentences = content.match(/[^.!?]+[.!?]+/g);
      if (sentences) {
        points.push(...sentences.slice(0, 3).map(s => s.trim()));
      }
    }

    return points;
  }
}