'use client';
import { useEffect, useState } from 'react';

export function WebView({ url }: { url: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useProxy, setUseProxy] = useState(true);

  const effectiveUrl = useProxy ? `/api/proxy-page?url=${encodeURIComponent(url)}` : url;

  const handleIframeLoad = () => {
    setLoading(false);
    setError(null);
  };

  const handleIframeError = () => {
    setLoading(false);
    if (useProxy) {
      // If proxy failed, try direct URL
      setUseProxy(false);
      setError(null);
    } else {
      setError('Failed to load webpage');
    }
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    setUseProxy(true);
  }, [url]);

  return (
    <div className="w-full h-full relative bg-white">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white">
          <div className="text-gray-600">Loading webpage...</div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white p-4">
          <div className="text-red-600 mb-2">Failed to load webpage</div>
          <div className="text-sm text-gray-500 mb-4">URL: {url}</div>
          <button
            onClick={() => window.open(url, '_blank')}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Open in New Tab
          </button>
        </div>
      )}
      <iframe
        src={effectiveUrl}
        className="w-full h-full border-0 bg-white"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation"
        referrerPolicy="no-referrer"
        onLoad={handleIframeLoad}
        onError={handleIframeError}
        style={{ display: (loading || error) ? 'none' : 'block' }}
      />
    </div>
  );
}