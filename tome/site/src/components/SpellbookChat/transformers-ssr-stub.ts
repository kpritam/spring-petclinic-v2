/**
 * SSR / server webpack target: the real `@huggingface/transformers` pulls WASM/ONNX
 * binaries that Webpack must not parse on the server. The chat only loads
 * this module on the client.
 */
export async function pipeline(): Promise<never> {
  throw new Error("@huggingface/transformers is client-only");
}

export const env: {
  allowLocalModels: boolean;
  useBrowserCache: boolean;
} = {
  allowLocalModels: false,
  useBrowserCache: false,
};
