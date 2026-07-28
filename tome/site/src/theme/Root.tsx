import { Suspense, lazy, type ReactNode } from "react";

/**
 * Lazy-loaded Spellbook chat dialog.
 *
 * When the feature is disabled (`index.enabled: false` in
 * `.grimoire/config.yml`, or `SPELLBOOK_ENABLED=false` at site-build
 * time), `spellbookWebpackPlugin` swaps this import target for
 * `SpellbookChatDisabled.tsx` via `NormalModuleReplacementPlugin`. That
 * happens at module-resolution time, so webpack tree-shakes the entire
 * SpellbookChat dependency tree (`@huggingface/transformers`,
 * `@mlc-ai/web-llm`, `ai`, `@ai-sdk/*`, `react-markdown`, `highlight.js`,
 * …) out of the production bundle — the resulting chunk is just an empty
 * stub. We pre-load this lazy module unconditionally; the cost when
 * disabled is essentially zero.
 */
const SpellbookChat = lazy(() => import("../components/SpellbookChat"));

export default function Root(props: { readonly children: ReactNode }): ReactNode {
  const { children } = props;
  return (
    <>
      {children}
      <Suspense fallback={null}>
        <SpellbookChat />
      </Suspense>
    </>
  );
}
