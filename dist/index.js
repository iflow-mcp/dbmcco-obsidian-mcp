#!/usr/bin/env node
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