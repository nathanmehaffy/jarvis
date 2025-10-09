import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log('[API] /api/gemini-search POST hit');
    const body = await request.json().catch(() => ({}));
    const { query } = body;

    if (!process.env.GEMINI_API_KEY) {
      // Graceful fallback to keep UI functional without external key
      const fallback = `Search is unavailable (missing GEMINI_API_KEY).\n\n- Query: ${query || '(none)'}\n- To enable, set GEMINI_API_KEY in your environment.`;
      return Response.json({ result: fallback });
    }

    if (!query || typeof query !== 'string') {
      console.error('[API] Missing or invalid query parameter', { query });
      return new Response(JSON.stringify({ error: 'Missing or invalid query parameter' }), { status: 400 });
    }

    console.log('[API] Making Gemini API request', { query });

    const intent = (() => {
      const q = (query as string).toLowerCase();
      if (/example|practice|problem|problems|exercise|exercises|compute|evaluate|solve/.test(q)) return 'examples';
      if (/what is|define|explain|overview|introduction/.test(q)) return 'explain';
      return 'mixed';
    })();

    const prompt = intent === 'examples'
      ? `Return EXACTLY TWO worked examples in GitHub-Flavored Markdown with LaTeX.
Topic: ${query}

Formatting rules (hard requirements):
- Begin immediately with "## Example 1:" followed by the first problem; NO preface text
- Then "## Example 2:"; NO concluding paragraphs
- Use LaTeX for all math (inline $...$, display $$...$$)
- Keep steps compact; include the final answer clearly
- Use proper LaTeX for matrices (\\begin{bmatrix} ... \\end{bmatrix}) when needed
`
      : `Provide a concise explanation in GitHub-Flavored Markdown with LaTeX for: ${query}

Requirements:
- Use headings and bullet points where helpful
- Use LaTeX for all equations (inline $...$, display $$...$$)
- For matrices/vectors, use LaTeX environments (e.g., \\begin{bmatrix} ... \\end{bmatrix})
- If user intent implies examples, include 1-2 short ones; otherwise focus on explanation
`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
        systemInstruction: {
          parts: [{
            text: 'You are a helpful AI assistant providing factual, well-researched responses. When providing information, cite sources when possible and maintain objectivity.'
          }]
        },
        tools: [{
          googleSearchRetrieval: {
            dynamicRetrievalConfig: {
              mode: "MODE_DYNAMIC",
              dynamicThreshold: 0.7
            }
          }
        }]
      })
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[API] Gemini API error', { status: response.status, statusText: response.statusText, detail: text });
      return new Response(JSON.stringify({ error: `Gemini API error: ${response.status} ${response.statusText}`, detail: text }), { status: 502 });
    }

    const data = await response.json();
    console.log('[API] Gemini API response received', { hasData: !!data });

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      console.error('[API] Invalid response format from Gemini API', { data });
      return new Response(JSON.stringify({ error: 'Invalid response format from Gemini API' }), { status: 502 });
    }

    let text = data.candidates[0].content.parts?.[0]?.text as string | undefined;
    if (!text) {
      console.error('[API] Empty response from Gemini API', { data });
      return new Response(JSON.stringify({ error: 'Empty response from Gemini API' }), { status: 502 });
    }

    // Post-process: convert common HTML tags to Markdown/LaTeX just in case
    const toLatexMarkdown = (input: string): string => {
      let s = input;
      // Remove placeholder comments
      s = s.replace(/<!--\s*Placeholder[^>]*-->/gi, '');
      // Basic HTML -> Markdown
      s = s.replace(/<strong>([\s\S]*?)<\/strong>/gi, '**$1**');
      s = s.replace(/<b>([\s\S]*?)<\/b>/gi, '**$1**');
      s = s.replace(/<em>([\s\S]*?)<\/em>/gi, '*$1*');
      s = s.replace(/<i>([\s\S]*?)<\/i>/gi, '*$1*');
      // Sub/Sup -> LaTeX
      s = s.replace(/<sub>([\s\S]*?)<\/sub>/gi, '_{$1}');
      s = s.replace(/<sup>([\s\S]*?)<\/sup>/gi, '^{$1}');
      // Common math symbols
      s = s.replace(/∫/g, '\\int ');
      s = s.replace(/∞/g, '\\infty ');
      s = s.replace(/±/g, '\\pm ');
      // Matrix HTML fallbacks to LaTeX bmatrix if present
      s = s.replace(/<table[\s\S]*?<\/table>/gi, (match) => {
        try {
          const rows = Array.from(match.matchAll(/<tr[\s\S]*?<\/tr>/gi)).map(r => r[0]);
          const cells = rows.map(r => Array.from(r.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)).map(c => c[1].trim()));
          const latexRows = cells.map(r => r.join(' & ')).join(' \\\n');
          return `\n\n$$\\begin{bmatrix}\n${latexRows}\n\\end{bmatrix}$$\n\n`;
        } catch {
          return match;
        }
      });
      // Collapse accidental double spaces (but preserve newlines)
      s = s.replace(/[ \t]{2,}/g, ' ');
      // Normalize excessive blank lines to at most one empty line
      s = s.replace(/\n{3,}/g, '\n\n');
      return s;
    };

    text = toLatexMarkdown(text);

    // If examples were requested, strip any preface before the first Example 1 heading
    if (intent === 'examples') {
      const startIdx = text.search(/(^|\n)\s*(##\s*Example\s*1\b|\*\*Example\s*1\*\*|Example\s*1\s*:)/i);
      if (startIdx > 0) {
        text = text.slice(startIdx).trimStart();
      }
      // Ensure it does not end with extra meta commentary
      // If there is text after Example 2 block separated by "---" or lines like "Notes:", drop it
      const endIdx = text.search(/\n\s*#+\s*(References|Notes|Further Reading)\b/i);
      if (endIdx > 0) {
        text = text.slice(0, endIdx).trimEnd();
      }
    }

    console.log('[API] /api/gemini-search success', { responseLength: text.length });
    return Response.json({ result: text });
  } catch (error) {
    console.error('[API] /api/gemini-search error', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { status: 500 });
  }
}
