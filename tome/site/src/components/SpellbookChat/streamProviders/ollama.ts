import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

import { createCloudProvider } from "./createCloudProvider";

const DEFAULT_BASE = "http://localhost:11434/v1";

function normalizeBaseUrl(raw?: string): string {
  const s = raw?.trim() || DEFAULT_BASE;
  return s.replace(/\/+$/, "");
}

export const ollamaProvider = createCloudProvider({
  id: "ollama",
  displayName: "Ollama / compatible",
  tagline: "Local server · Ollama / LM Studio / OpenAI-compatible",
  models: [
    { id: "llama3.2", label: "llama3.2" },
    { id: "llama3.2:3b", label: "llama3.2:3b" },
    { id: "qwen2.5:3b", label: "qwen2.5:3b" },
    { id: "phi4:latest", label: "phi4:latest" },
  ],
  configFields: [
    {
      key: "baseUrl",
      label: "OpenAI-compatible base URL",
      placeholder: DEFAULT_BASE,
      helpText:
        "Ollama defaults to http://localhost:11434/v1. For browser access you must allow CORS on the server (e.g. OLLAMA_ORIGINS='https://yoursite.example' ollama serve).",
      required: false,
      secret: false,
    },
  ],
  validateConfig: (cfg) => (!cfg.model?.trim() ? "Model name required" : null),
  resolveModel: (cfg) => {
    const baseURL = normalizeBaseUrl(cfg.baseUrl);
    const ollama = createOpenAICompatible({
      name: "ollama",
      baseURL,
      apiKey: "ollama",
      includeUsage: true,
    });
    return ollama.chatModel(cfg.model);
  },
});
