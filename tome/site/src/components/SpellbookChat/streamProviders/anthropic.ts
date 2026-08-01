import { createAnthropic } from "@ai-sdk/anthropic";

import { createCloudProvider } from "./createCloudProvider";

export const anthropicProvider = createCloudProvider({
  id: "anthropic",
  displayName: "Anthropic Claude",
  tagline: "Cloud · BYOK · Claude 5 family",
  models: [
    { id: "claude-sonnet-5", label: "Claude Sonnet 5", note: "balanced" },
    { id: "claude-opus-4-8", label: "Claude Opus 4.8", note: "smart" },
    { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", note: "fast" },
  ],
  configFields: [
    {
      key: "apiKey",
      label: "Anthropic API key",
      placeholder: "sk-ant-…",
      helpText:
        "Get one at console.anthropic.com. Kept in this tab's memory only (cleared on refresh). Calls go directly from your browser to Anthropic (CORS header enabled).",
      required: true,
      secret: true,
    },
  ],
  validateConfig: (cfg) => (!cfg.apiKey?.trim() ? "API key required" : null),
  resolveModel: (cfg) => {
    const client = createAnthropic({
      apiKey: cfg.apiKey!,
      headers: { "anthropic-dangerous-direct-browser-access": "true" },
    });
    return client(cfg.model);
  },
});
