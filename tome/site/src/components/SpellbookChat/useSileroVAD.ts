import { useCallback, useEffect, useRef, useState } from "react";

import { voiceLog } from "./voiceDebug";

/**
 * Async, non-typed import of `@ricky0123/vad-web`. We dynamic-import it so
 * Docusaurus' SSR build never evaluates the AudioWorklet/onnxruntime-web
 * dependency tree (already aliased to a stub for the server target — this
 * extra layer keeps the client bundle async-only too).
 */
type MicVADInstance = {
  readonly start: () => Promise<void>;
  readonly pause: () => Promise<void>;
  readonly destroy: () => Promise<void>;
  listening: boolean;
  errored: string | null;
};

interface MicVADStatic {
  new: (
    options: Partial<{
      onSpeechStart: () => void | Promise<void>;
      onSpeechEnd: (audio: Float32Array) => void | Promise<void>;
      onVADMisfire: () => void | Promise<void>;
      model: "v5" | "legacy";
      // Silero v5 thresholds — tuned for "stop talking immediately when
      // they pause" rather than "wait for an obvious silence".
      positiveSpeechThreshold: number;
      negativeSpeechThreshold: number;
      redemptionFrames: number;
      preSpeechPadFrames: number;
      minSpeechFrames: number;
    }>,
  ) => Promise<MicVADInstance>;
}

let cachedModule: { MicVAD: MicVADStatic } | null = null;
async function loadVadModule(): Promise<{ MicVAD: MicVADStatic }> {
  if (cachedModule) return cachedModule;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod = (await import("@ricky0123/vad-web")) as any;
  cachedModule = mod as { MicVAD: MicVADStatic };
  return cachedModule;
}

export type SileroLoadStatus = "idle" | "loading" | "ready" | "error";

export interface UseSileroVADResult {
  /** `true` once the VAD module + model are loaded and a `MicVAD` exists. */
  readonly ready: boolean;
  readonly loadStatus: SileroLoadStatus;
  readonly listening: boolean;
  readonly error: string | null;
  /** Idempotent. Lazy-loads the VAD module + Silero model on first call. */
  readonly start: () => Promise<void>;
  /** Pause the underlying mic stream; safe to call when not started. */
  readonly stop: () => Promise<void>;
  /** Tear down VAD and release the mic. Use on unmount. */
  readonly destroy: () => Promise<void>;
}

export interface UseSileroVADOptions {
  /** Fired the moment Silero detects voiced audio above the threshold. */
  readonly onSpeechStart?: () => void;
  /**
   * Fired when Silero detects the speaker has stopped (post-redemption).
   * The `audio` argument is the captured speech segment (16 kHz mono
   * Float32 in [-1, 1]); we don't currently use it because native STT
   * and Whisper own their own audio pipelines, but it's there if a
   * future revision wants to feed it directly into Whisper to drop
   * push-to-talk entirely.
   */
  readonly onSpeechEnd?: (audio: Float32Array) => void;
  /** Detected speech start but segment was below `minSpeechFrames`. */
  readonly onMisfire?: () => void;
  /**
   * Disable the hook entirely (e.g. while the engine is loading or the
   * user is in a non-voice mode). Keeps the React tree shape stable so
   * the consuming component doesn't have to conditionally call hooks.
   */
  readonly enabled?: boolean;
}

/**
 * Voice Activity Detection backed by Silero v5 via `@ricky0123/vad-web`.
 *
 * Silero gives us a hard speech-end signal in roughly the time it takes
 * a human to draw a breath (~80–250 ms) instead of the legacy 1.2-second
 * trailing-silence timer the chat used to fall back on. The win is most
 * dramatic for follow-up questions where the user pauses naturally
 * mid-sentence — the old timer would treat that as the end of the turn,
 * the model would speak too early, and the user would talk over the
 * assistant. With VAD redemption frames the model only fires on real
 * silence.
 *
 * The hook owns its own `MicVAD` instance and mic stream; it doesn't
 * compete with native STT or the Whisper recorder, which manage their
 * own audio pipelines. Browsers grant mic permission once, so the user
 * still sees only one prompt.
 */
export function useSileroVAD(opts: UseSileroVADOptions = {}): UseSileroVADResult {
  const { onSpeechStart, onSpeechEnd, onMisfire, enabled = true } = opts;

  const [loadStatus, setLoadStatus] = useState<SileroLoadStatus>("idle");
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vadRef = useRef<MicVADInstance | null>(null);
  const onStartRef = useRef(onSpeechStart);
  onStartRef.current = onSpeechStart;
  const onEndRef = useRef(onSpeechEnd);
  onEndRef.current = onSpeechEnd;
  const onMisfireRef = useRef(onMisfire);
  onMisfireRef.current = onMisfire;
  const wantStartRef = useRef(false);

  const ensureVad = useCallback(async (): Promise<MicVADInstance> => {
    if (vadRef.current) return vadRef.current;
    if (
      typeof window === "undefined" ||
      typeof window.AudioContext === "undefined" ||
      typeof navigator === "undefined" ||
      typeof navigator.mediaDevices?.getUserMedia !== "function"
    ) {
      // jsdom and SSR have neither AudioContext nor a real getUserMedia, so
      // there is nothing the VAD can do. Surface a soft-disabled state so
      // the consumer's `enabled` branch still works without firing a long
      // chain of model-fetch errors.
      throw new Error("AudioContext unavailable; VAD disabled");
    }
    setLoadStatus((s) => (s === "ready" ? s : "loading"));
    setError(null);
    const { MicVAD } = await loadVadModule();
    voiceLog("vad.module-loaded");
    const instance = await MicVAD.new({
      // Silero v5 is the current default in vad-web; it's a strict
      // upgrade over the legacy model in both accuracy and CPU cost
      // (smaller model, runs in the worklet not the main thread).
      model: "v5",
      // The defaults are fine for most cases; tuning these hurts more
      // than it helps. Documented here for future experimentation:
      //   positiveSpeechThreshold: 0.5
      //   negativeSpeechThreshold: 0.35
      //   redemptionFrames: 8 (≈260 ms at 32 ms frame size)
      //   preSpeechPadFrames: 1
      //   minSpeechFrames: 9 (≈300 ms; filters tongue clicks)
      onSpeechStart: () => {
        voiceLog("vad.speech-start");
        onStartRef.current?.();
      },
      onSpeechEnd: (audio: Float32Array) => {
        voiceLog("vad.speech-end", { samples: audio.length });
        onEndRef.current?.(audio);
      },
      onVADMisfire: () => {
        voiceLog("vad.misfire");
        onMisfireRef.current?.();
      },
    });
    vadRef.current = instance;
    setLoadStatus("ready");
    return instance;
  }, []);

  const start = useCallback(async (): Promise<void> => {
    if (!enabled) return;
    wantStartRef.current = true;
    try {
      const instance = await ensureVad();
      if (!wantStartRef.current) return;
      await instance.start();
      setListening(true);
      voiceLog("vad.started");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "VAD start failed";
      // "AudioContext unavailable" is the soft-disabled path used in
      // jsdom/SSR — silence those so we don't pollute the console of
      // every test run with VAD warnings.
      if (msg !== "AudioContext unavailable; VAD disabled") {
        voiceLog("vad.start.error", { message: msg });
        setLoadStatus("error");
        setError(msg);
      } else {
        setLoadStatus("error");
      }
      setListening(false);
    }
  }, [enabled, ensureVad]);

  const stop = useCallback(async (): Promise<void> => {
    wantStartRef.current = false;
    const instance = vadRef.current;
    if (!instance) return;
    try {
      await instance.pause();
    } catch (e) {
      voiceLog("vad.stop.error", {
        message: e instanceof Error ? e.message : String(e),
      });
    }
    setListening(false);
  }, []);

  const destroy = useCallback(async (): Promise<void> => {
    wantStartRef.current = false;
    const instance = vadRef.current;
    vadRef.current = null;
    setListening(false);
    if (!instance) return;
    try {
      await instance.destroy();
    } catch (e) {
      voiceLog("vad.destroy.error", {
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }, []);

  // Tear down on unmount so the mic indicator clears even if the parent
  // forgot to call destroy().
  useEffect(() => {
    return () => {
      void destroy();
    };
  }, [destroy]);

  return {
    ready: loadStatus === "ready",
    loadStatus,
    listening,
    error,
    start,
    stop,
    destroy,
  };
}
