// providerModels.ts — AI 模型提供商配置管理
// 存储：Tauri 后端权威 + localStorage 缓存
// 浏览器模式（dev）下仅使用 localStorage

import { isTauriEnv, tryInvoke, invokeOrFallback, TauriCommands } from "../bridge/tauri";
import { StorageEngine } from "./storageEngine";

const CACHE_KEY = "providers";

export type ProviderKind = "openai" | "anthropic" | "deepseek" | "custom";

export interface ImageModelConfig {
  sizes: string[];
  supportsQuality: boolean;
  supportsStyle: boolean;
}

export interface ModelEntry {
  id: string;
  capabilities: string[];
  imageConfig?: ImageModelConfig;
}

export type Provider = {
  id: string;
  label: string;
  kind: ProviderKind;
  baseUrl?: string;
  apiKey?: string;
  models: ModelEntry[];
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

// ─── 旧 models: string[] → ModelEntry[] 迁移 ───

function migrateLegacyModels(): void {
  try {
    const raw = localStorage.getItem("inkwise:providers");
    if (!raw) return;
    const providers = JSON.parse(raw) as any[];
    let changed = false;
    for (const p of providers) {
      // Case 1: Old format (string[])
      if (Array.isArray(p.models) && p.models.length > 0 && typeof p.models[0] === "string") {
        p.models = (p.models as string[]).map((id: string) => ({
          id,
          capabilities: inferCapabilities(id),
          imageConfig: undefined,
        }));
        changed = true;
      }
      // Case 2: Already-migrated ModelEntry[] — re-infer capabilities to fix migration artifacts
      if (Array.isArray(p.models) && p.models.length > 0 && typeof p.models[0] === "object") {
        for (const m of p.models) {
          const expected = inferCapabilities(m.id);
          const storedSorted = [...(m.capabilities || [])].sort();
          const expectedSorted = [...expected].sort();
          if (JSON.stringify(storedSorted) !== JSON.stringify(expectedSorted)) {
            m.capabilities = expected;
            changed = true;
          }
        }
      }
    }
    if (changed) {
      localStorage.setItem("inkwise:providers", JSON.stringify(providers));
    }
  } catch { /* ignore */ }
}

migrateLegacyModels();

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

function defaultModels(id: string): ModelEntry[] {
  const map: Record<string, ModelEntry[]> = {
    openai: [
      { id: "gpt-4o", capabilities: ["chat"] },
      { id: "gpt-4o-mini", capabilities: ["chat"] },
      { id: "dall-e-3", capabilities: ["image"], imageConfig: { sizes: ["1024x1024", "1792x1024", "1024x1792"], supportsQuality: true, supportsStyle: true } },
    ],
    anthropic: [
      { id: "claude-3.5-sonnet", capabilities: ["chat"] },
      { id: "claude-3-haiku", capabilities: ["chat"] },
    ],
    deepseek: [
      { id: "deepseek-chat", capabilities: ["chat"] },
      { id: "deepseek-coder", capabilities: ["chat"] },
    ],
  };
  return map[id] ?? [];
}


/** 根据模型名称推断能力类型 */
export { defaultModels };

export function inferCapabilities(modelName: string): string[] {
  const lower = modelName.toLowerCase();
  const caps: string[] = [];
  // Image generation models
  if (
    lower.includes("dall-e") ||
    lower.includes("cogview") ||
    lower.includes("wanx") ||
    lower.includes("image") ||
    lower.includes("candy") ||
    lower.match(/sd[\d-]*$/)
  ) {
    caps.push("image");
  }
  // Text/chat models — exclude known non-chat model types
  const nonChat = [
    "embedding", "speech", "tts", "stt", "whisper",
    "moderation", "rerank", "transcription",
  ];
  if (!nonChat.some((t) => lower.includes(t))) {
    caps.push("chat");
  }
  return caps.length > 0 ? caps : ["chat"];
}


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
    .flatMap((p) => p.models)
    .filter((m) => m.capabilities.includes("chat"))
    .map((m) => m.id);
}

/** 获取所有已启用的模型列表（异步权威） */
export async function getEnabledModels(): Promise<string[]> {
  const providers = await getProviders();
  return providers
    .filter((p) => p.enabled && p.models.length > 0)
    .flatMap((p) => p.models)
    .filter((m) => m.capabilities.includes("chat"))
    .map((m) => m.id);
}

/** 获取所有启用的图片模型列表（同步） */
export function getImageModelsSync(): ModelEntry[] {
  return getProvidersSync()
    .filter((p) => p.enabled && p.models.length > 0)
    .flatMap((p) => p.models)
    .filter((m) => inferCapabilities(m.id).includes("image"));
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
