import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useSileroVAD } from "./useSileroVAD";
import { useUnifiedSTT } from "./useUnifiedSTT";
import { transcriptDebug, voiceLog } from "./voiceDebug";

/*
 * idle       - mic off.
 * listening  - actively recording; interimText updates live.
 * finalizing - mic just stopped; waiting on a trailing native result or a
 *              Whisper transcription before the utterance can be delivered.
 */
export type VoiceCapturePhase = "idle" | "listening" | "finalizing";

/*
 * Fallback phrase-end timeout used when Silero VAD is unavailable or its
 * model is still downloading. When VAD is available this timer never
 * fires - VAD's onSpeechEnd short-circuits it in roughly 250ms.
 */
const PHRASE_END_MS = 600;
const NATIVE_STOP_GRACE_MS = 2500;

export interface UseVoiceCaptureResult {
  readonly supported: boolean;
  readonly phase: VoiceCapturePhase;
  /** Live transcript while phase === "listening"; empty otherwise. */
  readonly interimText: string;
  readonly error: string | null;
  /** idle -> start listening. listening -> graceful stop. No-op while finalizing. */
  readonly toggle: () => void;
  /** Hard-stop: abort STT, pause VAD, drop any pending transcript, reset to idle. */
  readonly cancel: () => void;
}

export interface UseVoiceCaptureOptions {
  /**
   * Fired once per finished turn with the finalized, non-empty transcript.
   * The caller owns everything downstream (adding the message, asking the
   * engine, speaking the reply) - this hook only turns audio into text.
   */
  readonly onUtterance: (text: string) => void;
}

/**
 * Mic capture: unified native/Whisper STT plus Silero VAD for turn-taking,
 * with no knowledge of the chat engine or TTS. Extracted from the old
 * VoiceMode so the composer can drive one shared conversation instead of a
 * parallel voice-only transcript.
 */
export function useVoiceCapture(
  opts: UseVoiceCaptureOptions,
): UseVoiceCaptureResult {
  const { onUtterance } = opts;
  const stt = useUnifiedSTT();

  const [phase, setPhaseState] = useState<VoiceCapturePhase>("idle");
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const sttRef = useRef(stt);
  sttRef.current = stt;
  const phaseRef = useRef(phase);
  const onUtteranceRef = useRef(onUtterance);
  onUtteranceRef.current = onUtterance;

  const phraseTimerRef = useRef<number | null>(null);
  const nativeStopTimerRef = useRef<number | null>(null);
  const awaitingNativeStopRef = useRef(false);

  const setPhase = useCallback((next: VoiceCapturePhase) => {
    if (phaseRef.current !== next) {
      voiceLog("capture.phase", { from: phaseRef.current, to: next });
    }
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  const clearPhraseTimer = useCallback(() => {
    if (phraseTimerRef.current != null) {
      window.clearTimeout(phraseTimerRef.current);
      phraseTimerRef.current = null;
    }
  }, []);

  const clearNativeStopTimer = useCallback(() => {
    if (nativeStopTimerRef.current != null) {
      window.clearTimeout(nativeStopTimerRef.current);
      nativeStopTimerRef.current = null;
    }
  }, []);

  const transcriptFromState = useCallback(() => {
    return `${sttRef.current.finalTranscript} ${sttRef.current.interimTranscript}`.trim();
  }, []);

  const finalize = useCallback(
    (reason: string) => {
      const text = transcriptFromState();
      voiceLog("capture.finalize", {
        reason,
        mode: sttRef.current.mode,
        ...transcriptDebug(text),
      });
      awaitingNativeStopRef.current = false;
      clearNativeStopTimer();
      sttRef.current.reset();
      setInterimText("");
      setPhase("idle");
      if (text) {
        onUtteranceRef.current(text);
      }
    },
    [clearNativeStopTimer, setPhase, transcriptFromState],
  );

  const startNativeStopDeadline = useCallback(
    (reason: string) => {
      clearNativeStopTimer();
      nativeStopTimerRef.current = window.setTimeout(() => {
        if (!awaitingNativeStopRef.current) return;
        voiceLog("capture.native.stop.timeout", { reason });
        finalize(`${reason}:timeout`);
      }, NATIVE_STOP_GRACE_MS);
    },
    [clearNativeStopTimer, finalize],
  );

  const stopNativeAndWaitForFinal = useCallback(
    (reason: string) => {
      awaitingNativeStopRef.current = true;
      voiceLog("capture.native.stop.request", { reason });
      setPhase("finalizing");
      sttRef.current.stop();
      startNativeStopDeadline(reason);
    },
    [setPhase, startNativeStopDeadline],
  );

  /*
   * Silero VAD speech-end handler - fires the moment the speaker pauses for
   * the "redemption" window (~250ms), far snappier than the timer fallback.
   */
  const onVadSpeechEnd = useCallback(() => {
    if (phaseRef.current !== "listening") return;
    if (awaitingNativeStopRef.current) return;
    if (sttRef.current.mode === "native") {
      const hasContent =
        sttRef.current.finalTranscript.trim().length > 0 ||
        sttRef.current.interimTranscript.trim().length > 0;
      if (!hasContent) return;
      voiceLog("capture.vad.handoff", { mode: "native" });
      clearPhraseTimer();
      stopNativeAndWaitForFinal("vad-end");
    } else {
      voiceLog("capture.vad.handoff", { mode: "whisper" });
      sttRef.current.stop();
    }
  }, [clearPhraseTimer, stopNativeAndWaitForFinal]);

  const vad = useSileroVAD({ onSpeechEnd: onVadSpeechEnd });
  const vadRef = useRef(vad);
  vadRef.current = vad;

  const cancel = useCallback(() => {
    voiceLog("capture.cancel", {
      phase: phaseRef.current,
      mode: sttRef.current.mode,
    });
    sttRef.current.abort();
    // Pause (don't destroy) so the next mic tap doesn't pay the Silero
    // model load cost again. The unmount effect below tears it down fully.
    void vadRef.current.stop();
    clearPhraseTimer();
    clearNativeStopTimer();
    awaitingNativeStopRef.current = false;
    setInterimText("");
    setError(null);
    setPhase("idle");
  }, [clearPhraseTimer, clearNativeStopTimer, setPhase]);

  const cancelRef = useRef(cancel);
  cancelRef.current = cancel;

  // Belt-and-braces: unmount (panel close, route change, etc.) must drop
  // the mic and any timers even if the caller forgot to call cancel().
  useEffect(() => {
    return () => {
      cancelRef.current();
    };
  }, []);

  useEffect(() => {
    if (phase === "listening" && stt.error) {
      setPhase("idle");
    }
  }, [phase, stt.error, setPhase]);

  /*
   * If the STT service stops while we still think we're listening (tab
   * blur, timeout, permission revoke), drop back to idle - but not while
   * Whisper is still downloading its model or transcribing.
   */
  useEffect(() => {
    if (phase !== "listening" || stt.listening || stt.error) {
      return;
    }
    if (stt.mode === "whisper" && stt.modelLoadStatus !== "ready") {
      return;
    }
    if (stt.mode === "whisper" && stt.transcribing) {
      return;
    }
    const id = window.setTimeout(() => {
      const s = sttRef.current;
      if (phaseRef.current !== "listening") return;
      if (s.listening || s.error) return;
      if (s.mode === "whisper" && s.modelLoadStatus !== "ready") return;
      if (s.mode === "whisper" && s.transcribing) return;
      setPhase("idle");
    }, 600);
    return () => window.clearTimeout(id);
  }, [
    phase,
    stt.listening,
    stt.error,
    stt.mode,
    stt.modelLoadStatus,
    stt.transcribing,
    setPhase,
  ]);

  /*
   * Drive VAD lifecycle off the listening phase. Starting it lazily on the
   * first listen avoids paying the ~1.6MB Silero download for users who
   * never use voice input. We never tear it down between turns - keeping
   * the worklet warm makes turn-taking feel instant.
   */
  useEffect(() => {
    if (phase === "listening") {
      void vad.start();
    } else if (vad.listening) {
      void vad.stop();
    }
  }, [phase, vad]);

  /*
   * Native (Web Speech API) auto-stop on phrase-end silence. Only runs in
   * native mode - Whisper has no interim activity and is driven by mic taps.
   */
  useEffect(() => {
    if (stt.mode !== "native" || phase !== "listening") {
      clearPhraseTimer();
      return;
    }
    const { interimTranscript, finalTranscript, listening } = sttRef.current;
    if (!listening || interimTranscript.trim() || !finalTranscript.trim()) {
      clearPhraseTimer();
      return;
    }
    clearPhraseTimer();
    phraseTimerRef.current = window.setTimeout(() => {
      if (phaseRef.current !== "listening") return;
      if (sttRef.current.interimTranscript.trim()) return;
      if (!sttRef.current.finalTranscript.trim()) return;
      clearPhraseTimer();
      stopNativeAndWaitForFinal("phrase-end");
    }, PHRASE_END_MS);
    return () => clearPhraseTimer();
  }, [
    stt.mode,
    phase,
    stt.listening,
    stt.finalTranscript,
    stt.interimTranscript,
    clearPhraseTimer,
    stopNativeAndWaitForFinal,
  ]);

  // Trailing native finalTranscript during the graceful-stop window.
  useEffect(() => {
    if (!awaitingNativeStopRef.current) return;
    if (stt.mode !== "native" || phase !== "finalizing") return;
    if (!stt.finalTranscript.trim()) return;
    finalize("native-final");
  }, [stt.mode, stt.finalTranscript, phase, finalize]);

  /*
   * Whisper fallback: when the user stops recording, the hook transcribes
   * asynchronously and eventually populates finalTranscript.
   */
  useEffect(() => {
    if (stt.mode !== "whisper" || phase !== "finalizing" || stt.transcribing) {
      return;
    }
    const text = stt.finalTranscript.trim();
    if (!text) return;
    voiceLog("capture.whisper.final", transcriptDebug(text));
    finalize("whisper-final");
  }, [stt.mode, stt.transcribing, stt.finalTranscript, phase, finalize]);

  /* Whisper returned nothing intelligible - drop back to idle instead of hanging. */
  useEffect(() => {
    if (stt.mode !== "whisper" || phase !== "finalizing") return;
    if (
      stt.transcribing ||
      stt.listening ||
      stt.finalTranscript.trim() ||
      stt.error
    ) {
      return;
    }
    const id = window.setTimeout(() => {
      if (
        phaseRef.current === "finalizing" &&
        !sttRef.current.transcribing &&
        !sttRef.current.listening &&
        !sttRef.current.finalTranscript.trim()
      ) {
        voiceLog("capture.whisper.empty");
        setPhase("idle");
      }
    }, 600);
    return () => window.clearTimeout(id);
  }, [
    stt.mode,
    stt.transcribing,
    stt.listening,
    stt.finalTranscript,
    stt.error,
    phase,
    setPhase,
  ]);

  useEffect(() => {
    if (phase !== "listening") {
      setInterimText("");
      return;
    }
    setInterimText(`${stt.finalTranscript} ${stt.interimTranscript}`.trim());
  }, [phase, stt.finalTranscript, stt.interimTranscript]);

  useEffect(() => {
    if (stt.error) {
      setError(stt.error);
    }
  }, [stt.error]);

  // Branches on phaseRef (not the `phase` state variable) so a synchronous
  // cancel() followed immediately by toggle() in the same event handler -
  // the barge-in pattern - sees cancel's effect right away instead of a
  // stale pre-cancel phase from this render's closure.
  const toggle = useCallback(() => {
    const current = phaseRef.current;
    if (current === "finalizing") {
      return;
    }
    if (current === "listening") {
      clearPhraseTimer();
      if (sttRef.current.mode === "whisper") {
        voiceLog("capture.whisper.stop.request");
        sttRef.current.stop();
        setPhase("finalizing");
        return;
      }
      stopNativeAndWaitForFinal("manual-stop");
      return;
    }
    setError(null);
    sttRef.current.reset();
    sttRef.current.start({ lang: "en-US" });
    setInterimText("");
    setPhase("listening");
  }, [clearPhraseTimer, setPhase, stopNativeAndWaitForFinal]);

  return useMemo(
    () => ({
      supported: stt.supported,
      phase,
      interimText,
      error,
      toggle,
      cancel,
    }),
    [stt.supported, phase, interimText, error, toggle, cancel],
  );
}
