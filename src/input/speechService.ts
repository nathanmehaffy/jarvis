/* eslint-disable @typescript-eslint/no-explicit-any */
import { eventBus } from '@/lib/eventBus';

export interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

export interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onerror: ((this: SpeechRecognition, ev: Event) => any) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export class SpeechTranscriptionService {
  private recognition: SpeechRecognition | null = null;
  private isListening = false;
  private isSupported = false;
  private isInitialized = false;

  constructor() {
    // Don't check support in constructor - do it during initialization
  }

  private checkSupport(): void {
    if (typeof window === 'undefined') {
      this.isSupported = false;
      return;
    }

    this.isSupported = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;

    if (!this.isSupported) {
      console.warn('Speech recognition not supported in this browser');
      eventBus.emit('speech:unsupported');
    }
  }

  initialize(): boolean {
    if (this.isInitialized) {
      return this.isSupported;
    }

    this.checkSupport();
    this.isInitialized = true;

    if (!this.isSupported) {
      return false;
    }

    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();

      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      // Maximize sensitivity and responsiveness
      if ('maxAlternatives' in this.recognition) {
        (this.recognition as any).maxAlternatives = 1;
      }
      if ('serviceURI' in this.recognition) {
        // Some browsers support additional config
      }

      this.setupEventHandlers();

      eventBus.emit('speech:initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize speech recognition:', error);
      eventBus.emit('speech:error', error);
      return false;
    }
  }

  private setupEventHandlers(): void {
    if (!this.recognition) return;

    this.recognition.onstart = () => {
      this.isListening = true;
      eventBus.emit('speech:started');
    };

    this.recognition.onend = () => {
      this.isListening = false;
      eventBus.emit('speech:ended');

      // Auto-restart if we want continuous listening
      if (this.isListening) {
        setTimeout(() => this.start(), 100);
      }
    };

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      let fullTranscript = '';
      let lastInterim = '';

      // Get all results for continuous stream
      for (let i = 0; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          fullTranscript += transcript;
        } else {
          lastInterim = transcript;
        }
      }

      // Always emit the most recent interim result for continuous stream
      const currentText = fullTranscript + lastInterim;

      eventBus.emit('speech:transcript', {
        final: fullTranscript,
        interim: lastInterim,
        fullText: currentText.trim(),
        timestamp: Date.now()
      });

      // Also emit individual words as they're detected
      if (lastInterim) {
        const words = lastInterim.trim().split(/\s+/);
        const lastWord = words[words.length - 1];
        if (lastWord && lastWord.length > 0) {
          eventBus.emit('speech:word', {
            word: lastWord,
            confidence: event.results[event.results.length - 1][0].confidence || 1,
            timestamp: Date.now()
          });
        }
      }
    };

    this.recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);

      // Don't emit error for no-speech since we want continuous listening through silence
      if (event.error !== 'no-speech') {
        eventBus.emit('speech:error', event.error);
      }

      // Auto-restart on all errors except fatal ones, with shorter delay for no-speech
      if (event.error === 'no-speech') {
        setTimeout(() => {
          if (this.isListening) {
            this.start();
          }
        }, 100); // Faster restart for silence
      } else if (event.error === 'audio-capture' || event.error === 'network') {
        setTimeout(() => {
          if (this.isListening) {
            this.start();
          }
        }, 1000);
      }
    };
  }

  start(): boolean {
    if (!this.recognition || this.isListening) {
      return false;
    }

    try {
      this.recognition.start();
      return true;
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      eventBus.emit('speech:error', error);
      return false;
    }
  }

  stop(): void {
    if (!this.recognition || !this.isListening) {
      return;
    }

    this.isListening = false;
    this.recognition.stop();
  }

  abort(): void {
    if (!this.recognition) {
      return;
    }

    this.isListening = false;
    this.recognition.abort();
  }

  getIsListening(): boolean {
    return this.isListening;
  }

  getIsSupported(): boolean {
    if (!this.isInitialized && typeof window !== 'undefined') {
      this.checkSupport();
      this.isInitialized = true;
    }
    return this.isSupported;
  }
}

export const speechService = new SpeechTranscriptionService();