import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const location: string = body?.location || '';
    if (!location) return new Response(JSON.stringify({ error: 'Missing location' }), { status: 400 });
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) return new Response(JSON.stringify({ error: 'Missing OPENWEATHER_API_KEY' }), { status: 500 });

    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=metric`;
    const resp = await fetch(url);
    if (!resp.ok) return new Response(JSON.stringify({ error: `Weather HTTP ${resp.status}` }), { status: 502 });
    const data = await resp.json();
    return new Response(JSON.stringify({ data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
}


