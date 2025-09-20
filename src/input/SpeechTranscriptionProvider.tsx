'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useSpeechTranscription, UseSpeechTranscriptionReturn, UseSpeechTranscriptionOptions } from './useSpeechTranscription';

const SpeechTranscriptionContext = createContext<UseSpeechTranscriptionReturn | null>(null);

export interface SpeechTranscriptionProviderProps {
  children: ReactNode;
  options?: UseSpeechTranscriptionOptions;
}

export function SpeechTranscriptionProvider({
  children,
  options = {}
}: SpeechTranscriptionProviderProps) {
  const speechTranscription = useSpeechTranscription(options);

  return (
    <SpeechTranscriptionContext.Provider value={speechTranscription}>
      {children}
    </SpeechTranscriptionContext.Provider>
  );
}

export function useSpeechTranscriptionContext(): UseSpeechTranscriptionReturn {
  const context = useContext(SpeechTranscriptionContext);

  if (!context) {
    throw new Error('useSpeechTranscriptionContext must be used within a SpeechTranscriptionProvider');
  }

  return context;
}

export function SpeechIndicator() {
  const { isListening, isSupported } = useSpeechTranscriptionContext();

  if (!isSupported) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50">
      <div className={`flex items-center px-3 py-2 rounded-full text-sm font-medium shadow-lg ${
        isListening
          ? 'bg-red-500 text-white'
          : 'bg-gray-200 text-gray-700'
      }`}>
        <div className={`w-2 h-2 rounded-full mr-2 ${
          isListening ? 'bg-white animate-pulse' : 'bg-gray-400'
        }`}></div>
        {isListening ? 'Listening' : 'Not listening'}
      </div>
    </div>
  );
}