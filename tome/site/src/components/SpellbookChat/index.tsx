import {
  type KeyboardEvent,
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { useBaseUrlUtils } from "@docusaurus/useBaseUrl";

import type { Citation } from "./types";
import ChatErrorBoundary from "./ChatErrorBoundary";
import Markdown from "./Markdown";
import SettingsPanel from "./SettingsPanel";
import { flushSentences, sanitizeForSpeech } from "./speechText";
import { useActiveProvider, useChatEngine } from "./useChatEngine";
import { useSpeechSynthesis } from "./useSpeechSynthesis";
import { useVoiceCapture } from "./useVoiceCapture";

import styles from "./styles.module.css";

export {
  useChatEngine,
  useActiveProvider,
  notifySettingsChanged,
  readActiveProviderId,
} from "./useChatEngine";

type UserMessage = {
  readonly id: string;
  readonly role: "user";
  readonly text: string;
};

type AssistantMessage = {
  readonly id: string;
  readonly role: "assistant";
  readonly text: string;
  readonly citations?: readonly Citation[];
  readonly error?: boolean;
  /**
   * `"length"` means the answer was cut off because the model hit its
   * `maxTokens` ceiling. The bubble shows a small banner so users know to
   * ask "continue" rather than treating the truncated text as final.
   */
  readonly truncated?: boolean;
};

type ChatMessage = UserMessage | AssistantMessage;

/** Mic button's combined visual/behavioral state — capture phase plus the ask/speak phase it hands off to. */
type MicPhase = "idle" | "listening" | "busy" | "speaking";

function newId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `m-${Date.now()}-${Math.random()}`
  );
}

function Icon(props: { readonly children: ReactNode }): ReactNode {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {props.children}
    </svg>
  );
}

function ClearIcon(): ReactNode {
  return (
    <Icon>
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" />
    </Icon>
  );
}

function ExpandIcon(): ReactNode {
  return (
    <Icon>
      <path d="M15 3h6v6" />
      <path d="M21 3l-8 8" />
      <path d="M9 21H3v-6" />
      <path d="M3 21l8-8" />
    </Icon>
  );
}

function CollapseIcon(): ReactNode {
  return (
    <Icon>
      <path d="M21 3l-7 7" />
      <path d="M14 4v6h6" />
      <path d="M3 21l7-7" />
      <path d="M10 20v-6H4" />
    </Icon>
  );
}

function SettingsIcon(): ReactNode {
  return (
    <Icon>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.57V21a2 2 0 1 1-4 0v-.06a1.7 1.7 0 0 0-1.04-1.57 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.57-1.04H3a2 2 0 1 1 0-4h.06a1.7 1.7 0 0 0 1.57-1.04 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.05A1.7 1.7 0 0 0 10 3.06V3a2 2 0 1 1 4 0v.06a1.7 1.7 0 0 0 1.04 1.57h.05a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.05a1.7 1.7 0 0 0 1.57 1.04H21a2 2 0 1 1 0 4h-.06a1.7 1.7 0 0 0-1.54 1.04Z" />
    </Icon>
  );
}

function CloseIcon(): ReactNode {
  return (
    <Icon>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </Icon>
  );
}

function MicIcon(): ReactNode {
  return (
    <Icon>
      <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Z" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
      <path d="M12 19v3" />
      <path d="M8 22h8" />
    </Icon>
  );
}

function StopIcon(): ReactNode {
  return (
    <Icon>
      <rect x="7" y="7" width="10" height="10" rx="2" />
    </Icon>
  );
}

function SendIcon(): ReactNode {
  return (
    <Icon>
      <path d="M12 19V6" />
      <path d="M6 12l6-6 6 6" />
    </Icon>
  );
}

/**
 * Defense-in-depth: only render citations whose sourceLink is http(s) or a
 * relative in-site path. The index builder only emits these schemes today,
 * but a hand-edited or third-party index shouldn't be able to smuggle a
 * `javascript:` href through the panel.
 */
function safeCitationHref(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (trimmed === "") return undefined;
  if (trimmed.startsWith("/") || trimmed.startsWith("#") || trimmed.startsWith("./")) {
    return trimmed;
  }
  try {
    const url = new URL(trimmed, window.location.origin);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString();
    }
  } catch {
    // Fall through: invalid URL → drop the link, render as a non-link card.
  }
  return undefined;
}

function CitationList(props: {
  readonly citations: readonly Citation[];
}): ReactNode {
  const { citations } = props;
  // Single hook call at the top of the component (not per-citation inside
  // the `.map` below) — `withBaseUrl` is a stable callback we can invoke
  // per-item without violating the rules of hooks. It prefixes the site's
  // GitHub Pages base path (e.g. `/repo/`) onto root-relative citation
  // links and leaves `#anchor` / absolute http(s) links untouched.
  const { withBaseUrl } = useBaseUrlUtils();
  if (!Array.isArray(citations) || citations.length === 0) {
    return null;
  }
  return (
    <div className={styles.citations}>
      <p className={styles.citationsTitle}>Sources</p>
      {citations.map((c) => {
        if (!c || typeof c.file !== "string") {
          return null;
        }
        const headings: readonly string[] = Array.isArray(c.headings)
          ? c.headings
          : [];
        // Only show the `#anchor` fragment in the label when it's actually
        // part of the link — the index builder omits it from `sourceLink`
        // for sections under a page's H1 title (Docusaurus never renders
        // an id there), even though `c.anchor` itself is still populated
        // for internal grouping. Showing it here would promise a scroll
        // target the click won't deliver.
        const linkHasAnchor =
          typeof c.sourceLink === "string" && c.sourceLink.includes("#");
        const pathLabel = `${c.file}${linkHasAnchor ? `#${c.anchor}` : ""}`;
        const inner = (
          <>
            <div className={styles.citationPath}>{pathLabel}</div>
            {headings.length > 0 ? (
              <div className={styles.citationHeadings}>
                {headings.join(" · ")}
              </div>
            ) : null}
          </>
        );
        const sanitized = safeCitationHref(c.sourceLink);
        const href = sanitized ? withBaseUrl(sanitized) : undefined;
        if (href) {
          const external = href.startsWith("http");
          return (
            <a
              key={`${c.file}-${c.anchor ?? ""}`}
              className={styles.citationCard}
              href={href}
              target={external ? "_blank" : undefined}
              rel={external ? "noreferrer noopener" : undefined}
            >
              {inner}
            </a>
          );
        }
        return (
          <div
            key={`${c.file}-${c.anchor ?? ""}`}
            className={styles.citationCard}
          >
            {inner}
          </div>
        );
      })}
    </div>
  );
}

const MessageBubble = memo(function MessageBubble(props: {
  readonly message: ChatMessage;
}): ReactNode {
  const { message: msg } = props;
  if (msg.role === "user") {
    return (
      <div className={`${styles.bubbleRow} ${styles.bubbleRowUser}`}>
        <div className={`${styles.bubble} ${styles.bubbleUser}`}>
          {msg.text}
        </div>
      </div>
    );
  }
  return (
    <div className={styles.bubbleRow}>
      <div
        className={`${styles.bubble} ${styles.bubbleAssistant} ${
          msg.error ? styles.bubbleAssistantError : ""
        }`}
      >
        {msg.error ? (
          <p style={{ margin: 0 }}>{msg.text}</p>
        ) : msg.text ? (
          <Markdown source={msg.text} />
        ) : (
          <span className={styles.typingDots} aria-hidden>
            <span />
            <span />
            <span />
          </span>
        )}
        {msg.truncated ? (
          <p
            className={styles.truncatedNotice}
            role="status"
            aria-live="polite"
          >
            Response was cut off (token limit). Ask “continue” for the rest.
          </p>
        ) : null}
        {msg.citations ? <CitationList citations={msg.citations} /> : null}
      </div>
    </div>
  );
});

export default function SpellbookChat(): ReactNode {
  const engine = useChatEngine();
  const activeInfo = useActiveProvider();
  const tts = useSpeechSynthesis();
  const titleId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [voiceTurnActive, setVoiceTurnActive] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const streamingTextRef = useRef("");
  const ttsBufferRef = useRef("");

  const speakChunk = useCallback(
    (chunk: string) => {
      const cleaned = sanitizeForSpeech(chunk);
      if (cleaned) {
        tts.enqueue(cleaned);
      }
    },
    [tts],
  );

  /**
   * Shared by the typed composer and voice capture. `speak` sentence-buffers
   * the streamed answer through TTS as it arrives; the typed path leaves it
   * false so silent replies stay silent.
   */
  const submitTurn = useCallback(
    async (rawText: string, turnOpts: { readonly speak: boolean }) => {
      const text = rawText.trim();
      if (!text || busy) {
        return;
      }
      if (engine.state !== "ready") {
        return;
      }

      if (!turnOpts.speak) {
        setInput("");
      }

      const userMsg: UserMessage = { id: newId(), role: "user", text };
      const assistantId = newId();
      setMessages((m) => [...m, userMsg]);
      setStreamingId(assistantId);
      setStreamingText("");
      streamingTextRef.current = "";
      ttsBufferRef.current = "";
      setBusy(true);

      const ac = new AbortController();
      abortRef.current = ac;

      // Project the visible chat into the multi-turn history the engine forwards
      // to the model. Errored bubbles are dropped so a recoverable mistake
      // doesn't pollute the next prompt; `(stopped)` markers stay in the UI but
      // are still useful as signal to the model so we keep them.
      const history = messages
        .filter(
          (m): m is ChatMessage =>
            m.role === "user" || (m.role === "assistant" && !m.error),
        )
        .map((m) => ({ role: m.role, content: m.text }));

      try {
        const result = await engine.ask(text, {
          signal: ac.signal,
          history,
          onToken: (ev) => {
            if (ac.signal.aborted) return;
            const piece = typeof ev?.text === "string" ? ev.text : "";
            if (!piece) {
              return;
            }
            streamingTextRef.current += piece;
            setStreamingText(streamingTextRef.current);
            if (turnOpts.speak) {
              ttsBufferRef.current = flushSentences(
                ttsBufferRef.current + piece,
                speakChunk,
              );
            }
          },
        });
        const finalText =
          (typeof result?.answer === "string" ? result.answer : "") ||
          streamingTextRef.current;
        const finalCitations: readonly Citation[] = Array.isArray(
          result?.citations,
        )
          ? result.citations
          : [];
        const truncated = result?.finishReason === "length";
        if (turnOpts.speak) {
          const tail = ttsBufferRef.current.trim();
          if (tail) {
            speakChunk(tail);
          }
          ttsBufferRef.current = "";
        }
        setMessages((m) => [
          ...m,
          {
            id: assistantId,
            role: "assistant",
            text: finalText,
            citations: finalCitations,
            truncated,
          },
        ]);
        setStreamingId(null);
        setStreamingText("");
        streamingTextRef.current = "";
      } catch (e) {
        if ((e as Error)?.name === "AbortError") {
          const body = streamingTextRef.current
            ? `${streamingTextRef.current}\n\n(stopped)`
            : "(stopped)";
          setMessages((m) => [
            ...m,
            {
              id: assistantId,
              role: "assistant",
              text: body,
              error: true,
            },
          ]);
        } else {
          const msgText =
            e instanceof Error ? e.message : "The assistant couldn't answer.";
          setMessages((m) => [
            ...m,
            {
              id: assistantId,
              role: "assistant",
              text: msgText,
              error: true,
            },
          ]);
        }
        setStreamingId(null);
        setStreamingText("");
        streamingTextRef.current = "";
        ttsBufferRef.current = "";
      } finally {
        setBusy(false);
        if (abortRef.current === ac) {
          abortRef.current = null;
        }
      }
    },
    [busy, engine, messages, speakChunk],
  );

  const handleVoiceUtterance = useCallback(
    (text: string) => {
      setVoiceTurnActive(true);
      void submitTurn(text, { speak: true });
    },
    [submitTurn],
  );

  const voice = useVoiceCapture({ onUtterance: handleVoiceUtterance });

  /** Stop everything noisy: text ask, voice capture, TTS. Safe to call repeatedly. */
  const cancelAll = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    tts.cancel();
    voice.cancel();
  }, [tts, voice]);

  const closePanel = useCallback(() => {
    cancelAll();
    setIsOpen(false);
    setShowSettings(false);
  }, [cancelAll]);

  const clearSession = useCallback(() => {
    cancelAll();
    setMessages([]);
    setStreamingId(null);
    setStreamingText("");
    streamingTextRef.current = "";
    setInput("");
    setBusy(false);
    setVoiceTurnActive(false);
  }, [cancelAll]);

  const toggleExpand = useCallback(() => {
    setExpanded((e) => !e);
  }, []);

  // Once the ask settles and any spoken reply drains, drop the "this turn
  // came from voice" flag so the mic button relaxes back to idle.
  useEffect(() => {
    if (voiceTurnActive && !busy && !tts.speaking) {
      setVoiceTurnActive(false);
    }
  }, [voiceTurnActive, busy, tts.speaking]);

  useEffect(() => {
    const node = messagesRef.current;
    if (!node) {
      return;
    }
    node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [messages, streamingText]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    engine.preload();
  }, [isOpen, engine.preload]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const onKey = (ev: globalThis.KeyboardEvent): void => {
      if (ev.key === "Escape") {
        closePanel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, closePanel]);

  // Unmount cleanup: the chat panel itself going away (route change, theme
  // hot-reload, etc.) must drain any in-flight ask and TTS.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const send = useCallback(() => {
    void submitTurn(input, { speak: false });
  }, [input, submitTurn]);

  const onComposerKeyDown = useCallback(
    (ev: KeyboardEvent<HTMLTextAreaElement>) => {
      if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();
        send();
      }
    },
    [send],
  );

  const micPhase: MicPhase =
    voice.phase === "listening"
      ? "listening"
      : voice.phase === "finalizing"
        ? "busy"
        : voiceTurnActive && busy
          ? "busy"
          : voiceTurnActive && tts.speaking
            ? "speaking"
            : "idle";

  const engineBlocked =
    engine.state === "missing-key" || engine.state === "error";

  // Only ever blocks *starting* a turn. Once a turn is under way (listening,
  // busy, speaking) the button must stay clickable so the user can always
  // cancel or interrupt, even if the engine errors out mid-turn.
  const micDisabled =
    micPhase === "idle" &&
    (!voice.supported || engineBlocked || engine.state !== "ready");

  const onMicClick = useCallback(() => {
    if (micPhase === "busy" || micPhase === "speaking") {
      // Barge-in: drop whatever's in flight and start listening immediately.
      cancelAll();
      setVoiceTurnActive(false);
      voice.toggle();
      return;
    }
    voice.toggle();
  }, [micPhase, cancelAll, voice]);

  const micAriaLabel = (() => {
    if (micPhase === "listening") {
      return "Stop listening";
    }
    if (micPhase === "busy") {
      return "Working…";
    }
    if (micPhase === "speaking") {
      return "Stop speaking";
    }
    if (!voice.supported) {
      return "Voice input not supported in this browser";
    }
    if (engineBlocked) {
      return engine.statusMessage || engine.error || "Assistant unavailable";
    }
    if (engine.state !== "ready") {
      return engine.statusMessage || "Preparing the assistant…";
    }
    return "Use voice input";
  })();

  const voiceHint = (() => {
    if (voice.error) {
      return voice.error;
    }
    if (micPhase === "listening") {
      return "Listening… tap the mic to stop.";
    }
    if (micPhase === "busy") {
      return "Thinking…";
    }
    if (micPhase === "speaking") {
      return "Speaking — tap the mic to interrupt.";
    }
    return null;
  })();

  const composerLocked =
    engine.state !== "ready" || busy || voice.phase !== "idle";

  const loading =
    engine.state === "loading-bundle" || engine.state === "loading-model";
  const showProgress = loading || (isOpen && engine.state === "idle");
  const degradedError = engine.state === "error";

  return (
    <>
      <button
        type="button"
        className={styles.launcher}
        aria-expanded={isOpen}
        aria-controls="spellbook-chat-panel"
        onClick={() => setIsOpen((o) => !o)}
      >
        <span className={styles.screenReader}>Ask the docs</span>
        <span className={styles.launcherSigil} aria-hidden>
          <span className={styles.launcherSigilInner} />
        </span>
        <span className={styles.launcherLabel}>Ask the docs</span>
      </button>

      <div
        className={`${styles.backdrop} ${isOpen ? styles.backdropVisible : ""}`}
        role="presentation"
        onClick={closePanel}
        tabIndex={-1}
      />

      <aside
        id="spellbook-chat-panel"
        className={`${styles.panel} ${isOpen ? styles.panelOpen : ""} ${
          expanded ? styles.panelExpanded : ""
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        hidden={!isOpen}
      >
        <ChatErrorBoundary>
          <div className={styles.panelInner}>
            <header className={styles.header}>
              <div className={styles.headerMain}>
                <span className={styles.kicker}>Docs assistant</span>
                <div className={styles.titleRow}>
                  <h2 id={titleId} className={styles.title}>
                    Assistant
                  </h2>
                  <div className={styles.headerActions}>
                    <button
                      type="button"
                      className={styles.iconButton}
                      aria-label={
                        messages.length === 0
                          ? "Clear session (no messages)"
                          : "Clear session"
                      }
                      title="Clear session"
                      onClick={clearSession}
                      disabled={messages.length === 0 && !busy}
                    >
                      <ClearIcon />
                    </button>
                    <button
                      type="button"
                      className={styles.iconButton}
                      aria-label={expanded ? "Compact view" : "Expand panel"}
                      aria-pressed={expanded}
                      title={expanded ? "Compact view" : "Expand panel"}
                      onClick={toggleExpand}
                    >
                      {expanded ? <CollapseIcon /> : <ExpandIcon />}
                    </button>
                    <button
                      type="button"
                      className={styles.iconButton}
                      aria-label="Settings"
                      title="Settings"
                      onClick={() => setShowSettings((s) => !s)}
                    >
                      <SettingsIcon />
                    </button>
                    <button
                      type="button"
                      className={styles.iconButton}
                      aria-label="Close chat"
                      title="Close"
                      onClick={closePanel}
                    >
                      <CloseIcon />
                    </button>
                  </div>
                </div>
                {engine.repo ||
                (engine.state === "ready" && engine.chunkCount > 0) ? (
                  <p className={styles.repo}>
                    {engine.repo ? <>{engine.repo} · </> : null}
                    {engine.state === "ready" && engine.chunkCount > 0 ? (
                      <>{engine.chunkCount} fragments indexed · </>
                    ) : null}
                    {activeInfo.providerId === "webllm"
                      ? `Local · ${activeInfo.modelLabel}`
                      : activeInfo.modelLabel}
                  </p>
                ) : null}
              </div>
            </header>

            {showProgress ? (
              <div className={styles.statusBar}>
                <p className={styles.statusText}>
                  {engine.state === "idle" && isOpen
                    ? "Loading…"
                    : engine.statusMessage}
                </p>
                <div className={styles.progressTrack}>
                  <div className={styles.progressFillIndeterminate} />
                </div>
              </div>
            ) : null}

            {degradedError && engine.error ? (
              <div className={styles.errorBanner} role="alert">
                <div>{engine.error}</div>
                <div className={styles.errorActions}>
                  <button
                    type="button"
                    className={styles.buttonPrimary}
                    onClick={() => engine.preload()}
                  >
                    Try again
                  </button>
                </div>
              </div>
            ) : null}

            {showSettings ? (
              <SettingsPanel
                variant="card"
                onClose={() => setShowSettings(false)}
                remoteStatusMessage={
                  engine.state === "loading-bundle" ||
                  engine.state === "loading-model"
                    ? engine.statusMessage
                    : undefined
                }
              />
            ) : null}

            {!showSettings && engine.state === "missing-key" && !loading ? (
              <SettingsPanel variant="inline" />
            ) : null}

            {!showSettings &&
            !degradedError &&
            engine.state !== "missing-key" ? (
              <>
                <div
                  ref={messagesRef}
                  className={styles.messages}
                  aria-live="polite"
                >
                  {messages.length === 0 && engine.state === "ready" ? (
                    <p className={styles.statusText} style={{ margin: 0 }}>
                      Ask anything about this documentation. Answers cite only
                      the indexed sources.
                    </p>
                  ) : null}
                  {messages.map((msg) => (
                    <MessageBubble key={msg.id} message={msg} />
                  ))}
                  {streamingId ? (
                    <div key={streamingId} className={styles.bubbleRow}>
                      <div
                        className={`${styles.bubble} ${styles.bubbleAssistant}`}
                      >
                        {streamingText ? (
                          <Markdown source={streamingText} streaming />
                        ) : (
                          <span className={styles.typingDots} aria-hidden>
                            <span />
                            <span />
                            <span />
                          </span>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
                <footer className={styles.footer}>
                  {voiceHint ? (
                    <p className={styles.voiceHint} role="status" aria-live="polite">
                      {voiceHint}
                    </p>
                  ) : null}
                  <div className={styles.composer}>
                    <textarea
                      className={styles.textarea}
                      placeholder={
                        micPhase === "listening"
                          ? "Listening…"
                          : engine.state === "ready"
                            ? "Ask a question…"
                            : "Loading…"
                      }
                      value={micPhase === "listening" ? voice.interimText : input}
                      disabled={composerLocked}
                      onChange={(ev) => setInput(ev.target.value)}
                      onKeyDown={onComposerKeyDown}
                      rows={2}
                    />
                    <div className={styles.composerActions}>
                      <button
                        type="button"
                        className={[
                          styles.micButton,
                          micPhase === "listening" ? styles.micButtonListening : "",
                          micPhase === "busy" ? styles.micButtonBusy : "",
                          micPhase === "speaking" ? styles.micButtonSpeaking : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        aria-label={micAriaLabel}
                        aria-pressed={micPhase === "listening"}
                        title={micAriaLabel}
                        disabled={micDisabled}
                        onClick={onMicClick}
                      >
                        {micPhase === "busy" ? (
                          <span className={styles.micSpinner} aria-hidden />
                        ) : micPhase === "speaking" ? (
                          <StopIcon />
                        ) : (
                          <MicIcon />
                        )}
                      </button>
                      <button
                        type="button"
                        className={styles.sendButton}
                        aria-label="Send message"
                        title="Send"
                        disabled={composerLocked || !input.trim()}
                        onClick={send}
                      >
                        <SendIcon />
                      </button>
                    </div>
                  </div>
                </footer>
              </>
            ) : null}
          </div>
        </ChatErrorBoundary>
      </aside>
    </>
  );
}
