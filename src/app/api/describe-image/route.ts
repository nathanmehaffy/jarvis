import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('[API] /api/describe-image POST hit');
    const body = await request.json().catch(() => ({}));
    const { image, mimeType, imageUrl, prompt } = body;

    if (!process.env.GEMINI_API_KEY) {
      console.error('[API] Missing GEMINI_API_KEY environment variable');
      return new Response(JSON.stringify({ error: 'Missing GEMINI_API_KEY' }), { status: 500 });
    }

    let imageData: string;
    let imageMimeType: string;

    // Handle both direct base64 image data and image URLs
    if (image && mimeType) {
      // Direct base64 image data
      imageData = image;
      imageMimeType = mimeType;
    } else if (imageUrl && typeof imageUrl === 'string') {
      // Fetch image from URL and convert to base64
      console.log('[API] Fetching image from URL:', imageUrl);

      try {
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch image: ${imageResponse.status}`);
        }

        const buffer = await imageResponse.arrayBuffer();
        imageData = Buffer.from(buffer).toString('base64');

        // Infer MIME type from Content-Type header or URL extension
        imageMimeType = imageResponse.headers.get('content-type') || 'image/jpeg';

        // Fallback MIME type inference from URL extension
        if (imageMimeType === 'application/octet-stream' || !imageMimeType.startsWith('image/')) {
          const urlLower = imageUrl.toLowerCase();
          if (urlLower.includes('.png')) imageMimeType = 'image/png';
          else if (urlLower.includes('.jpg') || urlLower.includes('.jpeg')) imageMimeType = 'image/jpeg';
          else if (urlLower.includes('.gif')) imageMimeType = 'image/gif';
          else if (urlLower.includes('.webp')) imageMimeType = 'image/webp';
          else imageMimeType = 'image/jpeg'; // default fallback
        }
      } catch (fetchError) {
        console.error('[API] Failed to fetch image from URL:', fetchError);
        return new Response(JSON.stringify({ error: 'Failed to fetch image from URL' }), { status: 400 });
      }
    } else {
      console.error('[API] Missing required parameters. Need either (image + mimeType) or imageUrl', {
        hasImage: !!image,
        hasMimeType: !!mimeType,
        hasImageUrl: !!imageUrl
      });
      return new Response(JSON.stringify({ error: 'Missing required parameters. Need either (image + mimeType) or imageUrl' }), { status: 400 });
    }

    console.log('[API] Making Gemini API request for image description');

    const finalPrompt = typeof prompt === 'string' ? prompt : "Describe this image in detail. What is it, what is happening, and what are the key objects or elements?";

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: finalPrompt },
            {
              inline_data: {
                mime_type: imageMimeType,
                data: imageData
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 1024,
        },
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

    const text = data.candidates[0].content.parts?.[0]?.text;
    if (!text) {
      console.error('[API] Empty response from Gemini API', { data });
      return new Response(JSON.stringify({ error: 'Empty response from Gemini API' }), { status: 502 });
    }

    console.log('[API] /api/describe-image success', { responseLength: text.length });
    return Response.json({ description: text });
  } catch (error) {
    console.error('[API] /api/describe-image error', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { status: 500 });
  }
}
