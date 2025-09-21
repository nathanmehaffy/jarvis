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

    const prompt = `Please provide a comprehensive and factual summary about: ${query}

Guidelines:
- Provide accurate, up-to-date information
- Structure your response with clear headings and bullet points when appropriate
- Include relevant facts, context, and key details
- Keep the response concise but informative
- If the topic involves current events or rapidly changing information, note that`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`, {
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