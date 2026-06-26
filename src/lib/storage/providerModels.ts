// providerModels.ts — AI 模型提供商配置管理
// 存储：Tauri 后端权威 + localStorage 缓存
// 浏览器模式（dev）下仅使用 localStorage

import { isTauriEnv, tryInvoke, invokeOrFallback, TauriCommands } from "../bridge/tauri";
import { StorageEngine } from "./storageEngine";

const CACHE_KEY = "providers";

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

// ─── 旧数据迁移 ───
// 旧版 localStorage key 为 "inkwise-providers"，新版引擎使用 "inkwise:providers"
// 首次访问时将旧数据迁移到新 key

function migrateLegacyCache(): void {
  try {
    if (localStorage.getItem("inkwise:providers") !== null) return; // 已迁移
    const old = localStorage.getItem("inkwise-providers");
    if (!old) return;
    // 迁移时也做清理：过滤掉 builtin 但无 apiKey 的旧数据
    const parsed = JSON.parse(old) as Provider[];
    const cleaned = parsed.filter((p) => !p.builtin || !!p.apiKey);
    if (cleaned.length > 0) {
      localStorage.setItem("inkwise:providers", JSON.stringify(cleaned));
    }
    localStorage.removeItem("inkwise-providers");
  } catch { /* ignore */ }
}

migrateLegacyCache();

// ─── Storage Engine ───

const engine = new StorageEngine<Provider[]>(CACHE_KEY, {
  read: async () => {
    if (isTauriEnv()) {
      try {
        return await invokeOrFallback<Provider[]>("get_providers", undefined, () => []);
      } catch { return null; }
    }
    return null;
  },
  write: async (data) => {
    if (!isTauriEnv()) return;
    try {
      await invokeOrFallback("set_providers", { providers: data }, () => {});
    } catch { /* backend unavailable */ }
  },
  delete: async () => {},
});

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

// ─── Public API ───

/** 权威读：后端 → 更新缓存 → 返回 */
export async function getProviders(): Promise<Provider[]> {
  const data = await engine.get();
  return data ?? defaultProviders();
}

/** 权威写：同时写后端和缓存 */
export async function saveProviders(providers: Provider[]): Promise<void> {
  await engine.set(providers);
}

/** 同步缓存读（用于 React useState 初始化） */
export function getProvidersSync(): Provider[] {
  return engine.getSync() ?? defaultProviders();
}

/** 同步写缓存（用于 React 事件中快速更新，不阻塞） */
export function saveProvidersSync(providers: Provider[]): void {
  engine.invalidateCache();
  try {
    localStorage.setItem("inkwise:providers", JSON.stringify(providers));
  } catch { /* ignore */ }
}

/** 获取当前启用的模型列表（同步） */
export function getEnabledModelsSync(): string[] {
  return getProvidersSync()
    .filter((p) => p.enabled && p.models.length > 0)
    .flatMap((p) => p.models);
}

/** 获取所有已启用的模型列表（异步权威） */
export async function getEnabledModels(): Promise<string[]> {
  const providers = await getProviders();
  return providers.filter((p) => p.enabled && p.models.length > 0).flatMap((p) => p.models);
}

/** 从提供商 API 拉取可用模型列表（调用 Tauri 后端） */
export async function fetchAvailableModels(providerId: string): Promise<string[]> {
  try {
    return await tryInvoke<string[]>(TauriCommands.FetchModels, { providerId });
  } catch {
    return [];
  }
}

/** 获取所有已配置模型（从所有已启用的提供商） */
export async function getAllModels(): Promise<string[]> {
  try {
    return await tryInvoke<string[]>(TauriCommands.GetAllModels);
  } catch {
    return [];
  }
}
