'use client';

import React, { useState, useRef, useEffect } from 'react';
import { eventBus } from '@/lib/eventBus';

interface BottomChatInputProps {
  isVisible: boolean;
  onClose: () => void;
}

export function BottomChatInput({ isVisible, onClose }: BottomChatInputProps) {
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isVisible && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isVisible]);

  useEffect(() => {
    // Listen for AI processing states
    const unsubscribeProcessing = eventBus.on('ai:processing', () => {
      setIsProcessing(true);
    });

    const unsubscribeComplete = eventBus.on('ai:text_command_processed', () => {
      setIsProcessing(false);
    });

    const unsubscribeResponse = eventBus.on('ai:ai_conversational_response', () => {
      setIsProcessing(false);
    });

    return () => {
      unsubscribeProcessing();
      unsubscribeComplete();
      unsubscribeResponse();
    };
  }, []);

  const handleSend = () => {
    if (!inputText.trim() || isProcessing) return;

    // Emit user input for bottom notifications
    eventBus.emit('chat:user_input', {
      text: inputText.trim()
    });

    setInputText('');
    setIsProcessing(true);

    // Close the input after a delay
    setTimeout(() => {
      onClose();
    }, 500);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-2xl px-4">
      <div
        className="bg-black/60 backdrop-blur-xl border-2 border-cyan-400/50 rounded-xl p-4 shadow-2xl"
        style={{
          background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.1), rgba(59, 130, 246, 0.1))',
          boxShadow: `
            0 0 20px rgba(34, 211, 238, 0.4),
            0 0 40px rgba(34, 211, 238, 0.2),
            inset 0 0 20px rgba(34, 211, 238, 0.1),
            0 4px 6px rgba(0, 0, 0, 0.3)
          `
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse"></div>
            <span className="text-cyan-100 text-sm font-semibold">Quick Chat with Jarvis</span>
          </div>
          <button
            onClick={onClose}
            className="text-cyan-200/70 hover:text-cyan-200 transition-colors p-1 hover:bg-cyan-400/10 rounded-full"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask Jarvis anything..."
            className="flex-1 px-3 py-2 bg-black/40 border border-cyan-400/30 rounded-lg text-cyan-100 placeholder-cyan-300/50 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50"
            disabled={isProcessing}
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || isProcessing}
            className="px-4 py-2 bg-cyan-600/60 hover:bg-cyan-600/80 disabled:bg-gray-600/40 disabled:cursor-not-allowed text-white rounded-lg transition-colors duration-200 flex items-center gap-2"
          >
            {isProcessing ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
            Send
          </button>
        </div>

        <div className="text-xs text-cyan-200/50 mt-2">
          Press Enter to send • Escape to close
        </div>
      </div>
    </div>
  );
}