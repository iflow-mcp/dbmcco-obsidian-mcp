# Obsidian MCP Server Usage Guide

## Problem Identified
- MCP server exists and is built at `/Users/braydon/projects/experiments/obsidian_mcp`
- Server is configured in Claude Desktop config but not accessible in Claude Code CLI
- Claude Code CLI requires different MCP server setup than Claude Desktop

## Available Tools (when properly connected):
1. **query_vault** - Natural language queries about vault content
2. **search_notes** - Search by filename/content/both
3. **get_note** - Get full content of specific note
4. **get_backlinks** - Find notes linking to specific note
5. **write_note** - Write/overwrite note content
6. **create_note** - Create new note with frontmatter
7. **append_to_note** - Append content to existing note
8. **update_note_section** - Update specific section by heading

## Current Status
- ✅ MCP server built and functional
- ✅ Vault path exists: `/users/braydon/obsidian/bvault`
- ✅ MCP server configured with ABSOLUTE paths
- ✅ Should now work in Claude Code CLI

## Solution Found
The issue was **relative vs absolute paths** in the MCP server configuration. When Claude Code CLI starts from different directories, relative paths like `dist/index.js` fail to locate the server.

## Correct MCP Server Configuration
- **Command**: `claude mcp add obsidian "node" "/Users/braydon/projects/experiments/obsidian_mcp/dist/index.js" --env OBSIDIAN_VAULT_PATH="/users/braydon/obsidian/bvault" --scope user`
- **Scope**: User (available across all projects)
- **Environment**: `OBSIDIAN_VAULT_PATH="/users/braydon/obsidian/bvault"`
- **Status**: Configured with absolute paths

## Alternative: Direct Vault Access
Since MCP tools aren't loading, Claude Code CLI can access your vault directly:
- **Vault Path**: `/users/braydon/obsidian/bvault`
- **File Operations**: Use Read, Grep, Glob tools on vault files
- **Search**: Use Grep tool to search vault content