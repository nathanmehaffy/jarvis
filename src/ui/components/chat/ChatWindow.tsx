'use client';

import React, { useState, useRef, useEffect } from 'react';
import { eventBus } from '@/lib/eventBus';

interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: number;
}

export function ChatWindow() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      text: 'Hello! I\'m Jarvis, your AI assistant. You can ask me questions or give me commands. Try asking me something!',
      sender: 'ai',
      timestamp: Date.now()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Listen for AI responses to display in chat
    const unsubscribe = eventBus.on('ai:ai_conversational_response', (data: { response: string; originalText?: string }) => {
      if (data.response) {
        const newMessage: ChatMessage = {
          id: `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          text: data.response,
          sender: 'ai',
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, newMessage]);
        setIsProcessing(false);
      }
    });

    // Listen for task completion
    const unsubscribeTaskComplete = eventBus.on('ai:text_command_processed', (data: { tasks?: any[]; conversationalResponse?: string }) => {
      if (data.tasks && data.tasks.length > 0) {
        const newMessage: ChatMessage = {
          id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          text: `✅ Completed ${data.tasks.length} task${data.tasks.length === 1 ? '' : 's'}: ${data.tasks.map(t => t.tool).join(', ')}`,
          sender: 'ai',
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, newMessage]);
        setIsProcessing(false);
      } else if (data.conversationalResponse) {
        const newMessage: ChatMessage = {
          id: `response_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          text: data.conversationalResponse,
          sender: 'ai',
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, newMessage]);
        setIsProcessing(false);
      }
    });

    return () => {
      unsubscribe();
      unsubscribeTaskComplete();
    };
  }, []);

  const handleSend = () => {
    if (!inputText.trim() || isProcessing) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text: inputText.trim(),
      sender: 'user',
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsProcessing(true);

    // Send to AI for processing
    eventBus.emit('input:transcript_updated', {
      transcript: inputText.trim()
    });

    setInputText('');
    inputRef.current?.focus();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full bg-black/20 backdrop-blur-sm">
      {/* Chat Header */}
      <div className="p-4 border-b border-cyan-400/20 bg-black/30">
        <h3 className="text-lg font-semibold text-cyan-100 flex items-center gap-2">
          <div className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse"></div>
          Chat with Jarvis
        </h3>
        <p className="text-xs text-cyan-200/70 mt-1">Ask questions or give commands</p>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] p-3 rounded-lg ${
                message.sender === 'user'
                  ? 'bg-blue-600/60 text-white ml-8'
                  : 'bg-cyan-900/40 text-cyan-100 mr-8 border border-cyan-400/20'
              }`}
            >
              <div className="text-sm leading-relaxed whitespace-pre-wrap">
                {message.text}
              </div>
              <div className={`text-xs mt-1 opacity-60 ${
                message.sender === 'user' ? 'text-blue-100' : 'text-cyan-200'
              }`}>
                {formatTimestamp(message.timestamp)}
              </div>
            </div>
          </div>
        ))}

        {isProcessing && (
          <div className="flex justify-start">
            <div className="bg-cyan-900/40 text-cyan-100 mr-8 border border-cyan-400/20 p-3 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <span className="text-sm text-cyan-200 ml-2">Jarvis is thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-cyan-400/20 bg-black/30">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message or command..."
            className="flex-1 px-3 py-2 bg-black/40 border border-cyan-400/30 rounded-lg text-cyan-100 placeholder-cyan-300/50 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50"
            disabled={isProcessing}
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || isProcessing}
            className="px-4 py-2 bg-cyan-600/60 hover:bg-cyan-600/80 disabled:bg-gray-600/40 disabled:cursor-not-allowed text-white rounded-lg transition-colors duration-200 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            Send
          </button>
        </div>
        <div className="text-xs text-cyan-200/50 mt-2">
          Press Enter to send, Shift+Enter for new line
        </div>
      </div>
    </div>
  );
}