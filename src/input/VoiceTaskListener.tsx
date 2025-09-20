'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { eventBus } from '@/lib/eventBus';
import { useSpeechTranscription } from './useSpeechTranscription';

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

  const MIN_SPACING_MS = 3000; // ~20 calls/min evenly spaced
  const MIN_DEBOUNCE_MS = 300; // slight coalescing of bursts

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
      if (data.final && data.final.trim()) {
        setBuffer(prev => (prev ? prev + ' ' : '') + data.final.trim());
        lastBufferAppendAtRef.current = Date.now();
        scheduleProcessing();
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
      attemptProcessing();
    }, delayMs);
  }, []);

  const scheduleProcessing = useCallback(() => {
    if (!isSupported || !isOnline) return;
    if (!bufferRef.current || processingRef.current) {
      // If processing, it will reschedule on completion if needed
      return;
    }

    const now = Date.now();
    const recent = cleanOld(apiCallTimestampsRef.current);
    const capWait = recent.length >= 20 ? (60000 - (now - recent[0])) : 0;
    const spacingWait = recent.length > 0 ? Math.max(0, (recent[recent.length - 1] + MIN_SPACING_MS) - now) : 0;
    let waitMs = Math.max(capWait, spacingWait, MIN_DEBOUNCE_MS);

    // If a timer exists but our new calculation is earlier, reschedule
    const desiredRunAt = now + waitMs;
    if (scheduledForRef.current == null || desiredRunAt < scheduledForRef.current) {
      scheduleTimer(waitMs);
    }
  }, [MIN_SPACING_MS, MIN_DEBOUNCE_MS, cleanOld, isOnline, isSupported, scheduleTimer]);

  const attemptProcessing = useCallback(() => {
    if (!isSupported || !isOnline) return;
    if (!bufferRef.current) return;
    if (processingRef.current) return;

    const now = Date.now();
    const recent = cleanOld(apiCallTimestampsRef.current);

    if (recent.length >= 20) {
      const wait = 60000 - (now - recent[0]);
      if (wait > 0) scheduleTimer(wait);
      return;
    }

    const spacingWait = recent.length > 0 ? Math.max(0, (recent[recent.length - 1] + MIN_SPACING_MS) - now) : 0;
    if (spacingWait > 0) {
      scheduleTimer(spacingWait);
      return;
    }

    processNow();
  }, [MIN_SPACING_MS, cleanOld, isOnline, isSupported, scheduleTimer]);

  const processNow = useCallback(() => {
    const currentBuffer = bufferRef.current;
    if (!currentBuffer) return;

    processingRef.current = true;
    setStatus('processing');
    setLastError('');

    // Count this call immediately for rate limiting
    setApiCallTimestamps(prev => {
      const next = cleanOld([...prev, Date.now()]);
      return next;
    });

    // Remember how much of the buffer we're sending
    callStartBufferLengthRef.current = currentBuffer.length;

    const MAX_PROMPT_CHARS = 2000;
    const baseText = currentBuffer.length > MAX_PROMPT_CHARS
      ? currentBuffer.slice(-MAX_PROMPT_CHARS)
      : currentBuffer;

    const now = Date.now();
    const lastAppend = lastBufferAppendAtRef.current || now;
    const silenceMs = Math.max(0, now - lastAppend);
    const textWithSilence = silenceMs > 500
      ? `${baseText} [silence for ${(silenceMs / 1000).toFixed(1)} seconds]`
      : baseText;

    const prompt = `Reasoning: none. Respond immediately.\n` +
      `Analyze the following transcribed speech and extract any specific, actionable tasks.\n` +
      `Guidelines:\n- Be cautious not to extract tasks from incomplete fragments.\n- If a simple, complete command is followed by a silence indicator, assume it's complete and extract it.\n\n` +
      `Return a JSON response with:\n` +
      `1. "tasks": array of specific actionable tasks found\n` +
      `2. "remainder": any text that might be part of an incomplete task\n\n` +
      `Text: "${textWithSilence}"\n\n` +
      `Respond ONLY with valid JSON.`;

    fetch('/api/cerebras-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    })
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((data: unknown) => {
      // Hard validate: object with tasks (string[]) present and optional remainder (string)
      if (!data || typeof data !== 'object') {
        return; // discard
      }
      const obj = data as CerebrasResult;
      if (!('tasks' in obj) || !Array.isArray(obj.tasks) || !obj.tasks.every(t => typeof t === 'string')) {
        return; // discard
      }

      const tasks = (obj.tasks || []).map(t => t.trim()).filter(t => t.length > 0);
      const remainder = typeof obj.remainder === 'string' ? obj.remainder : '';

      if (tasks.length > 0) {
        const nowTs = Date.now();
        eventBus.emit('input:tasks', {
          tasks: tasks.map((text, index) => ({
            id: (globalThis.crypto && 'randomUUID' in globalThis.crypto) ? crypto.randomUUID() : Math.random().toString(36).slice(2),
            text,
            timestamp: nowTs + index,
            source: 'voice'
          }))
        });
      }

      // Update buffer: replace the part we sent with remainder, keep any new text that arrived after call started
      const suffix = bufferRef.current.slice(callStartBufferLengthRef.current);
      const newBuffer = [remainder || '', suffix || ''].filter(Boolean).join(' ').trim();
      setBuffer(newBuffer);
    })
    .catch((error) => {
      // Retry after 5 seconds; keep buffer untouched
      setStatus('error');
      setLastError('Cerebras API error - retrying...');
      window.setTimeout(() => {
        if (bufferRef.current) scheduleProcessing();
      }, 5000);
    })
    .finally(() => {
      processingRef.current = false;
      setStatus(isListening ? 'listening' : 'idle');
      // If more buffer exists, try to schedule next call
      if (bufferRef.current) scheduleProcessing();
    });
  }, [isListening, cleanOld, scheduleProcessing]);

  // Render nothing; this component orchestrates voice -> tasks
  return null;
}

export default VoiceTaskListener;


