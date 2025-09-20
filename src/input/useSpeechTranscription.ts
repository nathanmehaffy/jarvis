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
  accumulatedTranscript: string;
  interimTranscript: string;
  fullText: string;
  start: () => boolean;
  stop: () => void;
  toggle: () => void;
  clear: () => void;
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
  const [accumulatedTranscript, setAccumulatedTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [fullText, setFullText] = useState('');

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
          setAccumulatedTranscript(prev => {
            const newText = prev ? prev + ' ' + data.final.trim() : data.final.trim();
            const trimmed = newText.length > 10000 ? newText.slice(-10000) : newText;
            setFullText(trimmed + (data.interim ? ' ' + data.interim : ''));
            return trimmed;
          });
        } else {
          setAccumulatedTranscript(prev => {
            setFullText(prev + (data.interim ? ' ' + data.interim : ''));
            return prev;
          });
        }
        setInterimTranscript(data.interim);

        onTranscript?.(data);
      }),

      eventBus.on('speech:word', (data: WordData) => {
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
          onError?.(error);
        }

        // Handle fatal errors by stopping restart
        if (error === 'not-allowed' || error === 'service-not-allowed') {
          shouldRestart.current = false;
          setIsListening(false);
          return;
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
  }, []);

  const clear = useCallback((): void => {
    setAccumulatedTranscript('');
    setInterimTranscript('');
    setFullText('');
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
    accumulatedTranscript,
    interimTranscript,
    fullText,
    start,
    stop,
    toggle,
    clear
  };
}