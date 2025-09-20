const fs = require('fs');

// Create Gemini client for web search
const geminiClientContent = `import { GoogleGenerativeAI } from '@google/generative-ai';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  content?: string;
}

export class GeminiSearchClient {
  private genAI: GoogleGenerativeAI;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('Gemini API key is required');
    }
    this.genAI = new GoogleGenerativeAI(key);
  }

  async searchWithGrounding(query: string, resultCount: number = 5): Promise<SearchResult[]> {
    try {
      const model = this.genAI.getGenerativeModel({ 
        model: 'gemini-2.0-flash-exp',
        tools: [{
          googleSearchRetrieval: {
            dynamicRetrievalConfig: {
              mode: 'MODE_DYNAMIC',
              dynamicThreshold: 0.3
            }
          }
        }]
      });

      const prompt = \`Search for: "\${query}"
      
Please provide \${resultCount} relevant search results. For each result, include:
1. Title
2. URL/Source
3. Brief snippet/summary
4. If there's only 1 result, also include more detailed content

Format your response as JSON with this structure:
{
  "results": [
    {
      "title": "Result Title",
      "url": "https://example.com",
      "snippet": "Brief description...",
      "content": "Detailed content (only for single results)"
    }
  ],
  "totalResults": number,
  "searchQuery": "\${query}"
}\`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Parse JSON response
      try {
        const data = JSON.parse(text);
        return data.results || [];
      } catch (parseError) {
        // Fallback: create a single result with the full text
        return [{
          title: \`Search Results for "\${query}"\`,
          url: 'https://google.com/search?q=' + encodeURIComponent(query),
          snippet: text.substring(0, 200) + '...',
          content: text
        }];
      }
    } catch (error) {
      console.error('Gemini search error:', error);
      throw new Error(\`Search failed: \${error instanceof Error ? error.message : String(error)}\`);
    }
  }
}
`;

fs.writeFileSync('src/ai/geminiSearchClient.ts', geminiClientContent);
console.log('✅ Created Gemini search client');

