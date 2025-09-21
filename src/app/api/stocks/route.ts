import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const symbol: string = body?.symbol || '';
    if (!symbol) return new Response(JSON.stringify({ error: 'Missing symbol' }), { status: 400 });
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
    if (!apiKey) return new Response(JSON.stringify({ error: 'Missing ALPHA_VANTAGE_API_KEY' }), { status: 500 });

    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;
    const resp = await fetch(url);
    if (!resp.ok) return new Response(JSON.stringify({ error: `Stocks HTTP ${resp.status}` }), { status: 502 });
    const data = await resp.json();
    return new Response(JSON.stringify({ data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
}


