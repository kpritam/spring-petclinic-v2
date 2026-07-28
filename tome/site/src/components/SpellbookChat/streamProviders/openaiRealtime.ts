/**
 * OpenAI Realtime API provider — text-mode streaming.
 *
 * Realtime's headline feature is bidirectional voice (audio in / audio
 * out via WebRTC). This provider uses Realtime's WebSocket text mode so
 * the regular text-chat panel can benefit from the API's persistent
 * session model and lower per-turn latency. Voice integration is a
 * future-work item and would replace the browser's own mic-capture
 * pipeline (`useVoiceCapture.ts`) and TTS (browser STT + native speech
 * synthesis go away in favour of one WebRTC peer connection); see
 * `voiceFsm.ts` for a phase-transition model a future voice variant
 * could dispatch into.
 *
 * Auth model:
 *
 *   Browsers MUST NOT hit the Realtime endpoint with a long-lived API
 *   key. The user (or the docs site operator) needs to stand up a small
 *   server endpoint that returns a short-lived `client_secret` minted
 *   via OpenAI's REST API. The expected response shape is:
 *
 *     POST <tokenEndpoint>
 *       → { client_secret: { value: "ek_…", expires_at: <unix ts> } }
 *
 *   We POST with no body (the endpoint can attach the model + voice it
 *   wants behind the scenes). The endpoint should rate-limit and
 *   authenticate its callers.
 *
 *   For prototyping, the user can paste a raw OpenAI API key in the
 *   `apiKey` field instead — the provider will pass it as the
 *   `Authorization: Bearer …` header. This is INSECURE for production
 *   (anyone visiting the page sees the key in the network tab) but
 *   matches the existing escape hatch we expose for direct Anthropic
 *   browser access; the help text makes the trade-off explicit.
 */

import { mapFinishReason } from "./mapFinishReason";
import type {
  ProviderConfig,
  StreamEvent,
  StreamProvider,
  StreamRequest,
} from "./types";

const REALTIME_WS = "wss://api.openai.com/v1/realtime";

interface ClientSecretResponse {
  readonly client_secret?: {
    readonly value: string;
    readonly expires_at?: number;
  };
}

async function fetchEphemeralKey(endpoint: string): Promise<string> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
  });
  if (!res.ok) {
    throw new Error(
      `Token endpoint ${endpoint} returned ${res.status}. Configure it to mint OpenAI Realtime ephemeral keys.`,
    );
  }
  const body = (await res.json()) as ClientSecretResponse;
  const value = body.client_secret?.value;
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(
      "Token endpoint response missing `client_secret.value`. See OpenAI Realtime ephemeral keys docs.",
    );
  }
  return value;
}

interface RealtimeServerEvent {
  readonly type: string;
  readonly response?: {
    readonly status_details?: { readonly type?: string };
    readonly usage?: {
      readonly input_tokens?: number;
      readonly output_tokens?: number;
    };
  };
  readonly delta?: string;
}

/**
 * Stream a text response using OpenAI's Realtime WebSocket. Yields
 * `text-delta` events as `response.text.delta` server events arrive,
 * then a single `finish` once `response.done` lands.
 */
async function* streamRealtimeText(
  req: StreamRequest,
  cfg: ProviderConfig,
): AsyncIterable<StreamEvent> {
  if (typeof WebSocket === "undefined") {
    throw new Error(
      "OpenAI Realtime requires a browser with WebSocket support.",
    );
  }

  let token: string;
  if (cfg.tokenEndpoint?.trim()) {
    token = await fetchEphemeralKey(cfg.tokenEndpoint.trim());
  } else if (cfg.apiKey?.trim()) {
    token = cfg.apiKey.trim();
  } else {
    throw new Error(
      "OpenAI Realtime needs either a token endpoint or an API key. Configure one in Settings → OpenAI Realtime.",
    );
  }

  const url = `${REALTIME_WS}?model=${encodeURIComponent(cfg.model)}`;
  const ws = new WebSocket(url, ["realtime", `openai-insecure-api-key.${token}`, "openai-beta.realtime-v1"]);

  // Pipeline: events → channel queue → consumer.
  const queue: StreamEvent[] = [];
  let resolveNext: (() => void) | null = null;
  let closed = false;
  let error: Error | null = null;

  const push = (ev: StreamEvent): void => {
    queue.push(ev);
    if (resolveNext) {
      const r = resolveNext;
      resolveNext = null;
      r();
    }
  };

  const finishWithError = (err: Error): void => {
    error = err;
    closed = true;
    if (resolveNext) {
      const r = resolveNext;
      resolveNext = null;
      r();
    }
  };

  const onAbort = (): void => {
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      try {
        ws.close();
      } catch {
        // ignore
      }
    }
    push({ type: "finish", finishReason: "abort" });
    closed = true;
  };

  if (req.signal) {
    if (req.signal.aborted) {
      onAbort();
      return;
    }
    req.signal.addEventListener("abort", onAbort, { once: true });
  }

  ws.addEventListener("open", () => {
    // Configure the session for text-only mode. Modalities = ["text"]
    // turns off audio entirely so we don't pay for streaming audio
    // tokens we don't use.
    ws.send(
      JSON.stringify({
        type: "session.update",
        session: {
          modalities: ["text"],
          instructions: req.system,
          temperature: req.temperature ?? 0.4,
          max_response_output_tokens: req.maxTokens ?? 1024,
        },
      }),
    );
    // Stream the chat history as conversation items.
    for (const m of req.messages) {
      ws.send(
        JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "message",
            role: m.role,
            content: [{ type: "input_text", text: m.content }],
          },
        }),
      );
    }
    ws.send(
      JSON.stringify({
        type: "response.create",
        response: { modalities: ["text"] },
      }),
    );
  });

  ws.addEventListener("message", (ev: MessageEvent<string>) => {
    let msg: RealtimeServerEvent;
    try {
      msg = JSON.parse(ev.data) as RealtimeServerEvent;
    } catch {
      return;
    }
    switch (msg.type) {
      case "response.text.delta":
      case "response.output_text.delta": {
        const delta = msg.delta;
        if (typeof delta === "string" && delta.length > 0) {
          push({ type: "text-delta", text: delta });
        }
        return;
      }
      case "response.done": {
        const usage = msg.response?.usage;
        const stopType = msg.response?.status_details?.type;
        push({
          type: "finish",
          finishReason: mapFinishReason(stopType),
          inputTokens: usage?.input_tokens,
          outputTokens: usage?.output_tokens,
        });
        try {
          ws.close();
        } catch {
          // ignore
        }
        closed = true;
        if (resolveNext) {
          const r = resolveNext;
          resolveNext = null;
          r();
        }
        return;
      }
      case "error": {
        finishWithError(
          new Error(`OpenAI Realtime error: ${ev.data.slice(0, 280)}`),
        );
        return;
      }
      default:
        return;
    }
  });

  ws.addEventListener("error", () => {
    finishWithError(new Error("OpenAI Realtime websocket error"));
  });

  ws.addEventListener("close", () => {
    closed = true;
    if (resolveNext) {
      const r = resolveNext;
      resolveNext = null;
      r();
    }
  });

  while (true) {
    if (queue.length > 0) {
      const ev = queue.shift()!;
      yield ev;
      if (ev.type === "finish") return;
      continue;
    }
    if (error) throw error;
    if (closed) return;
    await new Promise<void>((resolve) => {
      resolveNext = resolve;
    });
  }
}

export const openaiRealtimeProvider: StreamProvider = {
  id: "openai-realtime",
  displayName: "OpenAI Realtime (preview)",
  tagline: "Cloud · WebSocket · text mode (voice integration coming)",
  models: [
    {
      id: "gpt-realtime-preview",
      label: "gpt-realtime-preview",
      note: "voice/text",
    },
  ],
  configFields: [
    {
      key: "tokenEndpoint",
      label: "Ephemeral token endpoint",
      placeholder: "https://your-backend.example/realtime-token",
      helpText:
        "URL of a small server endpoint that returns OpenAI Realtime client secrets. Recommended for production. See the file header in `streamProviders/openaiRealtime.ts` for the expected response shape.",
      required: false,
      secret: false,
    },
    {
      key: "apiKey",
      label: "OpenAI API key (insecure direct access)",
      placeholder: "sk-…",
      helpText:
        "Prototyping only — the key is visible to anyone using this page. Prefer the token endpoint above for any deployment.",
      required: false,
      secret: true,
    },
  ],
  validateConfig: (cfg) => {
    if (!cfg.tokenEndpoint?.trim() && !cfg.apiKey?.trim()) {
      return "Configure either a token endpoint or an API key";
    }
    if (
      cfg.tokenEndpoint?.trim() &&
      !/^https?:\/\//i.test(cfg.tokenEndpoint.trim())
    ) {
      return "Token endpoint must be an http(s) URL";
    }
    return null;
  },
  stream: (req, cfg) => streamRealtimeText(req, cfg),
};
