import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('[API] /api/describe-image POST hit');
    const body = await request.json().catch(() => ({}));
    const { image, mimeType } = body;

    if (!process.env.GEMINI_API_KEY) {
      console.error('[API] Missing GEMINI_API_KEY environment variable');
      return new Response(JSON.stringify({ error: 'Missing GEMINI_API_KEY' }), { status: 500 });
    }

    if (!image || typeof image !== 'string' || !mimeType || typeof mimeType !== 'string') {
      console.error('[API] Missing or invalid image/mimeType parameter', { image: typeof image, mimeType: typeof mimeType });
      return new Response(JSON.stringify({ error: 'Missing or invalid image/mimeType parameter' }), { status: 400 });
    }

    console.log('[API] Making Gemini API request for image description');

    const prompt = "Describe this image in detail. What is it, what is happening, and what are the key objects or elements?";

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: image
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 1024,
        },
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

    console.log('[API] /api/describe-image success', { responseLength: text.length });
    return Response.json({ result: text });
  } catch (error) {
    console.error('[API] /api/describe-image error', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { status: 500 });
  }
}
