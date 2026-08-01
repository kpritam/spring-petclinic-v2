import { useCallback, useEffect, useRef } from "react";
import { useSpeechRecognition } from "./useSpeechRecognition";
import {
  useWhisperSTT,
  type WhisperLoadStatus,
} from "./useWhisperSTT";
import { voiceLog } from "./voiceDebug";

/**
 * Common shape for native (Web Speech API) and Whisper-fallback STT.
 * Native streams interim + final transcripts; Whisper is single-shot
 * (record → stop → transcript). Whisper-only metadata is reported as
 * `ready` / `1` / `false` in native mode so callers don't need to branch.
 */
export interface UnifiedSTT {
  readonly mode: "native" | "whisper";
  readonly supported: boolean;
  readonly listening: boolean;
  readonly interimTranscript: string;
  readonly finalTranscript: string;
  readonly error: string | null;
  readonly start: (opts?: { lang?: string }) => void;
  /** Graceful stop — native mode still emits a trailing final transcript. */
  readonly stop: () => void;
  /** Hard cancel — drops any pending transcript. */
  readonly abort: () => void;
  readonly reset: () => void;
  readonly modelLoadStatus: WhisperLoadStatus;
  readonly modelLoadProgress: number;
  readonly transcribing: boolean;
}

/**
 * Prefer the native Web Speech API; fall back to the in-browser Whisper
 * pipeline. Both hooks are always called (hooks must run unconditionally)
 * but only the active one is exercised by `start()`.
 *
 * If the user calls `start()` while native is supported and native then
 * errors fatally (typically `network` because Google's STT service is
 * unreachable), `useSpeechRecognition` flips its `supported` flag and
 * we transparently restart on Whisper. The caller doesn't have to know.
 */
export function useUnifiedSTT(): UnifiedSTT {
  const native = useSpeechRecognition();
  const whisper = useWhisperSTT();

  const usingNative = native.supported;
  const wantsListenRef = useRef(false);
  const langRef = useRef<string>("en-US");

  const start = useCallback(
    (opts?: { lang?: string }) => {
      wantsListenRef.current = true;
      if (opts?.lang) langRef.current = opts.lang;
      voiceLog("stt.start", {
        mode: native.supported ? "native" : "whisper",
        lang: langRef.current,
      });
      if (native.supported) {
        native.start(opts);
      } else {
        whisper.start(opts);
      }
    },
    [native, whisper],
  );

  const stop = useCallback(() => {
    wantsListenRef.current = false;
    voiceLog("stt.stop", { mode: usingNative ? "native" : "whisper" });
    if (usingNative) native.stop();
    else whisper.stop();
  }, [usingNative, native, whisper]);

  const abort = useCallback(() => {
    wantsListenRef.current = false;
    voiceLog("stt.abort", { mode: usingNative ? "native" : "whisper" });
    if (usingNative) native.abort();
    else whisper.stop();
  }, [usingNative, native, whisper]);

  const reset = useCallback(() => {
    wantsListenRef.current = false;
    voiceLog("stt.reset", { mode: usingNative ? "native" : "whisper" });
    if (usingNative) native.reset();
    else whisper.reset();
  }, [usingNative, native, whisper]);

  /**
   * If we asked native to listen and it died fatally (mode flipped to
   * whisper), kick off whisper so the user doesn't have to tap twice.
   */
  useEffect(() => {
    if (usingNative) return;
    if (!wantsListenRef.current) return;
    if (whisper.listening || whisper.transcribing || whisper.error) return;
    voiceLog("stt.fallback-to-whisper");
    whisper.start({ lang: langRef.current });
  }, [usingNative, whisper]);

  if (usingNative) {
    return {
      mode: "native",
      supported: true,
      listening: native.listening,
      interimTranscript: native.interimTranscript,
      finalTranscript: native.finalTranscript,
      error: native.error,
      start,
      stop,
      abort,
      reset,
      modelLoadStatus: "ready",
      modelLoadProgress: 1,
      transcribing: false,
    };
  }

  return {
    mode: "whisper",
    supported: whisper.supported,
    listening: whisper.listening,
    interimTranscript: whisper.interimTranscript,
    finalTranscript: whisper.finalTranscript,
    error: whisper.error,
    start,
    stop,
    abort,
    reset,
    modelLoadStatus: whisper.modelLoadStatus,
    modelLoadProgress: whisper.modelLoadProgress,
    transcribing: whisper.transcribing,
  };
}
