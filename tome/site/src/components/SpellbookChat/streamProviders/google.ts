import { createGoogle } from "@ai-sdk/google";

import { createCloudProvider } from "./createCloudProvider";

export const googleProvider = createCloudProvider({
  id: "google",
  displayName: "Google Gemini",
  tagline: "Cloud · BYOK · Gemini 3 & 2.5",
  models: [
    { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", note: "preview" },
    { id: "gemini-3-flash-preview", label: "Gemini 3 Flash", note: "preview" },
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", note: "smart" },
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", note: "fast" },
    { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite", note: "budget" },
  ],
  configFields: [
    {
      key: "apiKey",
      label: "Google AI API key",
      placeholder: "AI…",
      helpText:
        "Create a key in Google AI Studio (aistudio.google.com). Kept in this tab's memory only (cleared on refresh).",
      required: true,
      secret: true,
    },
  ],
  validateConfig: (cfg) => (!cfg.apiKey?.trim() ? "API key required" : null),
  resolveModel: (cfg) => {
    const google = createGoogle({ apiKey: cfg.apiKey! });
    return google.chat(cfg.model);
  },
});
