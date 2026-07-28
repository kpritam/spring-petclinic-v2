/**
 * Opt-in debug logging for the voice pipeline.
 *
 * The voice state machine is notoriously hard to reason about (phase
 * transitions, STT modes, TTS queueing, abort timing), so the dev
 * surface has a firehose of `voiceLog` calls. In production those
 * logs would:
 *   - spam the end user's console
 *   - expose transcript previews to any browser extension that can
 *     read `console.debug` output
 *
 * Both are undesirable, so logging is silent by default and only lights
 * up when the consumer opts in, either per-tab via the DevTools:
 *
 *     localStorage.setItem("grimoire.chat.debug", "1")
 *     location.reload()
 *
 * …or per-session by setting `window.__grimoireChatDebug = true` before
 * the panel mounts. Both checks are read once on module load; flip and
 * reload to toggle.
 */

const PREFIX = "[chat:voice]";

const debugEnabled = ((): boolean => {
  if (typeof window === "undefined") return false;
  try {
    const viaWindow = (window as unknown as { __grimoireChatDebug?: boolean })
      .__grimoireChatDebug;
    if (viaWindow === true) return true;
    return window.localStorage?.getItem("grimoire.chat.debug") === "1";
  } catch {
    // SSR, storage-disabled iframes, or sandboxed contexts — silent.
    return false;
  }
})();

export function voiceLog(
  event: string,
  details?: Record<string, unknown>,
): void {
  if (!debugEnabled) return;
  console.debug(PREFIX, event, details ?? {});
}

/**
 * Collapse a transcript into `{ length, preview }` for the log sink. We
 * never log the full transcript; at most the first 80 characters, and
 * only when debug is on (see `voiceLog`).
 */
export function transcriptDebug(text: string): {
  readonly length: number;
  readonly preview: string;
} {
  const trimmed = text.trim();
  return {
    length: trimmed.length,
    preview: trimmed.length > 80 ? `${trimmed.slice(0, 80)}...` : trimmed,
  };
}
