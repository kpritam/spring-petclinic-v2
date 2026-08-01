/**
 * Multi-provider streaming contract for the in-browser documentation chat.
 *
 * All providers — cloud (Anthropic, OpenAI, Google, Ollama) and local
 * (WebLLM via WebGPU) — implement this interface. The chat engine selects
 * one at runtime based on user settings; secrets live in memory only
 * (`secretStore.ts`), non-secret fields (provider id, chosen model,
 * optional base URL) live in `localStorage` under `grimoire.chat.*`.
 *
 * Providers are loaded on-demand (dynamic `import()`) so the WebLLM runtime
 * never enters the bundle of users who pick a cloud provider, and cloud
 * SDKs never load for local-only users.
 *
 * DO NOT modify this file without coordinating with both ends:
 *  - Provider impls live in `./anthropic.ts`, `./openai.ts`, `./google.ts`,
 *    `./ollama.ts`, `./webllm.ts`.
 *  - Consumer is `useChatEngine.ts`, which dispatches on `ProviderId`.
 */

export type ProviderId =
  | "anthropic"
  | "openai"
  | "openai-realtime"
  | "google"
  | "ollama"
  | "webllm";

/**
 * Auth + connection settings for a single provider.
 *
 * - `id`, `model`, `baseUrl` are read from `localStorage` under
 *   `grimoire.chat.<id>.*` (see `STORAGE_KEYS`).
 * - `apiKey` is read from the in-memory `secretStore` only. Cleared on
 *   tab refresh — deliberate; do not persist.
 */
export interface ProviderConfig {
  readonly id: ProviderId;
  readonly model: string;
  /** Cloud providers (anthropic, openai, google) — required. In-memory only. */
  readonly apiKey?: string;
  /** Ollama — defaults to `http://localhost:11434`. */
  readonly baseUrl?: string;
  /**
   * OpenAI Realtime — URL of a server endpoint that mints ephemeral
   * client_secrets via the OpenAI REST API. Browsers cannot safely use
   * a long-lived API key against the Realtime endpoint, so the user
   * must provide a small backend that returns `{ client_secret: { value, expires_at } }`
   * on each call. See `streamProviders/openaiRealtime.ts` for the
   * expected response shape.
   */
  readonly tokenEndpoint?: string;
}

/**
 * Single user/assistant exchange in the rolling chat history. The system
 * prompt + RAG context is passed separately via `StreamRequest.system`.
 */
export interface ChatTurn {
  readonly role: "user" | "assistant";
  readonly content: string;
}

export interface StreamRequest {
  /** Concatenated system prompt: identity + persona + RAG context block. */
  readonly system: string;
  /** Multi-turn chat history. The current user question is the last entry. */
  readonly messages: readonly ChatTurn[];
  /** Soft cap on output tokens. Provider may clamp to its own limits. */
  readonly maxTokens?: number;
  /** Sampling temperature. Default 0.4 if omitted. */
  readonly temperature?: number;
  /** Cancel the in-flight request. */
  readonly signal?: AbortSignal;
}

/**
 * A streamed event from `StreamProvider.stream`. The async iterable yields
 * zero-or-more `text-delta` events, then exactly one `finish` event.
 */
export type StreamEvent =
  | { readonly type: "text-delta"; readonly text: string }
  | {
      readonly type: "finish";
      readonly finishReason: "stop" | "length" | "tool-call" | "error" | "abort";
      readonly inputTokens?: number;
      readonly outputTokens?: number;
    };

/** Progress info for slow init steps (e.g. WebLLM model download). */
export interface PreloadProgress {
  readonly phase: string;
  readonly message: string;
  readonly loaded?: number;
  readonly total?: number;
  readonly fraction?: number;
}

/** A single configurable model option a provider exposes in the UI. */
export interface ModelOption {
  readonly id: string;
  readonly label: string;
  /** Optional hint shown next to the model name (e.g. "fast", "smart"). */
  readonly note?: string;
}

/** Required config field schema (rendered in SettingsPanel per provider). */
export interface ConfigField {
  readonly key: "apiKey" | "baseUrl" | "tokenEndpoint";
  readonly label: string;
  readonly placeholder?: string;
  readonly helpText?: string;
  readonly required: boolean;
  /** UI hint: should the value be masked (passwords)? */
  readonly secret: boolean;
}

/** A single AI provider plugged into the chat engine. */
export interface StreamProvider {
  readonly id: ProviderId;
  readonly displayName: string;
  /** One-line tagline shown in the provider picker. */
  readonly tagline: string;
  /** Models the user can pick from. The first entry is the default. */
  readonly models: readonly ModelOption[];
  /** Config fields (api key, base URL, etc.) the SettingsPanel renders. */
  readonly configFields: readonly ConfigField[];
  /** Returns null if config is valid; otherwise a human-readable error. */
  readonly validateConfig: (config: ProviderConfig) => string | null;
  /** Optional warm-up (download model, open WS, etc.). Cloud providers may resolve immediately. */
  readonly preload?: (
    config: ProviderConfig,
    onProgress?: (info: PreloadProgress) => void,
  ) => Promise<void>;
  /**
   * Stream a chat completion. Yields text-delta events as tokens arrive,
   * then exactly one finish event. Abort via `request.signal`.
   */
  readonly stream: (
    request: StreamRequest,
    config: ProviderConfig,
  ) => AsyncIterable<StreamEvent>;
}

/**
 * Provider registry: maps id to a lazy loader that returns the impl.
 * Implementations live in sibling files and are imported on demand.
 */
export type ProviderRegistry = Readonly<
  Record<ProviderId, () => Promise<StreamProvider>>
>;

/**
 * Storage key helpers for non-secret preferences (provider id, model,
 * base URL). API keys live in `secretStore.ts` — never in localStorage.
 */
export const STORAGE_KEYS = {
  activeProvider: "grimoire.chat.provider",
  field: (
    id: ProviderId,
    key: Exclude<ConfigField["key"], "apiKey"> | "model",
  ): string => `grimoire.chat.${id}.${key}`,
} as const;

/** Default order shown in the provider picker dropdown. */
export const PROVIDER_ORDER: readonly ProviderId[] = [
  "anthropic",
  "openai",
  "openai-realtime",
  "google",
  "ollama",
  "webllm",
] as const;
