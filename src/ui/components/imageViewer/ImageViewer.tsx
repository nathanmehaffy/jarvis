'use client';

import { useEffect } from 'react';
import { imageDescriptionService } from '@/ai/imageDescriptionService';

import Image from 'next/image';

interface ImageViewerProps {
  imageUrl: string;
  imageName: string;
  windowId: string;
}

export function ImageViewer({ imageUrl, imageName, windowId }: ImageViewerProps) {
  // Trigger background description generation when component mounts
  useEffect(() => {
    if (imageUrl) {
      imageDescriptionService.preloadDescription(imageUrl, imageName);
    }
  }, [imageUrl, imageName]);

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
      <Image
        src={imageUrl}
        alt={imageName}
        fill
        sizes="100vw"
        className="object-contain"
        // Avoid optimizer for data URLs to prevent unnecessary processing
        unoptimized={typeof imageUrl === 'string' && imageUrl.startsWith('data:')}
      />
    </div>
  );
}
