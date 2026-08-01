import { useCallback, useState, type ReactNode } from "react";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { Streamdown, type Components } from "streamdown";

import styles from "./markdown.module.css";

interface MarkdownProps {
  readonly source: string;
  /**
   * `true` while tokens are still arriving from the model. Streamdown uses
   * this to enable incomplete-block parsing (so a half-emitted code fence
   * doesn't render as broken markdown) and shows a subtle caret at the
   * streaming edge. Cheap to leave `false` once the assistant finishes —
   * the rendered output is identical once the markdown is complete.
   */
  readonly streaming?: boolean;
}

interface CodeBlockProps {
  readonly className?: string;
  readonly children: ReactNode;
}

/**
 * Standalone fenced code block with language tag + copy-to-clipboard button.
 * Styling lives in `markdown.module.css`; theming overrides live alongside.
 */
function CodeBlock(props: CodeBlockProps): ReactNode {
  const { className = "", children } = props;
  const langMatch = /language-(\w+)/.exec(className);
  const language = langMatch?.[1] ?? "";
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(() => {
    const text = extractText(children);
    if (!text) {
      return;
    }
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
      })
      .catch(() => {
        // ignore — likely insecure context
      });
  }, [children]);

  return (
    <div className={styles.codeBlock}>
      <div className={styles.codeBlockHeader}>
        <span className={styles.codeBlockLang}>{language || "code"}</span>
        <button
          type="button"
          className={styles.codeCopyButton}
          onClick={onCopy}
          aria-label="Copy code"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className={styles.codeBlockPre}>
        <code className={`${className} ${styles.codeBlockCode}`}>
          {children}
        </code>
      </pre>
    </div>
  );
}

function extractText(node: ReactNode): string {
  if (typeof node === "string") {
    return node;
  }
  if (typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(extractText).join("");
  }
  if (
    node &&
    typeof node === "object" &&
    "props" in node &&
    (node as { props?: { children?: ReactNode } }).props
  ) {
    return extractText(
      (node as { props: { children?: ReactNode } }).props.children,
    );
  }
  return "";
}

const componentMap: Components = {
  code(props) {
    const { className, children } = props as {
      className?: string;
      children?: ReactNode;
    };
    const isInline = !/language-/.test(className ?? "");
    if (isInline) {
      return <code className={styles.inlineCode}>{children}</code>;
    }
    return <CodeBlock className={className}>{children}</CodeBlock>;
  },
  pre(props) {
    return <>{(props as { children?: ReactNode }).children}</>;
  },
  a(props) {
    const { href = "", children, ...rest } = props as {
      href?: string;
      children?: ReactNode;
    } & Record<string, unknown>;
    // Defense-in-depth: answers are markdown from a third-party LLM and
    // must never execute as JavaScript. Allow only http(s), anchors, and
    // relative paths; anything else (javascript:, data:, vbscript:, etc.)
    // is stripped to a non-link span.
    const safeHref = (() => {
      const t = href.trim();
      if (t === "") return undefined;
      if (t.startsWith("#") || t.startsWith("/") || t.startsWith("./")) {
        return t;
      }
      if (/^https?:\/\//i.test(t)) {
        return t;
      }
      return undefined;
    })();
    if (!safeHref) {
      return <span className={styles.link}>{children}</span>;
    }
    const external = /^https?:\/\//i.test(safeHref);
    return (
      <a
        {...(rest as Record<string, unknown>)}
        href={safeHref}
        className={styles.link}
        target={external ? "_blank" : undefined}
        rel={external ? "noreferrer noopener" : undefined}
      >
        {children}
      </a>
    );
  },
  table(props) {
    return (
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          {(props as { children?: ReactNode }).children}
        </table>
      </div>
    );
  },
  blockquote(props) {
    return (
      <blockquote className={styles.blockquote}>
        {(props as { children?: ReactNode }).children}
      </blockquote>
    );
  },
  ul(props) {
    return (
      <ul className={styles.list}>
        {(props as { children?: ReactNode }).children}
      </ul>
    );
  },
  ol(props) {
    return (
      <ol className={styles.list}>
        {(props as { children?: ReactNode }).children}
      </ol>
    );
  },
  li(props) {
    return (
      <li className={styles.listItem}>
        {(props as { children?: ReactNode }).children}
      </li>
    );
  },
  h1(props) {
    return (
      <h3 className={styles.heading}>
        {(props as { children?: ReactNode }).children}
      </h3>
    );
  },
  h2(props) {
    return (
      <h3 className={styles.heading}>
        {(props as { children?: ReactNode }).children}
      </h3>
    );
  },
  h3(props) {
    return (
      <h4 className={styles.subheading}>
        {(props as { children?: ReactNode }).children}
      </h4>
    );
  },
  h4(props) {
    return (
      <h4 className={styles.subheading}>
        {(props as { children?: ReactNode }).children}
      </h4>
    );
  },
  hr() {
    return <hr className={styles.rule} />;
  },
  p(props) {
    return (
      <p className={styles.paragraph}>
        {(props as { children?: ReactNode }).children}
      </p>
    );
  },
};

/**
 * Streaming-aware markdown renderer.
 *
 * Built on Vercel's `streamdown`, which handles **incomplete markdown blocks**
 * gracefully (so a half-emitted code fence won't render as broken HTML
 * mid-stream) and ships `rehype-harden` for safer rendering of LLM output.
 * We override the default elements via `components` to keep the chat panel's
 * visual style consistent with the rest of the docs.
 *
 * `streaming={true}` enables the unterminated-block handling and the
 * subtle caret indicator at the live edge. Pass `false` for finalised
 * messages — the output is identical, just without the streaming hints.
 */
export default function Markdown({
  source,
  streaming = false,
}: MarkdownProps): ReactNode {
  if (!source) {
    return null;
  }
  return (
    <div className={styles.root}>
      <Streamdown
        mode={streaming ? "streaming" : "static"}
        parseIncompleteMarkdown={streaming}
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          [rehypeHighlight, { detect: true, ignoreMissing: true }],
        ]}
        components={componentMap}
      >
        {source}
      </Streamdown>
    </div>
  );
}
