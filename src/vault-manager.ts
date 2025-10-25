// ABOUTME: Core vault management with CRUD operations, search, and advanced intelligence features
// Provides link analysis, tag hierarchies, note auditing, and knowledge graph capabilities
import { promises as fs } from 'fs';
import type { Stats } from 'fs';
import path from 'path';
import { glob } from 'glob';
import matter from 'gray-matter';

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

interface StoryPathSegment {
  role: 'introduction' | 'supporting' | 'counterpoint';
  notePath: string;
  title: string;
  excerpt: string;
  context?: string;
}

interface ActionItemHighlight {
  notePath: string;
  title: string;
  text: string;
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

export class VaultManager {
  private defaultVaultPath: string;
  private frontmatterFailureCount = 0;
  private readonly frontmatterFailureLimit = 10;

  constructor() {
    this.defaultVaultPath = process.env.OBSIDIAN_VAULT_PATH || '';
  }

  private getVaultPath(vaultPath?: string): string {
    const vault = vaultPath || this.defaultVaultPath;
    if (!vault) {
      throw new Error('No vault path provided and OBSIDIAN_VAULT_PATH environment variable not set');
    }
    return vault;
  }

  async searchNotes(
    searchTerm: string,
    searchType: 'filename' | 'content' | 'both' = 'both',
    vaultPath?: string
  ): Promise<NoteSearchResult[]> {
    const vault = this.getVaultPath(vaultPath);
    const results: NoteSearchResult[] = [];
    
    const mdFiles = await glob('**/*.md', {
      cwd: vault,
      absolute: false,
    });

    for (const file of mdFiles) {
      const fullPath = path.join(vault, file);
      const basename = path.basename(file, '.md');
      const matches: string[] = [];
      let matchType: 'filename' | 'content' | 'both' | null = null;

      // Search in filename
      if (searchType === 'filename' || searchType === 'both') {
        if (basename.toLowerCase().includes(searchTerm.toLowerCase())) {
          matches.push(`Filename: ${basename}`);
          matchType = 'filename';
        }
      }

      // Search in content
      if (searchType === 'content' || searchType === 'both') {
        try {
          const content = await fs.readFile(fullPath, 'utf-8');
          const lines = content.split('\n');
          
          lines.forEach((line, index) => {
            if (line.toLowerCase().includes(searchTerm.toLowerCase())) {
              matches.push(`Line ${index + 1}: ${line.trim()}`);
              matchType = matchType === 'filename' ? 'both' : 'content';
            }
          });
        } catch (error) {
          console.error(`Error reading file ${fullPath}:`, error);
        }
      }

      if (matches.length > 0 && matchType) {
        const title = await this.getNoteTitle(fullPath);
        results.push({
          path: file,
          title,
          matches: matches.slice(0, 5), // Limit to first 5 matches
          matchType,
        });
      }
    }

    return results;
  }

  async getNoteContent(notePath: string, vaultPath?: string): Promise<string> {
    const vault = this.getVaultPath(vaultPath);
    const fullPath = path.join(vault, notePath);
    
    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      return content;
    } catch (error) {
      throw new Error(`Failed to read note at ${notePath}: ${error}`);
    }
  }

  async getBacklinks(notePath: string, vaultPath?: string): Promise<Backlink[]> {
    const vault = this.getVaultPath(vaultPath);
    const backlinks: Backlink[] = [];
    const targetNote = path.basename(notePath, '.md');
    
    const mdFiles = await glob('**/*.md', {
      cwd: vault,
      absolute: false,
    });

    for (const file of mdFiles) {
      if (file === notePath) continue; // Skip the target file itself
      
      const fullPath = path.join(vault, file);
      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        const lines = content.split('\n');
        
        // Look for wiki-style links [[targetNote]] or [[targetNote|alias]]
        const wikiLinkRegex = new RegExp(`\\[\\[${targetNote}(\\|[^\\]]+)?\\]\\]`, 'gi');
        
        // Look for markdown links [text](targetNote.md)
        const mdLinkRegex = new RegExp(`\\[([^\\]]+)\\]\\(${targetNote}\\.md\\)`, 'gi');
        
        lines.forEach((line, index) => {
          let match;
          
          // Check wiki-style links
          while ((match = wikiLinkRegex.exec(line)) !== null) {
            const linkText = match[1] ? match[1].substring(1) : targetNote;
            backlinks.push({
              sourcePath: file,
              sourceTitle: path.basename(file, '.md'),
              linkText,
              context: this.getContext(lines, index),
            });
          }
          
          // Check markdown links
          while ((match = mdLinkRegex.exec(line)) !== null) {
            backlinks.push({
              sourcePath: file,
              sourceTitle: path.basename(file, '.md'),
              linkText: match[1],
              context: this.getContext(lines, index),
            });
          }
        });
      } catch (error) {
        console.error(`Error reading file ${fullPath}:`, error);
      }
    }

    return backlinks;
  }

  async getAllNotes(vaultPath?: string): Promise<string[]> {
    const vault = this.getVaultPath(vaultPath);
    
    const mdFiles = await glob('**/*.md', {
      cwd: vault,
      absolute: false,
    });

    return mdFiles;
  }

  async listDirectories(directoryPath: string = '', vaultPath?: string): Promise<DirectoryListing[]> {
    const vault = this.getVaultPath(vaultPath);
    const targetPath = path.join(vault, directoryPath);
    
    try {
      const entries = await fs.readdir(targetPath, { withFileTypes: true });
      const results: DirectoryListing[] = [];
      
      for (const entry of entries) {
        // Skip hidden files and Obsidian metadata
        if (entry.name.startsWith('.')) continue;
        
        const itemPath = directoryPath ? path.join(directoryPath, entry.name) : entry.name;
        
        if (entry.isDirectory()) {
          // Count notes in this directory
          const notePattern = path.join(itemPath, '**/*.md');
          const notesInDir = await glob(notePattern, {
            cwd: vault,
            absolute: false,
          });
          
          results.push({
            name: entry.name,
            path: itemPath,
            type: 'directory',
            noteCount: notesInDir.length,
          });
        } else if (entry.name.endsWith('.md')) {
          results.push({
            name: entry.name,
            path: itemPath,
            type: 'file',
          });
        }
      }
      
      // Sort: directories first, then files, both alphabetically
      return results.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
    } catch (error) {
      throw new Error(`Failed to list directory ${directoryPath}: ${error}`);
    }
  }

  async buildLinkGraph(vaultPath?: string): Promise<Map<string, Set<string>>> {
    const vault = this.getVaultPath(vaultPath);
    const linkGraph = new Map<string, Set<string>>();
    
    const mdFiles = await glob('**/*.md', {
      cwd: vault,
      absolute: false,
    });

    for (const file of mdFiles) {
      const fullPath = path.join(vault, file);
      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        const links = this.extractWikiLinks(content);
        linkGraph.set(file, new Set(links));
      } catch (error) {
        console.error(`Error reading file ${fullPath}:`, error);
        linkGraph.set(file, new Set());
      }
    }

    return linkGraph;
  }

  async buildTagHierarchy(vaultPath?: string): Promise<Map<string, string[]>> {
    const vault = this.getVaultPath(vaultPath);
    const hierarchy = new Map<string, string[]>();
    
    const mdFiles = await glob('**/*.md', {
      cwd: vault,
      absolute: false,
    });

    for (const file of mdFiles) {
      const fullPath = path.join(vault, file);
      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        const tags = this.extractTags(content);
        
        for (const tag of tags) {
          const parts = tag.split('/');
          for (let i = 0; i < parts.length - 1; i++) {
            const parent = parts.slice(0, i + 1).join('/');
            const child = parts.slice(0, i + 2).join('/');
            if (!hierarchy.has(parent)) {
              hierarchy.set(parent, []);
            }
            if (!hierarchy.get(parent)!.includes(child)) {
              hierarchy.get(parent)!.push(child);
            }
          }
        }
      } catch (error) {
        console.error(`Error reading file ${fullPath}:`, error);
      }
    }

    return hierarchy;
  }

  async intelligentSearch(query: string, vaultPath?: string): Promise<EnhancedNoteSearchResult[]> {
    const [linkGraph, tagHierarchy] = await Promise.all([
      this.buildLinkGraph(vaultPath),
      this.buildTagHierarchy(vaultPath)
    ]);

    const [directResults, linkResults, tagResults, structuralResults] = await Promise.all([
      this.searchNotesEnhanced(query, 'both', vaultPath, 'direct'),
      this.findByLinkProximity(query, linkGraph, vaultPath),
      this.expandedTagSearch(query, tagHierarchy, vaultPath),
      this.structuralSearch(query, vaultPath)
    ]);

    return this.mergeAndRankResults([
      directResults,
      linkResults, 
      tagResults,
      structuralResults
    ]);
  }

  private async searchNotesEnhanced(
    searchTerm: string,
    searchType: 'filename' | 'content' | 'both' = 'both',
    vaultPath?: string,
    method: 'direct' | 'link' | 'tag' | 'structural' = 'direct'
  ): Promise<EnhancedNoteSearchResult[]> {
    const results = await this.searchNotes(searchTerm, searchType, vaultPath);
    return results.map(result => ({
      ...result,
      relevanceScore: 1.0,
      searchMethod: method
    }));
  }

  private async findByLinkProximity(
    query: string, 
    linkGraph: Map<string, Set<string>>, 
    vaultPath?: string
  ): Promise<EnhancedNoteSearchResult[]> {
    const directMatches = await this.searchNotes(query, 'both', vaultPath);
    const relatedNotes = new Set<string>();
    
    // Find notes that link to/from direct matches
    for (const match of directMatches) {
      const linkedNotes = linkGraph.get(match.path) || new Set();
      linkedNotes.forEach(note => relatedNotes.add(note));
      
      // Also find notes that link TO this match
      for (const [notePath, links] of linkGraph) {
        const matchBasename = path.basename(match.path, '.md');
        if (links.has(matchBasename) || links.has(match.path)) {
          relatedNotes.add(notePath);
        }
      }
    }

    const results: EnhancedNoteSearchResult[] = [];
    for (const notePath of relatedNotes) {
      if (!directMatches.some(m => m.path === notePath)) {
        const title = await this.getNoteTitle(path.join(this.getVaultPath(vaultPath), notePath));
        results.push({
          path: notePath,
          title,
          matches: ['Found via link proximity'],
          matchType: 'content',
          relevanceScore: 0.7,
          searchMethod: 'link',
          context: 'Connected to matching notes via wiki-links'
        });
      }
    }

    return results;
  }

  private async expandedTagSearch(
    query: string,
    tagHierarchy: Map<string, string[]>,
    vaultPath?: string
  ): Promise<EnhancedNoteSearchResult[]> {
    const expandedTerms = this.expandQueryByTags(query, tagHierarchy);
    const allResults: EnhancedNoteSearchResult[] = [];

    for (const term of expandedTerms) {
      if (term !== query) { // Don't duplicate direct search
        const results = await this.searchNotesEnhanced(term, 'both', vaultPath, 'tag');
        results.forEach(result => {
          result.relevanceScore = 0.6;
          result.context = `Found via tag expansion: ${term}`;
        });
        allResults.push(...results);
      }
    }

    return allResults;
  }

  private async structuralSearch(query: string, vaultPath?: string): Promise<EnhancedNoteSearchResult[]> {
    const vault = this.getVaultPath(vaultPath);
    const results: EnhancedNoteSearchResult[] = [];
    
    const mdFiles = await glob('**/*.md', {
      cwd: vault,
      absolute: false,
    });

    for (const file of mdFiles) {
      const fullPath = path.join(vault, file);
      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        const sections = this.parseDocumentSections(content);
        
        for (const section of sections) {
          if (section.content.toLowerCase().includes(query.toLowerCase())) {
            const title = await this.getNoteTitle(fullPath);
            const relevanceScore = this.calculateStructuralRelevance(section, query);
            
            results.push({
              path: file,
              title,
              matches: [`${section.heading}: ${section.content.substring(0, 100)}...`],
              matchType: 'content',
              relevanceScore,
              searchMethod: 'structural',
              context: `Found in section: ${section.heading}`
            });
          }
        }
      } catch (error) {
        console.error(`Error reading file ${fullPath}:`, error);
      }
    }

    return results.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
  }

  private mergeAndRankResults(resultSets: EnhancedNoteSearchResult[][]): EnhancedNoteSearchResult[] {
    const seenPaths = new Set<string>();
    const mergedResults: EnhancedNoteSearchResult[] = [];

    // Flatten and deduplicate, keeping highest relevance score
    for (const resultSet of resultSets) {
      for (const result of resultSet) {
        if (seenPaths.has(result.path)) {
          // If we've seen this path, update score if higher
          const existing = mergedResults.find(r => r.path === result.path);
          if (existing && (result.relevanceScore || 0) > (existing.relevanceScore || 0)) {
            existing.relevanceScore = result.relevanceScore;
            existing.searchMethod = result.searchMethod;
            existing.context = result.context;
          }
        } else {
          seenPaths.add(result.path);
          mergedResults.push(result);
        }
      }
    }

    // Sort by relevance score (highest first)
    return mergedResults.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
  }

  async auditRecentNotes(options: NoteAuditOptions = {}): Promise<NoteAuditFinding[]> {
    const {
      hoursBack = 72,
      limit = 25,
      requiredFields = ['title', 'created'],
      requireHeadings = false,
      vaultPath,
    } = options;

    const vault = this.getVaultPath(vaultPath);
    const threshold = Date.now() - hoursBack * 60 * 60 * 1000;

    const mdFiles = await glob('**/*.md', {
      cwd: vault,
      absolute: false,
    });

    const findings: NoteAuditFinding[] = [];

    for (const file of mdFiles) {
      const fullPath = path.join(vault, file);
      let stats;
      try {
        stats = await fs.stat(fullPath);
      } catch (error) {
        console.error(`Unable to stat file ${fullPath}:`, error);
        continue;
      }

      if (stats.mtime.getTime() < threshold) {
        continue;
      }

      let rawContent: string;
      try {
        rawContent = await fs.readFile(fullPath, 'utf-8');
      } catch (error) {
        console.error(`Unable to read file ${fullPath}:`, error);
        continue;
      }

      const parsed = this.safeParseMatter(rawContent);
      const missingFrontmatter = !parsed.frontmatterText;
      const missingFields = requiredFields.filter((field) => !this.hasFrontmatterField(parsed.data, field));
      const hasHeadings = /^#\s+/m.test(parsed.content);
      const wordCount = parsed.content.trim().length > 0 ? parsed.content.trim().split(/\s+/).length : 0;
      const preview = parsed.content
        .split('\n')
        .map((line) => line.trim())
        .find((line) => line.length > 0) || '';

      const needsAttention = missingFrontmatter || missingFields.length > 0 || (requireHeadings && !hasHeadings);
      if (!needsAttention) {
        continue;
      }

      findings.push({
        path: file,
        modifiedAt: stats.mtime.toISOString(),
        missingFrontmatter,
        missingFields,
        hasHeadings,
        wordCount,
        preview: preview.slice(0, 140),
      });
    }

    findings.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());

    return findings.slice(0, Math.max(1, limit));
  }

  async generateContextualCompanions(
    options: ContextualCompanionOptions
  ): Promise<ContextualCompanion[]> {
    const { notePath, topic, limit = 5, vaultPath } = options;
    if (!notePath && (!topic || topic.trim().length === 0)) {
      throw new Error('Provide either notePath or topic to generate contextual companions');
    }

    const vault = this.getVaultPath(vaultPath);
    const keywordSet = new Set<string>();
    const reasons = new Map<string, Set<string>>();
    const scores = new Map<string, number>();
    const titles = new Map<string, string>();

    if (topic) {
      this.extractKeywords(topic, 8).forEach((kw) => keywordSet.add(kw));
    }

    let seedNoteContent = '';
    let seedTitle = '';
    if (notePath) {
      const fullSeedPath = path.join(vault, notePath);
      try {
        const raw = await fs.readFile(fullSeedPath, 'utf-8');
        const parsed = this.parseNote(raw, notePath);
        seedNoteContent = parsed.body;
        seedTitle = parsed.title;
        this.extractKeywords(parsed.body, 12).forEach((kw) => keywordSet.add(kw));
      } catch (error) {
        console.error(`Failed to read seed note ${notePath}:`, error);
      }
    }

    const keywords = Array.from(keywordSet).slice(0, 12);
    const candidatePaths = new Set<string>();

    for (const keyword of keywords) {
      const matches = await this.searchNotes(keyword, 'both', vaultPath);
      matches.forEach((match) => {
        if (notePath && match.path === notePath) {
          return;
        }

        candidatePaths.add(match.path);
        this.bumpScore(scores, match.path, 1.0);
        this.appendReason(reasons, match.path, `Matches keyword "${keyword}"`);
        titles.set(match.path, match.title);
      });
    }

    if (notePath) {
      const fullSeedPath = path.join(vault, notePath);
      let rawSeed = '';
      try {
        rawSeed = await fs.readFile(fullSeedPath, 'utf-8');
      } catch (error) {
        console.error(`Unable to reopen seed note ${notePath}:`, error);
      }

      const outgoing = this.extractWikiLinks(rawSeed);
      for (const link of outgoing) {
        const resolved = await this.resolveNoteReference(link, vault);
        if (!resolved || resolved === notePath) {
          continue;
        }

        candidatePaths.add(resolved);
        this.bumpScore(scores, resolved, 1.5);
        this.appendReason(reasons, resolved, `Linked from ${notePath}`);
      }

      const backlinks = await this.getBacklinks(notePath, vaultPath);
      for (const backlink of backlinks) {
        if (backlink.sourcePath === notePath) {
          continue;
        }
        candidatePaths.add(backlink.sourcePath);
        this.bumpScore(scores, backlink.sourcePath, 1.3);
        this.appendReason(reasons, backlink.sourcePath, `References ${seedTitle || notePath}`);
      }
    }

    const companions: ContextualCompanion[] = [];

    for (const candidate of candidatePaths) {
      const fullPath = path.join(vault, candidate);
      let noteTitle = titles.get(candidate);
      let body = '';
      try {
        const raw = await fs.readFile(fullPath, 'utf-8');
        const parsed = this.parseNote(raw, candidate);
        noteTitle = noteTitle || parsed.title;
        body = parsed.body;
      } catch (error) {
        console.error(`Failed to enrich candidate ${candidate}:`, error);
      }

      const keywordOverlap = this.calculateKeywordOverlap(keywords, body);
      this.bumpScore(scores, candidate, keywordOverlap * 0.8);

      const meta = await this.safeStat(fullPath);
      if (meta) {
        const recencyBoost = this.calculateRecencyBoost(meta.mtimeMs);
        this.bumpScore(scores, candidate, recencyBoost);
      }

      companions.push({
        path: candidate,
        title: noteTitle || path.basename(candidate, '.md'),
        score: Number((scores.get(candidate) || 0).toFixed(2)),
        reason: Array.from(reasons.get(candidate) || []).join('; '),
        linkTypes: Array.from(reasons.get(candidate) || []).map((text) =>
          text.startsWith('Linked') || text.startsWith('References') ? 'link' : 'keyword'
        ),
      });
    }

    companions.sort((a, b) => b.score - a.score);
    return companions.slice(0, Math.max(1, limit));
  }

  async findFreshEnergyNotes(options: FreshEnergyOptions = {}): Promise<FreshEnergyFinding[]> {
    const { hoursBack = 48, limit = 10, minWords = 80, vaultPath } = options;
    const vault = this.getVaultPath(vaultPath);
    const threshold = Date.now() - hoursBack * 60 * 60 * 1000;

    const mdFiles = await glob('**/*.md', {
      cwd: vault,
      absolute: false,
    });

    const findings: FreshEnergyFinding[] = [];

    for (const file of mdFiles) {
      const fullPath = path.join(vault, file);
      const stats = await this.safeStat(fullPath);
      if (!stats || stats.mtimeMs < threshold) {
        continue;
      }

      let raw = '';
      try {
        raw = await fs.readFile(fullPath, 'utf-8');
      } catch (error) {
        console.error(`Unable to read ${file}:`, error);
        continue;
      }

      const parsed = this.parseNote(raw, file);
      const wordCount = parsed.body.trim().length > 0 ? parsed.body.trim().split(/\s+/).length : 0;
      if (wordCount < minWords) {
        continue;
      }

      const backlinks = await this.getBacklinks(file, vaultPath);
      const outgoingLinks = this.extractWikiLinks(raw).length;
      const tags = new Set<string>([
        ...this.extractTags(parsed.body),
        ...this.extractTagsFromFrontmatter(parsed.frontmatter),
      ]);
      const actionItems = this.extractActionItems(parsed.body, 5);

      if (backlinks.length > 0 && outgoingLinks > 0) {
        continue;
      }

      findings.push({
        path: file,
        title: parsed.title,
        modifiedAt: stats.mtime.toISOString(),
        backlinks: backlinks.length,
        outgoingLinks,
        tags: Array.from(tags),
        actionItems,
        preview: parsed.body.replace(/\s+/g, ' ').trim().slice(0, 160),
      });
    }

    findings.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());
    return findings.slice(0, Math.max(1, limit));
  }

  async bridgeInitiativeOpportunity(
    options: InitiativeBridgeOptions
  ): Promise<InitiativeBridgeFinding[]> {
    const { initiative, frontmatterField = 'project', limit = 10, vaultPath } = options;
    if (!initiative || initiative.trim().length === 0) {
      throw new Error('Initiative value is required');
    }

    const vault = this.getVaultPath(vaultPath);
    const mdFiles = await glob('**/*.md', {
      cwd: vault,
      absolute: false,
    });

    const results: InitiativeBridgeFinding[] = [];
    const normalizedInitiative = initiative.trim().toLowerCase();

    for (const file of mdFiles) {
      const fullPath = path.join(vault, file);
      let raw = '';
      try {
        raw = await fs.readFile(fullPath, 'utf-8');
      } catch (error) {
        console.error(`Unable to read ${file}:`, error);
        continue;
      }

      const parsed = this.parseNote(raw, file);
      const tags = new Set<string>([
        ...this.extractTags(parsed.body),
        ...this.extractTagsFromFrontmatter(parsed.frontmatter),
      ]);

      const fmValue = parsed.frontmatter[frontmatterField];
      const matchesFrontmatter = this.valueMatchesInitiative(fmValue, normalizedInitiative);
      const matchesTag = Array.from(tags).some((tag) => tag.toLowerCase() === normalizedInitiative);

      if (!matchesFrontmatter && !matchesTag) {
        continue;
      }

      const tasks = this.extractActionItems(parsed.body, 10);
      if (tasks.length === 0) {
        continue;
      }

      const backlinks = await this.getBacklinks(file, vaultPath);
      const outgoingLinks = this.extractWikiLinks(raw).length;
      const stats = await this.safeStat(fullPath);

      results.push({
        path: file,
        title: parsed.title,
        matchedField: matchesFrontmatter ? frontmatterField : 'tag',
        tasks,
        lastModified: stats ? stats.mtime.toISOString() : '',
        coverage: {
          backlinks: backlinks.length,
          outgoing: outgoingLinks,
        },
      });
    }

    results.sort((a, b) => b.tasks.length - a.tasks.length || a.coverage.backlinks - b.coverage.backlinks);
    return results.slice(0, Math.max(1, limit));
  }

  async patternEcho(options: PatternEchoOptions): Promise<PatternEchoResult[]> {
    const { snippet, limit = 5, vaultPath } = options;
    if (!snippet || snippet.trim().length === 0) {
      throw new Error('Snippet text is required for pattern echo');
    }

    const vault = this.getVaultPath(vaultPath);
    const normalizedSnippet = snippet.trim();
    const keywords = this.extractKeywords(normalizedSnippet, 8);
    const candidates = new Map<string, PatternEchoResult>();

    for (const keyword of keywords) {
      const matches = await this.searchNotes(keyword, 'content', vaultPath);
      for (const match of matches) {
        if (!candidates.has(match.path)) {
          candidates.set(match.path, {
            path: match.path,
            title: match.title,
            matchedLines: [],
            similarityScore: 0,
          });
        }
      }
    }

    for (const [candidatePath, result] of candidates.entries()) {
      const fullPath = path.join(vault, candidatePath);
      let raw = '';
      try {
        raw = await fs.readFile(fullPath, 'utf-8');
      } catch (error) {
        console.error(`Unable to read ${candidatePath} for pattern echo:`, error);
        candidates.delete(candidatePath);
        continue;
      }

      const lines = raw.split('\n');
      const matchedLines = this.findMatchingLines(lines, normalizedSnippet, keywords);
      if (matchedLines.length === 0) {
        candidates.delete(candidatePath);
        continue;
      }

      const overlap = this.calculateTokenOverlap(normalizedSnippet, raw);
      result.matchedLines = matchedLines.slice(0, 3);
      result.similarityScore = Number(overlap.toFixed(2));
    }

    const results = Array.from(candidates.values());
    results.sort((a, b) => b.similarityScore - a.similarityScore);
    return results.slice(0, Math.max(1, limit));
  }

  async findSynthesisReadyClusters(
    options: SynthesisReadyOptions = {}
  ): Promise<SynthesisReadyFinding[]> {
    const { minClusterSize = 3, vaultPath } = options;
    const vault = this.getVaultPath(vaultPath);

    const mdFiles = await glob('**/*.md', {
      cwd: vault,
      absolute: false,
    });

    const baseNameMap = new Map<string, string[]>();
    mdFiles.forEach((file) => {
      const base = path.basename(file, '.md').toLowerCase();
      if (!baseNameMap.has(base)) {
        baseNameMap.set(base, []);
      }
      baseNameMap.get(base)!.push(file);
    });

    const clusters: SynthesisReadyFinding[] = [];

    for (const file of mdFiles) {
      const fullPath = path.join(vault, file);
      let raw = '';
      try {
        raw = await fs.readFile(fullPath, 'utf-8');
      } catch (error) {
        console.error(`Unable to read ${file} for synthesis scan:`, error);
        continue;
      }

      const parsed = this.parseNote(raw, file);
      const outgoing = this.extractWikiLinks(raw);
      const related = new Set<string>();

      for (const link of outgoing) {
        const normalized = link.trim().toLowerCase();
        if (baseNameMap.has(normalized)) {
          baseNameMap.get(normalized)!.forEach((mapped) => related.add(mapped));
        }
      }

      const backlinks = await this.getBacklinks(file, vaultPath);
      backlinks.forEach((backlink) => related.add(backlink.sourcePath));

      related.delete(file);
      if (related.size < minClusterSize - 1) {
        continue;
      }

      const clusterPaths = Array.from(related);
      const summaryExists = await this.summaryNoteExists(clusterPaths, vault);
      clusters.push({
        hubNote: file,
        title: parsed.title,
        cluster: clusterPaths,
        missingSummaryNote: !summaryExists,
        suggestion: summaryExists
          ? 'Cluster already has a summary note.'
          : 'Consider drafting a synthesis note to connect these related ideas.',
      });
    }

    return clusters;
  }

  private extractWikiLinks(content: string): string[] {
    const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;
    const links: string[] = [];
    let match;
    
    while ((match = wikiLinkRegex.exec(content)) !== null) {
      const link = match[1].split('|')[0].trim(); // Handle [[note|alias]] format
      links.push(link);
    }
    
    return links;
  }

  private extractTags(content: string): string[] {
    const tagRegex = /#([\w\/]+)/g;
    const tags: string[] = [];
    let match;
    
    while ((match = tagRegex.exec(content)) !== null) {
      tags.push(match[1]);
    }
    
    return tags;
  }

  private expandQueryByTags(query: string, tagHierarchy: Map<string, string[]>): string[] {
    const expandedTerms = new Set([query]);
    
    // Add tag children and siblings
    for (const [tag, children] of tagHierarchy) {
      if (tag.toLowerCase().includes(query.toLowerCase())) {
        expandedTerms.add(tag);
        children.forEach(child => expandedTerms.add(child));
      }
    }
    
    // Add parent tags
    for (const [parent, children] of tagHierarchy) {
      if (children.some(child => child.toLowerCase().includes(query.toLowerCase()))) {
        expandedTerms.add(parent);
      }
    }
    
    return Array.from(expandedTerms);
  }

  private parseDocumentSections(content: string): DocumentSection[] {
    const lines = content.split('\n');
    const sections: DocumentSection[] = [];
    let currentSection: DocumentSection | null = null;
    
    lines.forEach((line, index) => {
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      
      if (headingMatch) {
        // Save previous section
        if (currentSection) {
          sections.push(currentSection);
        }
        
        // Start new section
        currentSection = {
          heading: headingMatch[2],
          content: '',
          level: headingMatch[1].length,
          startLine: index
        };
      } else if (currentSection) {
        currentSection.content += line + '\n';
      }
    });
    
    // Add final section
    if (currentSection) {
      sections.push(currentSection);
    }
    
    return sections;
  }

  private calculateStructuralRelevance(section: DocumentSection, query: string): number {
    let score = 0.5; // Base score
    
    // Boost for heading matches
    if (section.heading.toLowerCase().includes(query.toLowerCase())) {
      score += 0.3;
    }
    
    // Boost for higher-level headings (more important sections)
    score += (7 - section.level) * 0.05;
    
    // Boost for multiple query occurrences
    const occurrences = (section.content.toLowerCase().match(new RegExp(query.toLowerCase(), 'g')) || []).length;
    score += Math.min(occurrences * 0.1, 0.3);
    
    return Math.min(score, 1.0);
  }

  async writeNote(notePath: string, content: string, vaultPath?: string): Promise<void> {
    const vault = this.getVaultPath(vaultPath);
    const fullPath = path.join(vault, notePath);
    
    // Ensure directory exists
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });
    
    try {
      await fs.writeFile(fullPath, content, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to write note at ${notePath}: ${error}`);
    }
  }

  async createNote(
    notePath: string, 
    title: string, 
    content: string = '', 
    tags: string[] = [],
    vaultPath?: string
  ): Promise<void> {
    const vault = this.getVaultPath(vaultPath);
    const fullPath = path.join(vault, notePath);
    
    // Check if file already exists
    try {
      await fs.access(fullPath);
      throw new Error(`Note already exists at ${notePath}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
    
    // Create frontmatter
    const frontmatter = {
      title,
      created: new Date().toISOString(),
      tags: tags.length > 0 ? tags : undefined,
    };
    
    // Build note content with frontmatter
    const noteContent = matter.stringify(content, frontmatter);
    
    await this.writeNote(notePath, noteContent, vaultPath);
  }

  async appendToNote(notePath: string, content: string, vaultPath?: string): Promise<void> {
    const vault = this.getVaultPath(vaultPath);
    const fullPath = path.join(vault, notePath);
    
    try {
      // Check if file exists
      await fs.access(fullPath);
      
      // Read existing content
      const existing = await fs.readFile(fullPath, 'utf-8');
      
      // Append new content with proper spacing
      const separator = existing.endsWith('\n') ? '\n' : '\n\n';
      const newContent = existing + separator + content;
      
      await fs.writeFile(fullPath, newContent, 'utf-8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Note does not exist at ${notePath}. Use create_note or write_note instead.`);
      }
      throw new Error(`Failed to append to note at ${notePath}: ${error}`);
    }
  }

  async updateNoteSection(
    notePath: string, 
    sectionHeading: string, 
    newContent: string, 
    vaultPath?: string
  ): Promise<void> {
    const existing = await this.getNoteContent(notePath, vaultPath);
    const lines = existing.split('\n');
    
    // Find the section heading
    const headingRegex = new RegExp(`^#{1,6}\\s+${sectionHeading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i');
    let startIndex = -1;
    let endIndex = lines.length;
    let headingLevel = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (headingRegex.test(line)) {
        startIndex = i;
        headingLevel = (line.match(/^#+/) || [''])[0].length;
        break;
      }
    }
    
    if (startIndex === -1) {
      throw new Error(`Section "${sectionHeading}" not found in note ${notePath}`);
    }
    
    // Find the end of this section (next heading of same or higher level)
    for (let i = startIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/^#+/);
      
      if (match && match[0].length <= headingLevel) {
        endIndex = i;
        break;
      }
    }
    
    // Replace the section content
    const beforeSection = lines.slice(0, startIndex + 1);
    const afterSection = lines.slice(endIndex);
    const updatedLines = [...beforeSection, '', newContent, '', ...afterSection];
    
    await this.writeNote(notePath, updatedLines.join('\n'), vaultPath);
  }

  private async getNoteTitle(fullPath: string): Promise<string> {
    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      const { data, content: bodyContent } = matter(content);
      
      // Check frontmatter for title
      if (data.title) return data.title;
      
      // Look for first heading
      const firstHeading = bodyContent.match(/^#\s+(.+)$/m);
      if (firstHeading) return firstHeading[1];
      
      // Fall back to filename
      return path.basename(fullPath, '.md');
    } catch {
      return path.basename(fullPath, '.md');
    }
  }

  getContext(lines: string[], lineIndex: number, contextLines = 2): string {
    const start = Math.max(0, lineIndex - contextLines);
    const end = Math.min(lines.length, lineIndex + contextLines + 1);
    
    return lines
      .slice(start, end)
      .map((line, i) => {
        const actualLineNum = start + i;
        const prefix = actualLineNum === lineIndex ? '> ' : '  ';
        return prefix + line;
      })
      .join('\n');
  }

  async generateStoryPath(
    notePath: string,
    options: StoryPathOptions = {}
  ): Promise<string> {
    const {
      supportingLimit = 3,
      counterpointLimit = 3,
      includeActionItems = true,
      vaultPath,
    } = options;

    const vault = this.getVaultPath(vaultPath);
    const fullPath = path.join(vault, notePath);

    let rawSeedContent: string;
    try {
      rawSeedContent = await fs.readFile(fullPath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read seed note ${notePath}: ${error}`);
    }

    const seedParsed = this.parseNote(rawSeedContent, notePath);
    const introduction: StoryPathSegment = {
      role: 'introduction',
      notePath,
      title: seedParsed.title,
      excerpt: this.extractSummary(seedParsed.body),
      context: undefined,
    };

    const outgoingLinks = Array.from(new Set(this.extractWikiLinks(rawSeedContent)));
    const supportingSegments: StoryPathSegment[] = [];
    const actionHighlights: ActionItemHighlight[] = [];

    if (includeActionItems) {
      const seedActions = this.extractActionItems(seedParsed.body).map((text) => ({
        notePath,
        title: seedParsed.title,
        text,
      }));
      actionHighlights.push(...seedActions);
    }

    for (const link of outgoingLinks) {
      if (supportingSegments.length >= supportingLimit) {
        break;
      }

      const resolvedPath = await this.resolveNoteReference(link, vault);
      if (!resolvedPath) {
        continue;
      }

      const supportingFullPath = path.join(vault, resolvedPath);
      let rawSupporting: string;
      try {
        rawSupporting = await fs.readFile(supportingFullPath, 'utf-8');
      } catch (error) {
        console.error(`Unable to read supporting note ${resolvedPath}:`, error);
        continue;
      }

      const parsed = this.parseNote(rawSupporting, resolvedPath);
      const segment: StoryPathSegment = {
        role: 'supporting',
        notePath: resolvedPath,
        title: parsed.title,
        excerpt: this.extractSummary(parsed.body),
        context: this.extractLinkContext(rawSeedContent, link),
      };

      supportingSegments.push(segment);

      if (includeActionItems) {
        const supportActions = this.extractActionItems(parsed.body).map((text) => ({
          notePath: resolvedPath,
          title: parsed.title,
          text,
        }));
        actionHighlights.push(...supportActions);
      }
    }

    const backlinks = await this.getBacklinks(notePath, vaultPath);
    const counterpointSegments: StoryPathSegment[] = [];

    for (const backlink of backlinks) {
      if (counterpointSegments.length >= counterpointLimit) {
        break;
      }

      const backlinkFullPath = path.join(vault, backlink.sourcePath);
      let rawBacklink: string;
      try {
        rawBacklink = await fs.readFile(backlinkFullPath, 'utf-8');
      } catch (error) {
        console.error(`Unable to read counterpoint note ${backlink.sourcePath}:`, error);
        continue;
      }

      const parsed = this.parseNote(rawBacklink, backlink.sourcePath);
      const excerpt = backlink.context
        ? this.normalizeContextForExcerpt(backlink.context)
        : this.extractSummary(parsed.body);

      counterpointSegments.push({
        role: 'counterpoint',
        notePath: backlink.sourcePath,
        title: parsed.title,
        excerpt,
        context: backlink.linkText
          ? `References seed as "${backlink.linkText}".`
          : undefined,
      });

      if (includeActionItems) {
        const counterActions = this.extractActionItems(parsed.body).map((text) => ({
          notePath: backlink.sourcePath,
          title: parsed.title,
          text,
        }));
        actionHighlights.push(...counterActions);
      }
    }

    const keyPoints = this.extractKeyPointsForStory(seedParsed.body);
    const topActionHighlights = includeActionItems
      ? actionHighlights.slice(0, 6)
      : [];

    let narrative = `## Guided Story Path: ${introduction.title}\n\n`;
    narrative += `Seed note: ${introduction.notePath}\n\n`;

    narrative += `### Introduction\n${introduction.excerpt}\n`;
    if (keyPoints.length > 0) {
      narrative += '\nKey takeaways:\n';
      keyPoints.slice(0, 5).forEach((point) => {
        narrative += `- ${point}\n`;
      });
    }

    narrative += '\n';

    narrative += '### Supporting Threads\n';
    if (supportingSegments.length === 0) {
      narrative += 'No direct supporting notes were linked from the seed.\n\n';
    } else {
      supportingSegments.forEach((segment, index) => {
        narrative += `${index + 1}. **${segment.title}** (${segment.notePath})\n`;
        if (segment.context) {
          narrative += `${this.formatContextForBlockquote(segment.context)}\n`;
        }
        narrative += `   Insight: ${segment.excerpt}\n\n`;
      });
    }

    narrative += '### Counterpoints & Contrasts\n';
    if (counterpointSegments.length === 0) {
      narrative += 'No backlinks surfaced counterpoints for this note.\n\n';
    } else {
      counterpointSegments.forEach((segment, index) => {
        narrative += `${index + 1}. **${segment.title}** (${segment.notePath})\n`;
        if (segment.context) {
          narrative += `   ${segment.context}\n`;
        }
        narrative += `${this.formatContextForBlockquote(segment.excerpt)}\n\n`;
      });
    }

    if (includeActionItems) {
      narrative += '### Action Ideas To Explore\n';
      if (topActionHighlights.length === 0) {
        narrative += 'No action-oriented lines were detected in the related notes.\n\n';
      } else {
        topActionHighlights.forEach((item) => {
          narrative += `- (${item.title}) ${item.text}\n`;
        });
        narrative += '\n';
      }
    }

    narrative += '### Suggested Next Steps\n';
    narrative += '- Review the supporting notes for deeper context and capture any missing links.\n';
    if (counterpointSegments.length > 0) {
      narrative += '- Decide whether to reconcile or highlight the counterpoints in the seed note.\n';
    }
    if (includeActionItems && topActionHighlights.length > 0) {
      narrative += '- Triage the action ideas into your task system or mark them complete.\n';
    }
    narrative += '- Consider creating additional backlinks from related concepts to strengthen the narrative.\n';

    return narrative.trimEnd();
  }

  private async resolveNoteReference(reference: string, vault: string): Promise<string | null> {
    const sanitized = reference.trim().replace(/\\/g, '/').replace(/\.md$/i, '');
    const directMatches = await glob(`${sanitized}.md`, {
      cwd: vault,
      absolute: false,
      nocase: true,
    });

    if (directMatches.length > 0) {
      return directMatches[0];
    }

    const baseName = path.basename(sanitized);
    const fallbackMatches = await glob(`**/${baseName}.md`, {
      cwd: vault,
      absolute: false,
      nocase: true,
    });

    if (fallbackMatches.length === 0) {
      return null;
    }

    const normalizedTarget = this.noteKey(sanitized);
    const exactMatch = fallbackMatches.find(
      (candidate) => this.noteKey(candidate) === normalizedTarget
    );

    return exactMatch || fallbackMatches[0];
  }

  private noteKey(input: string): string {
    return input.replace(/\\/g, '/').replace(/\.md$/i, '').toLowerCase();
  }

  private extractLinkContext(content: string, reference: string): string | undefined {
    const lines = content.split('\n');
    const normalizedRef = reference.split('|')[0].trim();
    const linkRegex = new RegExp(`\\[\\[${this.escapeRegExp(normalizedRef)}(?:\\|[^\\]]+)?\\]\\]`, 'i');

    for (let index = 0; index < lines.length; index++) {
      if (linkRegex.test(lines[index])) {
        return this.getContext(lines, index, 1);
      }
    }

    return undefined;
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
  }

  private extractSummary(body: string): string {
    const paragraphs = body
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter((paragraph) => paragraph.length > 0 && !paragraph.startsWith('#'));

    if (paragraphs.length > 0) {
      return paragraphs[0].replace(/\s+/g, ' ').trim();
    }

    const sentences = body.replace(/\n/g, ' ').match(/[^.!?]+[.!?]+/g);
    if (sentences && sentences.length > 0) {
      return sentences[0].trim();
    }

    return body.replace(/\s+/g, ' ').trim().substring(0, 180);
  }

  private extractActionItems(body: string, limit = 5): string[] {
    const lines = body.split('\n');
    const results: string[] = [];
    const taskRegex = /^\s*[\-\*]\s*\[ \]\s*(.+)$/;
    const todoRegex = /\b(TODO|Action|Next Step|Follow[- ]?up):?\s*(.+)$/i;

    for (const line of lines) {
      if (results.length >= limit) {
        break;
      }

      const taskMatch = line.match(taskRegex);
      if (taskMatch) {
        results.push(taskMatch[1].trim());
        continue;
      }

      const todoMatch = line.match(todoRegex);
      if (todoMatch) {
        results.push(todoMatch[2].trim());
      }
    }

    return results;
  }

  private extractKeyPointsForStory(body: string): string[] {
    const bullets = body.match(/^[\-\*]\s+(.+)$/gm);
    if (bullets && bullets.length > 0) {
      return bullets.slice(0, 5).map((bullet) => bullet.replace(/^[\-\*]\s+/, '').trim());
    }

    const sentences = body.match(/[^.!?]+[.!?]+/g);
    if (sentences) {
      return sentences.slice(0, 3).map((sentence) => sentence.trim());
    }

    return [];
  }

  private parseNote(
    rawContent: string,
    notePath: string
  ): { title: string; body: string; frontmatter: Record<string, unknown> } {
    const parsed = this.safeParseMatter(rawContent);
    const { data, content } = parsed;
    let title = typeof data.title === 'string' ? data.title : undefined;

    if (!title) {
      const headingMatch = content.match(/^#\s+(.+)$/m);
      if (headingMatch) {
        title = headingMatch[1].trim();
      }
    }

    if (!title) {
      title = path.basename(notePath, '.md');
    }

    return {
      title,
      body: content,
      frontmatter: data ?? {},
    };
  }

  private formatContextForBlockquote(context: string): string {
    const lines = context.split('\n');
    const cleaned = lines
      .map((line) => line.replace(/^>\s?/, '').trimStart())
      .map((line) => line.replace(/^\s+/g, ''));

    return cleaned
      .filter((line) => line.length > 0)
      .map((line) => `> ${line}`)
      .join('\n')
      .concat('\n');
  }

  private normalizeContextForExcerpt(context: string): string {
    return context
      .split('\n')
      .map((line) => line.replace(/^>\s?/, '').trim())
      .filter((line) => line.length > 0)
      .join(' ');
  }

  private hasFrontmatterField(data: Record<string, unknown>, field: string): boolean {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const value = (data as Record<string, unknown>)[field];
    if (value === undefined || value === null) {
      return false;
    }

    if (typeof value === 'string') {
      return value.trim().length > 0;
    }

    if (Array.isArray(value)) {
      return value.length > 0;
    }

    if (typeof value === 'number') {
      return true;
    }

    if (typeof value === 'object') {
      return Object.keys(value as Record<string, unknown>).length > 0;
    }

    return true;
  }

  private extractTagsFromFrontmatter(data: Record<string, unknown>): string[] {
    const value = data.tags;
    if (!value) {
      return [];
    }

    if (Array.isArray(value)) {
      return value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item) => item.length > 0);
    }

    if (typeof value === 'string') {
      return value
        .split(/[,\s]+/)
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);
    }

    return [];
  }

  private safeParseMatter(
    rawContent: string
  ): { data: Record<string, unknown>; content: string; frontmatterText: string | null } {
    try {
      const parsed = matter(rawContent);
      return {
        data: (parsed.data as Record<string, unknown>) || {},
        content: parsed.content,
        frontmatterText: parsed.matter && parsed.matter.trim().length > 0 ? parsed.matter : null,
      };
    } catch (error) {
      if (this.frontmatterFailureCount < this.frontmatterFailureLimit) {
        console.warn('Failed to parse frontmatter:', error);
      } else if (this.frontmatterFailureCount === this.frontmatterFailureLimit) {
        console.warn('Additional frontmatter parse errors suppressed.');
      }
      this.frontmatterFailureCount += 1;
      return {
        data: {},
        content: rawContent,
        frontmatterText: null,
      };
    }
  }

  private extractKeywords(text: string, limit = 10): string[] {
    const tokens = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 3 && !this.stopWords.has(token));

    const frequencies = new Map<string, number>();
    tokens.forEach((token) => {
      frequencies.set(token, (frequencies.get(token) || 0) + 1);
    });

    return Array.from(frequencies.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([token]) => token);
  }

  private calculateKeywordOverlap(keywords: string[], content: string): number {
    if (keywords.length === 0 || !content) {
      return 0;
    }
    const lower = content.toLowerCase();
    let overlap = 0;
    keywords.forEach((keyword) => {
      if (keyword.length > 0 && lower.includes(keyword)) {
        overlap += 1;
      }
    });
    return overlap / keywords.length;
  }

  private calculateTokenOverlap(snippet: string, content: string): number {
    if (!snippet || !content) {
      return 0;
    }

    const snippetTokens = new Set(this.tokenize(snippet));
    const contentTokens = new Set(this.tokenize(content));
    if (snippetTokens.size === 0 || contentTokens.size === 0) {
      return 0;
    }

    let overlap = 0;
    snippetTokens.forEach((token) => {
      if (contentTokens.has(token)) {
        overlap += 1;
      }
    });

    return overlap / snippetTokens.size;
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 2 && !this.stopWords.has(token));
  }

  private bumpScore(map: Map<string, number>, key: string, amount: number): void {
    map.set(key, (map.get(key) || 0) + amount);
  }

  private appendReason(map: Map<string, Set<string>>, key: string, reason: string): void {
    if (!map.has(key)) {
      map.set(key, new Set());
    }
    map.get(key)!.add(reason);
  }

  private async safeStat(fullPath: string): Promise<Stats | null> {
    try {
      return await fs.stat(fullPath);
    } catch (error) {
      console.error(`Failed to stat ${fullPath}:`, error);
      return null;
    }
  }

  private calculateRecencyBoost(mtimeMs: number): number {
    const hoursOld = (Date.now() - mtimeMs) / (1000 * 60 * 60);
    if (hoursOld <= 12) {
      return 0.8;
    }
    if (hoursOld <= 48) {
      return 0.5;
    }
    if (hoursOld <= 168) {
      return 0.2;
    }
    return 0;
  }

  private findMatchingLines(
    lines: string[],
    snippet: string,
    keywords: string[],
    maxLines = 3
  ): string[] {
    const lowerSnippet = snippet.toLowerCase();
    const matches: string[] = [];

    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      if (lowerLine.includes(lowerSnippet)) {
        matches.push(line.trim());
      } else if (keywords.some((kw) => kw.length > 3 && lowerLine.includes(kw))) {
        matches.push(line.trim());
      }
      if (matches.length >= maxLines) {
        break;
      }
    }

    return matches;
  }

  private valueMatchesInitiative(value: unknown, initiative: string): boolean {
    if (!value) {
      return false;
    }

    if (typeof value === 'string') {
      return value.trim().toLowerCase() === initiative;
    }

    if (Array.isArray(value)) {
      return value.some(
        (item) => typeof item === 'string' && item.trim().toLowerCase() === initiative
      );
    }

    return false;
  }

  private async summaryNoteExists(cluster: string[], vault: string): Promise<boolean> {
    for (const notePath of cluster) {
      const fullPath = path.join(vault, notePath);
      let raw = '';
      try {
        raw = await fs.readFile(fullPath, 'utf-8');
      } catch (error) {
        console.error(`Unable to read cluster note ${notePath}:`, error);
        continue;
      }

      const parsed = this.parseNote(raw, notePath);
      const titleLower = parsed.title.toLowerCase();
      const typeValue = parsed.frontmatter['type'];

      const looksLikeSummary =
        titleLower.includes('summary') ||
        titleLower.includes('overview') ||
        titleLower.includes('brief') ||
        (typeof typeValue === 'string' && typeValue.toLowerCase().includes('summary'));

      if (looksLikeSummary) {
        return true;
      }
    }

    return false;
  }

  private get stopWords(): Set<string> {
    if (!this._stopWords) {
      this._stopWords = new Set<string>([
        'the',
        'this',
        'that',
        'from',
        'with',
        'have',
        'just',
        'about',
        'into',
        'there',
        'would',
        'could',
        'should',
        'because',
        'while',
        'where',
        'after',
        'before',
        'their',
        'which',
        'your',
        'when',
        'were',
        'been',
        'also',
        'will',
        'they',
        'them',
        'some',
        'more',
        'than',
        'what',
        'there',
        'does',
        'like',
        'into',
        'over',
      ]);
    }
    return this._stopWords;
  }

  private _stopWords?: Set<string>;
}
