import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useState,
} from "react";

import {
  clearSecret,
  getSecret,
  setSecret,
} from "./secretStore";
import { loadProvider } from "./streamProviders/index";
import {
  PROVIDER_ORDER,
  STORAGE_KEYS,
} from "./streamProviders/types";
import type { ProviderId, StreamProvider } from "./streamProviders/types";

import {
  notifySettingsChanged,
  readActiveProviderId,
} from "./useChatEngine";

import styles from "./styles.module.css";

const OLLAMA_CUSTOM = "__custom__";

export interface SettingsPanelProps {
  readonly variant?: "inline" | "card";
  readonly onClose?: () => void;
  /** Live engine status (e.g. WebLLM download %) while the panel is open. */
  readonly remoteStatusMessage?: string;
}

export default function SettingsPanel(props: SettingsPanelProps): ReactNode {
  const { variant = "inline", onClose, remoteStatusMessage } = props;
  const labelId = useId();
  const [providerId, setProviderId] = useState<ProviderId>(() =>
    readActiveProviderId(),
  );
  const [provider, setProvider] = useState<StreamProvider | null>(null);
  const [pickerMeta, setPickerMeta] = useState<
    Partial<Record<ProviderId, { displayName: string; tagline: string }>>
  >({});
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [tokenEndpoint, setTokenEndpoint] = useState("");
  const [modelSelect, setModelSelect] = useState("");
  const [ollamaCustomModel, setOllamaCustomModel] = useState("");
  const [ollamaPreset, setOllamaPreset] = useState<string>(OLLAMA_CUSTOM);

  const loadMeta = useCallback(async (id: ProviderId) => {
    const p = await loadProvider(id);
    setProvider(p);
    const mk = STORAGE_KEYS.field(id, "model");
    const storedModel = localStorage.getItem(mk)?.trim() ?? "";
    const defaultId = p.models[0]?.id ?? "";

    if (id === "ollama") {
      const known = p.models.some((m) => m.id === storedModel);
      if (storedModel && !known) {
        setOllamaPreset(OLLAMA_CUSTOM);
        setOllamaCustomModel(storedModel);
        setModelSelect(storedModel);
      } else {
        const useId = storedModel && known ? storedModel : defaultId;
        setOllamaPreset(useId);
        setOllamaCustomModel("");
        setModelSelect(useId);
      }
    } else {
      setModelSelect(storedModel || defaultId);
    }

    // API keys live in memory; pre-fill the field only if the user has
    // already entered one this session.
    setApiKey(getSecret(id) ?? "");
    setBaseUrl(localStorage.getItem(STORAGE_KEYS.field(id, "baseUrl")) ?? "");
    setTokenEndpoint(
      localStorage.getItem(STORAGE_KEYS.field(id, "tokenEndpoint")) ?? "",
    );
  }, []);

  useEffect(() => {
    void loadMeta(providerId);
  }, [providerId, loadMeta]);

  useEffect(() => {
    void Promise.all(
      PROVIDER_ORDER.map((id) =>
        loadProvider(id).then((p) => [id, p] as const),
      ),
    ).then((pairs) => {
      const next: Partial<
        Record<ProviderId, { displayName: string; tagline: string }>
      > = {};
      for (const [id, p] of pairs) {
        next[id] = { displayName: p.displayName, tagline: p.tagline };
      }
      setPickerMeta(next);
    });
  }, []);

  const onProviderPick = (id: ProviderId): void => {
    setProviderId(id);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.activeProvider, id);
    }
  };

  const save = (e?: FormEvent): void => {
    e?.preventDefault();
    if (typeof localStorage === "undefined") return;
    const p = provider;
    if (!p) return;

    for (const field of p.configFields) {
      if (field.key === "apiKey") {
        // Secrets are NEVER persisted to disk — in-memory only.
        setSecret(providerId, apiKey);
      }
      if (field.key === "baseUrl") {
        const t = baseUrl.trim();
        if (t) {
          localStorage.setItem(STORAGE_KEYS.field(providerId, "baseUrl"), t);
        } else {
          localStorage.removeItem(STORAGE_KEYS.field(providerId, "baseUrl"));
        }
      }
      if (field.key === "tokenEndpoint") {
        const t = tokenEndpoint.trim();
        if (t) {
          localStorage.setItem(
            STORAGE_KEYS.field(providerId, "tokenEndpoint"),
            t,
          );
        } else {
          localStorage.removeItem(
            STORAGE_KEYS.field(providerId, "tokenEndpoint"),
          );
        }
      }
    }

    let effectiveModel = modelSelect.trim();
    if (providerId === "ollama" && ollamaPreset === OLLAMA_CUSTOM) {
      effectiveModel = ollamaCustomModel.trim();
    } else if (providerId === "ollama") {
      effectiveModel = ollamaPreset.trim();
    }

    if (effectiveModel) {
      localStorage.setItem(
        STORAGE_KEYS.field(providerId, "model"),
        effectiveModel,
      );
    } else {
      localStorage.removeItem(STORAGE_KEYS.field(providerId, "model"));
    }

    localStorage.setItem(STORAGE_KEYS.activeProvider, providerId);
    notifySettingsChanged();
    onClose?.();
  };

  const clearCurrent = (): void => {
    if (typeof localStorage === "undefined" || !provider) return;
    clearSecret(providerId);
    for (const field of provider.configFields) {
      if (field.key === "baseUrl") {
        localStorage.removeItem(STORAGE_KEYS.field(providerId, "baseUrl"));
      }
      if (field.key === "tokenEndpoint") {
        localStorage.removeItem(
          STORAGE_KEYS.field(providerId, "tokenEndpoint"),
        );
      }
    }
    localStorage.removeItem(STORAGE_KEYS.field(providerId, "model"));
    if (providerId === "ollama") {
      const d = provider.models[0]?.id ?? "";
      setOllamaPreset(d || OLLAMA_CUSTOM);
      setOllamaCustomModel("");
      setModelSelect(d);
    } else {
      setModelSelect(provider.models[0]?.id ?? "");
    }
    setApiKey("");
    setBaseUrl("");
    setTokenEndpoint("");
    notifySettingsChanged();
  };

  if (!provider) {
    return (
      <section
        className={
          variant === "card" ? styles.settingsCard : styles.settingsInline
        }
      >
        <p className={styles.settingsHelp}>Loading provider…</p>
      </section>
    );
  }

  const showOllamaCustom =
    providerId === "ollama" && ollamaPreset === OLLAMA_CUSTOM;

  return (
    <section
      className={
        variant === "card" ? styles.settingsCard : styles.settingsInline
      }
      aria-labelledby={labelId}
    >
      <h3 id={labelId} className={styles.settingsTitle}>
        AI provider
      </h3>
      <p className={styles.settingsHelp}>
        Choose how the assistant talks to a model. Keys stay in this tab's
        memory only (cleared on refresh); URLs and model choices persist
        locally. Nothing is proxied through a third-party server.
      </p>

      <form className={styles.settingsForm} onSubmit={save}>
        <label className={styles.settingsLabel} htmlFor="chat-provider">
          Provider
        </label>
        <select
          id="chat-provider"
          className={styles.settingsSelect}
          value={providerId}
          onChange={(ev) => onProviderPick(ev.target.value as ProviderId)}
        >
          {PROVIDER_ORDER.map((id) => {
            const meta = pickerMeta[id];
            const label = meta
              ? `${meta.displayName} — ${meta.tagline}`
              : id;
            return (
              <option key={id} value={id}>
                {label}
              </option>
            );
          })}
        </select>
        <p className={styles.providerTagline}>{provider.tagline}</p>

        {provider.id === "webllm" ? (
          <p className={styles.settingsHelp}>
            Models download on first use (about 300&nbsp;MB–2&nbsp;GB) and
            stay cached in your browser (IndexedDB).
          </p>
        ) : null}

        {remoteStatusMessage ? (
          <div className={styles.preloadPanel}>
            <p className={styles.preloadText}>{remoteStatusMessage}</p>
            <div className={styles.progressTrack}>
              <div className={styles.progressFillIndeterminate} />
            </div>
          </div>
        ) : null}

        {provider.configFields.map((field) => (
          <div key={field.key} className={styles.settingsFieldGroup}>
            <label
              className={styles.settingsLabel}
              htmlFor={`chat-${provider.id}-${field.key}`}
            >
              {field.label}
              {field.required ? " *" : ""}
            </label>
            <input
              id={`chat-${provider.id}-${field.key}`}
              className={styles.settingsInput}
              type={field.secret ? "password" : "text"}
              autoComplete="off"
              spellCheck={false}
              placeholder={field.placeholder}
              value={
                field.key === "apiKey"
                  ? apiKey
                  : field.key === "tokenEndpoint"
                    ? tokenEndpoint
                    : baseUrl
              }
              onChange={(ev) => {
                const v = ev.target.value;
                if (field.key === "apiKey") setApiKey(v);
                else if (field.key === "tokenEndpoint") setTokenEndpoint(v);
                else setBaseUrl(v);
              }}
            />
            {field.helpText ? (
              <p className={styles.fieldHelp}>{field.helpText}</p>
            ) : null}
          </div>
        ))}

        <label className={styles.settingsLabel} htmlFor="chat-model">
          Model
        </label>
        {provider.id === "ollama" ? (
          <>
            <select
              id="chat-model"
              className={styles.settingsSelect}
              value={ollamaPreset}
              onChange={(ev) => {
                const v = ev.target.value;
                setOllamaPreset(v);
                if (v !== OLLAMA_CUSTOM) {
                  setModelSelect(v);
                }
              }}
            >
              {provider.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                  {m.note ? ` · ${m.note}` : ""}
                </option>
              ))}
              <option value={OLLAMA_CUSTOM}>(custom…)</option>
            </select>
            {showOllamaCustom ? (
              <input
                className={styles.settingsInput}
                style={{ marginTop: "0.5rem" }}
                id="chat-model-custom"
                type="text"
                placeholder="your-model:tag"
                value={ollamaCustomModel}
                onChange={(ev) => setOllamaCustomModel(ev.target.value)}
              />
            ) : null}
            <p className={styles.fieldHelp}>
              Use any tag you have pulled locally; the preset list is a
              shortcut.
            </p>
          </>
        ) : (
          <select
            id="chat-model"
            className={styles.settingsSelect}
            value={modelSelect}
            onChange={(ev) => setModelSelect(ev.target.value)}
          >
            {provider.models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
                {m.note ? ` · ${m.note}` : ""}
              </option>
            ))}
          </select>
        )}

        <div className={styles.settingsActions}>
          <button type="submit" className={styles.buttonPrimary}>
            Save
          </button>
          <button
            type="button"
            className={styles.buttonGhost}
            onClick={clearCurrent}
          >
            Clear {provider.displayName}
          </button>
        </div>
      </form>
    </section>
  );
}
