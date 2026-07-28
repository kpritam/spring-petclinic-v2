/**
 * Shared contract between the text-chat panel and the voice-mode wrapper —
 * both are React-rendered, in-browser, BYOK. `useChatEngine()` (in this
 * folder) provides the canonical implementation.
 */

import type { Citation } from "./types";

export type EngineLoadingState =
  | "idle"
  | "loading-bundle"
  | "loading-model"
  | "ready"
  | "missing-key"
  | "error";

export interface StreamChunkEvent {
  readonly text: string;
}

/**
 * Why the stream ended. Surfaced on `AskResult` so the UI can distinguish
 * "the model said its piece" from "we ran out of tokens" or "the request
 * was cut off mid-flight". Maps 1:1 onto the AI SDK `finishReason` plus
 * an explicit `"abort"` for client-side cancellation.
 */
export type AskFinishReason =
  | "stop"
  | "length"
  | "tool-call"
  | "error"
  | "abort";

/**
 * One turn of the conversation as it should be replayed to the model on
 * the next call. The current pending question is NOT part of this — it's
 * passed separately to `ask`. This shape mirrors `ChatTurn` in the
 * provider-stream contract so the engine can hand it through verbatim.
 */
export interface AskHistoryEntry {
  readonly role: "user" | "assistant";
  readonly content: string;
}

export interface AskResult {
  readonly answer: string;
  readonly citations: readonly Citation[];
  readonly inputTokensApprox: number;
  readonly outputTokensApprox: number;
  readonly durationMs: number;
  /** Why the stream stopped. Defaults to `"stop"` for clean completions. */
  readonly finishReason: AskFinishReason;
}

export interface AskOptions {
  readonly onToken?: (event: StreamChunkEvent) => void;
  readonly signal?: AbortSignal;
  /**
   * Prior turns of the conversation, oldest first. Excludes the current
   * pending `question`. The engine forwards this to the provider so the
   * model can see context like "the second one" or "what about that file?".
   */
  readonly history?: readonly AskHistoryEntry[];
}

export interface ChatEngine {
  readonly state: EngineLoadingState;
  readonly statusMessage: string;
  readonly error?: string;
  readonly chunkCount: number;
  readonly repo?: string;
  readonly hasApiKey: boolean;
  /** Streams tokens via `opts.onToken`. Rejects if not ready or call fails. */
  readonly ask: (question: string, opts?: AskOptions) => Promise<AskResult>;
  /** Idempotent lazy-load of bundle + model. */
  readonly preload: () => void;
}

export type UseChatEngine = () => ChatEngine;
