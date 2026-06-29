import { create } from "zustand";

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
