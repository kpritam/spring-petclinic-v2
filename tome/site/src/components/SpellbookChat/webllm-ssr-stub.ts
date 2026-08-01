/**
 * Docusaurus SSR build must not import `@mlc-ai/web-llm` (WebGPU / browser-only).
 * Webpack aliases the real package to this stub on the server target.
 */

export function CreateMLCEngine(): Promise<never> {
  throw new Error("WebLLM is browser-only");
}
