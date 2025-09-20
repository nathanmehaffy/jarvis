'use client';

import { useState } from 'react';

interface ImageViewerProps {
  imageUrl: string;
  imageName?: string;
}

export function ImageViewer({ imageUrl, imageName }: ImageViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = imageName || 'image';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="h-full w-full bg-black relative">
      <img
        src={imageUrl}
        alt={imageName || 'Uploaded image'}
        className="w-full h-full object-contain"
      />
      
      {/* Floating controls */}
      <div className="absolute top-4 right-4 flex space-x-2 z-10">
        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="px-3 py-1 bg-blue-600/80 hover:bg-blue-700/80 backdrop-blur-sm rounded text-sm transition-colors text-white"
        >
          {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        </button>
        <button
          onClick={handleDownload}
          className="px-3 py-1 bg-green-600/80 hover:bg-green-700/80 backdrop-blur-sm rounded text-sm transition-colors text-white"
        >
          Download
        </button>
      </div>
      
      {/* Fullscreen overlay */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
          <img
            src={imageUrl}
            alt={imageName || 'Uploaded image'}
            className="max-w-full max-h-full object-contain"
          />
          <button
            onClick={() => setIsFullscreen(false)}
            className="absolute top-4 right-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition-colors"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
