'use client';

import { useState, useRef, useEffect } from 'react';
import { UserNotesState, UserNotesProps } from './userNotes.types';
import { eventBus } from '@/lib/eventBus';

export function UserNotes({
  placeholder = 'Start typing your personal notes here...',
  windowId
}: UserNotesProps) {
  const [notes, setNotes] = useState<UserNotesState>({
    content: '',
    lastModified: new Date()
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setNotes({
      content: newContent,
      lastModified: new Date()
    });

    // Emit content change for similarity analysis
    if (windowId) {
      eventBus.emit('window:content_changed', {
        windowId,
        content: newContent,
        title: 'New Note'
      });
    }
  };

  // Initial content setup
  useEffect(() => {
    if (windowId && notes.content) {
      eventBus.emit('window:content_changed', {
        windowId,
        content: notes.content,
        title: 'New Note'
      });
    }
  }, [windowId, notes.content]);

  const clearNotes = () => {
    setNotes({
      content: '',
      lastModified: new Date()
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header - ultra minimal */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-gray-600/30 bg-gray-800/50">
        <div className="flex items-center space-x-1">
          <div className="w-4 h-4 bg-gradient-to-br from-blue-400 to-indigo-500 rounded flex items-center justify-center">
            <span className="text-white text-xs">✏️</span>
          </div>
          <h3 className="text-xs font-semibold text-gray-100">Notes</h3>
        </div>
        <button
          onClick={clearNotes}
          className="px-1 py-0.5 text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 rounded"
        >
          Clear
        </button>
      </div>

      {/* Notes Area - absolute maximum space */}
      <div className="flex-1 px-1 py-1">
        <textarea
          ref={textareaRef}
          value={notes.content}
          onChange={handleContentChange}
          placeholder={placeholder}
          className="w-full h-full resize-none border-none outline-none bg-transparent text-cyan-200 leading-relaxed text-sm placeholder-cyan-400/60"
          style={{
            fontFamily: 'system-ui, -apple-system, sans-serif',
            lineHeight: '1.6'
          }}
        />
      </div>

      {/* Footer - absolute minimal */}
      <div className="border-t border-gray-600/30 bg-gray-800/30 px-2 py-0.5 text-xs text-gray-400 flex justify-between">
        <span>{notes.content.split(/\s+/).filter(word => word.length > 0).length}w</span>
        <span>{notes.content.length}c</span>
      </div>
    </div>
  );
}