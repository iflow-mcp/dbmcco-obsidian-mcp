#!/usr/bin/env node
// ABOUTME: MCP server entry point providing Obsidian vault access via Model Context Protocol
// Implements 18 tools for vault interaction: read, write, search, and advanced intelligence features
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { VaultManager } from './vault-manager.js';
import { QueryProcessor } from './query-processor.js';
const QueryVaultArgsSchema = z.object({
    query: z.string().describe('Natural language query about the vault contents'),
    vaultPath: z.string().optional().describe('Path to Obsidian vault (defaults to environment variable)'),
});
const SearchNotesArgsSchema = z.object({
    searchTerm: z.string().describe('Term to search for in notes'),
    searchType: z.enum(['filename', 'content', 'both']).default('both'),
    vaultPath: z.string().optional(),
});
const GetNoteArgsSchema = z.object({
    notePath: z.string().describe('Path to the note relative to vault root'),
    vaultPath: z.string().optional(),
});
const GetBacklinksArgsSchema = z.object({
    notePath: z.string().describe('Path to the note to find backlinks for'),
    vaultPath: z.string().optional(),
});
const WriteNoteArgsSchema = z.object({
    notePath: z.string().describe('Path to the note relative to vault root'),
    content: z.string().describe('Full content to write to the note'),
    vaultPath: z.string().optional(),
});
const CreateNoteArgsSchema = z.object({
    notePath: z.string().describe('Path for the new note relative to vault root'),
    title: z.string().describe('Title of the note'),
    content: z.string().default('').describe('Initial content of the note'),
    tags: z.array(z.string()).default([]).describe('Tags to add to the note'),
    vaultPath: z.string().optional(),
});
const AppendToNoteArgsSchema = z.object({
    notePath: z.string().describe('Path to the note relative to vault root'),
    content: z.string().describe('Content to append to the note'),
    vaultPath: z.string().optional(),
});
const UpdateNoteSectionArgsSchema = z.object({
    notePath: z.string().describe('Path to the note relative to vault root'),
    sectionHeading: z.string().describe('Heading of the section to update'),
    newContent: z.string().describe('New content for the section'),
    vaultPath: z.string().optional(),
});
const ListDirectoriesArgsSchema = z.object({
    directoryPath: z.string().default('').describe('Path to directory relative to vault root (empty for vault root)'),
    vaultPath: z.string().optional(),
});
const IntelligentSearchArgsSchema = z.object({
    query: z.string().describe('Search query - can be keywords, phrases, or natural language'),
    vaultPath: z.string().optional(),
});
const GuidedPathArgsSchema = z.object({
    notePath: z
        .string()
        .describe('Seed note to build the story path from, relative to the vault root'),
    supportingLimit: z
        .number()
        .int()
        .min(1)
        .max(10)
        .optional()
        .describe('Maximum number of supporting notes to include (default 3)'),
    counterpointLimit: z
        .number()
        .int()
        .min(1)
        .max(10)
        .optional()
        .describe('Maximum counterpoint notes to include (default 3)'),
    includeActionItems: z
        .boolean()
        .optional()
        .describe('Whether to surface action items (default true)'),
    vaultPath: z.string().optional(),
});
const AuditRecentNotesArgsSchema = z.object({
    hoursBack: z
        .number()
        .int()
        .min(1)
        .max(24 * 14)
        .optional()
        .describe('How many hours back to examine for recent notes (default 72)'),
    limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe('Maximum findings to return (default 25)'),
    requiredFields: z
        .array(z.string())
        .optional()
        .describe('Frontmatter fields that should exist (default title, created)'),
    requireHeadings: z
        .boolean()
        .optional()
        .describe('Flag notes missing top-level headings'),
    vaultPath: z.string().optional(),
});
const ContextualCompanionsArgsSchema = z.object({
    notePath: z
        .string()
        .optional()
        .describe('Existing note to anchor companions (relative path within the vault)'),
    topic: z
        .string()
        .optional()
        .describe('Topic or working theme to match against'),
    limit: z
        .number()
        .int()
        .min(1)
        .max(10)
        .optional()
        .describe('Maximum number of companion notes to return (default 5)'),
    vaultPath: z.string().optional(),
});
const FreshEnergyArgsSchema = z.object({
    hoursBack: z
        .number()
        .int()
        .min(1)
        .max(168)
        .optional()
        .describe('Look back this many hours for newly dropped notes (default 48)'),
    limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe('Maximum notes to surface (default 10)'),
    minWords: z
        .number()
        .int()
        .min(10)
        .max(5000)
        .optional()
        .describe('Ignore notes below this word-count floor (default 80)'),
    vaultPath: z.string().optional(),
});
const InitiativeBridgeArgsSchema = z.object({
    initiative: z
        .string()
        .describe('Initiative, project tag, or value to match against notes'),
    frontmatterField: z
        .string()
        .optional()
        .describe('Frontmatter field to check for matches (default project)'),
    limit: z
        .number()
        .int()
        .min(1)
        .max(25)
        .optional()
        .describe('Maximum notes to return (default 10)'),
    vaultPath: z.string().optional(),
});
const PatternEchoArgsSchema = z.object({
    snippet: z
        .string()
        .describe('Sentence, phrase, or bullet pattern to echo across the vault'),
    limit: z
        .number()
        .int()
        .min(1)
        .max(20)
        .optional()
        .describe('Maximum notes with matching patterns (default 5)'),
    vaultPath: z.string().optional(),
});
const SynthesisReadyArgsSchema = z.object({
    minClusterSize: z
        .number()
        .int()
        .min(2)
        .max(10)
        .optional()
        .describe('Minimum number of related notes to flag (default 3)'),
    vaultPath: z.string().optional(),
});
class ObsidianMCPServer {
    server;
    vaultManager;
    queryProcessor;
    constructor() {
        this.server = new Server({
            name: 'obsidian-mcp',
            version: '1.0.0',
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.vaultManager = new VaultManager();
        this.queryProcessor = new QueryProcessor(this.vaultManager);
        this.setupHandlers();
    }
    setupHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: [
                {
                    name: 'query_vault',
                    description: 'Process natural language queries about your Obsidian vault',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            query: {
                                type: 'string',
                                description: 'Natural language query about the vault contents',
                            },
                            vaultPath: {
                                type: 'string',
                                description: 'Path to Obsidian vault (defaults to environment variable)',
                            },
                        },
                        required: ['query'],
                    },
                },
                {
                    name: 'search_notes',
                    description: 'Search for notes by filename or content',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            searchTerm: {
                                type: 'string',
                                description: 'Term to search for in notes',
                            },
                            searchType: {
                                type: 'string',
                                enum: ['filename', 'content', 'both'],
                                default: 'both',
                                description: 'Where to search',
                            },
                            vaultPath: {
                                type: 'string',
                                description: 'Path to Obsidian vault',
                            },
                        },
                        required: ['searchTerm'],
                    },
                },
                {
                    name: 'get_note',
                    description: 'Get the full content of a specific note',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            notePath: {
                                type: 'string',
                                description: 'Path to the note relative to vault root',
                            },
                            vaultPath: {
                                type: 'string',
                                description: 'Path to Obsidian vault',
                            },
                        },
                        required: ['notePath'],
                    },
                },
                {
                    name: 'get_backlinks',
                    description: 'Get all notes that link to a specific note',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            notePath: {
                                type: 'string',
                                description: 'Path to the note to find backlinks for',
                            },
                            vaultPath: {
                                type: 'string',
                                description: 'Path to Obsidian vault',
                            },
                        },
                        required: ['notePath'],
                    },
                },
                {
                    name: 'write_note',
                    description: 'Write or overwrite a note with new content',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            notePath: {
                                type: 'string',
                                description: 'Path to the note relative to vault root',
                            },
                            content: {
                                type: 'string',
                                description: 'Full content to write to the note',
                            },
                            vaultPath: {
                                type: 'string',
                                description: 'Path to Obsidian vault',
                            },
                        },
                        required: ['notePath', 'content'],
                    },
                },
                {
                    name: 'create_note',
                    description: 'Create a new note with frontmatter and content',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            notePath: {
                                type: 'string',
                                description: 'Path for the new note relative to vault root',
                            },
                            title: {
                                type: 'string',
                                description: 'Title of the note',
                            },
                            content: {
                                type: 'string',
                                description: 'Initial content of the note',
                                default: '',
                            },
                            tags: {
                                type: 'array',
                                items: { type: 'string' },
                                description: 'Tags to add to the note',
                                default: [],
                            },
                            vaultPath: {
                                type: 'string',
                                description: 'Path to Obsidian vault',
                            },
                        },
                        required: ['notePath', 'title'],
                    },
                },
                {
                    name: 'append_to_note',
                    description: 'Append content to an existing note',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            notePath: {
                                type: 'string',
                                description: 'Path to the note relative to vault root',
                            },
                            content: {
                                type: 'string',
                                description: 'Content to append to the note',
                            },
                            vaultPath: {
                                type: 'string',
                                description: 'Path to Obsidian vault',
                            },
                        },
                        required: ['notePath', 'content'],
                    },
                },
                {
                    name: 'update_note_section',
                    description: 'Update a specific section of a note by heading',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            notePath: {
                                type: 'string',
                                description: 'Path to the note relative to vault root',
                            },
                            sectionHeading: {
                                type: 'string',
                                description: 'Heading of the section to update',
                            },
                            newContent: {
                                type: 'string',
                                description: 'New content for the section',
                            },
                            vaultPath: {
                                type: 'string',
                                description: 'Path to Obsidian vault',
                            },
                        },
                        required: ['notePath', 'sectionHeading', 'newContent'],
                    },
                },
                {
                    name: 'list_directories',
                    description: 'List directories and files in vault or specific directory',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            directoryPath: {
                                type: 'string',
                                description: 'Path to directory relative to vault root (empty for vault root)',
                                default: '',
                            },
                            vaultPath: {
                                type: 'string',
                                description: 'Path to Obsidian vault',
                            },
                        },
                        required: [],
                    },
                },
                {
                    name: 'intelligent_search',
                    description: 'Advanced search using link analysis, tag hierarchies, and structural context',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            query: {
                                type: 'string',
                                description: 'Search query - can be keywords, phrases, or natural language',
                            },
                            vaultPath: {
                                type: 'string',
                                description: 'Path to Obsidian vault',
                            },
                        },
                        required: ['query'],
                    },
                },
                {
                    name: 'guided_path',
                    description: 'Generate a narrative tour through linked notes starting from a seed note',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            notePath: {
                                type: 'string',
                                description: 'Seed note to begin the story path (relative path within the vault)',
                            },
                            supportingLimit: {
                                type: 'number',
                                minimum: 1,
                                maximum: 10,
                                description: 'Cap the number of supporting notes (default 3)',
                            },
                            counterpointLimit: {
                                type: 'number',
                                minimum: 1,
                                maximum: 10,
                                description: 'Cap the number of counterpoints (default 3)',
                            },
                            includeActionItems: {
                                type: 'boolean',
                                description: 'Include action items discovered along the path (default true)',
                            },
                            vaultPath: {
                                type: 'string',
                                description: 'Path to Obsidian vault',
                            },
                        },
                        required: ['notePath'],
                    },
                },
                {
                    name: 'audit_recent_notes',
                    description: 'Highlight recently modified notes that are missing required frontmatter or structure',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            hoursBack: {
                                type: 'number',
                                minimum: 1,
                                maximum: 336,
                                description: 'Examine notes touched within this many hours (default 72)',
                            },
                            limit: {
                                type: 'number',
                                minimum: 1,
                                maximum: 100,
                                description: 'Return at most this many findings (default 25)',
                            },
                            requiredFields: {
                                type: 'array',
                                items: { type: 'string' },
                                description: 'Frontmatter fields that should be present',
                            },
                            requireHeadings: {
                                type: 'boolean',
                                description: 'Flag notes lacking headings',
                            },
                            vaultPath: {
                                type: 'string',
                                description: 'Path to Obsidian vault',
                            },
                        },
                        required: [],
                    },
                },
                {
                    name: 'contextual_companions',
                    description: 'Suggest adjacent notes related to a topic or seed note based on links, keywords, and recency',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            notePath: {
                                type: 'string',
                                description: 'Seed note to anchor the search (optional)',
                            },
                            topic: {
                                type: 'string',
                                description: 'Freeform topic or question to match (optional)',
                            },
                            limit: {
                                type: 'number',
                                minimum: 1,
                                maximum: 10,
                                description: 'Maximum companion notes to return (default 5)',
                            },
                            vaultPath: {
                                type: 'string',
                                description: 'Path to Obsidian vault',
                            },
                        },
                        required: [],
                    },
                },
                {
                    name: 'fresh_energy',
                    description: 'Find recently updated notes that lack backlinks or link coverage so you can integrate them',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            hoursBack: {
                                type: 'number',
                                minimum: 1,
                                maximum: 168,
                                description: 'Look back window in hours (default 48)',
                            },
                            limit: {
                                type: 'number',
                                minimum: 1,
                                maximum: 50,
                                description: 'Maximum notes to surface (default 10)',
                            },
                            minWords: {
                                type: 'number',
                                minimum: 10,
                                maximum: 5000,
                                description: 'Ignore notes below this word count (default 80)',
                            },
                            vaultPath: {
                                type: 'string',
                                description: 'Path to Obsidian vault',
                            },
                        },
                        required: [],
                    },
                },
                {
                    name: 'initiative_bridge',
                    description: 'Identify initiative-tagged notes with outstanding tasks so nothing slips between systems',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            initiative: {
                                type: 'string',
                                description: 'Project/initiative identifier to match',
                            },
                            frontmatterField: {
                                type: 'string',
                                description: 'Frontmatter field to inspect (default project)',
                            },
                            limit: {
                                type: 'number',
                                minimum: 1,
                                maximum: 25,
                                description: 'Maximum notes to return (default 10)',
                            },
                            vaultPath: {
                                type: 'string',
                                description: 'Path to Obsidian vault',
                            },
                        },
                        required: ['initiative'],
                    },
                },
                {
                    name: 'pattern_echo',
                    description: 'Search for notes that reuse a phrasing, bullet pattern, or framework fragment',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            snippet: {
                                type: 'string',
                                description: 'Sentence, bullet, or pattern to echo across the vault',
                            },
                            limit: {
                                type: 'number',
                                minimum: 1,
                                maximum: 20,
                                description: 'Maximum matches to surface (default 5)',
                            },
                            vaultPath: {
                                type: 'string',
                                description: 'Path to Obsidian vault',
                            },
                        },
                        required: ['snippet'],
                    },
                },
                {
                    name: 'synthesis_ready',
                    description: 'Flag clusters of notes that reference each other but lack a synthesis/summary note',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            minClusterSize: {
                                type: 'number',
                                minimum: 2,
                                maximum: 10,
                                description: 'Minimum related notes required to trigger (default 3)',
                            },
                            vaultPath: {
                                type: 'string',
                                description: 'Path to Obsidian vault',
                            },
                        },
                        required: [],
                    },
                },
            ],
        }));
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            try {
                switch (name) {
                    case 'query_vault': {
                        const { query, vaultPath } = QueryVaultArgsSchema.parse(args);
                        const result = await this.queryProcessor.processQuery(query, vaultPath);
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: result,
                                },
                            ],
                        };
                    }
                    case 'search_notes': {
                        const { searchTerm, searchType, vaultPath } = SearchNotesArgsSchema.parse(args);
                        const results = await this.vaultManager.searchNotes(searchTerm, searchType, vaultPath);
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify(results, null, 2),
                                },
                            ],
                        };
                    }
                    case 'get_note': {
                        const { notePath, vaultPath } = GetNoteArgsSchema.parse(args);
                        const content = await this.vaultManager.getNoteContent(notePath, vaultPath);
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: content,
                                },
                            ],
                        };
                    }
                    case 'get_backlinks': {
                        const { notePath, vaultPath } = GetBacklinksArgsSchema.parse(args);
                        const backlinks = await this.vaultManager.getBacklinks(notePath, vaultPath);
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify(backlinks, null, 2),
                                },
                            ],
                        };
                    }
                    case 'write_note': {
                        const { notePath, content, vaultPath } = WriteNoteArgsSchema.parse(args);
                        await this.vaultManager.writeNote(notePath, content, vaultPath);
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: `Successfully wrote note: ${notePath}`,
                                },
                            ],
                        };
                    }
                    case 'create_note': {
                        const { notePath, title, content, tags, vaultPath } = CreateNoteArgsSchema.parse(args);
                        await this.vaultManager.createNote(notePath, title, content, tags, vaultPath);
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: `Successfully created note: ${notePath}`,
                                },
                            ],
                        };
                    }
                    case 'append_to_note': {
                        const { notePath, content, vaultPath } = AppendToNoteArgsSchema.parse(args);
                        await this.vaultManager.appendToNote(notePath, content, vaultPath);
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: `Successfully appended to note: ${notePath}`,
                                },
                            ],
                        };
                    }
                    case 'update_note_section': {
                        const { notePath, sectionHeading, newContent, vaultPath } = UpdateNoteSectionArgsSchema.parse(args);
                        await this.vaultManager.updateNoteSection(notePath, sectionHeading, newContent, vaultPath);
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: `Successfully updated section "${sectionHeading}" in note: ${notePath}`,
                                },
                            ],
                        };
                    }
                    case 'list_directories': {
                        const { directoryPath, vaultPath } = ListDirectoriesArgsSchema.parse(args);
                        const listing = await this.vaultManager.listDirectories(directoryPath, vaultPath);
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify(listing, null, 2),
                                },
                            ],
                        };
                    }
                    case 'intelligent_search': {
                        const { query, vaultPath } = IntelligentSearchArgsSchema.parse(args);
                        const results = await this.vaultManager.intelligentSearch(query, vaultPath);
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify(results, null, 2),
                                },
                            ],
                        };
                    }
                    case 'guided_path': {
                        const { notePath, supportingLimit, counterpointLimit, includeActionItems, vaultPath, } = GuidedPathArgsSchema.parse(args);
                        const narrative = await this.vaultManager.generateStoryPath(notePath, {
                            supportingLimit,
                            counterpointLimit,
                            includeActionItems,
                            vaultPath,
                        });
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: narrative,
                                },
                            ],
                        };
                    }
                    case 'audit_recent_notes': {
                        const auditArgs = AuditRecentNotesArgsSchema.parse(args);
                        const findings = await this.vaultManager.auditRecentNotes(auditArgs);
                        if (findings.length === 0) {
                            return {
                                content: [
                                    {
                                        type: 'text',
                                        text: 'No recent notes require attention within the specified window.',
                                    },
                                ],
                            };
                        }
                        const hoursBack = auditArgs.hoursBack ?? 72;
                        const reportLines = [];
                        reportLines.push(`Audit window: last ${hoursBack} hours`);
                        reportLines.push(`Findings: ${findings.length}`);
                        reportLines.push('');
                        findings.forEach((finding, index) => {
                            reportLines.push(`${index + 1}. **${finding.path}** (modified ${finding.modifiedAt})`);
                            if (finding.missingFrontmatter) {
                                reportLines.push('   - Missing frontmatter block');
                            }
                            if (finding.missingFields.length > 0) {
                                reportLines.push(`   - Missing fields: ${finding.missingFields.join(', ')}`);
                            }
                            if (!finding.hasHeadings) {
                                reportLines.push('   - No headings detected');
                            }
                            reportLines.push(`   - Words: ${finding.wordCount}`);
                            if (finding.preview) {
                                reportLines.push(`   - Preview: ${finding.preview}`);
                            }
                            reportLines.push('');
                        });
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: reportLines.join('\n').trimEnd(),
                                },
                            ],
                        };
                    }
                    case 'contextual_companions': {
                        const companionsArgs = ContextualCompanionsArgsSchema.parse(args);
                        const companions = await this.vaultManager.generateContextualCompanions(companionsArgs);
                        if (companions.length === 0) {
                            return {
                                content: [
                                    {
                                        type: 'text',
                                        text: 'No related notes found for the requested topic.',
                                    },
                                ],
                            };
                        }
                        const lines = [];
                        lines.push('Contextual companions:');
                        lines.push('');
                        companions.forEach((companion, index) => {
                            lines.push(`${index + 1}. **${companion.title}** (${companion.path}) — score ${companion.score}`);
                            if (companion.reason) {
                                lines.push(`   - ${companion.reason}`);
                            }
                            lines.push('');
                        });
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: lines.join('\n').trimEnd(),
                                },
                            ],
                        };
                    }
                    case 'fresh_energy': {
                        const freshArgs = FreshEnergyArgsSchema.parse(args);
                        const findings = await this.vaultManager.findFreshEnergyNotes(freshArgs);
                        if (findings.length === 0) {
                            return {
                                content: [
                                    {
                                        type: 'text',
                                        text: 'No fresh notes need integration right now.',
                                    },
                                ],
                            };
                        }
                        const lines = [];
                        lines.push('Fresh energy notes:');
                        lines.push('');
                        findings.forEach((finding, index) => {
                            lines.push(`${index + 1}. **${finding.title}** (${finding.path})`);
                            lines.push(`   - Updated: ${finding.modifiedAt}`);
                            lines.push(`   - Backlinks: ${finding.backlinks}, Outgoing links: ${finding.outgoingLinks}`);
                            if (finding.tags.length > 0) {
                                lines.push(`   - Tags: ${finding.tags.join(', ')}`);
                            }
                            if (finding.actionItems.length > 0) {
                                lines.push(`   - Action items: ${finding.actionItems.join(' | ')}`);
                            }
                            if (finding.preview) {
                                lines.push(`   - Preview: ${finding.preview}`);
                            }
                            lines.push('');
                        });
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: lines.join('\n').trimEnd(),
                                },
                            ],
                        };
                    }
                    case 'initiative_bridge': {
                        const initiativeArgs = InitiativeBridgeArgsSchema.parse(args);
                        const matches = await this.vaultManager.bridgeInitiativeOpportunity(initiativeArgs);
                        if (matches.length === 0) {
                            return {
                                content: [
                                    {
                                        type: 'text',
                                        text: 'No initiative-linked notes with outstanding tasks were found.',
                                    },
                                ],
                            };
                        }
                        const lines = [];
                        lines.push(`Initiative bridge: ${initiativeArgs.initiative}`);
                        lines.push('');
                        matches.forEach((match, index) => {
                            lines.push(`${index + 1}. **${match.title}** (${match.path})`);
                            lines.push(`   - Matched via ${match.matchedField}`);
                            if (match.lastModified) {
                                lines.push(`   - Updated: ${match.lastModified}`);
                            }
                            lines.push(`   - Link coverage: ${match.coverage.backlinks} backlinks, ${match.coverage.outgoing} outgoing`);
                            lines.push(`   - Tasks:`);
                            match.tasks.forEach((task) => {
                                lines.push(`       • ${task}`);
                            });
                            lines.push('');
                        });
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: lines.join('\n').trimEnd(),
                                },
                            ],
                        };
                    }
                    case 'pattern_echo': {
                        const patternArgs = PatternEchoArgsSchema.parse(args);
                        const echoes = await this.vaultManager.patternEcho(patternArgs);
                        if (echoes.length === 0) {
                            return {
                                content: [
                                    {
                                        type: 'text',
                                        text: 'No repeating patterns were detected for that snippet.',
                                    },
                                ],
                            };
                        }
                        const lines = [];
                        lines.push('Pattern echoes:');
                        lines.push('');
                        echoes.forEach((echo, index) => {
                            lines.push(`${index + 1}. **${echo.title}** (${echo.path}) — similarity ${echo.similarityScore}`);
                            echo.matchedLines.forEach((line) => {
                                lines.push(`   > ${line}`);
                            });
                            lines.push('');
                        });
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: lines.join('\n').trimEnd(),
                                },
                            ],
                        };
                    }
                    case 'synthesis_ready': {
                        const synthesisArgs = SynthesisReadyArgsSchema.parse(args);
                        const clusters = await this.vaultManager.findSynthesisReadyClusters(synthesisArgs);
                        if (clusters.length === 0) {
                            return {
                                content: [
                                    {
                                        type: 'text',
                                        text: 'No synthesis-ready clusters detected.',
                                    },
                                ],
                            };
                        }
                        const lines = [];
                        lines.push('Synthesis-ready clusters:');
                        lines.push('');
                        clusters.forEach((cluster, index) => {
                            lines.push(`${index + 1}. **${cluster.title}** (${cluster.hubNote})`);
                            lines.push(`   - Related notes: ${cluster.cluster.join(', ')}`);
                            lines.push(`   - Summary note present: ${cluster.missingSummaryNote ? 'No' : 'Yes'}`);
                            lines.push(`   - Suggestion: ${cluster.suggestion}`);
                            lines.push('');
                        });
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: lines.join('\n').trimEnd(),
                                },
                            ],
                        };
                    }
                    default:
                        throw new Error(`Unknown tool: ${name}`);
                }
            }
            catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
                        },
                    ],
                };
            }
        });
    }
    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('Obsidian MCP Server running on stdio');
    }
}
const server = new ObsidianMCPServer();
server.run().catch(console.error);
//# sourceMappingURL=index.js.map