// domain/Provider.ts — AI 提供商相关纯类型定义

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
