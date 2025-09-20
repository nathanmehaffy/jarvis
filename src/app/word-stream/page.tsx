'use client';

import { useState, useRef, useEffect } from 'react';
import { useSpeechTranscription } from '@/input';
import type { WordData } from '@/input';

export default function WordStreamPage() {
  const [wordStream, setWordStream] = useState<Array<{ word: string; timestamp: number; confidence: number }>>([]);
  const streamEndRef = useRef<HTMLDivElement>(null);

  const {
    isListening,
    isSupported,
    fullText,
    lastWord,
    start,
    stop,
    toggle
  } = useSpeechTranscription({
    continuous: true,
    onWord: (data: WordData) => {
      setWordStream(prev => [
        ...prev,
        {
          word: data.word,
          timestamp: data.timestamp,
          confidence: data.confidence
        }
      ]);
    }
  });

  // Auto-scroll to bottom when new words are added
  useEffect(() => {
    streamEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [wordStream]);

  const clearStream = () => {
    setWordStream([]);
  };

  if (!isSupported) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="bg-gray-800 p-8 rounded-lg shadow-md max-w-md text-center">
          <h1 className="text-2xl font-bold mb-4">Speech Recognition Not Supported</h1>
          <p className="text-gray-300">
            Your browser doesn't support the Web Speech API. Please try using Chrome, Safari, or another compatible browser.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-6 text-center bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          Continuous Word Stream
        </h1>

        {/* Controls */}
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-6">
          <div className="flex items-center justify-center gap-4 mb-4">
            <button
              onClick={toggle}
              className={`px-8 py-4 rounded-lg font-bold text-lg transition-all duration-200 ${
                isListening
                  ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/50'
                  : 'bg-green-500 hover:bg-green-600 text-white shadow-green-500/50'
              } shadow-lg`}
            >
              {isListening ? '⏹ Stop Listening' : '🎤 Start Listening'}
            </button>

            <button
              onClick={clearStream}
              className="px-6 py-4 rounded-lg font-bold bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/50 transition-all duration-200"
            >
              🗑 Clear Stream
            </button>
          </div>

          <div className="text-center">
            <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${
              isListening
                ? 'bg-red-900/50 text-red-200 border border-red-500'
                : 'bg-gray-700 text-gray-300 border border-gray-600'
            }`}>
              <div className={`w-3 h-3 rounded-full mr-3 ${
                isListening ? 'bg-red-400 animate-pulse' : 'bg-gray-500'
              }`}></div>
              {isListening ? 'LIVE - Recording Audio' : 'Stopped'}
            </div>
          </div>
        </div>

        {/* Current Stream Display */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Real-time text */}
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold mb-4 text-blue-400">📝 Live Text Stream</h2>
            <div className="min-h-32 p-4 bg-gray-900 rounded border border-gray-700 font-mono">
              {fullText ? (
                <p className="text-green-400 leading-relaxed">{fullText}</p>
              ) : (
                <p className="text-gray-500 italic">Start speaking to see continuous transcription...</p>
              )}
            </div>
          </div>

          {/* Last word highlight */}
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold mb-4 text-purple-400">🎯 Current Word</h2>
            <div className="min-h-32 p-4 bg-gray-900 rounded border border-gray-700 flex items-center justify-center">
              {lastWord ? (
                <span className="text-3xl font-bold text-yellow-400 animate-pulse">
                  "{lastWord}"
                </span>
              ) : (
                <p className="text-gray-500 italic">No current word</p>
              )}
            </div>
          </div>
        </div>

        {/* Word Stream */}
        <div className="bg-gray-800 rounded-lg shadow-lg">
          <div className="p-6 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-green-400">🌊 Word Stream</h2>
              <span className="text-sm text-gray-400">
                {wordStream.length} words detected
              </span>
            </div>
            <p className="text-sm text-gray-400 mt-2">
              Individual words as they're detected in real-time
            </p>
          </div>

          <div className="p-6 max-h-96 overflow-y-auto">
            {wordStream.length === 0 ? (
              <p className="text-gray-500 italic text-center py-8">
                Start speaking to see words appear here in real-time...
              </p>
            ) : (
              <div className="space-y-2">
                {wordStream.map((item, index) => (
                  <div
                    key={`${item.timestamp}-${index}`}
                    className="flex items-center justify-between p-3 bg-gray-900 rounded border border-gray-700 hover:border-gray-600 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-500 font-mono w-16">
                        #{index + 1}
                      </span>
                      <span className="text-lg font-medium text-white">
                        {item.word}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span className="font-mono">
                        {new Date(item.timestamp).toLocaleTimeString([], {
                          hour12: false,
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </span>
                      <div className="flex items-center gap-1">
                        <span>📊</span>
                        <span>{Math.round(item.confidence * 100)}%</span>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={streamEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="mt-6 bg-blue-900/20 border border-blue-500/30 p-4 rounded-lg">
          <p className="text-sm text-blue-200">
            <strong>High Sensitivity Mode:</strong> This page demonstrates continuous word-by-word detection
            with maximum sensitivity. Each word is captured and displayed as soon as it's detected,
            providing a real-time stream of your speech.
          </p>
        </div>
      </div>
    </div>
  );
}