'use client';

import { useState } from 'react';
import { SpeechTranscriptionProvider, useSpeechTranscriptionContext, SpeechIndicator } from '@/input';

function ExampleContent() {
  const {
    isListening,
    isSupported,
    currentTranscript,
    interimTranscript,
    start,
    stop,
    toggle
  } = useSpeechTranscriptionContext();

  const [transcriptHistory, setTranscriptHistory] = useState<string[]>([]);

  // Add transcript to history when we get a final one
  if (currentTranscript && !transcriptHistory.includes(currentTranscript)) {
    setTranscriptHistory(prev => [...prev, currentTranscript]);
  }

  if (!isSupported) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Speech Recognition Not Supported</h1>
          <p className="text-gray-600">
            Your browser doesn't support the Web Speech API.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">
          Background Speech Transcription Example
        </h1>

        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-semibold mb-4">Speech Controls</h2>
          <div className="flex gap-4">
            <button
              onClick={start}
              disabled={isListening}
              className={`px-4 py-2 rounded font-medium ${
                isListening
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-500 text-white hover:bg-green-600'
              }`}
            >
              Start Listening
            </button>

            <button
              onClick={stop}
              disabled={!isListening}
              className={`px-4 py-2 rounded font-medium ${
                !isListening
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-red-500 text-white hover:bg-red-600'
              }`}
            >
              Stop Listening
            </button>

            <button
              onClick={toggle}
              className="px-4 py-2 rounded font-medium bg-blue-500 text-white hover:bg-blue-600"
            >
              {isListening ? 'Stop' : 'Start'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Current Speech */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold mb-4">Current Speech</h3>
            <div className="min-h-24 p-4 bg-gray-50 rounded border">
              {interimTranscript && (
                <p className="text-gray-600 italic">{interimTranscript}</p>
              )}
              {currentTranscript && (
                <p className="text-gray-800 font-medium">{currentTranscript}</p>
              )}
              {!interimTranscript && !currentTranscript && (
                <p className="text-gray-400">Start speaking to see transcription...</p>
              )}
            </div>
          </div>

          {/* Transcript History */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold mb-4">Speech History</h3>
            <div className="max-h-64 overflow-y-auto">
              {transcriptHistory.length === 0 ? (
                <p className="text-gray-400">No speech detected yet...</p>
              ) : (
                <ul className="space-y-2">
                  {transcriptHistory.map((transcript, index) => (
                    <li key={index} className="p-2 bg-gray-50 rounded text-sm">
                      {transcript}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {transcriptHistory.length > 0 && (
              <button
                onClick={() => setTranscriptHistory([])}
                className="mt-4 px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600"
              >
                Clear History
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 bg-blue-50 p-4 rounded-lg">
          <h3 className="font-semibold text-blue-800 mb-2">How to use this on any page:</h3>
          <div className="text-sm text-blue-700 space-y-2">
            <p>1. Wrap your page/component with <code className="bg-blue-100 px-1 rounded">SpeechTranscriptionProvider</code></p>
            <p>2. Use the <code className="bg-blue-100 px-1 rounded">useSpeechTranscriptionContext</code> hook to access speech data</p>
            <p>3. Add the <code className="bg-blue-100 px-1 rounded">SpeechIndicator</code> component for visual feedback</p>
            <p>4. The speech recognition runs in the background and can be controlled programmatically</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SpeechExamplePage() {
  return (
    <SpeechTranscriptionProvider options={{ continuous: true }}>
      <SpeechIndicator />
      <ExampleContent />
    </SpeechTranscriptionProvider>
  );
}