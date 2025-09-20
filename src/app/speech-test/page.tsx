'use client';

import { useEffect, useState, useRef } from 'react';
import { speechService } from '@/input';
import { eventBus } from '@/lib/eventBus';

interface TranscriptItem {
  id: string;
  text: string;
  timestamp: number;
  isFinal: boolean;
}

export default function SpeechTestPage() {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [currentInterim, setCurrentInterim] = useState('');
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize speech service
    const initialized = speechService.initialize();
    setIsSupported(initialized);

    // Set up event listeners
    const unsubscribers = [
      eventBus.on('speech:transcript', (data: { final: string; interim: string; timestamp: number }) => {
        if (data.final) {
          // Add final transcript
          const newTranscript: TranscriptItem = {
            id: `${data.timestamp}-${Math.random()}`,
            text: data.final.trim(),
            timestamp: data.timestamp,
            isFinal: true
          };

          if (newTranscript.text) {
            setTranscripts(prev => [...prev, newTranscript]);
          }
          setCurrentInterim('');
        } else {
          // Update interim transcript
          setCurrentInterim(data.interim);
        }
      }),

      eventBus.on('speech:started', () => {
        setIsListening(true);
      }),

      eventBus.on('speech:ended', () => {
        setIsListening(false);
      }),

      eventBus.on('speech:error', (error: string) => {
        console.error('Speech error:', error);
        setIsListening(false);
      }),

      eventBus.on('speech:unsupported', () => {
        setIsSupported(false);
      })
    ];

    // Auto-scroll to bottom when new transcripts are added
    const scrollToBottom = () => {
      transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };
    scrollToBottom();

    return () => {
      // Clean up event listeners
      unsubscribers.forEach(unsub => unsub());
      speechService.stop();
    };
  }, [transcripts]);

  const handleStartListening = () => {
    if (!isSupported) return;
    speechService.start();
  };

  const handleStopListening = () => {
    speechService.stop();
  };

  const handleClearTranscripts = () => {
    // Text clearing functionality removed to keep all text on screen
    // setTranscripts([]);
    // setCurrentInterim('');
  };

  if (!isSupported) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Speech Recognition Not Supported</h1>
          <p className="text-gray-600">
            Your browser doesn't support the Web Speech API. Please try using Chrome, Safari, or another compatible browser.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">
          Speech Transcription Test
        </h1>

        {/* Controls */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={handleStartListening}
              disabled={isListening}
              className={`px-6 py-3 rounded-lg font-semibold text-white transition-colors ${
                isListening
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-500 hover:bg-green-600 active:bg-green-700'
              }`}
            >
              {isListening ? 'Listening...' : 'Start Listening'}
            </button>

            <button
              onClick={handleStopListening}
              disabled={!isListening}
              className={`px-6 py-3 rounded-lg font-semibold text-white transition-colors ${
                !isListening
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-red-500 hover:bg-red-600 active:bg-red-700'
              }`}
            >
              Stop Listening
            </button>

            <button
              onClick={handleClearTranscripts}
              className="px-6 py-3 rounded-lg font-semibold text-white bg-blue-500 hover:bg-blue-600 active:bg-blue-700 transition-colors"
            >
              Clear
            </button>
          </div>

          <div className="mt-4 text-center">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              isListening
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
            }`}>
              <span className={`w-2 h-2 rounded-full mr-2 ${
                isListening ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
              }`}></span>
              {isListening ? 'Recording' : 'Stopped'}
            </span>
          </div>
        </div>

        {/* Transcription Display */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">
              Live Transcription
            </h2>
            <p className="text-sm text-gray-600">
              Words appear here as you speak
            </p>
          </div>

          <div className="p-6 max-h-96 overflow-y-auto">
            {transcripts.length === 0 && !currentInterim && (
              <p className="text-gray-500 italic text-center py-8">
                Start speaking to see your words appear here...
              </p>
            )}

            {/* Final transcripts */}
            {transcripts.map((transcript) => (
              <div
                key={transcript.id}
                className="mb-3 p-3 bg-gray-50 rounded-lg border-l-4 border-blue-500"
              >
                <p className="text-gray-800">{transcript.text}</p>
                <span className="text-xs text-gray-500">
                  {new Date(transcript.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}

            {/* Interim transcript */}
            {currentInterim && (
              <div className="mb-3 p-3 bg-yellow-50 rounded-lg border-l-4 border-yellow-400">
                <p className="text-gray-600 italic">{currentInterim}</p>
                <span className="text-xs text-yellow-600">Speaking...</span>
              </div>
            )}

            <div ref={transcriptEndRef} />
          </div>
        </div>

        {/* Info */}
        <div className="mt-6 bg-blue-50 p-4 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>How it works:</strong> This page uses the Web Speech API to continuously listen to your microphone
            and transcribe speech in real-time. Gray text shows interim results while you're speaking,
            and blue text shows final transcripts.
          </p>
        </div>
      </div>
    </div>
  );
}