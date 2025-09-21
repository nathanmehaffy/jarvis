'use client';

import { useCallback } from 'react';
import { eventBus } from '@/lib/eventBus';

import Image from 'next/image';

interface ImageViewerProps {
  imageUrl: string;
  imageName: string;
  windowId: string;
}

export function ImageViewer({ imageUrl, imageName, windowId }: ImageViewerProps) {
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
