'use client';

import { useCallback, useEffect } from 'react';
import { eventBus } from '@/lib/eventBus';
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
    <div className="w-full h-full bg-black flex items-center justify-center overflow-hidden">
      <Image
        src={imageUrl}
        alt={imageName}
        layout="fill"
        objectFit="contain"
      />
    </div>
  );
}
