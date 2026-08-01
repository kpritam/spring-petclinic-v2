import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  AskFinishReason,
  AskOptions,
  AskResult,
  ChatEngine,
  EngineLoadingState,
  UseChatEngine,
} from "./ChatEngine";
import type { BundleLoadResult } from "./useBundleLoader";
import { useBundleLoader } from "./useBundleLoader";
import type { Citation, ChunkRecord, RetrievedChunk } from "./types";
import { useEmbeddings } from "./useEmbeddings";
import { useRetrieval } from "./useRetrieval";
import {
  getSecret,
  hasSecret,
  onSecretChange,
  purgeLegacyKeyStorage,
} from "./secretStore";
import { loadProvider } from "./streamProviders/index";
import type {
  ProviderConfig,
  ProviderId,
  StreamProvider,
} from "./streamProviders/types";
import { STORAGE_KEYS } from "./streamProviders/types";
import { buildPrompts } from "./systemPrompt";

const SETTINGS_EVENT = "grimoire-chat-settings";

function ls(): Storage | null {
  try {
    if (
      typeof localStorage === "undefined" ||
      typeof localStorage.getItem !== "function"
    ) {
      return null;
    }
    return localStorage;
  } catch {
    return null;
  }
}

export function readActiveProviderId(): ProviderId {
  const storage = ls();
  const v = storage?.getItem(STORAGE_KEYS.activeProvider) ?? null;
  if (
    v === "anthropic" ||
    v === "openai" ||
    v === "openai-realtime" ||
    v === "google" ||
    v === "ollama" ||
    v === "webllm"
  ) {
    return v;
  }
  return "anthropic";
}

function readProviderConfig(
  id: ProviderId,
  provider: StreamProvider,
): ProviderConfig {
  const storage = ls();
  const storedModel =
    storage?.getItem(STORAGE_KEYS.field(id, "model"))?.trim() ?? "";
  const model = storedModel || provider.models[0]?.id || "";
  const baseUrl =
    storage?.getItem(STORAGE_KEYS.field(id, "baseUrl"))?.trim() || undefined;
  const tokenEndpoint =
    storage
      ?.getItem(STORAGE_KEYS.field(id, "tokenEndpoint"))
      ?.trim() || undefined;
  const apiKey = getSecret(id);
  return { id, model, apiKey, baseUrl, tokenEndpoint };
}

/**
 * Is the active provider ready to run? Cloud providers need an in-memory
 * secret; local providers (ollama, webllm) just need a selected model.
 * `openai-realtime` is satisfied by either an API key (insecure) OR a
 * persisted token endpoint URL.
 */
function providerLooksConfigured(id: ProviderId): boolean {
  if (id === "anthropic" || id === "openai" || id === "google") {
    return hasSecret(id);
  }
  if (id === "openai-realtime") {
    if (hasSecret(id)) return true;
    const storage = ls();
    const ep = storage
      ?.getItem(STORAGE_KEYS.field(id, "tokenEndpoint"))
      ?.trim();
    return !!ep;
  }
  const storage = ls();
  const model = storage?.getItem(STORAGE_KEYS.field(id, "model"))?.trim();
  return !!model;
}

function uniqCitations(retrieved: readonly RetrievedChunk[]): Citation[] {
  // Dedup by file+anchor, not file alone — a single doc can contribute
  // multiple retrieved sections (e.g. two different headings under the
  // same guide), and each should surface as its own citation card rather
  // than collapsing to whichever chunk of that file was retrieved first.
  const byKey = new Map<string, Citation>();
  for (const r of retrieved) {
    const key = `${r.chunk.file}#${r.chunk.anchor ?? ""}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        file: r.chunk.file,
        headings: r.chunk.headings,
        sourceLink: r.chunk.sourceLink,
        anchor: r.chunk.anchor,
      });
    }
  }
  // Avoid `[...byKey.values()]` — Docusaurus' Babel preset compiles array
  // spread of a Map iterator to `[].concat(iter)`, which wraps the iterator
  // in a single-element array instead of spreading it. Same hazard fixed in
  // `reciprocalRankFusion` upstream; keeping the explicit forEach for safety.
  const out: Citation[] = [];
  byKey.forEach((c) => {
    out.push(c);
  });
  return out;
}

function mapBundleError(e: unknown): string {
  if (e instanceof Error && e.message === "BUNDLE_MISSING") {
    return "Documentation index not found. Run `grimoire cast` to build it.";
  }
  if (e instanceof Error && e.message.startsWith("VECTOR_DIM_MISMATCH")) {
    return "The documentation index looks corrupted (vector size mismatch). Rebuild it.";
  }
  if (e instanceof Error && e.message === "NO_WASM") {
    return "Your browser doesn't support local embeddings. Please use a modern browser.";
  }
  return e instanceof Error ? e.message : String(e);
}

interface BundleMeta {
  readonly repo?: string;
  readonly siteName?: string;
  readonly siteTagline?: string;
}

export const useChatEngine: UseChatEngine = (): ChatEngine => {
  const loadBundle = useBundleLoader();
  const { loadEmbedder, embedQuery } = useEmbeddings();

  const [state, setState] = useState<EngineLoadingState>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [chunkCount, setChunkCount] = useState(0);
  const [bundleMeta, setBundleMeta] = useState<BundleMeta>({});
  const [settingsTick, setSettingsTick] = useState(0);

  const [chunks, setChunks] = useState<ChunkRecord[] | null>(null);
  const [vectors, setVectors] = useState<Float32Array | null>(null);
  const [dim, setDim] = useState(0);
  const [count, setCount] = useState(0);

  const loadGenRef = useRef(0);
  const stateRef = useRef<EngineLoadingState>("idle");
  stateRef.current = state;

  // One-shot: wipe any legacy plaintext API keys a previous build persisted.
  useEffect(() => {
    purgeLegacyKeyStorage();
  }, []);

  const hasApiKey = useMemo(() => {
    void settingsTick;
    return providerLooksConfigured(readActiveProviderId());
  }, [settingsTick]);

  // Re-check config when the settings form saves or the in-memory secret
  // for the active provider changes.
  useEffect(() => {
    const bump = (): void => setSettingsTick((t) => t + 1);
    window.addEventListener(SETTINGS_EVENT, bump);
    const offSecret = onSecretChange(bump);
    return () => {
      window.removeEventListener(SETTINGS_EVENT, bump);
      offSecret();
    };
  }, []);

  const retrieve = useRetrieval(chunks, vectors, dim, count);

  const finishLoad = useCallback((bundle: BundleLoadResult) => {
    setBundleMeta({
      repo: bundle.manifest.repo,
      siteName: bundle.manifest.siteName,
      siteTagline: bundle.manifest.siteTagline,
    });
    setChunkCount(bundle.manifest.count);
    setState("ready");
    setStatusMessage("Ready.");
  }, []);

  const runLoad = useCallback(async () => {
    const gen = ++loadGenRef.current;
    const alive = (): boolean => gen === loadGenRef.current;

    setError(undefined);
    setChunks(null);
    setVectors(null);
    setDim(0);
    setCount(0);
    setChunkCount(0);
    setBundleMeta({});

    const providerId = readActiveProviderId();

    if (typeof WebAssembly === "undefined") {
      if (!alive()) return;
      setError(mapBundleError(new Error("NO_WASM")));
      setState("error");
      setStatusMessage("");
      return;
    }

    if (!alive()) return;
    setState("loading-bundle");
    setStatusMessage("Preparing provider…");

    let provider: StreamProvider;
    try {
      provider = await loadProvider(providerId);
    } catch (e) {
      if (!alive()) return;
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setState("error");
      setStatusMessage("");
      return;
    }

    if (!alive()) return;

    const config = readProviderConfig(providerId, provider);
    const validationError = provider.validateConfig(config);
    if (validationError) {
      if (!alive()) return;
      setState("missing-key");
      setStatusMessage(validationError);
      return;
    }

    try {
      await provider.preload?.(config, (info) => {
        if (!alive()) return;
        const pct =
          info.fraction !== undefined
            ? ` ${Math.round(info.fraction * 100)}%`
            : "";
        setStatusMessage(`${info.message}${pct}`);
      });
    } catch (e) {
      if (!alive()) return;
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setState("error");
      setStatusMessage("");
      return;
    }

    if (!alive()) return;
    setStatusMessage("Fetching documentation index…");

    let bundle: BundleLoadResult;
    try {
      bundle = await loadBundle();
    } catch (e) {
      if (!alive()) return;
      const msg = mapBundleError(e);
      setError(msg);
      setState("error");
      setStatusMessage("");
      return;
    }

    if (!alive()) return;

    setChunks(bundle.chunks);
    setVectors(bundle.vectors);
    setDim(bundle.manifest.dim);
    setCount(bundle.manifest.count);

    setState("loading-model");
    setStatusMessage("Loading search model…");

    try {
      // Use whatever model the bundle manifest names — the build-time
      // pipeline (`grimoire cast`) writes this id, and queries MUST be
      // embedded with the same model the chunks were embedded with for
      // dot-product = cosine to hold.
      await loadEmbedder(bundle.manifest.model, (fraction) => {
        if (!alive()) return;
        setStatusMessage(`Loading search model… ${Math.round(fraction * 100)}%`);
      });
    } catch (e) {
      if (!alive()) return;
      const msg = mapBundleError(e);
      setError(msg);
      setState("error");
      setStatusMessage("");
      setChunks(null);
      setVectors(null);
      setDim(0);
      setCount(0);
      return;
    }

    if (!alive()) return;
    finishLoad(bundle);
  }, [loadBundle, loadEmbedder, finishLoad]);

  const preload = useCallback(() => {
    if (stateRef.current === "ready") return;
    void runLoad();
  }, [runLoad]);

  useEffect(() => {
    const onSettings = (): void => {
      void runLoad();
    };
    if (typeof window === "undefined") return;
    window.addEventListener(SETTINGS_EVENT, onSettings);
    return () => window.removeEventListener(SETTINGS_EVENT, onSettings);
  }, [runLoad]);

  const ask = useCallback(
    async (question: string, opts?: AskOptions): Promise<AskResult> => {
      if (state !== "ready") {
        throw new Error(
          state === "missing-key"
            ? "Add your AI provider key in Settings."
            : "The assistant is not ready yet.",
        );
      }

      const trimmed = question.trim();
      if (!trimmed) {
        throw new Error("Ask something first.");
      }

      const providerId = readActiveProviderId();
      const provider = await loadProvider(providerId);
      const config = readProviderConfig(providerId, provider);
      const bad = provider.validateConfig(config);
      if (bad) {
        throw new Error(bad);
      }

      const t0 = performance.now();
      const queryVec = await embedQuery(trimmed);
      // Hybrid retrieval: dense (vector) + lexical (BM25) candidates fused
      // with RRF, then MMR re-ranks for diversity, then a token budget
      // trims the tail. `query` lets the BM25 side actually run; without
      // it retrieval falls back to pure vector search.
      const retrieved = retrieve(queryVec, 6, { query: trimmed });
      const { system, user } = buildPrompts({
        project: {
          name: bundleMeta.siteName,
          tagline: bundleMeta.siteTagline,
          repo: bundleMeta.repo,
        },
        question: trimmed,
        retrieved,
      });
      const citations = uniqCitations(retrieved);

      // Stitch prior turns onto the front of the messages array. Filter out
      // empty/whitespace-only entries (defensive — voice mode can briefly
      // produce empty assistant bubbles before the first token arrives).
      const priorTurns = (opts?.history ?? [])
        .filter(
          (t) =>
            (t.role === "user" || t.role === "assistant") &&
            typeof t.content === "string" &&
            t.content.trim().length > 0,
        )
        .map((t) => ({ role: t.role, content: t.content }));

      let answer = "";
      let inputTokensApprox = Math.ceil((system.length + user.length) / 4);
      let outputTokensApprox = 0;
      let finishReason: AskFinishReason = "stop";

      try {
        for await (const ev of provider.stream(
          {
            system,
            messages: [...priorTurns, { role: "user", content: user }],
            maxTokens: 1024,
            temperature: 0.4,
            signal: opts?.signal,
          },
          config,
        )) {
          if (!ev || typeof ev.type !== "string") continue;
          if (opts?.signal?.aborted) {
            finishReason = "abort";
            break;
          }
          if (ev.type === "text-delta") {
            const piece = typeof ev.text === "string" ? ev.text : "";
            if (piece.length === 0) continue;
            answer += piece;
            if (opts?.onToken) {
              try {
                opts.onToken({ text: piece });
              } catch (cbErr) {
                if (typeof console !== "undefined") {
                  console.error("[chat] onToken handler threw", cbErr);
                }
              }
            }
          } else if (ev.type === "finish") {
            if (
              typeof ev.inputTokens === "number" &&
              typeof ev.outputTokens === "number"
            ) {
              inputTokensApprox = ev.inputTokens;
              outputTokensApprox = ev.outputTokens;
            } else {
              outputTokensApprox = Math.ceil(answer.length / 4);
            }
            if (typeof ev.finishReason === "string") {
              finishReason = ev.finishReason as AskFinishReason;
            }
          }
        }
      } catch (err) {
        if (opts?.signal?.aborted || (err as Error)?.name === "AbortError") {
          finishReason = "abort";
        } else {
          throw err;
        }
      }

      const durationMs = Math.round(performance.now() - t0);

      return {
        answer,
        citations,
        inputTokensApprox,
        outputTokensApprox,
        durationMs,
        finishReason,
      };
    },
    [state, bundleMeta, embedQuery, retrieve],
  );

  return useMemo(
    (): ChatEngine => ({
      state,
      statusMessage,
      error,
      chunkCount,
      repo: bundleMeta.repo,
      hasApiKey,
      ask,
      preload,
    }),
    [state, statusMessage, error, chunkCount, bundleMeta, hasApiKey, ask, preload],
  );
};

export function notifySettingsChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SETTINGS_EVENT));
  }
}

export interface ActiveProviderInfo {
  readonly displayName: string;
  readonly modelLabel: string;
  readonly providerId: ProviderId;
}

export function useActiveProvider(): ActiveProviderInfo {
  const [info, setInfo] = useState<ActiveProviderInfo>(() => ({
    displayName: "…",
    modelLabel: "…",
    providerId: readActiveProviderId(),
  }));

  const [rev, setRev] = useState(0);

  useEffect(() => {
    const bump = (): void => setRev((r) => r + 1);
    window.addEventListener(SETTINGS_EVENT, bump);
    const offSecret = onSecretChange(bump);
    return () => {
      window.removeEventListener(SETTINGS_EVENT, bump);
      offSecret();
    };
  }, []);

  useEffect(() => {
    const id = readActiveProviderId();
    let cancelled = false;
    void loadProvider(id).then((p) => {
      if (cancelled) return;
      const cfg = readProviderConfig(id, p);
      const label =
        p.models.find((m) => m.id === cfg.model)?.label ?? cfg.model;
      setInfo({
        displayName: p.displayName,
        modelLabel: label,
        providerId: id,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [rev]);

  return info;
}
