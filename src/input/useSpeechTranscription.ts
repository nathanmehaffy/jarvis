'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { speechService } from './speechService';
import { eventBus } from '@/lib/eventBus';

export interface TranscriptData {
  final: string;
  interim: string;
  fullText: string;
  timestamp: number;
}

export interface WordData {
  word: string;
  confidence: number;
  timestamp: number;
}

export interface UseSpeechTranscriptionOptions {
  autoStart?: boolean;
  continuous?: boolean;
  onTranscript?: (data: TranscriptData) => void;
  onWord?: (data: WordData) => void;
  onError?: (error: string) => void;
}

export interface UseSpeechTranscriptionReturn {
  isListening: boolean;
  isSupported: boolean;
  currentTranscript: string;
  interimTranscript: string;
  fullText: string;
  lastWord: string;
  start: () => boolean;
  stop: () => void;
  toggle: () => void;
}

export function useSpeechTranscription(
  options: UseSpeechTranscriptionOptions = {}
): UseSpeechTranscriptionReturn {
  const {
    autoStart = false,
    continuous = true,
    onTranscript,
    onWord,
    onError
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [fullText, setFullText] = useState('');
  const [lastWord, setLastWord] = useState('');

  const isInitialized = useRef(false);
  const shouldRestart = useRef(continuous);

  // Initialize speech service
  useEffect(() => {
    if (isInitialized.current) return;

    const initialized = speechService.initialize();
    setIsSupported(initialized);
    isInitialized.current = true;

    if (initialized && autoStart) {
      speechService.start();
    }
  }, [autoStart]);

  // Set up event listeners
  useEffect(() => {
    const unsubscribers = [
      eventBus.on('speech:transcript', (data: TranscriptData) => {
        if (data.final && data.final.trim()) {
          setCurrentTranscript(data.final.trim());
        }
        setInterimTranscript(data.interim);
        setFullText(data.fullText);

        onTranscript?.(data);
      }),

      eventBus.on('speech:word', (data: WordData) => {
        setLastWord(data.word);
        onWord?.(data);
      }),

      eventBus.on('speech:started', () => {
        setIsListening(true);
      }),

      eventBus.on('speech:ended', () => {
        setIsListening(false);

        // Auto-restart if continuous mode is enabled
        if (shouldRestart.current && continuous) {
          setTimeout(() => {
            speechService.start();
          }, 100);
        }
      }),

      eventBus.on('speech:error', (error: string) => {
        console.error('Speech recognition error:', error);

        // Don't change listening state for no-speech errors since we want continuous listening
        if (error !== 'no-speech') {
          setIsListening(false);
          onError?.(error);
        }

        // Auto-restart on certain errors if continuous
        if (continuous && shouldRestart.current) {
          if (error === 'no-speech') {
            // Faster restart for silence, don't change UI state
            setTimeout(() => {
              speechService.start();
            }, 100);
          } else if (error === 'audio-capture' || error === 'network') {
            setTimeout(() => {
              speechService.start();
            }, 1000);
          }
        }
      }),

      eventBus.on('speech:unsupported', () => {
        setIsSupported(false);
      })
    ];

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [continuous, onTranscript, onWord, onError]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shouldRestart.current = false;
      speechService.stop();
    };
  }, []);

  const start = useCallback((): boolean => {
    if (!isSupported) return false;

    shouldRestart.current = true;
    return speechService.start();
  }, [isSupported]);

  const stop = useCallback((): void => {
    shouldRestart.current = false;
    speechService.stop();
    setInterimTranscript('');
    setLastWord('');
  }, []);

  const toggle = useCallback((): void => {
    if (isListening) {
      stop();
    } else {
      start();
    }
  }, [isListening, start, stop]);

  return {
    isListening,
    isSupported,
    currentTranscript,
    interimTranscript,
    fullText,
    lastWord,
    start,
    stop,
    toggle
  };
}