// src/app/api/proxy-page/route.ts
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url || !/^https?:\/\//i.test(url)) {
      return new Response('Valid URL is required', { status: 400 });
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      }
    });

    if (!response.ok) {
      return new Response(`Failed to fetch: ${response.status}`, { status: response.status });
    }

    const content = await response.text();

    // Return the content with appropriate headers for iframe embedding
    return new Response(content, {
      headers: {
        'Content-Type': 'text/html',
        'X-Frame-Options': 'SAMEORIGIN',
        'Content-Security-Policy': "frame-ancestors 'self'",
      },
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(`Proxy error: ${msg}`, { status: 500 });
  }
}