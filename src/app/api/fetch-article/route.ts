import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const url: string | undefined = body?.url;
    const mode: 'full' | 'head' = body?.mode === 'head' ? 'head' : 'full';
    if (!url || !/^https?:\/\//i.test(url)) {
      return new Response(JSON.stringify({ error: 'Valid url is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    let html: string;
    let finalUrl = url;
    let xfo: string | null = null;
    let csp: string | null = null;
    try {
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        // Avoid following too many redirects which can lead to blockers
        redirect: 'follow' as RequestRedirect
      });
      if (!resp.ok) throw new Error(`Fetch HTTP ${resp.status}`);
      finalUrl = (resp as any).url || url;
      xfo = resp.headers.get('x-frame-options');
      csp = resp.headers.get('content-security-policy');
      html = await resp.text();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return new Response(JSON.stringify({ error: `Failed to fetch url: ${msg}` }), { status: 502, headers: { 'Content-Type': 'application/json' } });
    }

    // Detect likely iframe blocking
    const embeddingBlocked = (() => {
      try {
        if (xfo && /deny|sameorigin/i.test(xfo)) return true;
        if (csp && /frame-ancestors/i.test(csp)) {
          // If frame-ancestors is present but does not include * or http(s), assume blocked
          const fa = /frame-ancestors\s+([^;]+)/i.exec(csp)?.[1] || '';
          if (fa && !/\*|https?:/i.test(fa)) return true;
        }
      } catch {}
      return false;
    })();

    if (mode === 'head') {
      return new Response(JSON.stringify({ url: finalUrl, embeddingBlocked, xFrameOptions: xfo, csp }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Lazy import to keep cold start small
    const { JSDOM } = await import('jsdom');
    const { Readability } = await import('@mozilla/readability');

    try {
      const dom = new JSDOM(html, { url });
      const doc = dom.window.document;

      // Remove script/style to reduce noise
      doc.querySelectorAll('script, style, noscript').forEach(el => el.remove());

      const reader = new Readability(doc);
      const article = reader.parse();

      if (!article) {
        return new Response(JSON.stringify({ error: 'Could not extract article content' }), { status: 422, headers: { 'Content-Type': 'application/json' } });
      }

      // Return both text and html; clients can choose safe rendering
      return new Response(JSON.stringify({
        url: finalUrl,
        title: article.title || '',
        byline: article.byline || '',
        textContent: article.textContent || '',
        content: article.content || '',
        embeddingBlocked,
        xFrameOptions: xfo,
        csp
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return new Response(JSON.stringify({ error: `Failed to parse article: ${msg}` }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}


