'use client';

import { useState, useRef } from 'react';

interface ImageDropZoneProps {
  onImageUpload: (imageUrl: string, imageName: string) => void;
  onMultipleImageUpload?: (images: { url: string; name: string }[]) => void;
}

export function ImageDropZone({ onImageUpload, onMultipleImageUpload }: ImageDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length > 0) {
      if (imageFiles.length === 1) {
        handleImageFile(imageFiles[0]);
      } else {
        handleMultipleImageFiles(imageFiles);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length > 0) {
      if (imageFiles.length === 1) {
        handleImageFile(imageFiles[0]);
      } else {
        handleMultipleImageFiles(imageFiles);
      }
    }
  };

  const handleImageFile = (file: File) => {
    setIsUploading(true);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const imageUrl = event.target?.result as string;
      onImageUpload(imageUrl, file.name);
      setIsUploading(false);
    };
    reader.onerror = () => {
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleMultipleImageFiles = (files: File[]) => {
    setIsUploading(true);
    
    const imagePromises = files.map(file => {
      return new Promise<{ url: string; name: string }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const imageUrl = event.target?.result as string;
          resolve({ url: imageUrl, name: file.name });
        };
        reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
        reader.readAsDataURL(file);
      });
    });

    Promise.all(imagePromises)
      .then(images => {
        if (onMultipleImageUpload) {
          onMultipleImageUpload(images);
        } else {
          // Fallback to single image upload for each image
          images.forEach(image => onImageUpload(image.url, image.name));
        }
        setIsUploading(false);
      })
      .catch(error => {
        console.error('Error processing multiple images:', error);
        setIsUploading(false);
      });
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      className={`
        relative w-16 h-16 border-2 border-dashed rounded-full transition-all duration-300 cursor-pointer
        flex items-center justify-center
        ${isDragOver 
          ? 'border-blue-400 bg-blue-500/20 scale-105' 
          : 'border-white/30 hover:border-white/50 hover:bg-white/5'
        }
        ${isUploading ? 'opacity-50 pointer-events-none' : ''}
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />
      
      <div className="absolute inset-0 flex flex-col items-center justify-center p-2">
        {isUploading ? (
          <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
        ) : (
          <svg 
            className="w-8 h-8 text-white/70" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 4v16m8-8H4" 
            />
          </svg>
        )}
      </div>
    </div>
  );
}
