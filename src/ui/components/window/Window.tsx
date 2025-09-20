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
  onClose,
  isActive = false,
  onFocus
}: WindowProps) {
  const [position, setPosition] = useState({ x: initialX, y: initialY });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
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

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  return (
    <div
      ref={windowRef}
      className={`absolute overflow-hidden ${
        isActive ? 'z-50' : 'z-10'
      } ${isDragging
        ? 'cursor-grabbing bg-white/95 border border-white/30 rounded-2xl shadow-lg'
        : 'cursor-default bg-white/90 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl transition-all duration-300 hover:shadow-3xl'
      }`}
      style={{
        left: position.x,
        top: position.y,
        width,
        height,
        boxShadow: isDragging
          ? '0 10px 25px -5px rgba(0, 0, 0, 0.2)'
          : isActive
            ? '0 25px 50px -12px rgba(59, 130, 246, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)'
            : '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        willChange: isDragging ? 'transform' : 'auto'
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Window Header */}
      <div className={`window-header flex items-center justify-between px-4 py-3 text-white cursor-grab select-none ${
        isDragging
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
              isDragging
                ? 'bg-yellow-400'
                : 'bg-gradient-to-br from-yellow-400 to-orange-500 hover:scale-110 transition-transform duration-200'
            }`}
            aria-label="Minimize"
          ></button>
          <button
            className={`w-3 h-3 rounded-full shadow-sm ${
              isDragging
                ? 'bg-green-400'
                : 'bg-gradient-to-br from-green-400 to-emerald-500 hover:scale-110 transition-transform duration-200'
            }`}
            aria-label="Maximize"
          ></button>
          <button
            className={`w-3 h-3 rounded-full shadow-sm ${
              isDragging
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
        isDragging
          ? 'bg-white'
          : 'bg-gradient-to-br from-white/40 to-white/20 backdrop-blur-sm'
      }`} style={{ height: `calc(100% - 48px)` }}>
        {children}
      </div>
    </div>
  );
}