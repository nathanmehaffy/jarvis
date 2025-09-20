const fs = require('fs');

// 1. Add web_search tool to tools.ts
let toolsContent = fs.readFileSync('src/ai/tools.ts', 'utf8');

const newTool = `,
  {
    name: 'web_search',
    description: 'Performs web search using Gemini with grounding and displays results in a window. Use this when user wants to search for information online.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query to look up'
        },
        resultCount: {
          type: 'number',
          description: 'Number of results to return (1-10, default 5)'
        },
        displayMode: {
          type: 'string',
          description: 'How to display results: summary (single result with summary), links (multiple results with titles/links), full (single result with full content)',
          enum: ['summary', 'links', 'full', 'auto']
        }
      },
      required: ['query']
    }
  }`;

// Insert before the closing ];
toolsContent = toolsContent.replace('  }\n];', `  }${newTool}\n];`);

fs.writeFileSync('src/ai/tools.ts', toolsContent);
console.log('✅ Added web_search tool to tools.ts');

// 2. Add types to types.ts
let typesContent = fs.readFileSync('src/ai/types.ts', 'utf8');

const newTypes = `
export interface WebSearchParams {
  query: string;
  resultCount?: number;
  displayMode?: 'summary' | 'links' | 'full' | 'auto';
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  content?: string;
}
`;

// Insert before the last export
typesContent = typesContent.replace(
  'export interface AIProcessingResult {',
  `${newTypes}
export interface AIProcessingResult {`
);

fs.writeFileSync('src/ai/types.ts', typesContent);
console.log('✅ Added WebSearchParams types to types.ts');

