import { useEffect, useState, useRef, useCallback } from 'react';
import { eventBus } from '@/lib/eventBus';

const MIN_DEBOUNCE_MS = 500; // 500ms
import { useSpeechTranscription } from './useSpeechTranscription';
// Cerebras calls removed; this component now only buffers transcript and emits updates

type Status = 'idle' | 'listening' | 'processing' | 'error';

export function VoiceTaskListener({ pushToTalk = false }: { pushToTalk?: boolean }) {
  const [buffer, setBuffer] = useState('');
  const [, setStatus] = useState<Status>('idle');
  const [lastError, setLastError] = useState('');
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  const bufferRef = useRef(buffer);
  const processingRef = useRef(false);
  const scheduledTimeoutRef = useRef<number | null>(null);
  const scheduledForRef = useRef<number | null>(null);
  const callStartBufferLengthRef = useRef(0);
  const lastBufferAppendAtRef = useRef<number>(0);
  
  const latestFullTextRef = useRef<string>('');
  const streamTimerRef = useRef<number | null>(null);
  const lastStreamCallAtRef = useRef<number>(0);
  const lastStreamProcessedTextRef = useRef<string>('');
  const lastEmittedFullTextRef = useRef<string>('');
  const attemptProcessingRef = useRef<((mode?: 'final' | 'stream') => void) | null>(null);

  // No AI calls here; VoiceTaskListener is now a pure input buffer

  const STREAM_INTERVAL_MS = 2000; // periodic checks during continuous speech
  const STILL_SPEAKING_WINDOW_MS = 1500; // treat activity within this as still speaking
  const SILENCE_CONFIRM_MS = 500; // wait after last final segment to coalesce phrases (reduced for snappier response)
  const ENABLE_STREAMING = false; // disable streaming task emission to avoid partial-command actions


  useEffect(() => { bufferRef.current = buffer; }, [buffer]);

  const scheduleTimer = useCallback((delayMs: number) => {
    if (scheduledTimeoutRef.current !== null) {
      clearTimeout(scheduledTimeoutRef.current);
      scheduledTimeoutRef.current = null;
    }
    const runAt = Date.now() + delayMs;
    scheduledForRef.current = runAt;
    scheduledTimeoutRef.current = window.setTimeout(() => {
      scheduledTimeoutRef.current = null;
      scheduledForRef.current = null;
      attemptProcessingRef.current?.('final');
    }, delayMs);
  }, []);

  const { isListening, isSupported, start, stop, clear } = useSpeechTranscription({
    autoStart: !pushToTalk,
    continuous: !pushToTalk,
    onTranscript: (data) => {
      console.log('[PTT] Received transcript data:', { data, pushToTalk });
      if (data?.fullText) {
        latestFullTextRef.current = data.fullText.trim();
        console.log('[PTT] Updated latestFullTextRef:', latestFullTextRef.current);
      }
      if (data.final && data.final.trim()) {
        // Compute and set new buffer synchronously to ensure attemptProcessing sees it
        const newBuffer = (bufferRef.current ? bufferRef.current + ' ' : '') + data.final.trim();
        bufferRef.current = newBuffer;
        setBuffer(newBuffer);
        lastBufferAppendAtRef.current = Date.now();
        console.log('[PTT] Updated buffer with final transcript:', { newBuffer, pushToTalk });
        // In continuous mode, coalesce with a short silence timer; in PTT, defer to spacebar release
        if (!pushToTalk) {
          scheduleTimer(SILENCE_CONFIRM_MS);
        }
      } else if (data.interim && data.interim.trim()) {
        console.log('[PTT] Received interim transcript:', data.interim);
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

  // Ensure recorder state matches mode immediately on toggle
  useEffect(() => {
    console.log('[PTT] Mode toggle effect:', { pushToTalk, isSupported, isListening });
    if (!isSupported) return;
    if (pushToTalk) {
      // Turn off continuous listening when entering PTT mode
      console.log('[PTT] Entering PTT mode, stopping continuous listening');
      stop();
    } else {
      // Resume always-on listening when exiting PTT mode if not already
      console.log('[PTT] Exiting PTT mode, resuming continuous listening if needed');
      if (!isListening) {
        start();
      }
    }
  }, [pushToTalk, isSupported, isListening, start, stop]);

  // Push-to-Talk: handle Spacebar hold to temporarily start recording and submit on release
  useEffect(() => {
    console.log('[PTT] Setting up push-to-talk listeners, pushToTalk:', pushToTalk);
    if (!pushToTalk) {
      console.log('[PTT] Push-to-talk disabled, skipping setup');
      return;
    }

    let pttActive = false;
    let pressedAt = 0;

    const isSpaceEvent = (e: KeyboardEvent): boolean => {
      return e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar';
    };

    const onKeyDown = (e: KeyboardEvent) => {
      console.log('[PTT] KeyDown event:', { code: e.code, key: e.key, pushToTalk, isSpaceEvent: isSpaceEvent(e) });
      if (!isSpaceEvent(e)) return;
      if (pttActive) {
        console.log('[PTT] Ignoring repeat space press');
        return; // ignore repeats while held
      }
      console.log('[PTT] Starting push-to-talk recording');
      pttActive = true;
      pressedAt = Date.now();
      e.preventDefault();
      e.stopPropagation();
      // start recording immediately - force start in PTT mode regardless of isListening state
      console.log('[PTT] Attempting to start recording, isListening:', isListening);
      const startResult = start();
      console.log('[PTT] Start recording result:', startResult);
      if (!startResult) {
        console.log('[PTT] Failed to start recording, forcing stop then start');
        stop();
        setTimeout(() => {
          const retryResult = start();
          console.log('[PTT] Retry start result:', retryResult);
        }, 50);
      }
      // cancel any pending silence timers
      if (scheduledTimeoutRef.current !== null) {
        clearTimeout(scheduledTimeoutRef.current);
        scheduledTimeoutRef.current = null;
        scheduledForRef.current = null;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      console.log('[PTT] KeyUp event:', { code: e.code, key: e.key, pushToTalk, isSpaceEvent: isSpaceEvent(e), pttActive });
      if (!isSpaceEvent(e)) return;
      if (!pttActive) {
        console.log('[PTT] KeyUp but PTT not active');
        return;
      }
      console.log('[PTT] Stopping push-to-talk recording');
      pttActive = false;
      e.preventDefault();
      e.stopPropagation();
      // stop recording and immediately submit current buffer (debounce very short presses)
      const heldMs = Date.now() - pressedAt;
      if (isListening) {
        stop();
      }

      // Force AI processing even if no transcript was captured
      // This ensures the AI gets triggered when spacebar is released
      setTimeout(() => {
        const currentBuffer = bufferRef.current || '';
        const latestText = latestFullTextRef.current || '';
        const textToProcess = latestText || currentBuffer || '';

        console.log('[PTT] Force triggering AI with available text:', { textToProcess, currentBuffer, latestText });

        if (textToProcess.trim()) {
          // Emit transcript event to trigger AI processing
          eventBus.emit('input:transcript_updated', {
            transcript: textToProcess.trim(),
            pastTranscript: '',
            currentDirective: textToProcess.trim(),
            timestamp: Date.now()
          });
          console.log('[PTT] Emitted transcript_updated event for AI processing');
        } else {
          console.log('[PTT] No text captured during recording - check microphone permissions');
          // Still try to process in case there's interim text or to trigger error handling
          attemptProcessingRef.current?.('final');
        }
      }, 100); // Small delay to ensure speech recognition has finished
      // Optionally clear interim buffer to avoid accumulation across presses
      // Full text history still maintained in lastEmittedFullTextRef
    };

    console.log('[PTT] Attaching event listeners for push-to-talk');
    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('keyup', onKeyUp, { capture: true });
    return () => {
      console.log('[PTT] Removing event listeners for push-to-talk');
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      window.removeEventListener('keyup', onKeyUp, { capture: true });
    };
  }, [pushToTalk, start, stop]);

  // Compute and emit debug info whenever core state changes
  useEffect(() => {
    eventBus.emit('input:voice_debug', {
      status: !isSupported ? 'error' : processingRef.current ? 'processing' : isListening ? 'listening' : 'idle',
      bufferLength: bufferRef.current.length,
      bufferText: bufferRef.current,
      apiCallsUsedLastMinute: 0, // No longer tracking API calls
      nextCallInMs: null, // No longer rate limiting
      lastError: lastError || null,
      isOnline,
      isSupported
    });
  }, [buffer, lastError, isOnline, isListening, isSupported]);

  const scheduleProcessing = useCallback(() => {
    if (!isSupported || !isOnline) return;
    if (processingRef.current) return;
    if (!bufferRef.current) return;

    attemptProcessingRef.current?.('final');
  }, [isOnline, isSupported]);

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
  }, [scheduleProcessing]);

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
      if (ENABLE_STREAMING) attemptProcessingRef.current?.('stream');
    }, waitMs);
  }, [isOnline, isSupported]);

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

  const processNow = useCallback((mode: 'final' | 'stream' = 'final') => {
    const currentBuffer = bufferRef.current;
    console.log('[PTT] processNow called:', { mode, currentBuffer, latestFullText: latestFullTextRef.current });
    if (mode === 'final' && !currentBuffer) {
      console.log('[PTT] No current buffer, returning early');
      return;
    }

    processingRef.current = true;
    setStatus('processing');
    setLastError('');

    // Remember how much text we considered at this processing moment
    callStartBufferLengthRef.current = currentBuffer ? currentBuffer.length : 0;

    const MAX_PROMPT_CHARS = 500;
    const PAST_CONTEXT_CHARS = 2000;
    const getCommonPrefixLength = (a: string, b: string): number => {
      const minLen = Math.min(a.length, b.length);
      let i = 0;
      while (i < minLen && a.charCodeAt(i) === b.charCodeAt(i)) {
        i++;
      }
      return i;
    };
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
      if ((delta && delta.trim().length > 0) ? delta : tail) {}
    } else {
      if (currentBuffer.length > MAX_PROMPT_CHARS ? currentBuffer.slice(-MAX_PROMPT_CHARS) : currentBuffer) {}
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
        const full = (latestFullTextRef.current || currentBuffer || '').trim();
        console.log('[PTT] Processing final transcript:', { full, currentBuffer, latestFullText: latestFullTextRef.current });
        if (full) {
          const prev = lastEmittedFullTextRef.current || '';
          const common = getCommonPrefixLength(prev, full);
          const directive = full.slice(common).trim();
          console.log('[PTT] Calculated directive:', { directive, prev, common });

          if (directive) {
            const pastFull = full.slice(0, common).trim();
            const pastTranscript = pastFull.length > PAST_CONTEXT_CHARS ? pastFull.slice(-PAST_CONTEXT_CHARS) : pastFull;
            console.log('[PTT] Emitting transcript_updated event:', { transcript: full, directive });
            eventBus.emit('input:transcript_updated', {
              transcript: full,
              pastTranscript,
              currentDirective: directive,
              timestamp: Date.now()
            });
            lastEmittedFullTextRef.current = full;
          } else {
            console.log('[PTT] No directive to emit (directive is empty)');
          }
        } else {
          console.log('[PTT] No full transcript to process');
        }
      }
    } finally {
      processingRef.current = false;
      setStatus(isListening ? 'listening' : 'idle');
    }
  }, [isListening]);

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

    processNow(mode);
  }, [isOnline, isSupported, processNow]);

  // Keep ref in sync to avoid use-before-define in timers/handlers
  useEffect(() => {
    attemptProcessingRef.current = attemptProcessing;
  }, [attemptProcessing]);

  // Render nothing; this component orchestrates voice -> tasks
  return null;
}

export default VoiceTaskListener;


