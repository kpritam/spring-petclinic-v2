import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Thin, idempotent wrapper around `window.speechSynthesis` with a FIFO queue
 * so streamed answers can be spoken sentence-by-sentence. Guarantees:
 *
 *   1. `cancel()` empties the queue, aborts the live utterance, and resets
 *      internal state. Callers that re-enqueue after `cancel()` start a
 *      brand new utterance chain.
 *   2. The hook cancels automatically on unmount — no leftover TTS after
 *      the chat panel is closed, the mode is switched, or the route changes.
 *
 * Browser quirk: `speechSynthesis.cancel()` fires `onend`/`onerror` on the
 * in-flight utterance which would normally try to advance our queue. We
 * flip `processingRef` to `false` and empty the queue BEFORE calling cancel
 * so the `finish` callback is a no-op on the cancellation path.
 */
export interface UseSpeechSynthesisResult {
  readonly supported: boolean;
  readonly speaking: boolean;
  readonly voices: readonly SpeechSynthesisVoice[];
  readonly speak: (
    text: string,
    opts?: {
      voice?: SpeechSynthesisVoice;
      rate?: number;
      pitch?: number;
    },
  ) => void;
  readonly cancel: () => void;
  readonly enqueue: (text: string) => void;
}

function pickDefaultVoice(
  list: readonly SpeechSynthesisVoice[],
): SpeechSynthesisVoice | undefined {
  const en = list.filter((v) => v.lang.toLowerCase().startsWith("en"));
  const pool = en.length > 0 ? en : [...list];
  const remote = pool.find((v) => v.localService === false);
  if (remote) {
    return remote;
  }
  return pool[0];
}

export function useSpeechSynthesis(): UseSpeechSynthesisResult {
  const supported =
    typeof window !== "undefined" && typeof speechSynthesis !== "undefined";

  const [voices, setVoices] = useState<readonly SpeechSynthesisVoice[]>([]);
  const [speaking, setSpeaking] = useState(false);

  const queueRef = useRef<string[]>([]);
  const processingRef = useRef(false);
  const defaultVoiceRef = useRef<SpeechSynthesisVoice | undefined>(undefined);

  const refreshVoices = useCallback(() => {
    if (!supported) {
      return;
    }
    const v = speechSynthesis.getVoices();
    setVoices(v);
    defaultVoiceRef.current = pickDefaultVoice(v);
  }, [supported]);

  useEffect(() => {
    if (!supported) {
      return;
    }
    refreshVoices();
    const previous = speechSynthesis.onvoiceschanged;
    const handler: typeof speechSynthesis.onvoiceschanged = () => {
      refreshVoices();
    };
    speechSynthesis.onvoiceschanged = handler;
    return () => {
      if (speechSynthesis.onvoiceschanged === handler) {
        speechSynthesis.onvoiceschanged = previous;
      }
    };
  }, [supported, refreshVoices]);

  const processQueue = useCallback(() => {
    if (!supported) {
      return;
    }
    if (processingRef.current) {
      return;
    }
    const next = queueRef.current.shift();
    if (!next) {
      setSpeaking(false);
      return;
    }
    processingRef.current = true;
    setSpeaking(true);

    const utterance = new SpeechSynthesisUtterance(next);
    const voice =
      defaultVoiceRef.current ??
      pickDefaultVoice(speechSynthesis.getVoices());
    if (voice) {
      utterance.voice = voice;
    }
    utterance.lang = voice?.lang ?? "en-US";

    const finish = (): void => {
      processingRef.current = false;
      if (queueRef.current.length === 0) {
        setSpeaking(false);
      }
      processQueue();
    };

    utterance.onend = finish;
    utterance.onerror = finish;

    try {
      speechSynthesis.speak(utterance);
    } catch {
      processingRef.current = false;
      finish();
    }
  }, [supported]);

  const cancel = useCallback(() => {
    if (!supported) {
      return;
    }
    queueRef.current = [];
    processingRef.current = false;
    try {
      speechSynthesis.cancel();
    } catch {
      // Chromium occasionally throws if cancel races with tab suspension —
      // the subsequent state reset still leaves us in a consistent idle state.
    }
    setSpeaking(false);
  }, [supported]);

  const speak = useCallback(
    (
      text: string,
      opts?: {
        voice?: SpeechSynthesisVoice;
        rate?: number;
        pitch?: number;
      },
    ) => {
      if (!supported) {
        return;
      }
      cancel();
      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }
      processingRef.current = true;
      setSpeaking(true);
      const utterance = new SpeechSynthesisUtterance(trimmed);
      const voice =
        opts?.voice ??
        defaultVoiceRef.current ??
        pickDefaultVoice(speechSynthesis.getVoices());
      if (voice) {
        utterance.voice = voice;
      }
      utterance.lang = voice?.lang ?? "en-US";
      if (opts?.rate != null) {
        utterance.rate = opts.rate;
      }
      if (opts?.pitch != null) {
        utterance.pitch = opts.pitch;
      }
      const finish = (): void => {
        processingRef.current = false;
        setSpeaking(false);
      };
      utterance.onend = finish;
      utterance.onerror = finish;
      try {
        speechSynthesis.speak(utterance);
      } catch {
        finish();
      }
    },
    [supported, cancel],
  );

  const enqueue = useCallback(
    (text: string) => {
      if (!supported) {
        return;
      }
      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }
      queueRef.current.push(trimmed);
      processQueue();
    },
    [supported, processQueue],
  );

  /**
   * Every VoiceMode mount/unmount (panel close, mode switch, route change)
   * must flush `speechSynthesis`; otherwise a live utterance keeps talking
   * long after the UI is gone. Stash cancel in a ref so the cleanup fires
   * exactly once, on unmount.
   */
  const cancelRef = useRef(cancel);
  cancelRef.current = cancel;
  useEffect(() => {
    return () => {
      cancelRef.current();
    };
  }, []);

  const stableVoices = useMemo(() => voices, [voices]);

  return {
    supported,
    speaking,
    voices: stableVoices,
    speak,
    cancel,
    enqueue,
  };
}
