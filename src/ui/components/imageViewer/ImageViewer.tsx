'use client';

import { useCallback } from 'react';
import { eventBus } from '@/lib/eventBus';

interface ImageViewerProps {
  imageUrl: string;
  imageName?: string;
  windowId?: string;
}

export function ImageViewer({ imageUrl, imageName, windowId }: ImageViewerProps) {
  const handleClose = useCallback(() => {
    if (windowId) {
      eventBus.emit('ui:close_window', { windowId });
    }
  }, [windowId]);


  return (
    <div className="h-full w-full relative">
      <img
        src={imageUrl}
        alt={imageName || 'Uploaded image'}
        className="w-full h-full object-fill"
        draggable={false}
      />
    </div>
  );
}
