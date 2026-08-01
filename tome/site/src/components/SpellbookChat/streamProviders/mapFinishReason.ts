import type { StreamEvent } from "./types";

/**
 * Normalize a provider's `finishReason` string into the closed union our
 * `StreamProvider` contract emits. Shared by every cloud provider
 * (`anthropic`, `openai`, `google`, `ollama`) so the mapping is defined once.
 *
 * As of `ai` v7, `streamText`'s own `result.finishReason` is already a
 * closed union (`'stop' | 'length' | 'content-filter' | 'tool-calls' |
 * 'error' | 'other'`) — the SDK no longer emits an `"unknown"` value, and
 * abort is no longer surfaced as a finish reason at all: aborting now
 * rejects `result.finishReason`/`result.usage` instead (see
 * `createCloudProvider.ts`). We still normalize here rather than depend on
 * that union directly because `openaiRealtime.ts` feeds this the *raw*
 * OpenAI Realtime `status_details.type` string (e.g. `"completed"`,
 * `"cancelled"`, `"incomplete"`), which is a different vocabulary entirely.
 *
 * Unknown / undefined / `"other"` reasons fall through to `"stop"` since
 * callers treat that as the "completed normally" baseline.
 */
export type FinishReason = Extract<StreamEvent, { type: "finish" }>["finishReason"];

export function mapFinishReason(r: string | undefined): FinishReason {
  if (r === "length") return "length";
  if (r === "error" || r === "content-filter") return "error";
  if (r === "tool-calls") return "tool-call";
  if (r === "abort") return "abort";
  return "stop";
}
