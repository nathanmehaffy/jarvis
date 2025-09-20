import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    if (!process.env.CEREBRAS_API_KEY) {
      return new Response(JSON.stringify({ error: 'Missing CEREBRAS_API_KEY' }), { status: 500 });
    }

    const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CEREBRAS_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-oss-120b',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const text = await response.text();
      return new Response(JSON.stringify({ error: `Upstream error ${response.status}`, detail: text }), { status: 502 });
    }

    const data = await response.json();

    // Expect standard OpenAI-like shape
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid upstream response' }), { status: 502 });
    }

    // Ensure we return valid JSON only
    try {
      const parsed = JSON.parse(content);
      return Response.json(parsed);
    } catch {
      // If model returns non-JSON, surface as 502 to trigger client retry policy
      return new Response(JSON.stringify({ error: 'Non-JSON model response' }), { status: 502 });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: (error instanceof Error ? error.message : String(error)) }), { status: 500 });
  }
}



