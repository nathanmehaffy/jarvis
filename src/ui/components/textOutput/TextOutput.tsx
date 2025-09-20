'use client';

import { useState, useEffect, useRef } from 'react';
import { eventBus } from '@/lib/eventBus';
import { LogEntry, TextOutputProps } from './textOutput.types';

export function TextOutput({
  maxEntries = 100,
  showTimestamp = true,
  autoScroll = true
}: TextOutputProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isCleared, setIsCleared] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribers = [
      eventBus.on('input:input_processed', (data) => {
        addLog('success', `Input processed: ${JSON.stringify(data)}`, 'Input Manager');
      }),
      eventBus.on('ai:ai_response_generated', (data) => {
        addLog('info', `AI response: ${JSON.stringify(data)}`, 'AI Manager');
      }),
      eventBus.on('input:initialized', () => {
        addLog('success', 'Input manager initialized successfully', 'System');
      }),
      eventBus.on('ai:initialized', () => {
        addLog('success', 'AI manager initialized successfully', 'System');
      }),
      eventBus.on('ui:log', (data: { type: LogEntry['type'], message: string, source?: string }) => {
        addLog(data.type, data.message, data.source);
      })
    ];

    // Add initial welcome message
    addLog('info', 'Text Output window initialized. Listening for events...', 'System');

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, []);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const addLog = (type: LogEntry['type'], message: string, source?: string) => {
    const newLog: LogEntry = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      type,
      message,
      source
    };

    setLogs(prev => {
      const updated = [...prev, newLog];
      return updated.length > maxEntries ? updated.slice(-maxEntries) : updated;
    });
  };

  const clearLogs = () => {
    setLogs([]);
    setIsCleared(true);
    setTimeout(() => setIsCleared(false), 1000);
  };

  const getTypeIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'debug': return '🔍';
      default: return 'ℹ️';
    }
  };

  const getTypeColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-600';
      case 'warning': return 'text-yellow-600';
      case 'debug': return 'text-purple-600';
      default: return 'text-blue-600';
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-slate-400 to-gray-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg">
          <div className="w-8 h-8 bg-white rounded-lg opacity-90 flex items-center justify-center">
            <span className="text-sm">📄</span>
          </div>
        </div>
        <h3 className="text-2xl font-bold text-gray-800 mb-2">Text Output</h3>
        <p className="text-gray-600 leading-relaxed">Real-time event logs and system messages</p>
      </div>

      <div className="bg-gradient-to-br from-slate-50 to-gray-100 rounded-2xl p-4 border border-slate-200/50 flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-700">
            {logs.length} {logs.length === 1 ? 'entry' : 'entries'}
          </span>
          <button
            onClick={clearLogs}
            className={`px-3 py-1 text-xs rounded-lg transition-all duration-200 ${
              isCleared
                ? 'bg-green-500 text-white'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            }`}
          >
            {isCleared ? '✓ Cleared' : 'Clear'}
          </button>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-auto bg-white rounded-xl p-3 border border-gray-200 font-mono text-xs space-y-1"
          style={{ minHeight: '200px' }}
        >
          {logs.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <span className="text-2xl mb-2 block">📝</span>
              No logs yet. Events will appear here...
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex items-start space-x-2 py-1 border-b border-gray-100 last:border-b-0">
                <span className="flex-shrink-0">{getTypeIcon(log.type)}</span>
                {showTimestamp && (
                  <span className="flex-shrink-0 text-gray-500 w-16">
                    {formatTime(log.timestamp)}
                  </span>
                )}
                {log.source && (
                  <span className="flex-shrink-0 text-gray-400 text-xs bg-gray-100 px-1 rounded">
                    {log.source}
                  </span>
                )}
                <span className={`flex-1 ${getTypeColor(log.type)}`}>
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}