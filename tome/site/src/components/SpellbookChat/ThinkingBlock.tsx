import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import styles from "./thinkingBlock.module.css";

interface ThinkingBlockProps {
  /** Reasoning text captured so far (may be partial while streaming). */
  readonly text: string;
  /** `true` while inside an opened-but-not-yet-closed `<think>` block. */
  readonly isThinking: boolean;
  /** Elapsed seconds once reasoning finished; `null`/undefined while still thinking or unknown. */
  readonly durationSeconds?: number | null;
}

function SparkIcon(): ReactNode {
  return (
    <svg
      className={styles.icon}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3v4" />
      <path d="M12 17v4" />
      <path d="M3 12h4" />
      <path d="M17 12h4" />
      <path d="M5.5 5.5l2.3 2.3" />
      <path d="M16.2 16.2l2.3 2.3" />
      <path d="M18.5 5.5l-2.3 2.3" />
      <path d="M8 16.2l-2.3 2.3" />
    </svg>
  );
}

function ChevronIcon(): ReactNode {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/** Mirrors the industry pattern (ChatGPT/Claude/DeepSeek/Vercel AI Elements):
 * leave the trace open for a beat after it finishes so the user can register
 * it happened, then collapse to a one-line disclosure. Any manual toggle
 * (open or closed) permanently opts the block out of this auto-behavior. */
const AUTO_CLOSE_DELAY_MS = 900;

/**
 * Collapsible "chain of thought" disclosure rendered above an assistant
 * answer. Reasoning text is shown as plain text (not run through the
 * Markdown/Streamdown pipeline) — it's internal monologue prose, not
 * content worth spending code-block/table/link rendering on, and staying
 * plain text sidesteps `Markdown.tsx`'s hardcoded 0.92rem font-size, which
 * would otherwise fight this component's smaller/muted treatment.
 */
export default function ThinkingBlock(props: ThinkingBlockProps): ReactNode {
  const { text, isThinking, durationSeconds } = props;
  const [open, setOpen] = useState(true);
  const userToggledRef = useRef(false);
  const hasAutoClosedRef = useRef(false);

  useEffect(() => {
    if (isThinking && !userToggledRef.current) {
      setOpen(true);
    }
  }, [isThinking]);

  useEffect(() => {
    if (isThinking || hasAutoClosedRef.current || userToggledRef.current) {
      return;
    }
    const timer = window.setTimeout(() => {
      hasAutoClosedRef.current = true;
      setOpen(false);
    }, AUTO_CLOSE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [isThinking]);

  const toggle = useCallback(() => {
    userToggledRef.current = true;
    setOpen((o) => !o);
  }, []);

  const label = isThinking
    ? "Thinking…"
    : durationSeconds
      ? `Thought for ${durationSeconds} second${durationSeconds === 1 ? "" : "s"}`
      : "Thought for a moment";

  return (
    <div className={styles.block}>
      <button
        type="button"
        className={styles.trigger}
        onClick={toggle}
        aria-expanded={open}
      >
        <SparkIcon />
        <span className={styles.label} data-pulse={isThinking ? "true" : undefined}>
          {label}
        </span>
        <span className={styles.chevronWrap} data-open={open ? "true" : undefined}>
          <ChevronIcon />
        </span>
      </button>
      <div className={styles.contentWrap} data-open={open ? "true" : undefined}>
        <div className={styles.contentInner}>
          {text.trim() ? <div className={styles.contentText}>{text}</div> : null}
        </div>
      </div>
    </div>
  );
}
