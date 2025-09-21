// src/app/api/analyze-pdf/route.ts
import { NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const prompt = formData.get('prompt') as string || 'Summarize this PDF and extract key bullet points.';

    if (!file) {
      return new Response(JSON.stringify({ error: 'No PDF file provided' }), { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Dynamic import to avoid build issues with pdf-parse
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(buffer);
    const text = data.text || '';

    if (!text.trim()) {
      return new Response(JSON.stringify({ error: 'Could not extract text from PDF' }), { status: 422 });
    }

    if (!process.env.GEMINI_API_KEY) {
      // Fallback to simple truncation if Gemini is not available
      const summary = text.split('.').slice(0, 5).join('.') + '.';
      return new Response(JSON.stringify({ summary }), { status: 200 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(`${prompt}\n\n---\n\n${text.slice(0, 100000)}`);
    const summary = await result.response.text();

    return new Response(JSON.stringify({ summary }), { status: 200 });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
}