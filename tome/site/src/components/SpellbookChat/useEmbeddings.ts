import { useCallback, useRef } from "react";

/**
 * Vector dimension of every embedding the chat pipeline produces. Both the
 * legacy MiniLM-L6 model and the current Snowflake Arctic-Embed-XS default
 * emit 384-d float vectors, and so does every other 384-d alternative we
 * recommend. Anything else won't slot into the existing `vectors.bin`
 * format, so we hard-fail at query time rather than silently corrupt
 * retrieval scores.
 */
const EXPECTED_DIM = 384;

/**
 * Default model used by browsers built before the manifest carried the
 * model id. Older bundles (manifest.version === 1, no `model` ever
 * required) used MiniLM-L6; new bundles always carry a model id, but we
 * keep this fallback so a stale manifest doesn't crash the chat.
 */
const FALLBACK_MODEL_ID = "Snowflake/snowflake-arctic-embed-xs";

type FeaturePipeline = {
  (text: string, options: { pooling: string; normalize: boolean }): Promise<unknown>;
};

const sharedPipelineCache = new Map<string, Promise<FeaturePipeline>>();

function toFloat32(raw: unknown): Float32Array {
  if (raw instanceof Float32Array) {
    return raw;
  }
  if (Array.isArray(raw)) {
    return Float32Array.from(raw.flat(Infinity) as number[]);
  }
  const t = raw as { data?: unknown; dims?: readonly number[]; tolist?: () => unknown };
  if (t?.data instanceof Float32Array) {
    return t.data;
  }
  if (Array.isArray(t?.data)) {
    return Float32Array.from((t.data as number[][]).flat());
  }
  if (typeof t?.tolist === "function") {
    const nested = t.tolist() as number[] | number[][];
    if (Array.isArray(nested) && nested.length > 0 && typeof nested[0] === "number") {
      return Float32Array.from(nested as number[]);
    }
    return Float32Array.from((nested as number[][]).flat());
  }
  throw new Error("Unexpected embedder output shape");
}

/**
 * L2-normalize a vector into a fresh `Float32Array(dim)`. Defensive against
 * the case where the upstream pipeline silently disables `normalize: true`
 * (or ships per-token tensors instead of pooled vectors); without this,
 * dot-product retrieval scores stop equalling cosine similarity and
 * top-k results quietly degrade.
 */
function l2Normalize(vec: Float32Array): Float32Array {
  let sum = 0;
  for (let i = 0; i < vec.length; i++) {
    const v = vec[i]!;
    sum += v * v;
  }
  const inv = sum > 0 ? 1 / Math.sqrt(sum) : 1;
  const out = new Float32Array(vec.length);
  for (let i = 0; i < vec.length; i++) out[i] = vec[i]! * inv;
  return out;
}

export type EmbeddingProgress = (fraction: number) => void;

export interface UseEmbeddingsApi {
  /**
   * Download / instantiate the embedding model named in the bundle
   * manifest. Returns a callable pipeline that can produce 384-d vectors.
   * Calling with a different `modelId` than a prior call swaps the
   * active model — useful if the user reloads the chat panel after a
   * fresh `grimoire cast` that changed the embedding model.
   */
  readonly loadEmbedder: (
    modelId?: string,
    onProgress?: EmbeddingProgress,
  ) => Promise<FeaturePipeline>;
  readonly embedQuery: (query: string) => Promise<Float32Array>;
}

export function useEmbeddings(): UseEmbeddingsApi {
  const pipelineRef = useRef<FeaturePipeline | null>(null);

  const loadEmbedder = useCallback(
    async (modelId?: string, onProgress?: EmbeddingProgress) => {
      if (typeof WebAssembly === "undefined") {
        throw new Error("NO_WASM");
      }

      const id = modelId ?? FALLBACK_MODEL_ID;
      const { pipeline, env } = await import("@huggingface/transformers");
      env.allowLocalModels = false;
      env.useBrowserCache = true;

      let entry = sharedPipelineCache.get(id);
      if (!entry) {
        entry = pipeline("feature-extraction", id, {
          dtype: "fp32",
          progress_callback: (report: { status?: string; progress?: number }) => {
            if (
              (report.status === "progress" || report.status === "progress_total") &&
              typeof report.progress === "number" &&
              onProgress
            ) {
              onProgress(Math.min(1, Math.max(0, report.progress / 100)));
            }
          },
        }) as Promise<FeaturePipeline>;
        sharedPipelineCache.set(id, entry);
      } else if (onProgress) {
        onProgress(1);
      }

      const pipe = await entry;
      pipelineRef.current = pipe;
      return pipe;
    },
    [],
  );

  const embedQuery = useCallback(async (query: string) => {
    const pipe = pipelineRef.current;
    if (!pipe) {
      throw new Error("EMBEDDER_NOT_READY");
    }
    const out = await pipe(query, { pooling: "mean", normalize: true });
    const vec = toFloat32(out);
    if (vec.length !== EXPECTED_DIM) {
      throw new Error(
        `EMBED_DIM_MISMATCH: expected ${EXPECTED_DIM}, got ${vec.length}. ` +
          "The model named in the bundle manifest produced an unexpected " +
          "vector size — either the wrong model is being downloaded or " +
          "the pipeline returned a per-token tensor instead of a pooled " +
          "vector.",
      );
    }
    return l2Normalize(vec);
  }, []);

  return { loadEmbedder, embedQuery };
}
