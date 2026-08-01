import { useCallback, useEffect, useRef, useState } from "react";
import { transcriptDebug, voiceLog } from "./voiceDebug";

/** Narrow surface of the Web Speech API used here (DOM lib may omit these in some TS configs). */
interface VoiceSpeechRecognitionAlternative {
  readonly transcript: string;
}

interface VoiceSpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: VoiceSpeechRecognitionAlternative;
}

interface VoiceSpeechRecognitionResultList {
  readonly length: number;
  readonly [index: number]: VoiceSpeechRecognitionResult;
}

interface VoiceSpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: VoiceSpeechRecognitionResultList;
}

interface VoiceSpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface VoiceSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((this: VoiceSpeechRecognition, ev: VoiceSpeechRecognitionEvent) => void) | null;
  onerror:
    | ((this: VoiceSpeechRecognition, ev: VoiceSpeechRecognitionErrorEvent) => void)
    | null;
  onend: ((this: VoiceSpeechRecognition, ev: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionConstructor = new () => VoiceSpeechRecognition;

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? undefined;
}

/**
 * Fatal native-runtime errors. Once one of these fires the API is effectively
 * dead for this page-load (no network path to Google's speech service, mic
 * blocked at the OS level, etc.) — there's no point retrying it. We surface
 * `unsupported` so the unified hook can transparently fall back to Whisper.
 */
const FATAL_NATIVE_ERRORS = new Set([
  "network",
  "service-not-allowed",
  "audio-capture",
]);

export interface UseSpeechRecognitionResult {
  readonly supported: boolean;
  readonly listening: boolean;
  readonly interimTranscript: string;
  readonly finalTranscript: string;
  readonly error: string | null;
  readonly start: (opts?: { lang?: string }) => void;
  /** Graceful stop: the engine still emits any trailing final onresult. */
  readonly stop: () => void;
  /** Hard cancel: drops any pending result. Use on unmount / re-listen. */
  readonly abort: () => void;
  readonly reset: () => void;
}

export function useSpeechRecognition(): UseSpeechRecognitionResult {
  const [listening, setListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Sticky once the API errors out fatally — flips `supported` to false so
  // the unified hook can fall back to Whisper for the rest of the session.
  const [runtimeUnsupported, setRuntimeUnsupported] = useState(false);

  const recognitionRef = useRef<VoiceSpeechRecognition | null>(null);
  // Lazy init avoids ever rendering with `supported: false` on the client.
  // SSR is irrelevant — `Root.tsx` lazy-imports the panel.
  const [hasCtor, setHasCtor] = useState<boolean>(() =>
    Boolean(getSpeechRecognitionCtor()),
  );

  useEffect(() => {
    const next = Boolean(getSpeechRecognitionCtor());
    setHasCtor((prev) => (prev === next ? prev : next));
  }, []);

  const supported = hasCtor && !runtimeUnsupported;

  // Graceful stop — Chrome will still fire one trailing `onresult` (final)
  // and then `onend`. The recognition reference is kept until `onend` so
  // that final result can land in state; only the listening flag flips
  // immediately. Use `abort` if you need to drop the pending result.
  const stop = useCallback(() => {
    const r = recognitionRef.current;
    voiceLog("native.stop", { hasRecognition: Boolean(r) });
    if (!r) {
      setListening(false);
      return;
    }
    try {
      r.stop();
    } catch {
      /* already stopped */
    }
    setListening(false);
  }, []);

  const abort = useCallback(() => {
    const r = recognitionRef.current;
    voiceLog("native.abort", { hasRecognition: Boolean(r) });
    recognitionRef.current = null;
    try {
      r?.abort();
    } catch {
      /* ignore */
    }
    setListening(false);
  }, []);

  const reset = useCallback(() => {
    voiceLog("native.reset");
    abort();
    setInterimTranscript("");
    setFinalTranscript("");
    setError(null);
  }, [abort]);

  useEffect(() => {
    return () => {
      const r = recognitionRef.current;
      recognitionRef.current = null;
      try {
        r?.abort();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const start = useCallback((opts?: { lang?: string }) => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      voiceLog("native.unsupported");
      return;
    }
    const lang = opts?.lang ?? "en-US";
    voiceLog("native.start", { lang });
    setError(null);
    abort();

    let recognition: VoiceSpeechRecognition;
    try {
      recognition = new Ctor();
    } catch {
      voiceLog("native.start.error", { message: "constructor failed" });
      setError("Could not start speech recognition.");
      return;
    }

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onresult = (event: VoiceSpeechRecognitionEvent) => {
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const piece = result[0]?.transcript ?? "";
        if (result.isFinal) {
          final += piece;
        } else {
          interim += piece;
        }
      }

      if (final) {
        voiceLog("native.result.final", transcriptDebug(final));
        setFinalTranscript((prev) =>
          prev ? `${prev.trimEnd()} ${final.trim()}` : final.trim(),
        );
      }
      if (interim) {
        voiceLog("native.result.interim", transcriptDebug(interim));
        setInterimTranscript(interim);
      } else if (final) {
        setInterimTranscript("");
      }
    };

    recognition.onerror = (ev: VoiceSpeechRecognitionErrorEvent) => {
      voiceLog("native.error", {
        error: ev.error,
        message: ev.message,
      });
      if (ev.error === "aborted" || ev.error === "no-speech") {
        return;
      }
      if (ev.error === "not-allowed") {
        setError("Microphone permission denied");
        setListening(false);
        recognitionRef.current = null;
        return;
      }
      if (FATAL_NATIVE_ERRORS.has(ev.error)) {
        // Web Speech API is dead for this session — flip to unsupported so
        // the unified hook switches to Whisper. Don't surface the raw error
        // (the user doesn't care about Google STT internals).
        setRuntimeUnsupported(true);
        setError(null);
        setListening(false);
        recognitionRef.current = null;
        return;
      }
      setError(ev.message || ev.error || "Speech recognition error");
      setListening(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      voiceLog("native.end");
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
      }
      setListening(false);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      voiceLog("native.started");
      setListening(true);
      setInterimTranscript("");
    } catch {
      voiceLog("native.start.error", { message: "start failed" });
      setError("Could not start speech recognition.");
      recognitionRef.current = null;
      setListening(false);
    }
  }, [abort]);

  return {
    supported,
    listening,
    interimTranscript,
    finalTranscript,
    error,
    start,
    stop,
    abort,
    reset,
  };
}
