import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const urlObj = new URL(request.url);
    const original = urlObj.searchParams.get('url');
    if (!original || !/^https?:\/\//i.test(original)) {
      return new Response('Invalid url', { status: 400 });
    }

    const resp = await fetch(original, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      },
      redirect: 'follow' as RequestRedirect
    });
    if (!resp.ok) {
      return new Response(`Upstream HTTP ${resp.status}`, { status: 502 });
    }

    const contentType = resp.headers.get('content-type') || 'application/octet-stream';
    const buff = await resp.arrayBuffer();
    return new Response(buff, { status: 200, headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=86400' } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(`Asset proxy error: ${msg}`, { status: 500 });
  }
}


