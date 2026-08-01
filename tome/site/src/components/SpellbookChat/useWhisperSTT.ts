import { useCallback, useEffect, useRef, useState } from "react";
import { transcriptDebug, voiceLog } from "./voiceDebug";

/**
 * Whisper-based STT fallback for browsers without the native Web Speech API
 * (Firefox, some Chromium derivatives). Single-shot: tap to record, tap
 * again to stop, transcript arrives after a Whisper pass. Uses the same
 * `@huggingface/transformers` runtime as the embedder. The model (~40 MB
 * quantized) downloads once and is browser-cached thereafter.
 */
export type WhisperLoadStatus = "idle" | "loading" | "ready" | "error";

export interface UseWhisperSTTResult {
  readonly supported: boolean;
  readonly listening: boolean;
  readonly interimTranscript: string;
  readonly finalTranscript: string;
  readonly error: string | null;
  readonly start: (opts?: { lang?: string }) => void;
  readonly stop: () => void;
  readonly reset: () => void;
  /** Lifecycle of the on-disk Whisper pipeline. */
  readonly modelLoadStatus: WhisperLoadStatus;
  /** 0 → 1 progress for the initial model download; meaningless after `ready`. */
  readonly modelLoadProgress: number;
  /** True while Whisper is post-processing the captured audio. */
  readonly transcribing: boolean;
}

interface AnyTransformersPipeline {
  (input: Float32Array, options?: Record<string, unknown>): Promise<{
    text?: string;
  }>;
}

let whisperPipelinePromise: Promise<AnyTransformersPipeline> | null = null;

/** Memoized at module scope so `start()` calls and other hook instances share one pipeline. */
async function loadWhisperPipeline(
  onProgress: (progress: number) => void,
): Promise<AnyTransformersPipeline> {
  if (whisperPipelinePromise) {
    return whisperPipelinePromise;
  }
  whisperPipelinePromise = (async () => {
    const transformers = await import("@huggingface/transformers");
    const pipelineFn = transformers.pipeline as unknown as (
      task: string,
      model: string,
      opts?: { progress_callback?: (info: unknown) => void },
    ) => Promise<AnyTransformersPipeline>;
    return pipelineFn("automatic-speech-recognition", "Xenova/whisper-tiny.en", {
      progress_callback: (info: unknown) => {
        if (!info || typeof info !== "object") return;
        const o = info as { status?: string; progress?: number };
        if (
          (o.status === "progress" || o.status === "progress_total") &&
          typeof o.progress === "number"
        ) {
          onProgress(Math.max(0, Math.min(1, o.progress / 100)));
        }
      },
    });
  })();
  whisperPipelinePromise.catch(() => {
    whisperPipelinePromise = null;
  });
  return whisperPipelinePromise;
}

/** Decode the recording into mono 16 kHz Float32, as Whisper expects. */
async function decodeAndResample(blob: Blob): Promise<Float32Array> {
  const arrayBuffer = await blob.arrayBuffer();
  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) {
    throw new Error("AudioContext is not supported in this browser.");
  }
  const ctx = new Ctx();
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    if (audioBuffer.sampleRate === 16000 && audioBuffer.numberOfChannels === 1) {
      return new Float32Array(audioBuffer.getChannelData(0));
    }
    const offline = new OfflineAudioContext(
      1,
      Math.max(1, Math.ceil(audioBuffer.duration * 16000)),
      16000,
    );
    const src = offline.createBufferSource();
    src.buffer = audioBuffer;
    src.connect(offline.destination);
    src.start(0);
    const resampled = await offline.startRendering();
    return new Float32Array(resampled.getChannelData(0));
  } finally {
    ctx.close().catch(() => {
      /* ignore */
    });
  }
}

function detectSupported(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof MediaRecorder === "undefined") return false;
  if (!navigator?.mediaDevices?.getUserMedia) return false;
  if (
    typeof window.AudioContext === "undefined" &&
    typeof (window as unknown as { webkitAudioContext?: unknown })
      .webkitAudioContext === "undefined"
  ) {
    return false;
  }
  return true;
}

function pickRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const m of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m;
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

export function useWhisperSTT(): UseWhisperSTTResult {
  // Lazy initial state — same rationale as `useSpeechRecognition`. Without
  // this, the first render reports `supported: false` and the unified hook
  // briefly shows the "not supported" caption before flipping to true on
  // the next render, which the user can race past with a fast click.
  const [supported, setSupported] = useState<boolean>(() => detectSupported());
  const [listening, setListening] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [modelLoadStatus, setModelLoadStatus] =
    useState<WhisperLoadStatus>("idle");
  const [modelLoadProgress, setModelLoadProgress] = useState(0);
  const [transcribing, setTranscribing] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startSeqRef = useRef(0);

  useEffect(() => {
    const next = detectSupported();
    setSupported((prev) => (prev === next ? prev : next));
  }, []);

  const cleanupTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch {
        /* ignore */
      }
    });
    streamRef.current = null;
  }, []);

  const cleanupRecorder = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        /* ignore */
      }
    }
    recorderRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      cleanupRecorder();
      cleanupTracks();
      chunksRef.current = [];
    };
  }, [cleanupRecorder, cleanupTracks]);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    voiceLog("whisper.stop", { state: recorder?.state ?? "none" });
    if (!recorder) {
      startSeqRef.current += 1;
    }
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        /* ignore */
      }
    }
    setListening(false);
  }, []);

  const reset = useCallback(() => {
    voiceLog("whisper.reset");
    startSeqRef.current += 1;
    cleanupRecorder();
    cleanupTracks();
    chunksRef.current = [];
    setFinalTranscript("");
    setError(null);
    setListening(false);
    setTranscribing(false);
  }, [cleanupRecorder, cleanupTracks]);

  const start = useCallback(
    async (_opts?: { lang?: string }) => {
      if (!supported) {
        voiceLog("whisper.unsupported");
        setError("Voice input is not supported in this browser.");
        return;
      }

      voiceLog("whisper.start", { modelLoadStatus });
      setError(null);
      setFinalTranscript("");
      chunksRef.current = [];
      const seq = ++startSeqRef.current;

      if (modelLoadStatus !== "ready") {
        voiceLog("whisper.model.loading");
        setModelLoadStatus("loading");
        setModelLoadProgress(0);
        try {
          await loadWhisperPipeline((p) => {
            if (startSeqRef.current === seq) {
              setModelLoadProgress(p);
            }
          });
          if (startSeqRef.current !== seq) return;
          voiceLog("whisper.model.ready");
          setModelLoadStatus("ready");
          setModelLoadProgress(1);
        } catch (e) {
          voiceLog("whisper.model.error", {
            message: e instanceof Error ? e.message : String(e),
          });
          setModelLoadStatus("error");
          setError(
            `Could not load voice model: ${
              e instanceof Error ? e.message : String(e)
            }`,
          );
          return;
        }
      }

      let stream: MediaStream;
      try {
        voiceLog("whisper.media.request");
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e) {
        const name = (e as DOMException)?.name;
        voiceLog("whisper.media.error", {
          name,
          message: e instanceof Error ? e.message : String(e),
        });
        setError(
          name === "NotAllowedError" || name === "SecurityError"
            ? "Microphone permission denied"
            : `Could not access microphone: ${
                e instanceof Error ? e.message : String(e)
              }`,
        );
        return;
      }

      if (startSeqRef.current !== seq) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;

      const mimeType = pickRecorderMimeType();
      let recorder: MediaRecorder;
      try {
        recorder = mimeType
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream);
      } catch (e) {
        cleanupTracks();
        voiceLog("whisper.recorder.error", {
          message: e instanceof Error ? e.message : String(e),
        });
        setError(
          `Could not start recorder: ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
        return;
      }

      recorderRef.current = recorder;
      recorder.ondataavailable = (ev: BlobEvent) => {
        if (ev.data && ev.data.size > 0) {
          voiceLog("whisper.recorder.data", { size: ev.data.size });
          chunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        const chunks = chunksRef.current;
        chunksRef.current = [];
        cleanupTracks();
        recorderRef.current = null;
        setListening(false);

        if (chunks.length === 0 || startSeqRef.current !== seq) {
          voiceLog("whisper.stop.empty", { chunks: chunks.length });
          return;
        }
        const blobType = chunks[0]?.type || mimeType || "audio/webm";
        const blob = new Blob(chunks, { type: blobType });
        voiceLog("whisper.stop.blob", {
          size: blob.size,
          type: blob.type,
          chunks: chunks.length,
        });
        if (blob.size < 1024) {
          voiceLog("whisper.stop.too-small", { size: blob.size });
          return;
        }

        setTranscribing(true);
        try {
          voiceLog("whisper.transcribe.start");
          const pipe = await loadWhisperPipeline(() => {});
          if (startSeqRef.current !== seq) return;
          const pcm = await decodeAndResample(blob);
          if (startSeqRef.current !== seq) return;
          const result = await pipe(pcm, {
            language: "english",
            task: "transcribe",
          });
          if (startSeqRef.current !== seq) return;
          const text = (result?.text ?? "").trim();
          voiceLog("whisper.transcribe.done", transcriptDebug(text));
          if (text) {
            setFinalTranscript(text);
          }
        } catch (e) {
          voiceLog("whisper.transcribe.error", {
            message: e instanceof Error ? e.message : String(e),
          });
          setError(
            `Could not transcribe audio: ${
              e instanceof Error ? e.message : String(e)
            }`,
          );
        } finally {
          if (startSeqRef.current === seq) {
            setTranscribing(false);
          }
        }
      };

      recorder.onerror = () => {
        voiceLog("whisper.recorder.onerror");
        setError("Recorder error.");
        cleanupTracks();
        recorderRef.current = null;
        setListening(false);
      };

      try {
        recorder.start();
        voiceLog("whisper.recorder.started", { mimeType: recorder.mimeType });
        setListening(true);
      } catch (e) {
        cleanupTracks();
        voiceLog("whisper.recorder.start-error", {
          message: e instanceof Error ? e.message : String(e),
        });
        setError(
          `Could not start recording: ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      }
    },
    [supported, modelLoadStatus, cleanupTracks],
  );

  return {
    supported,
    listening,
    interimTranscript: "",
    finalTranscript,
    error,
    start,
    stop,
    reset,
    modelLoadStatus,
    modelLoadProgress,
    transcribing,
  };
}
