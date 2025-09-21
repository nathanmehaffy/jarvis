import { NextRequest } from 'next/server';
import pdfParse from 'pdf-parse';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function extractPdfText(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer);
  return data.text || '';
}

function basicSummary(text: string, limit = 12): string {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  return sentences.slice(0, limit).join(' ');
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let buffer: Buffer | null = null;
    let prompt = 'Summarize this PDF and extract key bullet points.';

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const file = form.get('file');
      const p = form.get('prompt');
      if (typeof p === 'string') prompt = p;
      if (file && file instanceof File) {
        const arr = await file.arrayBuffer();
        buffer = Buffer.from(arr);
      }
    } else if (contentType.includes('application/pdf')) {
      const arr = await request.arrayBuffer();
      buffer = Buffer.from(arr);
    } else {
      const body = await request.json().catch(() => ({}));
      if (typeof body?.prompt === 'string') prompt = body.prompt;
      if (typeof body?.url === 'string' && /^https?:\/\//i.test(body.url)) {
        const resp = await fetch(body.url);
        if (!resp.ok) return new Response(JSON.stringify({ error: `Fetch HTTP ${resp.status}` }), { status: 502 });
        const arr = await resp.arrayBuffer();
        buffer = Buffer.from(arr);
      }
    }

    if (!buffer) {
      return new Response(JSON.stringify({ error: 'No PDF provided' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const text = await extractPdfText(buffer);
    if (!text || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Could not extract text from PDF' }), { status: 422, headers: { 'Content-Type': 'application/json' } });
    }

    let summary: string | null = null;
    if (process.env.GEMINI_API_KEY) {
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const res: any = await (model as any).generateContent({
          contents: [{ role: 'user', parts: [{ text: `${prompt}\n\n---\n\n${text.slice(0, 120000)}` }]}]
        });
        summary = await res.response.text();
      } catch {
        summary = null;
      }
    }
    if (!summary) summary = basicSummary(text);

    return new Response(JSON.stringify({ summary }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}


