// globalAIConfig.ts — 全局 AI 配置管理
// 存储：Tauri 后端权威 + localStorage 缓存
// 所有 AI 入口共享同一套配置（模型、effort、token 限制等）

import { StorageEngine } from "../storage/storageEngine";
import { isTauriEnv, tryInvoke } from "../bridge/tauri";
import type { Provider } from "../../domain";
import { TauriSettingsStore } from "../../infrastructure/TauriSettingsStore";
import { emit } from "../events/eventBus";

const settings = new TauriSettingsStore();

const CACHE_KEY = "ai-config";

export type EffortLevel = "auto" | "low" | "medium" | "high";
export type TokenLimit = 500 | 1000 | 2000 | 4000 | 8000 | 0;

export interface GlobalAIConfig {
  defaultModel: string | null;
  effort: EffortLevel;
  maxTokens: number;
}

const DEFAULT_CONFIG: GlobalAIConfig = {
  defaultModel: null,
  effort: "auto",
  maxTokens: 2048,
};

// ─── Storage Engine ───
// 后端持久化到 ai_config.json，localStorage 作为读缓存

const engine = new StorageEngine<GlobalAIConfig>(CACHE_KEY, {
  read: async () => {
    if (!isTauriEnv()) return null;
    try {
      return await tryInvoke<GlobalAIConfig | null>("get_ai_config");
    } catch {
      return null;
    }
  },
  write: async (data) => {
    if (!isTauriEnv()) return;
    try {
      await tryInvoke("set_ai_config", { config: data });
    } catch {
      /* backend unavailable */
    }
  },
  delete: async () => {},
});

// ─── Public API ───

/** 权威读：后端 → 更新缓存 → 返回 */
export async function loadGlobalAIConfigAsync(): Promise<GlobalAIConfig> {
  const data = await engine.get();
  return data ?? { ...DEFAULT_CONFIG };
}

/** 同步读缓存（用于 React useState 初始化） */
export function loadGlobalAIConfig(): GlobalAIConfig {
  return engine.getSync() ?? { ...DEFAULT_CONFIG };
}

/** 保存默认模型到后端 + 缓存 */
export async function saveDefaultModel(model: string): Promise<void> {
  const config = loadGlobalAIConfig();
  config.defaultModel = model;
  await engine.set(config);
  emit("ai-config-changed");
}

/** 保存 effort 到后端 + 缓存 */
export async function saveEffort(effort: EffortLevel): Promise<void> {
  const config = loadGlobalAIConfig();
  config.effort = effort;
  await engine.set(config);
  emit("ai-config-changed");
}

/** 保存 token 限制到后端 + 缓存 */
export async function saveMaxTokens(tokens: TokenLimit): Promise<void> {
  const config = loadGlobalAIConfig();
  config.maxTokens = tokens;
  await engine.set(config);
  emit("ai-config-changed");
}

/** 获取当前启用的模型列表（同步，从缓存读取） */
export function getEnabledModels(): string[] {
  const providers = settings.getProvidersSync();
  return providers
    .filter((p) => p.enabled && p.models.length > 0)
    .flatMap((p) => p.models)
    .map((m) => m.id);
}

/** 获取默认模型的 provider 信息 */
export function getDefaultProvider(): Provider | null {
  const providers = settings.getProvidersSync();
  return providers.find((p) => p.enabled && p.models.length > 0) || null;
}

/** 根据配置选择一个模型（优先用用户选的，否则用第一个） */
export function resolveModel(defaultModel?: string | null): string | null {
  // 优先使用传入的模型，其次从已加载配置中读取默认模型
  const config = loadGlobalAIConfig();
  const effectiveDefault = defaultModel ?? config.defaultModel;
  if (effectiveDefault) {
    const models = getEnabledModels();
    if (models.includes(effectiveDefault)) return effectiveDefault;
  }
  const provider = getDefaultProvider();
  return provider?.models[0]?.id ?? null;
}

/** 获取所有模型 + provider 映射 */
export function buildModelList(): { id: string; label: string; provider: string }[] {
  const providers = settings.getProvidersSync();
  const result: { id: string; label: string; provider: string }[] = [];
  for (const p of providers) {
    if (!p.enabled || p.models.length === 0) continue;
    for (const m of p.models) {
      result.push({ id: m.id, label: m.id, provider: p.label });
    }
  }
  return result;
}

/** 统一解析 provider + model：优先匹配用户保存的默认模型，回退到第一个启用的提供商 */
export function resolveProviderForModel(): { provider: Provider | null; model: string } {
  const providers = settings.getProvidersSync();
  const resolvedModel = resolveModel() ?? '';
  
  if (resolvedModel) {
    const matching = providers.find(p => p.enabled && p.models.some(m => m.id === resolvedModel));
    if (matching) return { provider: matching, model: resolvedModel };
  }
  
  const fallback = providers.find(p => p.enabled && p.models.length > 0) ?? null;
  const modelId = resolvedModel || (fallback?.models[0]?.id ?? '');
  return { provider: fallback, model: modelId };
}

