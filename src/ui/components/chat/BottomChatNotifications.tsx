'use client';

import React, { useState, useEffect } from 'react';
import { eventBus } from '@/lib/eventBus';

interface ChatNotification {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: number;
  duration?: number;
}

export function BottomChatNotifications() {
  const [currentNotification, setCurrentNotification] = useState<ChatNotification | null>(null);
  const [currentTimeout, setCurrentTimeout] = useState<number | null>(null);

  useEffect(() => {
    const handleNotification = (notification: ChatNotification) => {
      setCurrentNotification(notification);
    };

    const handleResponseNotify = (data: { message: string; duration?: number }) => {
      const notification: ChatNotification = {
        id: Date.now().toString(),
        text: data.message,
        sender: 'ai',
        timestamp: Date.now(),
        duration: data.duration || 3000
      };
      setCurrentNotification(notification);
    };

    const handleConversationalResponse = (data: { response: string; originalText?: string }) => {
      const notification: ChatNotification = {
        id: Date.now().toString(),
        text: data.response,
        sender: 'ai',
        timestamp: Date.now(),
        duration: 15000
      };
      setCurrentNotification(notification);
    };

    eventBus.on('chat-notification', handleNotification);
    eventBus.on('ai:response_notify', handleResponseNotify);
    eventBus.on('ai:ai_conversational_response', handleConversationalResponse);

    return () => {
      eventBus.off('chat-notification', handleNotification);
      eventBus.off('ai:response_notify', handleResponseNotify);
      eventBus.off('ai:ai_conversational_response', handleConversationalResponse);
    };
  }, []);

  useEffect(() => {
    if (currentNotification) {
      if (currentTimeout) {
        clearTimeout(currentTimeout);
      }
      const timeout = window.setTimeout(() => {
        setCurrentNotification(null);
        setCurrentTimeout(null);
      }, currentNotification.duration || 3000);
      setCurrentTimeout(timeout);
    }

    return () => {
      if (currentTimeout) {
        clearTimeout(currentTimeout);
      }
    };
  }, [currentNotification]);

  if (!currentNotification) return null;

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none max-w-2xl w-full px-4">
      <div
        key={currentNotification.id}
        className="chat-notification pointer-events-auto"
        style={{
          animation: `slideUp 0.3s ease-out, fadeDown 0.5s ease-out ${(currentNotification.duration || 3000) - 500}ms forwards`
        }}
      >
        <div
          className={`relative p-4 px-6 backdrop-blur-md rounded-lg border-2 shadow-2xl max-w-full ${
            currentNotification.sender === 'user'
              ? 'bg-blue-600/40 border-blue-400/60 ml-auto mr-0 text-right'
              : 'bg-black/40 border-cyan-400/60 mr-auto ml-0'
          }`}
          style={{
            background: currentNotification.sender === 'user'
              ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(29, 78, 216, 0.2))'
              : 'linear-gradient(135deg, rgba(6, 182, 212, 0.1), rgba(59, 130, 246, 0.1))',
            boxShadow: currentNotification.sender === 'user'
              ? `
                0 0 20px rgba(59, 130, 246, 0.4),
                0 0 40px rgba(59, 130, 246, 0.2),
                inset 0 0 20px rgba(59, 130, 246, 0.1),
                0 4px 6px rgba(0, 0, 0, 0.3)
              `
              : `
                0 0 20px rgba(34, 211, 238, 0.4),
                0 0 40px rgba(34, 211, 238, 0.2),
                inset 0 0 20px rgba(34, 211, 238, 0.1),
                0 4px 6px rgba(0, 0, 0, 0.3)
              `
          }}
          >
          {/* Corner accents */}
          <div className={`absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 rounded-tl-lg ${
            currentNotification.sender === 'user' ? 'border-blue-400' : 'border-cyan-400'
          }`} />
          <div className={`absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 rounded-tr-lg ${
            currentNotification.sender === 'user' ? 'border-blue-400' : 'border-cyan-400'
          }`} />
          <div className={`absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 rounded-bl-lg ${
            currentNotification.sender === 'user' ? 'border-blue-400' : 'border-cyan-400'
          }`} />
          <div className={`absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 rounded-br-lg ${
            currentNotification.sender === 'user' ? 'border-blue-400' : 'border-cyan-400'
          }`} />

          {/* Animated pulse effect */}
          <div
            className={`absolute inset-0 rounded-lg border-2 animate-pulse ${
              currentNotification.sender === 'user' ? 'border-blue-400/30' : 'border-cyan-400/30'
            }`}
            style={{
              boxShadow: currentNotification.sender === 'user'
                ? '0 0 10px rgba(59, 130, 246, 0.3)'
                : '0 0 10px rgba(34, 211, 238, 0.3)'
            }}
          />

          {/* Content */}
          <div className="relative z-10 flex items-start gap-3">
            {/* Avatar */}
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              currentNotification.sender === 'user'
                ? 'bg-blue-500/60 order-2'
                : 'bg-cyan-500/60 order-1'
            }`}>
              {currentNotification.sender === 'user' ? (
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
              ) : (
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              )}
            </div>

            {/* Message */}
            <div className={`flex-1 ${currentNotification.sender === 'user' ? 'order-1' : 'order-2'}`}>
              <div className={`text-xs font-medium mb-1 ${
                currentNotification.sender === 'user' ? 'text-blue-200' : 'text-cyan-200'
              }`}>
                {currentNotification.sender === 'user' ? 'You' : 'Jarvis'}
              </div>
              <p className={`text-sm font-medium leading-relaxed ${
                currentNotification.sender === 'user' ? 'text-blue-100' : 'text-cyan-100'
              }`}>
                {currentNotification.text}
              </p>
            </div>
          </div>

          {/* Bottom gradient line */}
          <div
            className={`absolute bottom-0 left-2 right-2 h-px bg-gradient-to-r from-transparent to-transparent ${
              currentNotification.sender === 'user' ? 'via-blue-400/50' : 'via-cyan-400/50'
            }`}
          />
        </div>
      </div>
    </div>
  );
}