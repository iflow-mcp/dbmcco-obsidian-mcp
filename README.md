# Obsidian MCP Server

A Model Context Protocol (MCP) server for natural language interaction with your Obsidian vault.

## Features

- **Natural Language Queries**: Ask questions about your vault in plain English
- **Content Search**: Search notes by filename, content, or both
- **Backlink Analysis**: Find connections between notes
- **Smart Context Building**: Automatically gathers relevant information for complex queries

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the project:
   ```bash
   npm run build
   ```

3. Set your vault path:
   ```bash
   export OBSIDIAN_VAULT_PATH="/path/to/your/obsidian/vault"
   ```

## Usage

### As an MCP Server

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "node",
      "args": ["/path/to/obsidian-mcp/dist/index.js"],
      "env": {
        "OBSIDIAN_VAULT_PATH": "/path/to/your/vault"
      }
    }
  }
}
```

### Available Tools

**Read Operations:**
1. **query_vault**: Process natural language queries about your vault
   - Example: "What are the main themes in my project notes?"

2. **search_notes**: Search for notes by filename or content
   - Parameters: `searchTerm`, `searchType` (filename/content/both)

3. **get_note**: Get the full content of a specific note
   - Parameters: `notePath`

4. **get_backlinks**: Get all notes that link to a specific note
   - Parameters: `notePath`

**Write Operations:**
5. **write_note**: Write or overwrite a note with new content
   - Parameters: `notePath`, `content`

6. **create_note**: Create a new note with frontmatter and content
   - Parameters: `notePath`, `title`, `content` (optional), `tags` (optional)

7. **append_to_note**: Append content to an existing note
   - Parameters: `notePath`, `content`

8. **update_note_section**: Update a specific section of a note by heading
   - Parameters: `notePath`, `sectionHeading`, `newContent`

## Example Queries

- "Evaluate the ideas for Project Alpha and suggest improvements"
- "What are the key concepts related to machine learning in my vault?"
- "Show me all notes connected to the quarterly planning document"
- "Find all references to the client meeting from last week"

## Development

- `npm run dev`: Watch mode for development
- `npm run build`: Build the project
- `npm run start`: Start the server

## Environment Variables

- `OBSIDIAN_VAULT_PATH`: Path to your Obsidian vault (required)