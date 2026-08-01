/**
 * Static-bundle contract for the in-browser RAG chat. Produced by
 * `@kpritam/grimoire-core`'s `IndexBuilder` and shipped under
 * `static/grimoire-index/`. Wire format must stay aligned with the
 * Node-side mirror in `packages/core/src/services/index/types.ts`.
 */

export interface ChunkRecord {
  readonly id: string;
  readonly file: string;
  readonly headings: readonly string[];
  /**
   * Raw chunk body. Shown verbatim in citations and injected into LLM
   * context. Heading breadcrumb is NOT inlined here — it's stored
   * separately in `headings` and re-mixed into the embed input on the
   * server (the build-time bundle strips that derived field).
   */
  readonly text: string;
  readonly sourceLink?: string;
  readonly anchor?: string;
  /** Heuristic: `Math.ceil(chars / 4)`. */
  readonly tokens: number;
}

export interface BundleManifest {
  readonly version: 1;
  readonly model: string;
  readonly dim: number;
  readonly count: number;
  readonly sealSha: string;
  readonly generatedAt: string;
  readonly format: "f32-le";
  /** Source repo identifier, e.g. `"org/project"`. */
  readonly repo?: string;
  /** Human-readable project name (from `site.title`). Anchors the assistant persona. */
  readonly siteName?: string;
  /** Short project description (from `site.tagline`). Supplements the persona. */
  readonly siteTagline?: string;
}

export interface RetrievedChunk {
  readonly chunk: ChunkRecord;
  /** Cosine similarity in [-1, 1]; higher is better. */
  readonly score: number;
}

export interface Citation {
  readonly file: string;
  readonly headings: readonly string[];
  readonly sourceLink?: string;
  readonly anchor?: string;
}
