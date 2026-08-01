import type { MLCEngine } from "@mlc-ai/web-llm";

import type {
  PreloadProgress,
  StreamEvent,
  StreamProvider,
} from "./types";

let enginePromise: Promise<MLCEngine> | null = null;
let currentModelId: string | null = null;

/** Serializes swaps so dispose → create stays ordered across concurrent callers. */
let swapChain: Promise<unknown> = Promise.resolve();

function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const next = swapChain.then(fn, fn);
  swapChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

async function disposeEnginePromise(promise: Promise<MLCEngine>): Promise<void> {
  try {
    const engine = await promise;
    try {
      await engine.unload();
    } catch (err) {
      if (typeof console !== "undefined") {
        console.error("[chat] WebLLM engine unload failed", err);
      }
    }
  } catch {
    // Load failed previously; nothing to unload.
  }
}

const WEBLLM_MODELS = [
  {
    id: "Qwen2.5-7B-Instruct-q4f16_1-MLC",
    label: "Qwen 2.5 7B",
    note: "~4.3 GB",
  },
  {
    id: "Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC",
    label: "Qwen 2.5 Coder 7B",
    note: "~4.3 GB",
  },
  {
    id: "Llama-3.1-8B-Instruct-q4f16_1-MLC",
    label: "Llama 3.1 8B",
    note: "~4.5 GB",
  },
  {
    id: "Hermes-3-Llama-3.1-8B-q4f16_1-MLC",
    label: "Hermes 3 (Llama 3.1 8B)",
    note: "~4.5 GB",
  },
  {
    id: "DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC",
    label: "DeepSeek R1 Distill Qwen 7B",
    note: "~4.3 GB · reasoning",
  },
  {
    id: "DeepSeek-R1-Distill-Llama-8B-q4f16_1-MLC",
    label: "DeepSeek R1 Distill Llama 8B",
    note: "~4.5 GB · reasoning",
  },
  {
    id: "gemma-2-9b-it-q4f16_1-MLC",
    label: "Gemma 2 9B",
    note: "~5.2 GB",
  },
  {
    id: "Qwen3-4B-q4f16_1-MLC",
    label: "Qwen 3 4B",
    note: "~2.2 GB",
  },
  {
    id: "Phi-4-mini-instruct-q4f16_1-MLC",
    label: "Phi-4 mini",
    note: "~2.1 GB",
  },
  {
    id: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    label: "Llama 3.2 3B",
    note: "~1.7 GB",
  },
  {
    id: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    label: "Llama 3.2 1B",
    note: "~600 MB",
  },
  {
    id: "Phi-3.5-mini-instruct-q4f16_1-MLC",
    label: "Phi-3.5 mini",
    note: "~2 GB",
  },
  {
    id: "Qwen2.5-3B-Instruct-q4f16_1-MLC",
    label: "Qwen 2.5 3B",
    note: "~1.9 GB",
  },
  {
    id: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
    label: "Qwen 2.5 0.5B",
    note: "~300 MB",
  },
];

async function getEngine(
  modelId: string,
  onProgress?: (info: PreloadProgress) => void,
): Promise<MLCEngine> {
  return runExclusive(async () => {
    if (enginePromise && currentModelId === modelId) {
      return enginePromise;
    }

    const previous = enginePromise;
    currentModelId = modelId;
    const { CreateMLCEngine } = await import("@mlc-ai/web-llm");

    if (previous) {
      await disposeEnginePromise(previous);
    }

    enginePromise = CreateMLCEngine(modelId, {
      initProgressCallback: (report: { text: string; progress: number }) => {
        onProgress?.({
          phase: "loading",
          message: report.text,
          fraction: report.progress,
        });
      },
    });

    try {
      return await enginePromise;
    } catch (err) {
      enginePromise = null;
      currentModelId = null;
      throw err;
    }
  });
}

/** Truncate user content if a tiny local model can't realistically swallow it. */
function clampForLocal(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, maxChars)}\n\n[... truncated for local model context window]`;
}

export const webllmProvider: StreamProvider = {
  id: "webllm",
  displayName: "Local (WebLLM)",
  tagline: "100% in-browser · WebGPU · no key, no network",
  models: WEBLLM_MODELS,
  configFields: [],
  validateConfig: (cfg) => {
    if (!cfg.model?.trim()) {
      return "Pick a model";
    }
    if (typeof navigator !== "undefined" && !("gpu" in navigator)) {
      return "WebGPU not available in this browser (try Chrome 113+ or Safari 18+)";
    }
    return null;
  },
  async preload(cfg, onProgress) {
    await getEngine(cfg.model, onProgress);
  },
  async *stream(req, cfg): AsyncIterable<StreamEvent> {
    const engine = await getEngine(cfg.model);

    const isTinyModel = /\b(0\.5B|1B)\b/i.test(cfg.model);
    const systemBudget = isTinyModel ? 6000 : 24000;
    const userBudget = isTinyModel ? 2000 : 8000;

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];
    if (typeof req.system === "string" && req.system.trim().length > 0) {
      messages.push({
        role: "system",
        content: clampForLocal(req.system, systemBudget),
      });
    }
    for (const m of req.messages) {
      if (!m || typeof m.content !== "string" || m.content.length === 0) {
        continue;
      }
      const role = m.role === "assistant" ? "assistant" : "user";
      messages.push({
        role,
        content: clampForLocal(m.content, userBudget),
      });
    }

    if (messages.length === 0) {
      yield { type: "finish", finishReason: "stop" };
      return;
    }

    let stream: AsyncIterable<unknown>;
    try {
      stream = (await engine.chat.completions.create({
        messages,
        stream: true,
        temperature: req.temperature ?? 0.4,
        max_tokens: req.maxTokens ?? 1024,
      })) as AsyncIterable<unknown>;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(
        msg.includes("WebGPU") || msg.toLowerCase().includes("device")
          ? `Local model unavailable: ${msg}`
          : `Local model failed: ${msg}`,
      );
    }

    let outputTokens = 0;
    try {
      for await (const chunk of stream) {
        if (req.signal?.aborted) {
          yield { type: "finish", finishReason: "abort" };
          return;
        }
        if (!chunk || typeof chunk !== "object") {
          continue;
        }
        const c = chunk as {
          choices?: ReadonlyArray<{ delta?: { content?: unknown } }>;
        };
        if (!Array.isArray(c.choices) || c.choices.length === 0) {
          continue;
        }
        const choice = c.choices[0];
        const content = choice?.delta?.content;
        if (typeof content === "string" && content.length > 0) {
          outputTokens += 1;
          yield { type: "text-delta", text: content };
        }
      }
    } catch (err) {
      if (typeof console !== "undefined") {
        console.error("[chat] WebLLM stream error", err);
      }
      yield { type: "finish", finishReason: "error" };
      return;
    }

    yield {
      type: "finish",
      finishReason: "stop",
      outputTokens: outputTokens || undefined,
    };
  },
};
