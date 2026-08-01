/**
 * Voice mode finite-state machine.
 *
 * The four UI phases (`idle`, `listening`, `thinking`, `speaking`) are the
 * states the user can observe; the machine here makes the *transitions*
 * between them explicit and disallows illegal jumps. Side effects
 * (timers, AbortControllers, mic streams) are NOT modelled here — those
 * are owned by VoiceMode and reacted to via the `effects` array each
 * transition emits. Keeping effects out of the reducer keeps it pure and
 * testable without a real DOM.
 *
 * Transition table:
 *
 *   idle      ──MIC_PRESS──>  listening   (start STT + VAD)
 *   listening ──VAD_END / PHRASE_END / MIC_PRESS / NATIVE_FINAL──> thinking
 *   listening ──STT_ERROR──> idle (with error)
 *   thinking  ──TOKEN──>     speaking   (first sentence enqueued)
 *   thinking  ──ASK_DONE──>  idle       (no audible reply)
 *   thinking  ──ASK_ERROR──> idle       (with error)
 *   speaking  ──TTS_DRAIN──> idle
 *   *         ──CANCEL──>    idle       (hard reset; runs cleanup effects)
 *
 * `engineBlocked` and `pendingTranscript` live on the FSM only because
 * they gate transitions. Anything else (assistant text, citations, mic
 * permission state) belongs to the component.
 */

export type VoiceUiPhase = "idle" | "listening" | "thinking" | "speaking";

export interface VoiceFsmState {
  readonly phase: VoiceUiPhase;
  readonly error: string | null;
}

export type VoiceFsmEvent =
  | { readonly type: "MIC_PRESS" }
  | { readonly type: "VAD_END" }
  | { readonly type: "PHRASE_END" }
  | { readonly type: "NATIVE_FINAL_RECEIVED" }
  | { readonly type: "STT_ERROR"; readonly message: string }
  | { readonly type: "TOKEN_RECEIVED" }
  | { readonly type: "ASK_DONE"; readonly hadAudibleReply: boolean }
  | { readonly type: "ASK_ERROR"; readonly message: string }
  | { readonly type: "TTS_DRAIN" }
  | { readonly type: "CANCEL" };

export type VoiceFsmEffect =
  | "start-stt"
  | "stop-stt-graceful"
  | "stop-stt-hard"
  | "start-vad"
  | "stop-vad"
  | "abort-ask"
  | "cancel-tts"
  | "clear-timers"
  | "reset-transcripts";

export interface VoiceFsmTransition {
  readonly state: VoiceFsmState;
  readonly effects: readonly VoiceFsmEffect[];
}

export const initialVoiceState: VoiceFsmState = {
  phase: "idle",
  error: null,
};

const into = (
  phase: VoiceUiPhase,
  effects: readonly VoiceFsmEffect[] = [],
  error: string | null = null,
): VoiceFsmTransition => ({ state: { phase, error }, effects });

/**
 * Pure reducer. Returns the next state plus a list of effects the
 * VoiceMode component should fire after committing the state. The
 * effect names are deliberately coarse — VoiceMode owns the actual
 * function calls (so we don't have to mock timers or AudioContext to
 * test the FSM).
 */
export function voiceFsmReduce(
  state: VoiceFsmState,
  ev: VoiceFsmEvent,
): VoiceFsmTransition {
  // CANCEL is the universal escape hatch — it always resets.
  if (ev.type === "CANCEL") {
    return into("idle", [
      "abort-ask",
      "cancel-tts",
      "stop-stt-hard",
      "stop-vad",
      "clear-timers",
      "reset-transcripts",
    ]);
  }

  switch (state.phase) {
    case "idle": {
      if (ev.type === "MIC_PRESS") {
        return into("listening", [
          "reset-transcripts",
          "start-stt",
          "start-vad",
        ]);
      }
      return { state, effects: [] };
    }

    case "listening": {
      switch (ev.type) {
        case "VAD_END":
        case "PHRASE_END":
        case "MIC_PRESS":
          return into("thinking", [
            "stop-stt-graceful",
            "stop-vad",
            "clear-timers",
          ]);
        case "NATIVE_FINAL_RECEIVED":
          // Native API streams a final without us asking; treat as
          // implicit phrase end + speech end.
          return into("thinking", [
            "stop-stt-graceful",
            "stop-vad",
            "clear-timers",
          ]);
        case "STT_ERROR":
          return into(
            "idle",
            ["stop-vad", "clear-timers", "reset-transcripts"],
            ev.message,
          );
        default:
          return { state, effects: [] };
      }
    }

    case "thinking": {
      switch (ev.type) {
        case "TOKEN_RECEIVED":
          return into("speaking");
        case "ASK_DONE":
          // No audible reply means TTS never started; jump straight to idle.
          if (!ev.hadAudibleReply) {
            return into("idle");
          }
          // Otherwise stay in thinking and wait for first token; this branch
          // is mostly defensive since `TOKEN_RECEIVED` arrives first.
          return { state, effects: [] };
        case "ASK_ERROR":
          return into("idle", ["abort-ask"], ev.message);
        case "MIC_PRESS":
          // Interrupt: user wants to start over while the model is thinking.
          return into("listening", [
            "abort-ask",
            "cancel-tts",
            "reset-transcripts",
            "start-stt",
            "start-vad",
          ]);
        default:
          return { state, effects: [] };
      }
    }

    case "speaking": {
      switch (ev.type) {
        case "TTS_DRAIN":
          return into("idle");
        case "ASK_ERROR":
          return into("idle", ["abort-ask", "cancel-tts"], ev.message);
        case "MIC_PRESS":
          // Barge-in: user starts a new turn while the assistant is talking.
          return into("listening", [
            "abort-ask",
            "cancel-tts",
            "reset-transcripts",
            "start-stt",
            "start-vad",
          ]);
        case "TOKEN_RECEIVED":
          // Still streaming additional sentences mid-speak; nothing to do
          // (the component flushes them to TTS, not the FSM).
          return { state, effects: [] };
        default:
          return { state, effects: [] };
      }
    }

    default: {
      // Exhaustiveness: TS will flag if we add a phase without handling it.
      const _exhaustive: never = state.phase;
      return { state, effects: [] };
    }
  }
}
