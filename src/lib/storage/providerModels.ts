// providerModels.ts — supports both localStorage (browser) and Tauri invoke

import { isTauriEnv, tryInvoke, invokeOrFallback, TauriCommands } from "../bridge/tauri";

export type ProviderKind = "openai" | "anthropic" | "deepseek" | "custom";

export type Provider = {
  id: string;
  label: string;
  kind: ProviderKind;
  baseUrl?: string;
  apiKey?: string;
  models: string[];
  enabled: boolean;
  builtin: boolean;
};

export const BUILTIN_PROVIDERS: Omit<Provider, "apiKey" | "models" | "enabled">[] = [
  { id: "openai", label: "OpenAI", kind: "openai", baseUrl: "https://api.openai.com/v1", builtin: true },
  { id: "anthropic", label: "Anthropic", kind: "anthropic", baseUrl: "https://api.anthropic.com/v1", builtin: true },
  { id: "deepseek", label: "DeepSeek", kind: "deepseek", baseUrl: "https://api.deepseek.com/v1", builtin: true },
];

const STORAGE_KEY = "aiwriter-providers";

function browserGetProviders(): Provider[] {
  if (typeof localStorage === "undefined") return defaultProviders();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProviders();
    const parsed = JSON.parse(raw) as Provider[];
    // 过滤掉 builtin 但无 apiKey 的旧数据
    const cleaned = parsed.filter((p) => !p.builtin || !!p.apiKey);
    return cleaned.length > 0 ? cleaned : defaultProviders();
  } catch { return defaultProviders(); }
}

function browserSaveProviders(p: Provider[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

function defaultProviders(): Provider[] {
  return [];
}

function defaultModels(id: string): string[] {
  const map: Record<string, string[]> = {
    openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
    anthropic: ["claude-3.5-sonnet", "claude-3-haiku"],
    deepseek: ["deepseek-chat", "deepseek-coder"],
  };
  return map[id] ?? [];
}

export { defaultModels };

// ─── Public API (async, works in both browser and Tauri) ───

export async function getProviders(): Promise<Provider[]> {
  if (isTauriEnv()) {
    return invokeOrFallback(TauriCommands.GetProviders, undefined, () => browserGetProviders());
  }
  return browserGetProviders();
}

export async function saveProviders(providers: Provider[]): Promise<void> {
  browserSaveProviders(providers);
  if (isTauriEnv()) {
    try { await invokeOrFallback(TauriCommands.SetProviders, { providers }, () => {}); } catch { /* ok */ }
  }
}

export function getEnabledModelsSync(): string[] {
  return browserGetProviders().filter((p) => p.enabled && p.models.length > 0).flatMap((p) => p.models);
}

/** Sync version for React useState initialization */
export function getProvidersSync(): Provider[] {
  return browserGetProviders();
}

export function saveProvidersSync(providers: Provider[]): void {
  browserSaveProviders(providers);
}

export async function getEnabledModels(): Promise<string[]> {
  const providers = await getProviders();
  return providers.filter((p) => p.enabled && p.models.length > 0).flatMap((p) => p.models);
}

/** Fetch available models from a provider's API (calls Tauri backend). */
export async function fetchAvailableModels(providerId: string): Promise<string[]> {
  try {
    return await tryInvoke<string[]>(TauriCommands.FetchModels, { providerId });
  } catch {
    return [];
  }
}

/** Get all configured models from all enabled providers. */
export async function getAllModels(): Promise<string[]> {
  try {
    return await tryInvoke<string[]>(TauriCommands.GetAllModels);
  } catch {
    return [];
  }
}
