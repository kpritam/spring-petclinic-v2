import { Component, type ErrorInfo, type ReactNode } from "react";

import styles from "./styles.module.css";

interface ChatErrorBoundaryProps {
  readonly children: ReactNode;
}

interface ChatErrorBoundaryState {
  readonly error: Error | null;
}

/**
 * Isolates chat crashes so they don't take down the surrounding Docusaurus
 * page. Renders a small recoverable error card inside the panel instead
 * of letting React unwind to the outer ErrorBoundary.
 *
 * In dev we log the full error + stack to the console for debugging.
 */
export default class ChatErrorBoundary extends Component<
  ChatErrorBoundaryProps,
  ChatErrorBoundaryState
> {
  state: ChatErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ChatErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (typeof console !== "undefined") {
      console.error("[chat] Panel crashed:", error, info.componentStack);
    }
  }

  private reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (!this.state.error) {
      return this.props.children;
    }
    const message =
      this.state.error.message || "Unknown error in the chat.";
    return (
      <div className={styles.errorBanner} role="alert">
        <div>
          <strong>The assistant stumbled.</strong>
          <br />
          {message}
        </div>
        <div className={styles.errorActions}>
          <button
            type="button"
            className={styles.buttonPrimary}
            onClick={this.reset}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
}
