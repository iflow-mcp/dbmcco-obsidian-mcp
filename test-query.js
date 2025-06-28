#!/usr/bin/env node

import { VaultManager } from './dist/vault-manager.js';
import { QueryProcessor } from './dist/query-processor.js';

async function testQuery() {
  try {
    const vaultPath = process.env.OBSIDIAN_VAULT_PATH || "/path/to/your/obsidian/vault";
    const vaultManager = new VaultManager();
    const queryProcessor = new QueryProcessor(vaultManager);
    
    // Get query from command line arguments
    const args = process.argv.slice(2);
    if (args.length === 0) {
      console.log("Usage: node test-query.js <search-term> [query]");
      console.log("Examples:");
      console.log("  node test-query.js 'project management'");
      console.log("  node test-query.js 'AI agents' 'analyze my AI agent research and suggest improvements'");
      process.exit(1);
    }
    
    const searchTerm = args[0];
    const query = args[1] || `Please provide an overview of content related to "${searchTerm}"`;
    
    console.log(`Searching for "${searchTerm}" content...\n`);
    
    // Search for the provided term
    const searchResults = await vaultManager.searchNotes(searchTerm, "both", vaultPath);
    console.log(`Found ${searchResults.length} notes mentioning "${searchTerm}":\n`);
    
    for (const result of searchResults.slice(0, 10)) { // Limit to 10 results for readability
      console.log(`📄 ${result.title} (${result.path})`);
      console.log(`   Match type: ${result.matchType}`);
      result.matches.slice(0, 2).forEach(match => console.log(`   - ${match}`)); // Limit matches shown
      console.log();
    }
    
    if (searchResults.length > 0) {
      console.log("\n" + "=".repeat(50));
      console.log("DETAILED ANALYSIS");
      console.log("=".repeat(50) + "\n");
      
      const analysis = await queryProcessor.processQuery(query, vaultPath);
      console.log(analysis);
    }
    
  } catch (error) {
    console.error("Error:", error.message);
  }
}

testQuery();