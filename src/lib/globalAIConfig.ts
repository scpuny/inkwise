// globalAIConfig.ts — 全局 AI 配置管理
// 所有 AI 入口共享同一套配置（模型、effort、token 限制等）

import { getProvidersSync, type Provider } from "./providerModels";

const DEFAULT_MODEL_KEY = "aiwriter-default-model";
const DEFAULT_EFFORT_KEY = "aiwriter-default-effort";
const DEFAULT_TOKEN_KEY = "aiwriter-default-token";

export type EffortLevel = "auto" | "low" | "medium" | "high";
export type TokenLimit = 500 | 1000 | 2000 | 4000 | 8000 | 0;

export interface GlobalAIConfig {
  defaultModel: string | null;
  effort: EffortLevel;
  maxTokens: number;
}

/** 从 localStorage 读取当前配置 */
export function loadGlobalAIConfig(): GlobalAIConfig {
  const savedModel = typeof localStorage !== "undefined"
    ? localStorage.getItem(DEFAULT_MODEL_KEY)
    : null;
  const savedEffort = typeof localStorage !== "undefined"
    ? localStorage.getItem(DEFAULT_EFFORT_KEY)
    : null;
  const savedToken = typeof localStorage !== "undefined"
    ? localStorage.getItem(DEFAULT_TOKEN_KEY)
    : null;

  return {
    defaultModel: savedModel,
    effort: (savedEffort as EffortLevel) || "auto",
    maxTokens: savedToken ? Number(savedToken) : 2048,
  };
}

/** 保存默认模型到 localStorage */
export function saveDefaultModel(model: string): void {
  try { localStorage.setItem(DEFAULT_MODEL_KEY, model); } catch {}
  window.dispatchEvent(new CustomEvent("ai-config-changed"));
}

/** 保存 effort 到 localStorage */
export function saveEffort(effort: EffortLevel): void {
  try { localStorage.setItem(DEFAULT_EFFORT_KEY, effort); } catch {}
  window.dispatchEvent(new CustomEvent("ai-config-changed"));
}

/** 保存 token 限制到 localStorage */
export function saveMaxTokens(tokens: TokenLimit): void {
  try { localStorage.setItem(DEFAULT_TOKEN_KEY, String(tokens)); } catch {}
  window.dispatchEvent(new CustomEvent("ai-config-changed"));
}

/** 获取当前启用的模型列表 */
export function getEnabledModels(): string[] {
  const providers = getProvidersSync();
  return providers
    .filter((p) => p.enabled && p.models.length > 0)
    .flatMap((p) => p.models);
}

/** 获取默认模型的 provider 信息 */
export function getDefaultProvider(): Provider | null {
  const providers = getProvidersSync();
  return providers.find((p) => p.enabled && p.models.length > 0) || null;
}

/** 根据配置选择一个模型（优先用用户选的，否则用第一个） */
export function resolveModel(defaultModel?: string | null): string | null {
  if (defaultModel) {
    const models = getEnabledModels();
    if (models.includes(defaultModel)) return defaultModel;
  }
  const provider = getDefaultProvider();
  return provider?.models[0] || null;
}

/** 获取所有模型 + provider 映射 */
export function buildModelList(): { id: string; label: string; provider: string }[] {
  const providers = getProvidersSync();
  const result: { id: string; label: string; provider: string }[] = [];
  for (const p of providers) {
    if (!p.enabled || p.models.length === 0) continue;
    for (const m of p.models) {
      result.push({ id: m, label: m, provider: p.label });
    }
  }
  return result;
}
