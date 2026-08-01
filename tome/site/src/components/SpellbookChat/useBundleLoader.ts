import useBaseUrl from "@docusaurus/useBaseUrl";
import { useCallback } from "react";

import type { BundleManifest, ChunkRecord } from "./types";

export interface BundleLoadResult {
  readonly chunks: ChunkRecord[];
  readonly vectors: Float32Array;
  readonly manifest: BundleManifest;
}

export async function fetchSpellbookBundle(baseUrl: string): Promise<BundleLoadResult> {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const [chunksRes, vectorsRes, manifestRes] = await Promise.all([
    fetch(`${base}chunks.json`),
    fetch(`${base}vectors.bin`),
    fetch(`${base}manifest.json`),
  ]);

  if (!chunksRes.ok || !vectorsRes.ok || !manifestRes.ok) {
    const err = new Error("BUNDLE_MISSING");
    throw err;
  }

  const [chunksRaw, manifest] = await Promise.all([
    chunksRes.json() as Promise<ChunkRecord[]>,
    manifestRes.json() as Promise<BundleManifest>,
  ]);

  const ab = await vectorsRes.arrayBuffer();
  const vectors = new Float32Array(ab);

  if (vectors.length !== manifest.count * manifest.dim) {
    throw new Error(
      `VECTOR_DIM_MISMATCH: expected ${manifest.count * manifest.dim} floats, got ${vectors.length}`,
    );
  }

  return { chunks: chunksRaw, vectors, manifest };
}

/** Resolves `/grimoire-index/*` under the configured baseUrl. */
export function useBundleLoader(): () => Promise<BundleLoadResult> {
  const baseUrl = useBaseUrl("/grimoire-index/");
  return useCallback(() => fetchSpellbookBundle(baseUrl), [baseUrl]);
}
