/* eslint-disable @typescript-eslint/no-explicit-any */
import { CerebrasRequest, CerebrasResponse, Tool, CerebrasTool } from './types';

export class CerebrasClient {
  // Client no longer holds API key; all calls go through server route
  constructor(_apiKey?: string) {}

  async createChatCompletion(request: CerebrasRequest): Promise<CerebrasResponse> {
    // Always call our internal API route which adds auth server-side
    let targetUrl = '/api/cerebras-tasks';

    try {
      // Debug: log environment context from worker/main thread
      const isWorkerScope = typeof self !== 'undefined' && (self as unknown as { importScripts?: unknown }).importScripts !== undefined;

      // In worker context, construct absolute URL using worker's location
      if (isWorkerScope) {
        let workerOrigin = 'http://localhost:3000'; // fallback

        try {
          // Try to get the actual origin from the worker's location
          if (typeof location !== 'undefined' && (location as any)?.origin) {
            workerOrigin = (location as any).origin;
          } else if (typeof location !== 'undefined' && location?.href) {
            // Fallback: extract origin from href
            const url = new URL(location.href);
            workerOrigin = url.origin;
          }
        } catch (error) {
          console.warn('[CerebrasClient] Failed to determine worker origin:', error);
        }

        targetUrl = `${workerOrigin}/api/cerebras-tasks`;
      }

      // Avoid leaking secrets; only log safe runtime details
      console.log('[CerebrasClient] createChatCompletion', {
        targetUrl,
        isWorkerScope,
        locationHref: (typeof location !== 'undefined' && location?.href) ? location.href : 'n/a',
        baseHref: (typeof document !== 'undefined' && (document as any)?.baseURI) ? (document as any).baseURI : 'n/a'
      });
    } catch {
      // ignore logging errors
    }

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cerebrasRequest: request })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Internal API error (${response.status}): ${errorText}`);
    }

    return await response.json() as CerebrasResponse;
  }


}
