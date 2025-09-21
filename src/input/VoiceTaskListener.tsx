'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { eventBus } from '@/lib/eventBus';
import { useSpeechTranscription } from './useSpeechTranscription';
// Cerebras calls removed; this component now only buffers transcript and emits updates

type Status = 'idle' | 'listening' | 'processing' | 'error';

interface CerebrasResult {
  tasks?: string[];
  remainder?: string;
}

export function VoiceTaskListener() {
  const [buffer, setBuffer] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [lastError, setLastError] = useState('');
  const [apiCallTimestamps, setApiCallTimestamps] = useState<number[]>([]);
  const [nextCallAt, setNextCallAt] = useState<number | null>(null);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  const bufferRef = useRef(buffer);
  const apiCallTimestampsRef = useRef(apiCallTimestamps);
  const processingRef = useRef(false);
  const scheduledTimeoutRef = useRef<number | null>(null);
  const scheduledForRef = useRef<number | null>(null);
  const callStartBufferLengthRef = useRef(0);
  const lastBufferAppendAtRef = useRef<number>(0);
  
  const recentTaskTextsRef = useRef<Map<string, number>>(new Map());
  const latestFullTextRef = useRef<string>('');
  const streamTimerRef = useRef<number | null>(null);
  const lastStreamCallAtRef = useRef<number>(0);
  const lastStreamProcessedTextRef = useRef<string>('');

  // No AI calls here; VoiceTaskListener is now a pure input buffer

  const MIN_DEBOUNCE_MS = 0; // retained for potential future use
  const STREAM_INTERVAL_MS = 2000; // periodic checks during continuous speech
  const STILL_SPEAKING_WINDOW_MS = 1500; // treat activity within this as still speaking
  const SILENCE_CONFIRM_MS = 1000; // wait after last final segment to coalesce phrases
  const ENABLE_STREAMING = false; // disable streaming task emission to avoid partial-command actions

  const cleanOld = useCallback((timestamps: number[]): number[] => {
    const cutoff = Date.now() - 60000;
    return timestamps.filter(t => t > cutoff);
  }, []);

  useEffect(() => { bufferRef.current = buffer; }, [buffer]);
  useEffect(() => { apiCallTimestampsRef.current = apiCallTimestamps; }, [apiCallTimestamps]);

  const { isListening, isSupported } = useSpeechTranscription({
    autoStart: true,
    continuous: true,
    onTranscript: (data) => {
      if (data?.fullText) {
        latestFullTextRef.current = data.fullText.trim();
      }
      if (data.final && data.final.trim()) {
        // Compute and set new buffer synchronously to ensure attemptProcessing sees it
        const newBuffer = (bufferRef.current ? bufferRef.current + ' ' : '') + data.final.trim();
        bufferRef.current = newBuffer;
        setBuffer(newBuffer);
        lastBufferAppendAtRef.current = Date.now();
        // Coalesce multiple final segments by waiting briefly for silence
        scheduleTimer(SILENCE_CONFIRM_MS);
      } else if (data.interim && data.interim.trim()) {
        // Update activity timestamp to indicate user is still speaking
        lastBufferAppendAtRef.current = Date.now();
        // Periodic streaming calls while speaking
        if (ENABLE_STREAMING) scheduleStreamProcessing();
      }
    },
    onError: (error) => {
      // Treat permission/network errors as errors; no-op for 'no-speech'
      if (error !== 'no-speech') {
        setStatus('error');
        setLastError(String(error));
      }
    }
  });

  // Compute and emit debug info whenever core state changes
  useEffect(() => {
    const recent = cleanOld(apiCallTimestampsRef.current);
    eventBus.emit('input:voice_debug', {
      status: !isSupported ? 'error' : processingRef.current ? 'processing' : isListening ? 'listening' : 'idle',
      bufferLength: bufferRef.current.length,
      bufferText: bufferRef.current,
      apiCallsUsedLastMinute: recent.length,
      nextCallInMs: nextCallAt ? Math.max(0, nextCallAt - Date.now()) : null,
      lastError: lastError || null,
      isOnline,
      isSupported
    });
  }, [buffer, apiCallTimestamps, nextCallAt, lastError, isOnline, isListening, isSupported, cleanOld]);

  // Online/offline monitoring
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setLastError('');
      if (bufferRef.current) scheduleProcessing();
    };
    const handleOffline = () => {
      setIsOnline(false);
      setStatus('error');
      setLastError('Network disconnected');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (scheduledTimeoutRef.current !== null) {
        clearTimeout(scheduledTimeoutRef.current);
        scheduledTimeoutRef.current = null;
      }
      if (streamTimerRef.current !== null) {
        clearTimeout(streamTimerRef.current);
        streamTimerRef.current = null;
      }
    };
  }, []);

  // Stop streaming when recognition stops
  useEffect(() => {
    if (!isListening && streamTimerRef.current !== null) {
      clearTimeout(streamTimerRef.current);
      streamTimerRef.current = null;
    }
  }, [isListening]);

  // Track listening status for status display
  useEffect(() => {
    if (!isSupported) {
      setStatus('error');
      setLastError('Speech recognition not supported');
      return;
    }
    if (processingRef.current) return;
    setStatus(isListening ? 'listening' : 'idle');
  }, [isListening, isSupported]);

  const scheduleTimer = useCallback((delayMs: number) => {
    if (scheduledTimeoutRef.current !== null) {
      clearTimeout(scheduledTimeoutRef.current);
      scheduledTimeoutRef.current = null;
    }
    const runAt = Date.now() + delayMs;
    scheduledForRef.current = runAt;
    setNextCallAt(runAt);
    scheduledTimeoutRef.current = window.setTimeout(() => {
      scheduledTimeoutRef.current = null;
      scheduledForRef.current = null;
      setNextCallAt(null);
      attemptProcessing('final');
    }, delayMs);
  }, []);

  const scheduleProcessing = useCallback(() => {
    if (!isSupported || !isOnline) return;
    if (processingRef.current) return;
    if (!bufferRef.current) return;

    const now = Date.now();
    const recent = cleanOld(apiCallTimestampsRef.current);
    const capWait = recent.length >= 30 ? (60000 - (now - recent[0])) : 0;
    if (capWait > 0) {
      scheduleTimer(capWait);
    } else {
      attemptProcessing('final');
    }
  }, [MIN_DEBOUNCE_MS, cleanOld, isOnline, isSupported, scheduleTimer]);

  const scheduleStreamProcessing = useCallback(() => {
    if (!isSupported || !isOnline) return;
    if (processingRef.current) return;

    const now = Date.now();
    // Only if we appear to still be speaking
    if (now - (lastBufferAppendAtRef.current || now) > STILL_SPEAKING_WINDOW_MS) return;

    const sinceLast = now - (lastStreamCallAtRef.current || 0);
    const waitMs = Math.max(0, STREAM_INTERVAL_MS - sinceLast);

    if (streamTimerRef.current !== null) {
      clearTimeout(streamTimerRef.current);
      streamTimerRef.current = null;
    }
    streamTimerRef.current = window.setTimeout(() => {
      streamTimerRef.current = null;
      if (ENABLE_STREAMING) attemptProcessing('stream');
    }, waitMs);
  }, []);

  const attemptProcessing = useCallback((mode: 'final' | 'stream' = 'final') => {
    if (!isSupported || !isOnline) return;
    if (processingRef.current) return;

    // Guard by mode
    if (mode === 'final') {
      if (!bufferRef.current) return;
    } else if (mode === 'stream') {
      const nowCheck = Date.now();
      if (nowCheck - (lastBufferAppendAtRef.current || nowCheck) > STILL_SPEAKING_WINDOW_MS) return;
      const hasText = (latestFullTextRef.current && latestFullTextRef.current.length > 0) || (bufferRef.current && bufferRef.current.length > 0);
      if (!hasText) return;
    }

    const now = Date.now();
    const recent = cleanOld(apiCallTimestampsRef.current);

    if (recent.length >= 20) {
      const wait = 60000 - (now - recent[0]);
      if (wait > 0) {
        if (mode === 'final') {
          scheduleTimer(wait);
        } else {
          // stream mode: reschedule another attempt after cap clears
          if (streamTimerRef.current !== null) clearTimeout(streamTimerRef.current);
          streamTimerRef.current = window.setTimeout(() => attemptProcessing('stream'), wait);
        }
      }
      return;
    }

    processNow(mode);
  }, [cleanOld, isOnline, isSupported, scheduleTimer]);

  const processNow = useCallback((mode: 'final' | 'stream' = 'final') => {
    const currentBuffer = bufferRef.current;
    if (mode === 'final' && !currentBuffer) return;

    processingRef.current = true;
    setStatus('processing');
    setLastError('');

    // Remember how much text we considered at this processing moment
    callStartBufferLengthRef.current = currentBuffer ? currentBuffer.length : 0;

    const MAX_PROMPT_CHARS = 500;
    const getCommonPrefixLength = (a: string, b: string): number => {
      const minLen = Math.min(a.length, b.length);
      let i = 0;
      while (i < minLen && a.charCodeAt(i) === b.charCodeAt(i)) {
        i++;
      }
      return i;
    };
    let rawBase = '';
    if (mode === 'stream') {
      const full = latestFullTextRef.current || currentBuffer || '';
      // Use only the delta since the last stream call to avoid reprocessing old text
      let delta = '';
      const prev = lastStreamProcessedTextRef.current || '';
      if (prev && full.startsWith(prev)) {
        delta = full.slice(prev.length);
      } else {
        const common = getCommonPrefixLength(prev, full);
        delta = full.slice(common);
      }
      // If delta is tiny, still provide a small tail for context
      const tail = full.length > 400 ? full.slice(-400) : full;
      rawBase = (delta && delta.trim().length > 0) ? delta : tail;
    } else {
      rawBase = currentBuffer.length > MAX_PROMPT_CHARS ? currentBuffer.slice(-MAX_PROMPT_CHARS) : currentBuffer;
    }

    // No silence confirmation follow-up
    if (mode === 'stream') {
      lastStreamCallAtRef.current = Date.now();
      // Advance processed pointer to current full text snapshot
      lastStreamProcessedTextRef.current = latestFullTextRef.current || currentBuffer || '';
    }

    try {
      // Emit the entire current transcript on natural pause
      if (mode === 'final') {
        const transcript = (latestFullTextRef.current || currentBuffer || '').trim();
        if (transcript) {
          eventBus.emit('input:transcript_updated', { transcript, timestamp: Date.now() });
        }
      }
    } finally {
      processingRef.current = false;
      setStatus(isListening ? 'listening' : 'idle');
    }
  }, [isListening, cleanOld, scheduleProcessing]);

  // Render nothing; this component orchestrates voice -> tasks
  return null;
}

export default VoiceTaskListener;


