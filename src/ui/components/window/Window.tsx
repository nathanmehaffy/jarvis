'use client';

import { useState, useRef, useEffect } from 'react';
import { WindowProps } from './window.types';

export function Window({
  id,
  title,
  children,
  initialX = 100,
  initialY = 100,
  width = 400,
  height = 300,
  minWidth = 200,
  minHeight = 150,
  maxWidth = 1200,
  maxHeight = 800,
  onClose,
  isActive = false,
  onFocus,
  onResize
}: WindowProps) {
  const [position, setPosition] = useState({ x: initialX, y: initialY });
  const [size, setSize] = useState({ width, height });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<string>('');
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, startX: 0, startY: 0 });
  const windowRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.window-header')) {
      onFocus?.();
      setIsDragging(true);
      const rect = windowRef.current?.getBoundingClientRect();
      if (rect) {
        setDragOffset({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        });
      }
    }
  };

  const handleResizeStart = (e: React.MouseEvent, direction: string) => {
    e.preventDefault();
    e.stopPropagation();
    onFocus?.();
    setIsResizing(true);
    setResizeDirection(direction);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
      startX: position.x,
      startY: position.y
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        });
      } else if (isResizing) {
        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;

        let newWidth = resizeStart.width;
        let newHeight = resizeStart.height;
        let newX = resizeStart.startX;
        let newY = resizeStart.startY;

        // Handle width changes
        if (resizeDirection.includes('right')) {
          newWidth = Math.max(minWidth, Math.min(maxWidth, resizeStart.width + deltaX));
        }
        if (resizeDirection.includes('left')) {
          const proposedWidth = resizeStart.width - deltaX;
          newWidth = Math.max(minWidth, Math.min(maxWidth, proposedWidth));
          newX = resizeStart.startX + (resizeStart.width - newWidth);
        }

        // Handle height changes
        if (resizeDirection.includes('bottom')) {
          newHeight = Math.max(minHeight, Math.min(maxHeight, resizeStart.height + deltaY));
        }
        if (resizeDirection.includes('top')) {
          const proposedHeight = resizeStart.height - deltaY;
          newHeight = Math.max(minHeight, Math.min(maxHeight, proposedHeight));
          newY = resizeStart.startY + (resizeStart.height - newHeight);
        }

        setSize({ width: newWidth, height: newHeight });
        setPosition({ x: newX, y: newY });
        onResize?.(newWidth, newHeight);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      setResizeDirection('');
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragOffset, resizeStart, resizeDirection, minWidth, minHeight, maxWidth, maxHeight, onResize]);

  return (
    <div
      ref={windowRef}
      className={`absolute overflow-hidden ${
        isActive ? 'z-50' : 'z-10'
      } ${isDragging || isResizing
        ? 'cursor-grabbing bg-white/95 border border-white/30 rounded-2xl shadow-lg'
        : 'cursor-default bg-white/90 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl transition-all duration-300 hover:shadow-3xl'
      }`}
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        boxShadow: isDragging || isResizing
          ? '0 10px 25px -5px rgba(0, 0, 0, 0.2)'
          : isActive
            ? '0 25px 50px -12px rgba(59, 130, 246, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)'
            : '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        willChange: isDragging || isResizing ? 'transform' : 'auto'
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Window Header */}
      <div className={`window-header flex items-center justify-between px-4 py-3 text-white cursor-grab select-none ${
        isDragging || isResizing
          ? 'bg-gray-600'
          : `transition-all duration-300 ${
              isActive
                ? 'bg-gradient-to-r from-blue-500/80 to-purple-600/80'
                : 'bg-gradient-to-r from-gray-400/60 to-gray-500/60'
            } backdrop-blur-sm`
      }`}>
        <span className="font-semibold text-sm tracking-wide">{title}</span>
        <div className="flex space-x-2">
          <button
            className={`w-3 h-3 rounded-full shadow-sm ${
              isDragging || isResizing
                ? 'bg-red-400'
                : 'bg-gradient-to-br from-red-400 to-red-600 hover:scale-110 transition-transform duration-200'
            }`}
            onClick={onClose}
            aria-label="Close"
          ></button>
        </div>
      </div>

      {/* Window Content */}
      <div className={`p-6 h-full overflow-auto ${
        isDragging || isResizing
          ? 'bg-white'
          : 'bg-gradient-to-br from-white/40 to-white/20 backdrop-blur-sm'
      }`} style={{ height: `calc(100% - 48px)` }}>
        {children}
      </div>

      {/* Resize Handles */}
      {!isDragging && !isResizing && (
        <>
          {/* Corner handles */}
          <div
            className="absolute top-0 left-0 w-3 h-3 cursor-nw-resize opacity-0 hover:opacity-100 transition-opacity"
            onMouseDown={(e) => handleResizeStart(e, 'top-left')}
          />
          <div
            className="absolute top-0 right-0 w-3 h-3 cursor-ne-resize opacity-0 hover:opacity-100 transition-opacity"
            onMouseDown={(e) => handleResizeStart(e, 'top-right')}
          />
          <div
            className="absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize opacity-0 hover:opacity-100 transition-opacity"
            onMouseDown={(e) => handleResizeStart(e, 'bottom-left')}
          />
          <div
            className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize opacity-0 hover:opacity-100 transition-opacity bg-gray-400/50 rounded-tl-lg"
            onMouseDown={(e) => handleResizeStart(e, 'bottom-right')}
          />

          {/* Edge handles */}
          <div
            className="absolute top-0 left-3 right-3 h-1 cursor-n-resize opacity-0 hover:opacity-100 transition-opacity"
            onMouseDown={(e) => handleResizeStart(e, 'top')}
          />
          <div
            className="absolute bottom-0 left-3 right-3 h-1 cursor-s-resize opacity-0 hover:opacity-100 transition-opacity"
            onMouseDown={(e) => handleResizeStart(e, 'bottom')}
          />
          <div
            className="absolute left-0 top-3 bottom-3 w-1 cursor-w-resize opacity-0 hover:opacity-100 transition-opacity"
            onMouseDown={(e) => handleResizeStart(e, 'left')}
          />
          <div
            className="absolute right-0 top-3 bottom-3 w-1 cursor-e-resize opacity-0 hover:opacity-100 transition-opacity"
            onMouseDown={(e) => handleResizeStart(e, 'right')}
          />
        </>
      )}
    </div>
  );
}