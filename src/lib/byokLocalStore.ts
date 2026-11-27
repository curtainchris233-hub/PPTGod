"use client";

export interface ByokLocalPrefs {
  engineMode: "smart" | "llm";
  apiBase: string;
  modelName: string;
  imgModelName: string;
  apiKey: string;
}

export const DEFAULT_BYOK_PREFS: ByokLocalPrefs = {
  engineMode: "smart",
  apiBase: "https://api.openai.com/v1",
  modelName: "gpt-4o-mini",
  imgModelName: "dall-e-3",
  apiKey: "",
};

const BYOK_PREFS_STORAGE_KEY = "pptgod_byok_prefs_v1";
const BYOK_SESSION_KEY_STORAGE = "pptgod_byok_session_key_v1";
const BYOK_UPDATED_EVENT = "pptgod:byok-updated";

export function readByokPrefs(): ByokLocalPrefs {
  if (typeof window === "undefined") {
    return { ...DEFAULT_BYOK_PREFS };
  }

  let engineMode: "smart" | "llm" = DEFAULT_BYOK_PREFS.engineMode;
  let apiBase = DEFAULT_BYOK_PREFS.apiBase;
  let modelName = DEFAULT_BYOK_PREFS.modelName;
  let imgModelName = DEFAULT_BYOK_PREFS.imgModelName;
  let apiKey = "";

  try {
    const raw = window.localStorage.getItem(BYOK_PREFS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ByokLocalPrefs>;
      if (parsed && typeof parsed === "object") {
        if (parsed.engineMode === "llm" || parsed.engineMode === "smart") {
          engineMode = parsed.engineMode;
        }
        if (typeof parsed.apiBase === "string" && parsed.apiBase.trim()) {
          apiBase = parsed.apiBase;
        }
        if (typeof parsed.modelName === "string" && parsed.modelName.trim()) {
          modelName = parsed.modelName;
        }
        if (
          typeof parsed.imgModelName === "string" &&
          parsed.imgModelName.trim()
        ) {
          imgModelName = parsed.imgModelName;
        }
      }
    }
  } catch {
    // Graceful degradation under private mode / disabled storage
  }

  try {
    apiKey = window.sessionStorage.getItem(BYOK_SESSION_KEY_STORAGE) || "";
  } catch {
    apiKey = "";
  }

  return {
    engineMode,
    apiBase,
    modelName,
    imgModelName,
    apiKey,
  };
}

export function writeByokPrefs(
  patch: Partial<ByokLocalPrefs>
): ByokLocalPrefs {
  const current = readByokPrefs();
  const next: ByokLocalPrefs = {
    engineMode:
      patch.engineMode === "llm" || patch.engineMode === "smart"
        ? patch.engineMode
        : current.engineMode,
    apiBase:
      typeof patch.apiBase === "string" ? patch.apiBase : current.apiBase,
    modelName:
      typeof patch.modelName === "string" ? patch.modelName : current.modelName,
    imgModelName:
      typeof patch.imgModelName === "string"
        ? patch.imgModelName
        : current.imgModelName,
    apiKey: typeof patch.apiKey === "string" ? patch.apiKey : current.apiKey,
  };

  if (typeof window !== "undefined") {
    try {
      // Strictly keep non-sensitive endpoint & model defaults in localStorage (never apiKey).
      window.localStorage.setItem(
        BYOK_PREFS_STORAGE_KEY,
        JSON.stringify({
          engineMode: next.engineMode,
          apiBase: next.apiBase,
          modelName: next.modelName,
          imgModelName: next.imgModelName,
        })
      );
    } catch {
      // Ignore quota / privacy errors
    }

    try {
      // Sensitive apiKey lives strictly in tab-scoped sessionStorage (S22: never persisted to server DB).
      if (next.apiKey.trim()) {
        window.sessionStorage.setItem(BYOK_SESSION_KEY_STORAGE, next.apiKey);
      } else {
        window.sessionStorage.removeItem(BYOK_SESSION_KEY_STORAGE);
      }
    } catch {
      // Ignore quota / privacy errors
    }

    try {
      window.dispatchEvent(
        new CustomEvent<ByokLocalPrefs>(BYOK_UPDATED_EVENT, { detail: next })
      );
    } catch {
      // Ignore
    }
  }

  return next;
}

export function clearByokSessionKey(): ByokLocalPrefs {
  return writeByokPrefs({ apiKey: "" });
}

export function subscribeByokPrefs(
  listener: (prefs: ByokLocalPrefs) => void
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleCustom = (event: Event) => {
    const detail = (event as CustomEvent<ByokLocalPrefs>).detail;
    listener(detail ?? readByokPrefs());
  };
  const handleStorage = (event: StorageEvent) => {
    if (
      event.key === BYOK_PREFS_STORAGE_KEY ||
      event.key === BYOK_SESSION_KEY_STORAGE ||
      event.key === null
    ) {
      listener(readByokPrefs());
    }
  };

  window.addEventListener(BYOK_UPDATED_EVENT, handleCustom);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(BYOK_UPDATED_EVENT, handleCustom);
    window.removeEventListener("storage", handleStorage);
  };
}
