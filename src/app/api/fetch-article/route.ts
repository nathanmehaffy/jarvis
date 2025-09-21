// src/app/api/fetch-article/route.ts
import { NextRequest } from 'next/server';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const url: string | undefined = body?.url;

    if (!url || !/^https?:\/\//i.test(url)) {
      return new Response(JSON.stringify({ error: 'Valid url is required' }), { status: 400 });
    }

    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      }
    });

    if (!resp.ok) throw new Error(`Fetch HTTP ${resp.status}`);
    const html = await resp.text();

    const dom = new JSDOM(html, { url });
    const doc = dom.window.document;
    const reader = new Readability(doc);
    const article = reader.parse();

    if (!article) {
      return new Response(JSON.stringify({ error: 'Could not extract article content' }), { status: 422 });
    }

    return new Response(JSON.stringify({
      url: url,
      title: article.title || '',
      byline: article.byline || '',
      textContent: article.textContent || '',
      content: article.content || '',
    }), { status: 200 });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: `Failed to parse article: ${msg}` }), { status: 500 });
  }
}