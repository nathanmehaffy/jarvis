'use client';

import { useState, useRef } from 'react';
import { UserNotesState, UserNotesProps } from './userNotes.types';

export function UserNotes({
  placeholder = 'Start typing your personal notes here...'
}: UserNotesProps) {
  const [notes, setNotes] = useState<UserNotesState>({
    content: '',
    lastModified: new Date()
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNotes({
      content: e.target.value,
      lastModified: new Date()
    });
  };

  const clearNotes = () => {
    setNotes({
      content: '',
      lastModified: new Date()
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-lg flex items-center justify-center shadow-md">
            <span className="text-white text-lg">✏️</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Personal Notes</h3>
            <p className="text-xs text-gray-500">
              Last modified: {notes.lastModified.toLocaleTimeString()}
            </p>
          </div>
        </div>

        <button
          onClick={clearNotes}
          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
        >
          Clear All
        </button>
      </div>

      {/* Notes Area */}
      <div className="flex-1 p-4">
        <textarea
          ref={textareaRef}
          value={notes.content}
          onChange={handleContentChange}
          placeholder={placeholder}
          className="w-full h-full resize-none border-none outline-none bg-transparent text-gray-800 leading-relaxed text-sm"
          style={{
            fontFamily: 'system-ui, -apple-system, sans-serif',
            lineHeight: '1.6'
          }}
        />
      </div>

      {/* Footer */}
      <div className="border-t bg-gray-50 px-4 py-2 text-xs text-gray-500 flex justify-between">
        <span>
          {notes.content.split(/\s+/).filter(word => word.length > 0).length} words
        </span>
        <span>
          {notes.content.length} characters
        </span>
      </div>
    </div>
  );
}