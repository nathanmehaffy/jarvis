import { NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function readFileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  return { base64, mimeType: file.type || 'application/octet-stream' };
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let prompt = 'Describe the image and extract any visible text (OCR).';
    let imageBase64: string | null = null;
    let mimeType = 'image/png';

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const file = form.get('file');
      const p = form.get('prompt');
      if (typeof p === 'string' && p.trim().length > 0) prompt = p;
      if (file && file instanceof File) {
        const b64 = await readFileToBase64(file);
        imageBase64 = b64.base64; mimeType = b64.mimeType;
      }
    } else {
      const body = await request.json().catch(() => ({}));
      if (typeof body?.prompt === 'string' && body.prompt.trim().length > 0) prompt = body.prompt;
      if (typeof body?.imageUrl === 'string' && /^https?:\/\//i.test(body.imageUrl)) {
        const resp = await fetch(body.imageUrl);
        if (!resp.ok) return new Response(JSON.stringify({ error: `Fetch image HTTP ${resp.status}` }), { status: 502 });
        const buf = Buffer.from(await resp.arrayBuffer());
        imageBase64 = buf.toString('base64');
        const ct = resp.headers.get('content-type');
        if (ct) mimeType = ct;
      } else if (typeof body?.imageBase64 === 'string' && body.imageBase64.length > 0) {
        imageBase64 = body.imageBase64.replace(/^data:[^;]+;base64,/, '');
        if (typeof body?.mimeType === 'string') mimeType = body.mimeType;
      }
    }

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: 'No image provided' }), { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: 'Missing GEMINI_API_KEY' }), { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    let text: string;
    try {
      const res: any = await (model as any).generateContent({
        contents: [{
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { data: imageBase64, mimeType } }
          ]
        }]
      });
      text = await res.response.text();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return new Response(JSON.stringify({ error: `Gemini error: ${msg}` }), { status: 502 });
    }

    return new Response(JSON.stringify({ result: text }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}


