/* eslint-disable @typescript-eslint/no-explicit-any */
import { eventBus } from '@/lib/eventBus';

export interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
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
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
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
  private lastFinalCumulative = '';
  private micPrefetched = false;
  private audioRecoverAttempted = false;

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

  private async prefetchMicAccess(): Promise<void> {
    if (this.micPrefetched) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // immediately stop to release device
        stream.getTracks().forEach(t => t.stop());
        this.micPrefetched = true;
        this.audioRecoverAttempted = false;
        eventBus.emit('speech:mic_ready');
      }
    } catch (err) {
      // swallow; user may reject, we'll surface via onerror path
      eventBus.emit('speech:mic_denied', err);
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
      // Reset cumulative tracker at the start of each session
      this.lastFinalCumulative = '';
      eventBus.emit('speech:started');
    };

    this.recognition.onend = () => {
      // Mark as not listening; restart is coordinated by the hook
      this.isListening = false;
      eventBus.emit('speech:ended');
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

      // Compute delta of newly finalized portion relative to previous cumulative
      let finalDelta = '';
      if (fullTranscript.startsWith(this.lastFinalCumulative)) {
        finalDelta = fullTranscript.slice(this.lastFinalCumulative.length);
      } else {
        // Fallback: find common prefix length and take the suffix as delta
        const commonLength = this.getCommonPrefixLength(this.lastFinalCumulative, fullTranscript);
        finalDelta = fullTranscript.slice(commonLength);
      }

      // Update cumulative tracker
      this.lastFinalCumulative = fullTranscript;

      // Always emit the most recent interim result for continuous stream
      const currentText = (fullTranscript + lastInterim).trim();

      eventBus.emit('speech:transcript', {
        final: finalDelta,
        interim: lastInterim,
        fullText: currentText,
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

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.warn('Speech recognition error:', event.error);

      // Don't emit error for no-speech since we want continuous listening through silence
      if (event.error !== 'no-speech') {
        eventBus.emit('speech:error', event.error);
      }

      // Handle missing audio device / permission
      if (event.error === 'audio-capture') {
        // try a one-time recovery by prompting for mic access, then restarting
        if (!this.audioRecoverAttempted) {
          this.audioRecoverAttempted = true;
          if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
              try {
                stream.getTracks().forEach(t => t.stop());
                this.micPrefetched = true;
                // restart once
                if (this.recognition && !this.isListening) {
                  this.recognition.start();
                  this.isListening = true;
                  eventBus.emit('speech:restarted');
                }
              } catch {}
            }).catch(err => {
              eventBus.emit('speech:mic_denied', err);
            });
          }
        } else {
          // already attempted; stop trying to avoid loops
          this.isListening = false;
        }
        return;
      }

      // Handle fatal errors by stopping completely
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        this.isListening = false;
        return;
      }
    };
  }

  start(): boolean {
    if (!this.recognition || this.isListening) {
      return false;
    }

    try {
      // proactively request mic once if not already
      void this.prefetchMicAccess();
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

  private getCommonPrefixLength(a: string, b: string): number {
    const minLen = Math.min(a.length, b.length);
    let i = 0;
    while (i < minLen && a.charCodeAt(i) === b.charCodeAt(i)) {
      i++;
    }
    return i;
  }
}

export const speechService = new SpeechTranscriptionService();