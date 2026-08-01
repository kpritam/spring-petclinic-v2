import type {
  PreloadProgress,
  ProviderConfig,
  ProviderId,
  ProviderRegistry,
  StreamEvent,
  StreamProvider,
  StreamRequest,
} from "./types";

export const PROVIDERS: ProviderRegistry = {
  anthropic: () => import("./anthropic").then((m) => m.anthropicProvider),
  openai: () => import("./openai").then((m) => m.openaiProvider),
  "openai-realtime": () =>
    import("./openaiRealtime").then((m) => m.openaiRealtimeProvider),
  google: () => import("./google").then((m) => m.googleProvider),
  ollama: () => import("./ollama").then((m) => m.ollamaProvider),
  webllm: () => import("./webllm").then((m) => m.webllmProvider),
};

export async function loadProvider(id: ProviderId): Promise<StreamProvider> {
  return PROVIDERS[id]();
}

export type {
  PreloadProgress,
  ProviderConfig,
  ProviderId,
  StreamEvent,
  StreamProvider,
  StreamRequest,
};
