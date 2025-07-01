import { promises as fs } from 'fs';
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

export class VaultManager {
  private defaultVaultPath: string;

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
}