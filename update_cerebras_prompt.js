const fs = require('fs');

// Update Cerebras prompt to include web search examples
let content = fs.readFileSync('src/ai/cerebrasClient.ts', 'utf8');

const newExamples = '- User: "search for the top 5 health risks for cardiac disease" → web_search { query: "top 5 health risks cardiac disease", resultCount: 5, displayMode: "auto" }\\n- User: "open a window and search for AI news" → web_search { query: "AI news", resultCount: 5, displayMode: "auto" }\\n- User: "look up information about quantum computing" → web_search { query: "quantum computing information", resultCount: 5, displayMode: "auto" }\\n';

content = content.replace(
  '- User: "close all windows" → close_window { selector: "all" }',
  '- User: "close all windows" → close_window { selector: "all" }\\n' + newExamples
);

// Add web search guidance
const webSearchGuidance = '\\n\\nFor web search operations:\\n- Use web_search tool when user wants to search, look up, or find information online\\n- Extract the search query from natural language\\n- Set appropriate resultCount if specified (default 5)\\n- Use displayMode "auto" unless specified otherwise';

content = content.replace(
  'IMPORTANT: When user asks to open multiple windows (e.g., "open 5 windows"), create multiple separate tool calls, one for each window.',
  'IMPORTANT: When user asks to open multiple windows (e.g., "open 5 windows"), create multiple separate tool calls, one for each window.' + webSearchGuidance
);

fs.writeFileSync('src/ai/cerebrasClient.ts', content);
console.log('✅ Updated Cerebras prompt with web search examples');

