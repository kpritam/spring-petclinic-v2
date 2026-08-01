import type { ReactNode } from "react";

/**
 * Compile-time replacement for `SpellbookChat` when the chat feature is
 * disabled (`index.enabled: false` in `.grimoire/config.yml`, or an
 * explicit `SPELLBOOK_ENABLED=false` at site-build time).
 *
 * `docusaurus.config.ts` swaps this stub in via webpack's
 * `NormalModuleReplacementPlugin`, which short-circuits webpack's import
 * graph traversal at the module-resolution step. That breaks the chain to
 * `react-markdown`, `@huggingface/transformers`, `@mlc-ai/web-llm`, `ai`,
 * `@ai-sdk/*`, `highlight.js`, … so none of those heavy deps end up in
 * any chunk of the production bundle.
 *
 * The component renders nothing — `Root.tsx` lazy-imports it inside a
 * `<Suspense fallback={null}>`, so the chat slot stays empty.
 */
export default function SpellbookChatDisabled(): ReactNode {
  return null;
}
