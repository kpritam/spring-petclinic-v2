/**
 * Text transforms for the spoken (TTS) side of voice mode. The visible chat
 * bubble renders the same answer through Markdown, which already turns
 * backticks/asterisks/citation brackets into proper elements. This module
 * only cleans the plain string handed to speechSynthesis, which has no
 * markdown awareness and would otherwise read symbols aloud verbatim.
 */

const FENCED_CODE_BLOCK = /```[\s\S]*?```/g;
const INLINE_CODE = /`([^`]+)`/g;
const MARKDOWN_LINK = /\[([^\]]*)\]\(([^)]*)\)/g;
/* Bracketed, space-free tokens: citations (file.md#anchor) and leaked prompt-template tags (/Context). */
const BRACKET_TAG = /\[[^\]\s]+\]/g;
const HEADING_MARK = /^#{1,6}\s+/gm;
const EMPHASIS_MARK = /(\*\*\*|\*\*|\*|___|__|_|~~)/g;
const QUOTE_CHAR = /["'“”‘’`]/g;

/* Private-use codepoint that cannot occur in real LLM text; safe as a splice marker. */
const CODE_PLACEHOLDER = "";
const CODE_PLACEHOLDER_RE = new RegExp(`${CODE_PLACEHOLDER}(\\d+)${CODE_PLACEHOLDER}`, "g");

/* Strips markdown syntax and citation noise so TTS speaks clean prose. */
export function sanitizeForSpeech(text: string): string {
  const codeSpans: string[] = [];
  const withoutCode = text
    .replace(FENCED_CODE_BLOCK, " ")
    .replace(INLINE_CODE, (_match, inner: string) => {
      codeSpans.push(inner);
      return `${CODE_PLACEHOLDER}${codeSpans.length - 1}${CODE_PLACEHOLDER}`;
    });

  const cleaned = withoutCode
    .replace(MARKDOWN_LINK, "$1")
    .replace(BRACKET_TAG, "")
    .replace(HEADING_MARK, "")
    .replace(EMPHASIS_MARK, "")
    .replace(QUOTE_CHAR, "");

  const restored = cleaned.replace(
    CODE_PLACEHOLDER_RE,
    (_match, index: string) => codeSpans[Number(index)] ?? "",
  );

  return restored.replace(/\s+/g, " ").trim();
}

/*
 * Pulls complete sentences (and, failing that, paragraphs) off the front of
 * a streaming buffer so TTS can speak each one as soon as it's whole rather
 * than waiting for the full answer. Returns the unconsumed remainder.
 */
export function flushSentences(
  buffer: string,
  enqueue: (sentence: string) => void,
): string {
  let rest = buffer;
  while (true) {
    const sentence = rest.match(/^(.*?[.!?])(\s+|$)/);
    if (sentence) {
      enqueue(sentence[1]);
      rest = rest.slice(sentence[0].length);
      continue;
    }
    const para = rest.match(/^(.*?)(\n\n+)/);
    if (para && para[1].trim()) {
      enqueue(para[1].trim());
      rest = rest.slice(para[0].length);
      continue;
    }
    break;
  }
  return rest;
}
