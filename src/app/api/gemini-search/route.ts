import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('[API] /api/gemini-search POST hit');
    const body = await request.json().catch(() => ({}));
    const { query } = body;

    if (!process.env.GEMINI_API_KEY) {
      console.error('[API] Missing GEMINI_API_KEY environment variable');
      return new Response(JSON.stringify({ error: 'Missing GEMINI_API_KEY' }), { status: 500 });
    }

    if (!query || typeof query !== 'string') {
      console.error('[API] Missing or invalid query parameter', { query });
      return new Response(JSON.stringify({ error: 'Missing or invalid query parameter' }), { status: 400 });
    }

    console.log('[API] Making Gemini API request', { query });

    const prompt = `You are a search assistant for Jarvis. Given the user's query, generate a comprehensive but concise response using real-time search results. Structure output as markdown for readability.

Query: ${query}

Rules:
- Start with a direct answer.
- Use bullet points for lists.
- Cite sources with [1], [2], etc.
- Keep response under 1000 words.
- If query implies tools, suggest them but don't execute.

Example:
Query: Best AI tools 2025
Output: # Top AI Tools for 2025

Based on current trends:

- **Grok**: Advanced reasoning [1]
- **Claude**: Creative writing [2]

Sources:
[1] x.ai
[2] anthropic.com`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
        systemInstruction: {
          parts: [{
            text: 'You are a helpful AI assistant providing factual, well-researched responses. When providing information, cite sources when possible and maintain objectivity.'
          }]
        }
      })
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[API] Gemini API error', { status: response.status, statusText: response.statusText, detail: text });
      return new Response(JSON.stringify({ error: `Gemini API error: ${response.status} ${response.statusText}`, detail: text }), { status: 502 });
    }

    const data = await response.json();
    console.log('[API] Gemini API response received', { hasData: !!data });

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      console.error('[API] Invalid response format from Gemini API', { data });
      return new Response(JSON.stringify({ error: 'Invalid response format from Gemini API' }), { status: 502 });
    }

    const text = data.candidates[0].content.parts?.[0]?.text;
    if (!text) {
      console.error('[API] Empty response from Gemini API', { data });
      return new Response(JSON.stringify({ error: 'Empty response from Gemini API' }), { status: 502 });
    }

    console.log('[API] /api/gemini-search success', { responseLength: text.length });
    return Response.json({ result: text });
  } catch (error) {
    console.error('[API] /api/gemini-search error', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { status: 500 });
  }
}