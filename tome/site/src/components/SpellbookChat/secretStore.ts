/**
 * In-memory store for chat API keys.
 *
 * Keys live ONLY in the running tab's memory — never in localStorage,
 * sessionStorage, IndexedDB, cookies, or any other persistent surface.
 * Refreshing the page, opening a new tab, or closing the browser drops
 * every key. This is a deliberate security trade-off: users pay a one-time
 * re-entry cost per session for a drastically smaller attack surface
 * (no XSS-readable keys, no extensions that snoop storage, no keys left
 * behind on a shared device).
 *
 * Everything non-secret (active provider id, chosen model, base URL) still
 * lives in localStorage — those are low-risk preferences, not credentials.
 *
 * Subscribers can listen to `onChange(id)` to re-run `validateConfig`
 * whenever the user types or clears a key.
 */

import type { ProviderId } from "./streamProviders/types";

type Listener = (id: ProviderId) => void;

const secrets = new Map<ProviderId, string>();
const listeners = new Set<Listener>();

/**
 * Read the secret for a provider. Returns `undefined` when the user hasn't
 * entered one yet or after they clear it.
 */
export function getSecret(id: ProviderId): string | undefined {
  const v = secrets.get(id);
  return v && v.length > 0 ? v : undefined;
}

/**
 * Store a secret in memory. Empty/whitespace values clear the secret
 * (equivalent to `clearSecret(id)`).
 */
export function setSecret(id: ProviderId, value: string): void {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    if (!secrets.has(id)) return;
    secrets.delete(id);
  } else {
    if (secrets.get(id) === trimmed) return;
    secrets.set(id, trimmed);
  }
  for (const fn of listeners) {
    try {
      fn(id);
    } catch {
      // Listener failures must not prevent other listeners firing or the
      // secret from being updated; subsequent calls will re-notify.
    }
  }
}

export function clearSecret(id: ProviderId): void {
  setSecret(id, "");
}

export function hasSecret(id: ProviderId): boolean {
  return getSecret(id) !== undefined;
}

export function onSecretChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * Migration helper: wipes any legacy API keys from localStorage that a
 * previous version of the chat had persisted, so returning users don't
 * carry plaintext credentials around on disk. Runs exactly once per tab
 * (guarded by `migrated`).
 *
 * Call this from the chat bootstrap (useChatEngine) — it's a one-shot
 * side-effect, not something to call on every render.
 */
let migrated = false;
export function purgeLegacyKeyStorage(): void {
  if (migrated) return;
  migrated = true;
  if (typeof localStorage === "undefined") return;
  // Any key whose last segment is `apiKey`, plus the pre-generic
  // namespace Grimoire used during early previews. The list is explicit
  // rather than a regex so we never accidentally delete user preferences.
  const doomed = [
    "grimoire.spellbook.anthropic-key",
    "grimoire.spellbook.anthropic.apiKey",
    "grimoire.spellbook.openai.apiKey",
    "grimoire.spellbook.google.apiKey",
    "grimoire.chat.anthropic.apiKey",
    "grimoire.chat.openai.apiKey",
    "grimoire.chat.google.apiKey",
  ];
  for (const key of doomed) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Private browsing / storage quota — silently skip.
    }
  }
}
