import { useCallback, useMemo } from "react";

import type { ChunkRecord, RetrievedChunk } from "./types";

/**
 * How many candidates to consider in the dense (vector) sweep before MMR
 * re-ranks them. Larger than the final `k` so MMR has room to swap in
 * diverse candidates. Hand-rolled brute-force scan stays linear in the
 * total chunk count, so this is essentially free for our scale.
 */
const DENSE_CANDIDATE_POOL = 30;

/**
 * Same idea for the lexical (BM25) sweep. Candidate sets from the two
 * sides are merged via Reciprocal Rank Fusion before MMR runs.
 */
const LEXICAL_CANDIDATE_POOL = 30;

/**
 * RRF (Reciprocal Rank Fusion) constant. Lower values give more weight to
 * top-ranked candidates; 60 is the value Cormack et al. use in the
 * canonical RRF paper and is the standard production pick for hybrid
 * search blending.
 */
const RRF_K = 60;

/**
 * MMR diversity weight (1 = pure relevance, 0 = pure diversity). 0.7
 * keeps the top hit honest while still penalising near-duplicate chunks
 * that come from the same section/file. Tunable per-deployment if needed.
 */
const MMR_LAMBDA = 0.7;

/**
 * Approximate context-token budget for the retrieved passages. We don't
 * have a true tokenizer in the browser; chunks store a `tokens` heuristic
 * (`ceil(chars / 4)`) computed at index time, and we sum that against
 * this budget. Sized for cloud providers with 4-8k context windows; the
 * caller can override per-request via the second arg to `retrieve`.
 */
const DEFAULT_CONTEXT_TOKEN_BUDGET = 1500;

// ─── Vector similarity (dot product on unit vectors == cosine) ─────────

function dotProduct(
  query: Float32Array,
  vectors: Float32Array,
  index: number,
  dim: number,
): number {
  let s = 0;
  const base = index * dim;
  for (let d = 0; d < dim; d += 1) {
    s += query[d]! * vectors[base + d]!;
  }
  return s;
}

function denseTopK(
  query: Float32Array,
  vectors: Float32Array,
  dim: number,
  count: number,
  k: number,
): readonly { readonly idx: number; readonly score: number }[] {
  const scored: { idx: number; score: number }[] = new Array(count);
  for (let i = 0; i < count; i += 1) {
    scored[i] = { idx: i, score: dotProduct(query, vectors, i, dim) };
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

// ─── BM25 (lexical) ────────────────────────────────────────────────────

const TOKEN_RE = /[A-Za-z][A-Za-z0-9_]+|\d+/g;

/**
 * Cheap, dependency-free tokenizer good enough for English markdown.
 * We split on word boundaries, drop tokens shorter than 2 chars, and
 * lowercase. We deliberately don't stop-word filter — short, common
 * tokens like "use" or "tag" are still meaningful in code-heavy docs.
 */
function tokenize(text: string): string[] {
  const out: string[] = [];
  for (const m of text.toLowerCase().matchAll(TOKEN_RE)) {
    const t = m[0];
    if (t.length >= 2) out.push(t);
  }
  return out;
}

interface BM25Index {
  /** For each chunk: {token → tf}. */
  readonly termFreqs: ReadonlyArray<ReadonlyMap<string, number>>;
  /** Document length in tokens, per chunk. */
  readonly docLengths: ReadonlyArray<number>;
  /** Average document length over the corpus. */
  readonly avgDocLength: number;
  /** Inverse document frequency, per token. */
  readonly idf: ReadonlyMap<string, number>;
  readonly chunkCount: number;
}

function buildBM25Index(chunks: readonly ChunkRecord[]): BM25Index {
  const termFreqs: Map<string, number>[] = [];
  const docLengths: number[] = [];
  const docFreq = new Map<string, number>();

  for (const c of chunks) {
    const tokens = tokenize(`${c.headings.join(" ")} ${c.text}`);
    docLengths.push(tokens.length);
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    termFreqs.push(tf);
    for (const t of tf.keys()) docFreq.set(t, (docFreq.get(t) ?? 0) + 1);
  }

  const N = chunks.length;
  const avgDocLength =
    N > 0 ? docLengths.reduce((s, n) => s + n, 0) / N : 0;
  const idf = new Map<string, number>();
  for (const [term, df] of docFreq) {
    // Robertson-Sparck-Jones IDF, clamped to non-negative for stability.
    const v = Math.log(1 + (N - df + 0.5) / (df + 0.5));
    idf.set(term, v);
  }

  return {
    termFreqs,
    docLengths,
    avgDocLength,
    idf,
    chunkCount: N,
  };
}

const BM25_K1 = 1.5;
const BM25_B = 0.75;

function bm25Score(
  index: BM25Index,
  docIdx: number,
  queryTokens: readonly string[],
): number {
  const tf = index.termFreqs[docIdx];
  const dl = index.docLengths[docIdx];
  if (!tf || dl === undefined) return 0;
  let score = 0;
  for (const q of queryTokens) {
    const f = tf.get(q);
    if (!f) continue;
    const idf = index.idf.get(q) ?? 0;
    if (idf <= 0) continue;
    const norm = 1 - BM25_B + BM25_B * (dl / Math.max(1, index.avgDocLength));
    score += idf * ((f * (BM25_K1 + 1)) / (f + BM25_K1 * norm));
  }
  return score;
}

function bm25TopK(
  index: BM25Index,
  rawQuery: string,
  k: number,
): readonly { readonly idx: number; readonly score: number }[] {
  const queryTokens = tokenize(rawQuery);
  if (queryTokens.length === 0 || index.chunkCount === 0) return [];
  const scored: { idx: number; score: number }[] = new Array(index.chunkCount);
  for (let i = 0; i < index.chunkCount; i += 1) {
    scored[i] = { idx: i, score: bm25Score(index, i, queryTokens) };
  }
  scored.sort((a, b) => b.score - a.score);
  // Drop zero-score docs — they have no token overlap and skew the RRF
  // blend toward arbitrary documents.
  return scored.filter((s) => s.score > 0).slice(0, k);
}

// ─── Reciprocal Rank Fusion ────────────────────────────────────────────

interface RRFCandidate {
  readonly idx: number;
  readonly rrf: number;
  readonly denseScore?: number;
}

function reciprocalRankFusion(
  dense: readonly { readonly idx: number; readonly score: number }[],
  lexical: readonly { readonly idx: number; readonly score: number }[],
): readonly RRFCandidate[] {
  const fused = new Map<number, { rrf: number; denseScore?: number }>();

  dense.forEach(({ idx, score }, rank) => {
    const entry = fused.get(idx) ?? { rrf: 0 };
    entry.rrf += 1 / (RRF_K + rank + 1);
    entry.denseScore = score;
    fused.set(idx, entry);
  });

  lexical.forEach(({ idx }, rank) => {
    const entry = fused.get(idx) ?? { rrf: 0 };
    entry.rrf += 1 / (RRF_K + rank + 1);
    fused.set(idx, entry);
  });

  // NOTE: must use `Array.from(fused, ...)` rather than `[...fused.entries()]`.
  // Babel's docusaurus preset transpiles `[...iterable]` into
  // `[].concat(iterable)`, which only spreads true Array instances —
  // `Map.entries()` returns a Map Iterator that ends up wrapped as a single
  // element. The downstream `.map(([idx, { rrf, ... }]) => ...)` then sees
  // an iterator object instead of `[number, RRFEntry]` and explodes with
  // "Cannot read properties of undefined (reading 'rrf')".
  const out: RRFCandidate[] = [];
  fused.forEach((entry, idx) => {
    out.push({ idx, rrf: entry.rrf, denseScore: entry.denseScore });
  });
  out.sort((a, b) => b.rrf - a.rrf);
  return out;
}

// ─── Maximal Marginal Relevance ────────────────────────────────────────

/**
 * Re-rank candidates so picks with high relevance to the query but low
 * redundancy with already-picked chunks rise to the top. Uses each
 * candidate's stored unit vector for the redundancy term, falling back
 * to the RRF score if no dense score is available.
 */
function mmrReRank(
  candidates: readonly RRFCandidate[],
  vectors: Float32Array,
  dim: number,
  query: Float32Array,
  k: number,
): readonly { readonly idx: number; readonly score: number }[] {
  if (candidates.length === 0) return [];
  const remaining = [...candidates];
  const picked: { idx: number; score: number }[] = [];
  const pickedVecs: Float32Array[] = [];

  // Cache candidate vectors as subarray views so we don't re-slice each pass.
  const candVec = (idx: number): Float32Array =>
    vectors.subarray(idx * dim, idx * dim + dim);

  while (picked.length < k && remaining.length > 0) {
    let bestPos = 0;
    let bestScore = -Infinity;

    for (let i = 0; i < remaining.length; i += 1) {
      const c = remaining[i]!;
      // Relevance: prefer the actual dense similarity when we have it; the
      // RRF score is a relative ranking signal, not a magnitude.
      const relevance =
        c.denseScore !== undefined
          ? c.denseScore
          : c.rrf;

      // Redundancy: max cosine to any already-picked vector.
      let redundancy = 0;
      const v = candVec(c.idx);
      for (const pv of pickedVecs) {
        let s = 0;
        for (let d = 0; d < dim; d += 1) s += v[d]! * pv[d]!;
        if (s > redundancy) redundancy = s;
      }

      const mmr = MMR_LAMBDA * relevance - (1 - MMR_LAMBDA) * redundancy;
      if (mmr > bestScore) {
        bestScore = mmr;
        bestPos = i;
      }
    }

    const winner = remaining.splice(bestPos, 1)[0]!;
    picked.push({
      idx: winner.idx,
      // Surface the dense similarity (cosine in [-1, 1]) when available so
      // the consumer can show a meaningful score to the user; fall back to
      // a normalized version of RRF otherwise.
      score: winner.denseScore ?? winner.rrf,
    });
    pickedVecs.push(candVec(winner.idx));
    // Defensive: query-only relevance when no dense score is on this side.
    void query;
  }

  return picked;
}

// ─── Token-budget enforcement ──────────────────────────────────────────

function enforceTokenBudget(
  hits: readonly { readonly idx: number; readonly score: number }[],
  chunks: readonly ChunkRecord[],
  budget: number,
): readonly { readonly idx: number; readonly score: number }[] {
  if (budget <= 0) return hits;
  const out: typeof hits = [] as never;
  let used = 0;
  for (const h of hits) {
    const c = chunks[h.idx];
    if (!c) continue;
    const cost = c.tokens > 0 ? c.tokens : Math.ceil(c.text.length / 4);
    if (used + cost > budget && out.length > 0) break;
    (out as Array<typeof h>).push(h);
    used += cost;
  }
  return out;
}

// ─── Public hook ───────────────────────────────────────────────────────

export interface RetrieveOptions {
  /**
   * Approximate token budget for the combined `[Context]` block. Pass
   * `0` to disable. Defaults to `DEFAULT_CONTEXT_TOKEN_BUDGET`.
   */
  readonly tokenBudget?: number;
  /**
   * The original natural-language question, used for BM25 lexical
   * scoring. If omitted, only dense (vector) retrieval runs.
   */
  readonly query?: string;
}

export function useRetrieval(
  chunks: ChunkRecord[] | null,
  vectors: Float32Array | null,
  dim: number,
  count: number,
): (
  query: Float32Array,
  k: number,
  options?: RetrieveOptions,
) => RetrievedChunk[] {
  // Build the BM25 index lazily and cache it for the lifetime of this
  // chunks/vectors pair. Tokenisation cost scales with the corpus, but
  // for our scale (~hundreds of chunks) this completes in a few ms.
  const bm25 = useMemo(
    () => (chunks && chunks.length > 0 ? buildBM25Index(chunks) : null),
    [chunks],
  );

  return useCallback(
    (query: Float32Array, k: number, options?: RetrieveOptions) => {
      if (!chunks?.length || !vectors || count <= 0 || dim <= 0) {
        return [];
      }

      const dense = denseTopK(
        query,
        vectors,
        dim,
        count,
        Math.max(k, DENSE_CANDIDATE_POOL),
      );
      const lexical =
        bm25 && options?.query
          ? bm25TopK(bm25, options.query, LEXICAL_CANDIDATE_POOL)
          : [];

      const fused = reciprocalRankFusion(dense, lexical);
      const reranked = mmrReRank(fused, vectors, dim, query, k);

      const budget =
        options?.tokenBudget !== undefined
          ? options.tokenBudget
          : DEFAULT_CONTEXT_TOKEN_BUDGET;
      const trimmed = enforceTokenBudget(reranked, chunks, budget);

      return trimmed.map(({ idx, score }) => ({
        chunk: chunks[idx]!,
        score,
      }));
    },
    [chunks, vectors, dim, count, bm25],
  );
}
