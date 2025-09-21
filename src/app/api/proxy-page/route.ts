import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Very simple proxy-render that now also rewrites resource URLs to go through our
// asset proxy, and keeps navigation inside the proxy by rewriting anchors/forms.
// Scripts can be optionally allowed via ?scripts=1, otherwise they are stripped.
export async function GET(request: NextRequest) {
  try {
    const urlObj = new URL(request.url);
    const target = urlObj.searchParams.get('url');
    if (!target || !/^https?:\/\//i.test(target)) {
      return new Response('Missing or invalid url', { status: 400 });
    }

    const enableScripts = urlObj.searchParams.get('scripts') === '1';

    let html: string;
    try {
      const resp = await fetch(target, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        redirect: 'follow' as RequestRedirect
      });
      if (!resp.ok) {
        return new Response(`Upstream HTTP ${resp.status}`, { status: 502 });
      }
      html = await resp.text();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return new Response(`Failed to fetch url: ${msg}`, { status: 502 });
    }

    // Lazy import to keep cold starts smaller
    const { JSDOM } = await import('jsdom');

    try {
      const dom = new JSDOM(html);
      const doc = dom.window.document;

      // Ensure a base tag so relative URLs resolve against the original site
      const head = doc.querySelector('head') || doc.createElement('head');
      if (!doc.querySelector('head')) doc.documentElement.insertBefore(head, doc.body || null);
      let base = head.querySelector('base');
      if (!base) {
        base = doc.createElement('base');
        base.setAttribute('href', target);
        head.insertBefore(base, head.firstChild);
      } else if (!base.getAttribute('href')) {
        base.setAttribute('href', target);
      }

      // Remove CSP meta tags that might block rendering inside our iframe snapshot
      head.querySelectorAll('meta[http-equiv="Content-Security-Policy"]').forEach(el => el.remove());

      // Optionally remove scripts; default is safe (no scripts)
      if (!enableScripts) {
        doc.querySelectorAll('script').forEach(el => el.remove());
        // Remove inline event handlers
        doc.querySelectorAll('*').forEach((el: any) => {
          for (const attr of Array.from(el.attributes || [])) {
            if (/^on/i.test(attr.name)) {
              el.removeAttribute(attr.name);
            }
          }
        });
      }

      // URL rewriting helpers
      const toAbsolute = (val: string) => {
        try { return new URL(val, target).href; } catch { return val; }
      };
      const rewriteToAsset = (val: string | null) => val ? `/api/proxy-asset?url=${encodeURIComponent(toAbsolute(val))}` : val;
      const rewriteToPage = (val: string | null) => val ? `/api/proxy-page?url=${encodeURIComponent(toAbsolute(val))}` : val;

      // Rewrite anchors to stay inside proxy
      doc.querySelectorAll('a[href]')?.forEach((a: any) => {
        const href = a.getAttribute('href');
        if (!href) return;
        a.setAttribute('href', rewriteToPage(href) as string);
      });

      // Rewrite common resource-bearing elements to asset proxy
      const rewriteAttr = (selector: string, attr: string) => {
        doc.querySelectorAll(selector)?.forEach((el: any) => {
          const val = el.getAttribute(attr);
          if (val) el.setAttribute(attr, rewriteToAsset(val) as string);
        });
      };
      rewriteAttr('img[src]', 'src');
      rewriteAttr('script[src]', 'src');
      rewriteAttr('link[href]', 'href');
      rewriteAttr('video[src]', 'src');
      rewriteAttr('audio[src]', 'src');
      rewriteAttr('source[src]', 'src');

      // Rewrite srcset values
      doc.querySelectorAll('img[srcset], source[srcset]')?.forEach((el: any) => {
        const srcset = el.getAttribute('srcset');
        if (!srcset) return;
        const rewritten = srcset.split(',').map((part: string) => {
          const [u, d] = part.trim().split(/\s+/);
          const proxied = rewriteToAsset(u as string);
          return d ? `${proxied} ${d}` : String(proxied);
        }).join(', ');
        el.setAttribute('srcset', rewritten);
      });

      // Rewrite inline CSS url() usages
      doc.querySelectorAll('[style]')?.forEach((el: any) => {
        const style = String(el.getAttribute('style') || '');
        const rewritten = style.replace(/url\((['"]?)([^'"\)]+)\1\)/g, (_m: any, q: string, p: string) => {
          const abs = toAbsolute(p.trim());
          return `url(${q}${rewriteToAsset(abs)}${q})`;
        });
        if (rewritten !== style) el.setAttribute('style', rewritten);
      });

      // Forms: keep navigation inside proxy by rewriting action to proxy-page (best-effort)
      doc.querySelectorAll('form[action]')?.forEach((f: any) => {
        const action = f.getAttribute('action');
        if (action) f.setAttribute('action', rewriteToPage(action) as string);
      });

      // Basic CSS to make the page fill the iframe area
      const style = doc.createElement('style');
      style.textContent = 'html,body{height:100%;margin:0;padding:0;}';
      head.appendChild(style);

      const out = '<!doctype html>' + doc.documentElement.outerHTML;
      return new Response(out, { 
        status: 200, 
        headers: { 
          'Content-Type': 'text/html; charset=utf-8',
          // Keep this page frameable by us; apply a conservative CSP
          'X-Frame-Options': 'SAMEORIGIN',
          'Content-Security-Policy': "default-src 'self' data:; img-src 'self' data: *; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'self';",
          'Cache-Control': 'private, max-age=900'
        } 
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return new Response(`Failed to sanitize page: ${msg}`, { status: 500 });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(`Proxy error: ${msg}`, { status: 500 });
  }
}


