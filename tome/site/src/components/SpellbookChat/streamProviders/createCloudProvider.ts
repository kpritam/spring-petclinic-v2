import { type LanguageModel, streamText } from "ai";

import { mapFinishReason } from "./mapFinishReason";
import type {
  ConfigField,
  ModelOption,
  PreloadProgress,
  ProviderConfig,
  ProviderId,
  StreamEvent,
  StreamProvider,
  StreamRequest,
} from "./types";

/**
 * How many times the AI SDK should retry a failed network call before
 * giving up. Cloud LLM endpoints are flaky enough — especially during
 * model rollouts — that bumping this from the SDK default of 2 to 3 has
 * a measurable user-experience impact and costs nothing on the happy
 * path. The signal still aborts the whole pipeline including retries.
 */
const STREAM_MAX_RETRIES = 3;

export interface CloudProviderSpec {
  readonly id: ProviderId;
  readonly displayName: string;
  readonly tagline: string;
  readonly models: readonly ModelOption[];
  readonly configFields: readonly ConfigField[];
  readonly validateConfig: (cfg: ProviderConfig) => string | null;
  /**
   * Build a `LanguageModel` for the given config. Provider-specific (creates
   * the SDK client, applies headers, picks `chat` vs `chatModel`).
   */
  readonly resolveModel: (cfg: ProviderConfig) => LanguageModel;
  /** Optional warm-up. Cloud providers usually leave this undefined. */
  readonly preload?: (
    config: ProviderConfig,
    onProgress?: (info: PreloadProgress) => void,
  ) => Promise<void>;
}

/**
 * Single source of truth for the streaming loop every cloud provider runs:
 *   1. Build a `LanguageModel` via the spec's `resolveModel`.
 *   2. Hand it to the AI SDK's `streamText` with our shared retry, abort
 *      and decoding settings.
 *   3. Forward `text-delta` events as they arrive, then a `finish` with
 *      mapped reason + token usage.
 *
 * Adding a new cloud provider is now a ~15-line metadata block instead of
 * 70 lines of nearly-identical glue. Provider-specific quirks
 * (`anthropic-dangerous-direct-browser-access`, OpenAI-compatible base URL,
 * etc.) live entirely inside `resolveModel`.
 */
export function createCloudProvider(spec: CloudProviderSpec): StreamProvider {
  return {
    id: spec.id,
    displayName: spec.displayName,
    tagline: spec.tagline,
    models: spec.models,
    configFields: spec.configFields,
    validateConfig: spec.validateConfig,
    preload: spec.preload,
    async *stream(
      req: StreamRequest,
      cfg: ProviderConfig,
    ): AsyncIterable<StreamEvent> {
      const model = spec.resolveModel(cfg);

      const result = streamText({
        model,
        instructions: req.system,
        messages: req.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        maxOutputTokens: req.maxTokens ?? 1024,
        temperature: req.temperature ?? 0.4,
        abortSignal: req.signal,
        maxRetries: STREAM_MAX_RETRIES,
      });

      try {
        // `textStream` no longer throws on abort: the SDK now surfaces
        // cancellation as a first-class `abort` chunk on the underlying
        // stream and simply ends iteration, rather than rejecting via an
        // `AbortError` thrown mid-iteration. The abort signal instead
        // rejects the `finishReason`/`usage` promises below, so both paths
        // (loop throws, or the subsequent awaits reject) funnel into the
        // same catch here — that's what keeps this a single clean `finish`
        // event instead of an uncaught rejection bubbling past the engine.
        for await (const delta of result.textStream) {
          yield { type: "text-delta", text: delta };
        }

        const finishReasonRaw = await result.finishReason;
        const usage = await result.usage;
        yield {
          type: "finish",
          finishReason: mapFinishReason(finishReasonRaw),
          inputTokens: usage?.inputTokens,
          outputTokens: usage?.outputTokens,
        };
      } catch (err) {
        if (
          req.signal?.aborted ||
          (err as Error)?.name === "AbortError"
        ) {
          yield { type: "finish", finishReason: "abort" };
          return;
        }
        throw err;
      }
    },
  };
}
