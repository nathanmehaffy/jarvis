export class GeminiClient {
  constructor() {
    // No API key needed here since we're using the server-side API route
  }

  async generateResponse(query: string): Promise<string> {
    try {
      console.log('🔗 [GeminiClient] Making request to API route', { query });

      // In a Web Worker, we need to use an absolute URL
      let baseUrl: string;
      try {
        // Prefer an explicit base origin injected by the main thread (typed safely)
        const g = globalThis as unknown as { __BASE_ORIGIN__?: string };
        const injected = typeof g.__BASE_ORIGIN__ === 'string' ? g.__BASE_ORIGIN__ : '';
        if (injected) {
          baseUrl = injected;
        } else if (typeof location !== 'undefined' && typeof location.origin === 'string') {
          // Try to get the origin from the global location (works in workers and windows)
          baseUrl = location.origin;
        } else {
          // Fallback to localhost for development
          baseUrl = 'http://localhost:3000';
        }
      } catch {
        // Fallback if location access fails
        baseUrl = 'http://localhost:3000';
      }

      const apiUrl = `${baseUrl}/api/gemini-search`;
      console.log('🌐 [GeminiClient] Using API URL', { apiUrl, baseUrl });

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query })
      });

      console.log('📡 [GeminiClient] API route response received', {
        status: response.status,
        ok: response.ok
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ [GeminiClient] API route error', {
          status: response.status,
          errorData
        });
        throw new Error(`API error: ${response.status} - ${errorData.error || 'Unknown error'}`);
      }

      const data = await response.json();
      console.log('✅ [GeminiClient] API route success', {
        hasResult: !!data.result,
        resultLength: data.result?.length
      });

      if (!data.result) {
        throw new Error('No result in API response');
      }

      return data.result;
    } catch (error) {
      console.error('❌ [GeminiClient] generateResponse failed:', error);
      throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const geminiClient = new GeminiClient();
