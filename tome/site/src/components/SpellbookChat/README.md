# Chat — in-browser RAG over the documentation

A static-site chat panel that runs **entirely in the user's browser**:

- no backend, no edge function, no infra cost to the project owner
- **BYOK** — users bring their own API keys for cloud models; keys live in
  tab memory only (cleared on refresh, never written to disk)
- optional **fully local** inference with **WebLLM** (WebGPU, no keys)
- private by default — cloud calls go straight from the user's browser to
  the provider they chose

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  Build time — packages/core/IndexBuilder                             │
│    • walks tome/**/*.md, chunks by heading + ~512 tokens             │
│    • embeds chunks with @huggingface/transformers (onnx-community MiniLM-L6-v2, 384-dim) │
│    • writes the static bundle under                                  │
│        tome/site/static/grimoire-index/                              │
│          chunks.json     (array<ChunkRecord>)                        │
│          vectors.bin     (Float32Array, packed little-endian)        │
│          manifest.json   (BundleManifest — also carries siteName,    │
│                          siteTagline, repo so the chat persona is    │
│                          project-aware)                              │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  Browser runtime — SpellbookChat panel + ChatEngine                  │
│    1. User picks a provider + model in Settings                      │
│         • Provider id, model, base URL → localStorage                │
│         • API key → secretStore.ts (memory only; never on disk)      │
│    2. lazy-load chunks.json + vectors.bin + embedding model (WASM)   │
│    3. Optional: WebLLM preloads model weights (IndexedDB cache)      │
│    4. on each question: embed query locally → top-k chunks →         │
│       stream completion via the active StreamProvider                │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  Voice input — mic button inside the one composer                    │
│    • no separate "speak" mode: the mic sits next to Send and feeds   │
│      the same message list typing does — one transcript, ever        │
│    • useVoiceCapture: unified STT (Web Speech API, Whisper fallback) │
│      + Silero VAD for turn-taking; hands back a finalized utterance  │
│    • the panel submits that utterance through the same ask/stream    │
│      path as typed input, sentence-buffering the reply through       │
│      SpeechSynthesis (sanitized via speechText.ts) as it streams     │
│    • tapping the mic mid-reply is a barge-in: cancels the ask + TTS   │
│      and starts listening again immediately                         │
└──────────────────────────────────────────────────────────────────────┘
```

## LLM providers (`streamProviders/`)

All implement the shared `StreamProvider` contract (`streamProviders/types.ts`).

| Provider | How it runs | What the user configures |
| --- | --- | --- |
| **Anthropic** | Browser → Anthropic API (CORS header set) | API key; model from built-in list |
| **OpenAI** | Browser → OpenAI API | API key; model from built-in list |
| **Google Gemini** | Browser → Generative Language API | API key; model from built-in list |
| **Ollama / OpenAI-compatible** | Browser → user's server (e.g. `http://localhost:11434/v1`) | Base URL (optional); model name (presets + **custom**). Requires CORS on the server (e.g. `OLLAMA_ORIGINS`). |
| **WebLLM** | Model runs in the tab (WebGPU); weights cached locally | Model choice only. Needs a **WebGPU**-capable browser. SSR builds alias `@mlc-ai/web-llm` to a stub so Docusaurus can prerender. |

## Storage layout

| What | Where | Why |
| --- | --- | --- |
| Active provider id | `localStorage["grimoire.chat.provider"]` | Non-secret preference |
| Model / baseUrl per provider | `localStorage["grimoire.chat.<id>.{model,baseUrl}"]` | Non-secret preferences |
| **API key** | in-memory (`secretStore.ts`) | Cleared on tab refresh — no plaintext secret on disk |

On first load `secretStore.purgeLegacyKeyStorage()` deletes any plaintext
API keys a previous build persisted, so returning users don't carry
credentials forward on disk.

## Files in this directory

| File | Purpose |
| --- | --- |
| `types.ts` | Bundle schema (`ChunkRecord`, `BundleManifest`, `RetrievedChunk`) |
| `ChatEngine.ts` | Engine interface shared by panel + voice mode |
| `streamProviders/*.ts` | Per-provider streaming (Vercel AI SDK + WebLLM) |
| `index.tsx` | Main chat panel React component |
| `useChatEngine.ts` | React hook that implements the engine |
| `systemPrompt.ts` | Project-aware persona + grounded RAG prompt |
| `secretStore.ts` | In-memory API key store (no persistence) |
| `useEmbeddings.ts` | Loads + runs the in-browser embedding model |
| `useRetrieval.ts` | Cosine-sim against shipped vectors |
| `SettingsPanel.tsx` | Provider + model + key settings |
| `useVoiceCapture.ts` | Mic capture: unified STT + Silero VAD, engine-agnostic — hands the panel a finalized utterance string |
| `useSpeechRecognition.ts` | Web Speech API STT hook |
| `useSpeechSynthesis.ts` | Web Speech API TTS hook (cancels on unmount) |
| `useUnifiedSTT.ts` | Unified native + Whisper-fallback STT |
| `useWhisperSTT.ts` | In-browser Whisper STT hook |
| `speechText.ts` | Strips markdown/citation noise before TTS; sentence-buffers a streaming answer |
| `voiceDebug.ts` | Opt-in voice pipeline logger (silent by default) |
| `styles.module.css` | Panel + composer + mic button styles |
| `webllm-ssr-stub.ts` | SSR stub for `@mlc-ai/web-llm` |
| `transformers-ssr-stub.ts` | SSR stub for `@huggingface/transformers` |

`types.ts` and `ChatEngine.ts` are the only cross-cutting contracts.

## Debug logging

The voice pipeline is chatty during development. To enable transcript-level
traces in production:

```js
localStorage.setItem("grimoire.chat.debug", "1");
location.reload();
```

The flag is read once on module load. Logs include a truncated transcript
preview (first 80 chars) but never the raw API key or full answer.
