import { create } from "zustand";
import { isTauriEnv, tryInvoke, invokeOrFallback } from "../bridge/tauri";

export interface DrawConfig {
  enabled: boolean;
  model: string;
  style: string;
  size: string;
  count: number;
  negativePrompt: string;
}

export interface ImageGenProgress {
  status: "idle" | "generating";
  total: number;
  completed: number;
  currentIndex: number;
}

interface DrawConfigStore {
  config: DrawConfig;
  progress: ImageGenProgress;
  setConfig: (partial: Partial<DrawConfig>) => void;
  setProgress: (partial: Partial<ImageGenProgress>) => void;
}

async function loadBackendDrawConfig(): Promise<DrawConfig | null> {
  if (!isTauriEnv()) return null;
  try {
    const settings = await tryInvoke<any>("get_settings");
    if (!settings) return null;
    return {
      enabled: true,
      model: settings.drawModel || "",
      style: settings.drawStyle || "vivid",
      size: settings.drawSize || "1024x1024",
      count: settings.drawCount || 3,
      negativePrompt: settings.drawNegativePrompt || "",
    };
  } catch { return null; }
}

async function saveBackendDrawConfig(config: DrawConfig): Promise<void> {
  if (!isTauriEnv()) return;
  try {
    const settings = await tryInvoke<any>("get_settings");
    await tryInvoke("set_settings", {
      settings: {
        ...settings,
        drawModel: config.model,
        drawStyle: config.style,
        drawSize: config.size,
        drawCount: config.count,
        drawNegativePrompt: config.negativePrompt,
      },
    });
  } catch {}
}

function loadDrawConfig(): DrawConfig {
  return {
    enabled: (() => { try { return localStorage.getItem("inkwise-draw-enabled") === "true"; } catch { return false; } })(),
    model: (() => { try { return localStorage.getItem("inkwise-draw-model") || ""; } catch { return ""; } })(),
    style: (() => { try { return localStorage.getItem("inkwise-draw-style") || "vivid"; } catch { return "vivid"; } })(),
    size: (() => { try { return localStorage.getItem("inkwise-draw-size") || "1024x1024"; } catch { return "1024x1024"; } })(),
    count: (() => { try { return Number(localStorage.getItem("inkwise-draw-count")) || 3; } catch { return 3; } })(),
    negativePrompt: (() => { try { return localStorage.getItem("inkwise-draw-negative-prompt") || ""; } catch { return ""; } })(),
  };
}

function persistDrawConfig(config: DrawConfig) {
  try {
    localStorage.setItem("inkwise-draw-enabled", String(config.enabled));
    localStorage.setItem("inkwise-draw-model", config.model);
    localStorage.setItem("inkwise-draw-style", config.style);
    localStorage.setItem("inkwise-draw-size", config.size);
    localStorage.setItem("inkwise-draw-count", String(config.count));
    localStorage.setItem("inkwise-draw-negative-prompt", config.negativePrompt);
    // Also persist to Tauri backend (survives across dev/prod)
    saveBackendDrawConfig(config);
  } catch {}
}

export const useDrawConfig = create<DrawConfigStore>((set) => ({
  config: loadDrawConfig(),
  progress: { status: "idle", total: 0, completed: 0, currentIndex: -1 },
  setConfig: (partial) =>
    set((state) => {
      const next = { ...state.config, ...partial };
      persistDrawConfig(next);
      return { config: next };
    }),
  setProgress: (partial) =>
    set((state) => ({ progress: { ...state.progress, ...partial } })),
}));

// Sync backend config to localStorage on load (handles dev→prod migration)
(async () => {
  const backend = await loadBackendDrawConfig();
  if (backend) {
    const merged = { ...loadDrawConfig(), ...backend };
    persistDrawConfig(merged);
    useDrawConfig.setState({ config: merged });
  }
})();
