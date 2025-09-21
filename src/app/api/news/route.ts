import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const query: string = body?.query || '';
    const pageSize: number = Math.min(Math.max(Number(body?.pageSize) || 5, 1), 10);
    if (!query) return new Response(JSON.stringify({ error: 'Missing query' }), { status: 400 });
    const apiKey = process.env.NEWS_API_KEY;
    if (!apiKey) return new Response(JSON.stringify({ error: 'Missing NEWS_API_KEY' }), { status: 500 });

    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&pageSize=${pageSize}&sortBy=publishedAt&language=en&apiKey=${apiKey}`;
    const resp = await fetch(url);
    if (!resp.ok) return new Response(JSON.stringify({ error: `News HTTP ${resp.status}` }), { status: 502 });
    const data = await resp.json();
    return new Response(JSON.stringify({ data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
}


