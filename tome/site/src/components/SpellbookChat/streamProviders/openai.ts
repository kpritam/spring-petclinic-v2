import { createOpenAI } from "@ai-sdk/openai";

import { createCloudProvider } from "./createCloudProvider";

export const openaiProvider = createCloudProvider({
  id: "openai",
  displayName: "OpenAI",
  tagline: "Cloud · BYOK · GPT-5 family",
  models: [
    { id: "gpt-5.5", label: "GPT-5.5", note: "flagship" },
    { id: "gpt-5.4", label: "GPT-5.4" },
    { id: "gpt-5.4-mini", label: "GPT-5.4 mini", note: "fast" },
    { id: "gpt-5.4-nano", label: "GPT-5.4 nano", note: "budget" },
  ],
  configFields: [
    {
      key: "apiKey",
      label: "OpenAI API key",
      placeholder: "sk-…",
      helpText:
        "Get one at platform.openai.com. Kept in this tab's memory only (cleared on refresh). Requests are made directly from the browser.",
      required: true,
      secret: true,
    },
  ],
  validateConfig: (cfg) => (!cfg.apiKey?.trim() ? "API key required" : null),
  resolveModel: (cfg) => {
    const openai = createOpenAI({ apiKey: cfg.apiKey! });
    return openai.chat(cfg.model);
  },
});
