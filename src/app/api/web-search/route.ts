import { NextRequest } from 'next/server';

// Ensure Node runtime so env vars (GEMINI_API_KEY) are available
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
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
    const mode: 'links' | 'article' = (body?.mode === 'article') ? 'article' : 'links';

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Missing query' }), { status: 400 });
    }

    const useGemini = Boolean(process.env.GEMINI_API_KEY);
    console.log('[API/web-search] useGemini?', useGemini);

    if (useGemini) {
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = `You are a web research assistant with access to Google Search. Use Google Search grounding to find the most current and relevant results for this query.

Query: "${query}"

Requirements:
- Use Google Search grounding (not your training data)
- Find ${resultCount} high-quality, recent results
- Prefer authoritative sources (news sites, academic, government, established organizations)
- Return direct URLs to actual articles/pages (not search result URLs)

Return JSON exactly in this format:
{
  "results": [
    { "title": "Exact article title", "url": "https://direct-article-url.com", "snippet": "Brief description of content" }
  ]
}`;

        // Exponential backoff helper
        const fetchWithBackoff = async (requestFn: () => Promise<any>, maxRetries = 3): Promise<any> => {
          for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
              return await requestFn();
            } catch (e: any) {
              if (e?.message?.includes('429') && attempt < maxRetries - 1) {
                const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
                console.log(`[API/web-search] Rate limited, retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
              }
              throw e;
            }
          }
        };

        // Try Gemini with Google Search grounding and backoff
        let text: string | null = null;
        try {
          const res: any = await fetchWithBackoff(async () => {
            return await (model as any).generateContent({
              contents: [{ role: 'user', parts: [{ text: prompt }]}],
              tools: [{ googleSearchRetrieval: {} }],
              generationConfig: { temperature: 0.1, maxOutputTokens: 2048 }
            });
          });
          text = await res.response.text();
          console.log('[API/web-search] Gemini grounding successful');
        } catch (e) {
          console.warn('[API/web-search] Gemini grounding failed, trying simple generation:', e instanceof Error ? e.message : String(e));
          try {
            const res: any = await fetchWithBackoff(async () => {
              return await (model as any).generateContent(prompt);
            });
            text = await res.response.text();
          } catch (e2) {
            console.error('[API/web-search] All Gemini attempts failed:', e2 instanceof Error ? e2.message : String(e2));
            throw e2;
          }
        }
        // Try to parse JSON, being tolerant of fenced code blocks
        const tryParse = (raw: string | null) => {
          if (!raw) return null as any;
          let s = raw.trim();
          // strip markdown fences if present
          if (s.startsWith('```')) {
            const idx = s.indexOf('\n');
            if (idx !== -1) s = s.slice(idx + 1);
            if (s.endsWith('```')) s = s.slice(0, -3);
          }
          // extract first JSON object if extra text around
          const m = s.match(/\{[\s\S]*\}/);
          if (m) s = m[0];
          return JSON.parse(s);
        };
        try {
          const data = tryParse(text);
          const results: SearchResult[] = Array.isArray(data?.results) ? data.results : [];
          console.log('[API/web-search] Gemini returned results:', results.length);
          return Response.json({ results: results.slice(0, resultCount) });
        } catch (e) {
          console.warn('[API/web-search] Gemini JSON parse failed; returning blob:', (text || '').slice(0, 160));
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
        console.error('[API/web-search] Gemini call failed, falling back to DDG:', e instanceof Error ? e.message : String(e));
        // Fall through to non-Gemini fallback
      }
    }

    // Fallback: DuckDuckGo HTML (direct article URLs via uddg)
    try {
      const endpoint = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query);
      const htmlResp = await fetch(endpoint, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'
        }
      });
      if (!htmlResp.ok) throw new Error(`DDG HTML HTTP ${htmlResp.status}`);
      const html = await htmlResp.text();
      const { JSDOM } = await import('jsdom');
      const dom = new JSDOM(html);
      const doc = dom.window.document;
      const anchors = Array.from(doc.querySelectorAll('a.result__a')) as HTMLAnchorElement[];
      const results: SearchResult[] = [];
      for (const a of anchors) {
        const href = a.getAttribute('href') || '';
        const title = a.textContent?.trim() || '';
        if (!href) continue;
        const m = href.match(/uddg=([^&]+)/);
        const direct = m ? decodeURIComponent(m[1]) : href.startsWith('http') ? href : `https://duckduckgo.com${href}`;
        // Grab snippet from sibling element if present
        const resultNode = a.closest('.result');
        const snippetNode = resultNode?.querySelector('.result__snippet') || resultNode?.querySelector('.result__extras__url');
        const snippet = snippetNode?.textContent?.trim() || '';
        results.push({ title: title || direct, url: direct, snippet });
        if (results.length >= resultCount) break;
      }

      if (results.length === 0) {
        results.push({ title: `Search for "${query}"`, url: endpoint, snippet: 'No parsed results. Open in browser.' });
      }
      console.log('[API/web-search] Using DuckDuckGo HTML results:', results.length);
      return Response.json({ results });
    } catch (e) {
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


