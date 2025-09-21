'use client';

import { useState, useEffect, useRef } from 'react';
import { eventBus } from '@/lib/eventBus';
import { SystemOutputState, SystemOutputProps } from './systemOutput.types';
import { MarkdownText } from '../markdownText';

export function SystemOutput({
  placeholder = 'System messages will appear here...'
}: SystemOutputProps) {
  const [notes, setNotes] = useState<SystemOutputState>({
    content: '',
    lastModified: new Date()
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const unsubscribers = [
      eventBus.on('input:input_processed', (data) => {
        addToNotes(`Input processed: ${JSON.stringify(data)}\n`);
      }),
      eventBus.on('ai:ai_response_generated', (data) => {
        addToNotes(`AI response: ${JSON.stringify(data)}\n`);
      }),
      eventBus.on('input:initialized', () => {
        addToNotes('Input manager initialized successfully\n');
      }),
      eventBus.on('ai:initialized', () => {
        addToNotes('AI manager initialized successfully\n');
      }),
      eventBus.on('ui:log', (data: { message: string }) => {
        addToNotes(`${data.message}\n`);
      }),
      eventBus.on('system:output', (data: { text: string }) => {
        addToNotes(data.text);
      })
    ];

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, []);

  const addToNotes = (text: string) => {
    setNotes(prev => ({
      content: prev.content + text,
      lastModified: new Date()
    }));
  };

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
          <div className="w-4 h-4 bg-gradient-to-br from-green-400 to-emerald-500 rounded flex items-center justify-center">
            <span className="text-white text-xs">🖥️</span>
          </div>
          <h3 className="text-xs font-semibold text-gray-100">System</h3>
        </div>
      </div>

      {/* Notes Area - absolute maximum space with markdown support */}
      <div className="flex-1 px-2 py-2 overflow-y-auto">
        {notes.content ? (
          <MarkdownText className="text-sm leading-relaxed">
            {notes.content}
          </MarkdownText>
        ) : (
          <div className="text-cyan-400/60 text-sm italic">
            {placeholder}
          </div>
        )}
      </div>

      {/* Footer - absolute minimal */}
      <div className="border-t border-gray-600/30 bg-gray-800/30 px-2 py-0.5 text-xs text-gray-400 flex justify-between">
        <span>{notes.content.split(/\s+/).filter(word => word.length > 0).length}w</span>
        <span>{notes.content.length}c</span>
      </div>
    </div>
  );
}