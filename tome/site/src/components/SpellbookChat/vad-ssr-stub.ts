/**
 * SSR / server webpack target: the real `@ricky0123/vad-web` pulls
 * `onnxruntime-web` + an AudioWorklet asset path that Webpack must not
 * try to parse on the server. The chat only loads this module on the
 * client (lazy import inside `useSileroVAD`).
 */

export class MicVAD {
  static async new(): Promise<MicVAD> {
    throw new Error("@ricky0123/vad-web is client-only");
  }
  start = async (): Promise<void> => {
    throw new Error("@ricky0123/vad-web is client-only");
  };
  pause = async (): Promise<void> => {
    /* noop */
  };
  destroy = async (): Promise<void> => {
    /* noop */
  };
  listening = false;
  errored: string | null = null;
}

export const DEFAULT_MODEL = "legacy" as const;
