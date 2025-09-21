interface ImageDescriptionCache {
  [imageUrl: string]: {
    description: string;
    timestamp: number;
    expires: number;
  };
}

export class ImageDescriptionService {
  private cache: ImageDescriptionCache = {};
  private readonly cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
  private pendingRequests = new Map<string, Promise<string>>();

  constructor() {
    // Clean expired cache entries every hour
    setInterval(() => this.cleanExpiredCache(), 60 * 60 * 1000);
  }

  async getImageDescription(imageUrl: string, imageName?: string): Promise<string> {
    try {
      // Check cache first
      const cached = this.cache[imageUrl];
      if (cached && cached.expires > Date.now()) {
        console.log('📸 [ImageDescriptionService] Returning cached description for', imageUrl);
        return cached.description;
      }

      // Check if request is already pending
      const pendingRequest = this.pendingRequests.get(imageUrl);
      if (pendingRequest) {
        console.log('📸 [ImageDescriptionService] Waiting for pending request for', imageUrl);
        return await pendingRequest;
      }

      // Create new request
      const requestPromise = this.generateDescription(imageUrl, imageName);
      this.pendingRequests.set(imageUrl, requestPromise);

      try {
        const description = await requestPromise;

        // Cache the result
        this.cache[imageUrl] = {
          description,
          timestamp: Date.now(),
          expires: Date.now() + this.cacheExpiry
        };

        return description;
      } finally {
        this.pendingRequests.delete(imageUrl);
      }
    } catch (error) {
      console.error('❌ [ImageDescriptionService] Failed to get description for', imageUrl, error);
      return `[Image: ${imageName || 'Untitled image'}]`;
    }
  }

  private async generateDescription(imageUrl: string, imageName?: string): Promise<string> {
    console.log('🤖 [ImageDescriptionService] Generating description for', imageUrl);

    try {
      const response = await fetch('/api/describe-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl,
          prompt: 'Describe this image in 1-2 sentences, focusing on the main subject and key details that would be useful for AI context.'
        })
      });

      if (!response.ok) {
        throw new Error(`API responded with status ${response.status}`);
      }

      const data = await response.json();

      if (!data.description || typeof data.description !== 'string') {
        throw new Error('Invalid response format from describe-image API');
      }

      const description = data.description.trim();
      console.log('✅ [ImageDescriptionService] Generated description:', description);

      return `[Image: ${imageName || 'Untitled'}] ${description}`;
    } catch (error) {
      console.error('❌ [ImageDescriptionService] Failed to generate description:', error);
      // Fallback to basic description
      return `[Image: ${imageName || 'Untitled image'}]`;
    }
  }

  private cleanExpiredCache(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [url, entry] of Object.entries(this.cache)) {
      if (entry.expires < now) {
        delete this.cache[url];
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log('🧹 [ImageDescriptionService] Cleaned', cleanedCount, 'expired cache entries');
    }
  }

  // Method to pre-generate descriptions for images (can be called when image windows are created)
  async preloadDescription(imageUrl: string, imageName?: string): Promise<void> {
    // Fire and forget - just start the description generation process
    this.getImageDescription(imageUrl, imageName).catch(() => {
      // Ignore errors in preload
    });
  }

  // Get cached description only (doesn't trigger generation)
  getCachedDescription(imageUrl: string): string | null {
    const cached = this.cache[imageUrl];
    if (cached && cached.expires > Date.now()) {
      return cached.description;
    }
    return null;
  }
}

export const imageDescriptionService = new ImageDescriptionService();