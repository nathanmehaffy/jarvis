import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('[API] /api/cerebras-tasks POST hit');
    const body = await request.json().catch(() => ({}));
    let cerebrasRequest = body?.cerebrasRequest;

    if (!process.env.CEREBRAS_API_KEY) {
      return new Response(JSON.stringify({ error: 'Missing CEREBRAS_API_KEY' }), { status: 500 });
    }

    // Backward compatibility: accept { prompt } and wrap it into a minimal request
    if (!cerebrasRequest && typeof body?.prompt === 'string' && body.prompt.trim().length > 0) {
      cerebrasRequest = {
        model: 'llama3.1-8b',
        messages: [{ role: 'user', content: body.prompt }],
        temperature: 0.2,
        max_tokens: 512
      };
      // We'll try to unwrap this shaped response below if needed
      const proxied = await fetch('https://api.cerebras.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.CEREBRAS_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(cerebrasRequest)
      });

      if (!proxied.ok) {
        const text = await proxied.text();
        return new Response(JSON.stringify({ error: `Upstream error ${proxied.status}`, detail: text }), { status: 502 });
      }

      const data = await proxied.json();
      const content: unknown = data?.choices?.[0]?.message?.content;
      if (typeof content === 'string') {
        try {
          const parsed = JSON.parse(content);
          return Response.json(parsed);
        } catch {
          // Not JSON; return a safe default
          return Response.json({ tasks: [], remainder: content });
        }
      }
      return Response.json({ tasks: [], remainder: '' });
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




