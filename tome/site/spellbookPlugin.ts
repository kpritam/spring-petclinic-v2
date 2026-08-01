import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import webpack from "webpack";

/**
 * In-browser RAG chat ("Spellbook") master switch + Docusaurus plugin.
 *
 * This file is the single source of truth: `@kpritam/grimoire-output-docusaurus`
 * ships it to every scaffolded consumer site (see `writeSpellbookAssets` in
 * `src/internal/spellbookAssets.ts`), and the live Grimoire docs site
 * (`tome/site/spellbookPlugin.ts`) is a symlink into this exact file — no
 * separate sync step, no drift possible. Edit here directly.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolution order:
//   1. SPELLBOOK_ENABLED=true|false env var (explicit override)
//   2. Presence of static/grimoire-index/manifest.json (last `grimoire cast`)
//   3. Default: false
//
// `siteDir` comes from Docusaurus's own plugin `LoadContext` — computed by
// Docusaurus itself, not inferred here — so this is correct regardless of
// cwd or symlinks. Deliberately NOT `__dirname`-relative: the manifest is
// a property of the SITE being built (written into its own `static/`),
// not of this template file's own location, and NOT `process.cwd()`-
// relative either: that assumes the build always runs with cwd = the site
// directory, true for Grimoire's own generated scripts but not guaranteed
// for arbitrary CI setups. `context.siteDir` has neither failure mode.
export const resolveSpellbookEnabled = (siteDir: string): boolean => {
  const envFlag = process.env.SPELLBOOK_ENABLED;
  if (envFlag === "false" || envFlag === "0") return false;
  if (envFlag === "true" || envFlag === "1") return true;
  const manifestPath = path.join(siteDir, "static/grimoire-index/manifest.json");
  return fs.existsSync(manifestPath);
};

const SPELLBOOK_DISABLED_STUB = path.join(
  __dirname,
  "src/components/SpellbookChatDisabled.tsx",
);

interface MutableWebpackConfig {
  resolve?: { alias?: Record<string, string> | unknown };
  module?: { rules?: unknown[] };
}

/**
 * Webpack warnings we deliberately silence:
 *
 * - `onnxruntime-web` ships a UMD bundle whose dynamic `require()` only
 *   fires in non-web targets (Node fallbacks). Webpack can't statically
 *   resolve it, but it's effectively dead code in our browser build, so
 *   the "Critical dependency: require function is used in a way…" noise
 *   is purely cosmetic.
 *
 * - `@huggingface/transformers`'s web entry uses `import.meta` at the top
 *   level. Webpack 5 supports it but emits a "Critical dependency:
 *   Accessing import.meta directly is unsupported" warning because the
 *   runtime feature-detects gracefully. Library issue we can't fix here.
 *
 * Keeping this list narrow (matched by `module` and `message`) so future
 * real warnings still surface.
 */
const SPELLBOOK_IGNORED_WARNINGS = [
  {
    module: /node_modules[\\/].*onnxruntime-web/,
    message: /Critical dependency: require function is used in a way/,
  },
  {
    module:
      /node_modules[\\/].*@huggingface[\\/]transformers[\\/].*transformers\.web/,
    message:
      /Critical dependency: Accessing import\.meta directly is unsupported/,
  },
];

/**
 * Replaces every entrypoint into the SpellbookChat tree with an inert
 * stub when disabled (webpack still creates a chunk for `import()` even
 * when the branch is dead at runtime), and wires SSR stubs + binary
 * asset rules when enabled.
 *
 * Earlier revisions also defined a build-time `__SPELLBOOK_ENABLED__`
 * constant via `webpack.DefinePlugin`. That triggered a webpack
 * persistent-cache serialization warning ("No serializer registered for
 * ConstDependency") on every consumer of the constant. Since
 * `NormalModuleReplacementPlugin` already collapses the SpellbookChat
 * graph to the inert stub when disabled — and tree-shaking handles the
 * empty default export — the DefinePlugin layer was redundant. Removing
 * it eliminates the cache warning without changing bundle output.
 */
export const spellbookWebpackPlugin = (context: { siteDir: string }) => {
  const enabled = resolveSpellbookEnabled(context.siteDir);
  return {
    name: "spellbook-webpack",
    configureWebpack(config: MutableWebpackConfig, isServer: boolean) {
      if (!enabled) {
        const replacePlugin = new webpack.NormalModuleReplacementPlugin(
          /(?:^|[\\/])components[\\/]SpellbookChat(?:[\\/](?:index)?)?$/,
          SPELLBOOK_DISABLED_STUB,
        );
        return { plugins: [replacePlugin] };
      }

      const transformersStub = path.join(
        __dirname,
        "src/components/SpellbookChat/transformers-ssr-stub.ts",
      );
      const webllmStub = path.join(
        __dirname,
        "src/components/SpellbookChat/webllm-ssr-stub.ts",
      );
      const vadStub = path.join(
        __dirname,
        "src/components/SpellbookChat/vad-ssr-stub.ts",
      );
      const binaryRule = {
        test: /\.(wasm|onnx|bin|node)$/i,
        type: "asset/resource" as const,
      };

      if (isServer) {
        config.resolve ??= {};
        const prev = config.resolve.alias;
        const alias: Record<string, string> =
          prev && typeof prev === "object" && !Array.isArray(prev)
            ? { ...(prev as Record<string, string>) }
            : {};
        alias["@huggingface/transformers"] = transformersStub;
        alias["@mlc-ai/web-llm"] = webllmStub;
        // `@ricky0123/vad-web` and `onnxruntime-web` are not safe to evaluate
        // during Docusaurus SSR — they reference `AudioWorklet` and resolve
        // .wasm assets. Stub the VAD entrypoint and let the binary rule
        // handle the ORT wasm files when bundled for the browser.
        alias["@ricky0123/vad-web"] = vadStub;
        config.resolve.alias = alias;
        config.module ??= { rules: [] };
        config.module.rules ??= [];
        config.module.rules.push(binaryRule);
        return { ignoreWarnings: SPELLBOOK_IGNORED_WARNINGS };
      }

      return {
        experiments: {
          asyncWebAssembly: true,
        },
        resolve: {
          fallback: {
            fs: false as const,
            path: false as const,
            crypto: false as const,
          },
        },
        module: {
          rules: [binaryRule],
        },
        ignoreWarnings: SPELLBOOK_IGNORED_WARNINGS,
      };
    },
  };
};
