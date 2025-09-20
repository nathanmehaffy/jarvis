import { NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  content?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const query: string | undefined = body?.query;
    const resultCount: number = Math.min(Math.max(Number(body?.resultCount) || 5, 1), 10);

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Missing query' }), { status: 400 });
    }

    const useGemini = Boolean(process.env.GEMINI_API_KEY);

    if (useGemini) {
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

        const prompt = `You are a web research assistant. Use Google Search grounding to retrieve results.
Query: "${query}"

Return JSON with this shape exactly:
{
  "results": [
    { "title": string, "url": string, "snippet": string, "content"?: string }
  ]
}
Make sure to include ${resultCount} highly relevant results. If only one truly authoritative result exists, include detailed content in the 'content' field.`;

        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }]}],
          // Best-effort hint for grounding; some SDK versions support tools in params
          tools: [{ googleSearchRetrieval: {} }] as any
        } as any);

        const text = (await result.response).text();
        try {
          const data = JSON.parse(text);
          const results: SearchResult[] = Array.isArray(data?.results) ? data.results : [];
          return Response.json({ results: results.slice(0, resultCount) });
        } catch {
          // Fallback to single blob result
          const single: SearchResult = {
            title: `Search Results for "${query}"`,
            url: 'https://www.google.com/search?q=' + encodeURIComponent(query),
            snippet: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
            content: text
          };
          return Response.json({ results: [single] });
        }
      } catch (e) {
        // Fall through to non-Gemini fallback
      }
    }

    // Fallback: minimal DuckDuckGo Instant Answer API (may not always return web links)
    try {
      const ddg = await fetch('https://api.duckduckgo.com/?q=' + encodeURIComponent(query) + '&format=json&no_html=1&skip_disambig=1');
      const data = await ddg.json();
      const results: SearchResult[] = [];

      if (Array.isArray(data?.RelatedTopics)) {
        for (const t of data.RelatedTopics) {
          if (t?.FirstURL && t?.Text) {
            results.push({ title: t.Text.split(' - ')[0] || t.Text, url: t.FirstURL, snippet: t.Text });
          } else if (Array.isArray(t?.Topics)) {
            for (const u of t.Topics) {
              if (u?.FirstURL && u?.Text) {
                results.push({ title: u.Text.split(' - ')[0] || u.Text, url: u.FirstURL, snippet: u.Text });
              }
            }
          }
          if (results.length >= resultCount) break;
        }
      }

      if (results.length === 0) {
        results.push({
          title: `Search for "${query}"`,
          url: 'https://duckduckgo.com/?q=' + encodeURIComponent(query),
          snippet: 'No direct API results. Click the link to view search results.'
        });
      }

      return Response.json({ results });
    } catch {
      // Final fallback: instruct user to configure key
      return Response.json({
        results: [{
          title: `Search for "${query}"`,
          url: 'https://www.google.com/search?q=' + encodeURIComponent(query),
          snippet: 'Search service unavailable. Configure GEMINI_API_KEY in .env.local.'
        }]
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: (error instanceof Error ? error.message : String(error)) }), { status: 500 });
  }
}


