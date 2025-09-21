import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('[API] /api/cerebras-tasks POST hit');
    const body = await request.json().catch(() => ({}));
    const { cerebrasRequest } = body;

    if (!process.env.CEREBRAS_API_KEY) {
      return new Response(JSON.stringify({ error: 'Missing CEREBRAS_API_KEY' }), { status: 500 });
    }

    if (!cerebrasRequest) {
      return new Response(JSON.stringify({ error: 'Missing cerebrasRequest in body' }), { status: 400 });
    }

    const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CEREBRAS_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(cerebrasRequest)
    });

    if (!response.ok) {
      const text = await response.text();
      return new Response(JSON.stringify({ error: `Upstream error ${response.status}`, detail: text }), { status: 502 });
    }

    const data = await response.json();
    console.log('[API] /api/cerebras-tasks success');
    return Response.json(data);
  } catch (error) {
    console.error('[API] /api/cerebras-tasks error', error);
    return new Response(JSON.stringify({ error: (error instanceof Error ? error.message : String(error)) }), { status: 500 });
  }
}




