const fs = require('fs');

// Add search detection to taskParser.ts
let content = fs.readFileSync('src/ai/taskParser.ts', 'utf8');

// Add search detection in fallbackParsing after the open/create commands
const searchDetection = `
    // Search commands
    if (lowerText.includes('search') || lowerText.includes('look up') || lowerText.includes('find information')) {
      let searchQuery = '';
      let resultCount = 5;
      let displayMode = 'auto';

      // Extract search query patterns
      const searchPatterns = [
        /search\\s+for\\s+(.+?)$/i,
        /look\\s+up\\s+(.+?)$/i,
        /find\\s+information\\s+(?:about|on)\\s+(.+?)$/i,
        /(?:search|look\\s+up|find)\\s+["']([^"']+)["']/i,
        /(?:search|google|bing)\\s*[:.]?\\s*(.+?)$/i
      ];

      for (const pattern of searchPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          searchQuery = match[1].trim();
          break;
        }
      }

      // Extract result count if specified
      const countMatch = text.match(/(\\d+)\\s+(?:results?|top|first)/i);
      if (countMatch) {
        const n = parseInt(countMatch[1], 10);
        if (!isNaN(n) && n > 0 && n <= 10) resultCount = n;
      }

      // If we extracted a search query, create a search task
      if (searchQuery) {
        tasks.push({
          id: this.generateTaskId(),
          tool: 'web_search',
          parameters: {
            query: searchQuery,
            resultCount: resultCount,
            displayMode: displayMode
          },
          description: \`Search for: \${searchQuery}\`
        });
      }
    }
`;

// Insert after the open/create window logic
content = content.replace(
  '    }\n    \n    return tasks;',
  '    }' + searchDetection + '\n    \n    return tasks;'
);

fs.writeFileSync('src/ai/taskParser.ts', content);
console.log('✅ Added search detection to taskParser.ts');

