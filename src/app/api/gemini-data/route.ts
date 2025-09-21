import { NextRequest } from 'next/server';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const useGemini = Boolean(process.env.GEMINI_API_KEY);
  if (!useGemini) {
    return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), { status: 500 });
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
  const model: GenerativeModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  try {
    const body = await request.json();
    const { type, query, location, symbol } = body;

    let prompt = '';
    let responseFormat = '';

    // Exponential backoff helper (reuse from web-search)
    const fetchWithBackoff = async (requestFn: () => Promise<any>, maxRetries = 3): Promise<any> => {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          return await requestFn();
        } catch (e: any) {
          if (e?.message?.includes('429') && attempt < maxRetries - 1) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
            console.log(`[API/gemini-data] Rate limited, retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          throw e;
        }
      }
    };

    switch (type) {
      case 'weather':
        prompt = `Get current weather information for ${location}. Use Google Search to find the most up-to-date weather data.

Requirements:
- Current temperature, conditions, humidity, wind speed
- Today's high/low temperatures
- Brief forecast for today
- Use metric units (Celsius)

Return JSON exactly in this format:
{
  "location": "${location}",
  "current": {
    "temperature": number,
    "condition": "string",
    "humidity": number,
    "windSpeed": number,
    "description": "string"
  },
  "today": {
    "high": number,
    "low": number,
    "forecast": "string"
  }
}`;
        break;

      case 'news':
        prompt = `Search for recent news articles about "${query}". Use Google Search to find the latest news from reputable sources.

Requirements:
- Find 5 recent news articles (within last 24-48 hours if possible)
- Include title, source, brief summary, and URL
- Prefer established news sources (CNN, BBC, Reuters, AP, etc.)

Return JSON exactly in this format:
{
  "query": "${query}",
  "articles": [
    {
      "title": "string",
      "source": "string",
      "summary": "string",
      "url": "string",
      "publishedAt": "string"
    }
  ]
}`;
        break;

      case 'stocks':
        prompt = `Get current stock information for ${symbol}. Use Google Search to find the most recent stock data.

Requirements:
- Current stock price
- Day's change (amount and percentage)
- Day's high/low
- Market cap if available
- Brief analysis or recent news if relevant

Return JSON exactly in this format:
{
  "symbol": "${symbol}",
  "price": number,
  "change": number,
  "changePercent": number,
  "dayHigh": number,
  "dayLow": number,
  "marketCap": "string",
  "analysis": "string"
}`;
        break;

      default:
        return new Response(JSON.stringify({ error: 'Invalid data type. Use: weather, news, or stocks' }), { status: 400 });
    }

    // Try Gemini with Google Search grounding
    let text: string | null = null;
    try {
      const res: any = await fetchWithBackoff(async () => {
        return await (model as any).generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }]}],
          tools: [{ googleSearchRetrieval: {} }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 2048 }
        });
      });
      text = await res.response.text();
      console.log(`[API/gemini-data] Gemini grounding successful for ${type}`);
    } catch (e) {
      console.warn(`[API/gemini-data] Gemini grounding failed for ${type}:`, e instanceof Error ? e.message : String(e));
      try {
        const res: any = await fetchWithBackoff(async () => {
          return await (model as any).generateContent(prompt);
        });
        text = await res.response.text();
      } catch (e2) {
        console.error(`[API/gemini-data] All Gemini attempts failed for ${type}:`, e2 instanceof Error ? e2.message : String(e2));
        throw e2;
      }
    }

    // Parse JSON response
    const tryParse = (raw: string | null) => {
      if (!raw) return null;
      let s = raw.trim();
      // Strip markdown fences if present
      if (s.startsWith('```')) {
        const idx = s.indexOf('\n');
        if (idx !== -1) s = s.slice(idx + 1);
        if (s.endsWith('```')) s = s.slice(0, -3);
      }
      // Extract first JSON object if extra text around
      const m = s.match(/\{[\s\S]*\}/);
      if (m) s = m[0];
      return JSON.parse(s);
    };

    try {
      const data = tryParse(text);
      return Response.json({ data });
    } catch (e) {
      console.warn(`[API/gemini-data] JSON parse failed for ${type}, returning raw text`);
      return Response.json({ 
        data: { 
          type, 
          rawResponse: text,
          error: 'Failed to parse structured response' 
        } 
      });
    }

  } catch (error) {
    console.error(`[API/gemini-data] ${type} fetch failed:`, error);
    return new Response(JSON.stringify({ 
      error: `${type} fetch failed: ${error instanceof Error ? error.message : String(error)}` 
    }), { status: 500 });
  }
}
