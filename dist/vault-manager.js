import { promises as fs } from 'fs';
import path from 'path';
import { glob } from 'glob';
import matter from 'gray-matter';
export class VaultManager {
    defaultVaultPath;
    constructor() {
        this.defaultVaultPath = process.env.OBSIDIAN_VAULT_PATH || '';
    }
    getVaultPath(vaultPath) {
        const vault = vaultPath || this.defaultVaultPath;
        if (!vault) {
            throw new Error('No vault path provided and OBSIDIAN_VAULT_PATH environment variable not set');
        }
        return vault;
    }
    async searchNotes(searchTerm, searchType = 'both', vaultPath) {
        const vault = this.getVaultPath(vaultPath);
        const results = [];
        const mdFiles = await glob('**/*.md', {
            cwd: vault,
            absolute: false,
        });
        for (const file of mdFiles) {
            const fullPath = path.join(vault, file);
            const basename = path.basename(file, '.md');
            const matches = [];
            let matchType = null;
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
                }
                catch (error) {
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
    async getNoteContent(notePath, vaultPath) {
        const vault = this.getVaultPath(vaultPath);
        const fullPath = path.join(vault, notePath);
        try {
            const content = await fs.readFile(fullPath, 'utf-8');
            return content;
        }
        catch (error) {
            throw new Error(`Failed to read note at ${notePath}: ${error}`);
        }
    }
    async getBacklinks(notePath, vaultPath) {
        const vault = this.getVaultPath(vaultPath);
        const backlinks = [];
        const targetNote = path.basename(notePath, '.md');
        const mdFiles = await glob('**/*.md', {
            cwd: vault,
            absolute: false,
        });
        for (const file of mdFiles) {
            if (file === notePath)
                continue; // Skip the target file itself
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
            }
            catch (error) {
                console.error(`Error reading file ${fullPath}:`, error);
            }
        }
        return backlinks;
    }
    async getAllNotes(vaultPath) {
        const vault = this.getVaultPath(vaultPath);
        const mdFiles = await glob('**/*.md', {
            cwd: vault,
            absolute: false,
        });
        return mdFiles;
    }
    async writeNote(notePath, content, vaultPath) {
        const vault = this.getVaultPath(vaultPath);
        const fullPath = path.join(vault, notePath);
        // Ensure directory exists
        const dir = path.dirname(fullPath);
        await fs.mkdir(dir, { recursive: true });
        try {
            await fs.writeFile(fullPath, content, 'utf-8');
        }
        catch (error) {
            throw new Error(`Failed to write note at ${notePath}: ${error}`);
        }
    }
    async createNote(notePath, title, content = '', tags = [], vaultPath) {
        const vault = this.getVaultPath(vaultPath);
        const fullPath = path.join(vault, notePath);
        // Check if file already exists
        try {
            await fs.access(fullPath);
            throw new Error(`Note already exists at ${notePath}`);
        }
        catch (error) {
            if (error.code !== 'ENOENT') {
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
    async appendToNote(notePath, content, vaultPath) {
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
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error(`Note does not exist at ${notePath}. Use create_note or write_note instead.`);
            }
            throw new Error(`Failed to append to note at ${notePath}: ${error}`);
        }
    }
    async updateNoteSection(notePath, sectionHeading, newContent, vaultPath) {
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
    async getNoteTitle(fullPath) {
        try {
            const content = await fs.readFile(fullPath, 'utf-8');
            const { data, content: bodyContent } = matter(content);
            // Check frontmatter for title
            if (data.title)
                return data.title;
            // Look for first heading
            const firstHeading = bodyContent.match(/^#\s+(.+)$/m);
            if (firstHeading)
                return firstHeading[1];
            // Fall back to filename
            return path.basename(fullPath, '.md');
        }
        catch {
            return path.basename(fullPath, '.md');
        }
    }
    getContext(lines, lineIndex, contextLines = 2) {
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
//# sourceMappingURL=vault-manager.js.map