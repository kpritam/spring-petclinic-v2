/**
 * Reasoning models (Qwen3, DeepSeek-R1, and Ollama-served variants of both)
 * emit a `<think>...</think>` block inline in the plain-text stream ahead of
 * their actual answer. There's no separate "reasoning" field anywhere in
 * this codebase's `StreamEvent` union — every provider just yields raw
 * `text-delta` content — so every consumer of assistant text (the live
 * streaming bubble, finalized history, TTS, and the multi-turn prompt we
 * replay to the model) has to split it out itself.
 */

const OPEN_TAG = /<think(?:ing)?>/i;
const CLOSE_TAG = /<\/think(?:ing)?>/i;

export interface ThinkingSplit {
  /** Reasoning text, or `null` when the source has no `<think>` tag at all. */
  readonly reasoning: string | null;
  /** Everything outside the `<think>` block — the actual answer. */
  readonly answer: string;
  /** `true` while inside an opened-but-not-yet-closed `<think>` block. */
  readonly isThinking: boolean;
}

export function splitThinking(raw: string): ThinkingSplit {
  const open = OPEN_TAG.exec(raw);
  if (!open) {
    return { reasoning: null, answer: raw, isThinking: false };
  }
  const before = raw.slice(0, open.index);
  const afterOpen = raw.slice(open.index + open[0].length);
  const close = CLOSE_TAG.exec(afterOpen);
  if (!close) {
    return { reasoning: afterOpen, answer: before, isThinking: true };
  }
  const reasoning = afterOpen.slice(0, close.index);
  const after = afterOpen.slice(close.index + close[0].length);
  return { reasoning, answer: `${before}${after}`, isThinking: false };
}

/**
 * Strips a `<think>` block, keeping only the answer. Used when replaying
 * prior assistant turns back to the model as history: reasoning models
 * aren't trained to condition on their own replayed chain-of-thought, and
 * echoing it back every turn burns context budget for nothing — a real cost
 * for the small local models this chat targets (see `webllm.ts`'s tiny
 * per-turn character budgets).
 */
export function stripThinking(raw: string): string {
  return splitThinking(raw).answer;
}
