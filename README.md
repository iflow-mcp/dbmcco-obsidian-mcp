# Obsidian MCP Server

A powerful Model Context Protocol (MCP) server for natural language interaction with your Obsidian vault. Built with TypeScript and designed for seamless integration with Claude Code and other MCP clients.

## Features

### Core Capabilities
- **Natural Language Queries**: Ask questions about your vault in plain English
- **Advanced Search**: Intelligent search with link analysis, tag hierarchies, and structural context
- **Backlink Analysis**: Find and analyze connections between notes
- **Vault Navigation**: Browse directory structure and discover notes
- **Full CRUD Operations**: Read, write, create, append, and update notes

### Advanced Intelligence Tools
- **Guided Story Path**: Generate narrative tours through linked notes
- **Note Auditing**: Find recently modified notes missing frontmatter or structure
- **Contextual Companions**: Discover related notes based on links, keywords, and recency
- **Fresh Energy**: Identify recently updated notes needing integration
- **Initiative Bridge**: Track project-specific notes with outstanding tasks
- **Pattern Echo**: Find notes that reuse specific phrasings or patterns
- **Synthesis Ready**: Detect note clusters that need summary notes

## Installation

### From Source

1. Clone the repository:
   ```bash
   git clone https://github.com/dbmcco/obsidian-mcp.git
   cd obsidian-mcp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```

## Configuration

### Claude Code Setup

Add to your Claude Code MCP configuration:

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "node",
      "args": ["/absolute/path/to/obsidian-mcp/dist/index.js"],
      "env": {
        "OBSIDIAN_VAULT_PATH": "/absolute/path/to/your/vault"
      }
    }
  }
}
```

### Claude Desktop Setup

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "node",
      "args": ["/absolute/path/to/obsidian-mcp/dist/index.js"],
      "env": {
        "OBSIDIAN_VAULT_PATH": "/absolute/path/to/your/vault"
      }
    }
  }
}
```

### Environment Variables

- `OBSIDIAN_VAULT_PATH`: **Required**. Absolute path to your Obsidian vault

## Available Tools

### Basic Operations

#### query_vault
Process natural language queries about your vault content.

**Example:** "What are the main themes in my project notes?"

```typescript
{
  query: string,
  vaultPath?: string  // Optional override
}
```

#### search_notes
Search for notes by filename or content using exact text matching.

```typescript
{
  searchTerm: string,
  searchType: 'filename' | 'content' | 'both',  // Default: 'both'
  vaultPath?: string
}
```

#### intelligent_search
Advanced search with link graph analysis, tag hierarchies, and structural context weighting.

```typescript
{
  query: string,
  vaultPath?: string
}
```

#### list_directories
Browse vault directory structure with note counts.

```typescript
{
  directoryPath?: string,  // Empty string for vault root
  vaultPath?: string
}
```

#### get_note
Retrieve the full content of a specific note.

```typescript
{
  notePath: string,  // Relative to vault root
  vaultPath?: string
}
```

#### get_backlinks
Find all notes that link to a specific note with context.

```typescript
{
  notePath: string,
  vaultPath?: string
}
```

### Write Operations

#### write_note
Write or completely overwrite a note.

```typescript
{
  notePath: string,
  content: string,
  vaultPath?: string
}
```

#### create_note
Create a new note with frontmatter and content.

```typescript
{
  notePath: string,
  title: string,
  content?: string,
  tags?: string[],
  vaultPath?: string
}
```

#### append_to_note
Append content to an existing note.

```typescript
{
  notePath: string,
  content: string,
  vaultPath?: string
}
```

#### update_note_section
Update a specific section identified by heading.

```typescript
{
  notePath: string,
  sectionHeading: string,
  newContent: string,
  vaultPath?: string
}
```

### Advanced Intelligence

#### guided_path
Generate a narrative tour through linked notes starting from a seed note.

```typescript
{
  notePath: string,
  supportingLimit?: number,      // Default: 3
  counterpointLimit?: number,    // Default: 3
  includeActionItems?: boolean,  // Default: true
  vaultPath?: string
}
```

**Output:** Markdown narrative with introduction, supporting threads, counterpoints, and action items.

#### audit_recent_notes
Find recently modified notes missing frontmatter or structure.

```typescript
{
  hoursBack?: number,           // Default: 72
  limit?: number,               // Default: 25
  requiredFields?: string[],    // Default: ['title', 'created']
  requireHeadings?: boolean,    // Default: false
  vaultPath?: string
}
```

#### contextual_companions
Discover notes related to a topic or seed note based on links, keywords, and recency.

```typescript
{
  notePath?: string,    // Optional seed note
  topic?: string,       // Optional topic query
  limit?: number,       // Default: 5
  vaultPath?: string
}
```

**Note:** Must provide either `notePath` or `topic`.

#### fresh_energy
Find recently updated notes lacking backlinks or outgoing links (needing integration).

```typescript
{
  hoursBack?: number,   // Default: 48
  limit?: number,       // Default: 10
  minWords?: number,    // Default: 80
  vaultPath?: string
}
```

#### initiative_bridge
Track project/initiative-tagged notes with outstanding tasks.

```typescript
{
  initiative: string,           // Required: project identifier
  frontmatterField?: string,    // Default: 'project'
  limit?: number,               // Default: 10
  vaultPath?: string
}
```

#### pattern_echo
Find notes that reuse specific phrasings, bullet patterns, or framework fragments.

```typescript
{
  snippet: string,      // Required: text pattern to find
  limit?: number,       // Default: 5
  vaultPath?: string
}
```

#### synthesis_ready
Detect clusters of interlinked notes that lack a summary/synthesis note.

```typescript
{
  minClusterSize?: number,  // Default: 3
  vaultPath?: string
}
```

## Example Use Cases

### Knowledge Discovery
```javascript
// Find all notes about a topic with intelligent expansion
await intelligentSearch({ query: "machine learning" });

// Discover related notes for further reading
await contextualCompanions({
  topic: "neural networks",
  limit: 10
});
```

### Vault Maintenance
```javascript
// Audit recent work for missing metadata
await auditRecentNotes({
  hoursBack: 168,  // Last week
  requiredFields: ['title', 'created', 'tags']
});

// Find orphaned notes needing links
await freshEnergy({ hoursBack: 72 });

// Identify note clusters needing synthesis
await synthesisReady({ minClusterSize: 4 });
```

### Project Management
```javascript
// Track all tasks for a specific project
await initiativeBridge({
  initiative: "Project Alpha",
  frontmatterField: "project"
});

// Generate a narrative overview of a topic
await guidedPath({
  notePath: "Projects/Project Alpha.md",
  supportingLimit: 5,
  includeActionItems: true
});
```

### Pattern Analysis
```javascript
// Find notes using a specific framework
await patternEcho({
  snippet: "SWOT Analysis:",
  limit: 10
});
```

## Development

### Scripts
- `npm run dev`: Watch mode for development
- `npm run build`: Build TypeScript to JavaScript
- `npm run start`: Start the MCP server

### Project Structure
```
obsidian-mcp/
├── src/
│   ├── index.ts           # MCP server and tool definitions
│   ├── vault-manager.ts   # Vault operations and intelligence
│   └── query-processor.ts # Natural language query processing
├── dist/                  # Compiled JavaScript (generated)
├── package.json
├── tsconfig.json
└── README.md
```

## Technical Details

### Architecture
- **TypeScript** with strict mode enabled
- **ES Modules** (NodeNext)
- **Zod** for runtime type validation
- **gray-matter** for frontmatter parsing
- **glob** for file pattern matching

### Search Methods
The `intelligent_search` tool combines four search strategies:
1. **Direct matching**: Exact keyword matches in content/filenames
2. **Link proximity**: Notes connected via wiki-links
3. **Tag expansion**: Related notes via tag hierarchies
4. **Structural context**: Section-aware searching with relevance scoring

Results are merged, deduplicated, and ranked by relevance score.

### Performance
- No caching - all searches are real-time to avoid staleness
- Lazy loading of note content for large vaults
- Efficient glob patterns for file discovery

## Credits

Built by Braydon with Claude (Anthropic). This MCP server was developed using test-driven development principles and extensive collaboration with Claude Code.

## License

MIT License - feel free to use and modify as needed.

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Submit a pull request

## Troubleshooting

### "No vault path provided" error
Ensure `OBSIDIAN_VAULT_PATH` is set in your MCP configuration or environment variables.

### MCP server not connecting
- Verify the path to `dist/index.js` is absolute, not relative
- Ensure the server is built (`npm run build`)
- Check that Node.js can execute the script

### Search returns no results
- Verify vault path is correct
- Check that `.md` files exist in the vault
- Try using `list_directories` to explore the vault structure