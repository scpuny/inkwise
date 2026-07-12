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

// ─── 内置提供商定义 ───

export const BUILTIN_PROVIDERS: Omit<Provider, "apiKey" | "models" | "enabled">[] = [
  { id: "openai", label: "OpenAI", kind: "openai", baseUrl: "https://api.openai.com/v1", builtin: true },
  { id: "anthropic", label: "Anthropic", kind: "anthropic", baseUrl: "https://api.anthropic.com/v1", builtin: true },
  { id: "deepseek", label: "DeepSeek", kind: "deepseek", baseUrl: "https://api.deepseek.com/v1", builtin: true },
];

/** 默认模型映射 */
export function defaultModels(id: string): ModelEntry[] {
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
export function inferCapabilities(modelName: string): string[] {
  const lower = modelName.toLowerCase();
  const caps: string[] = [];
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
  const nonChat = [
    "embedding", "speech", "tts", "stt", "whisper",
    "moderation", "rerank", "transcription",
  ];
  if (!nonChat.some((t) => lower.includes(t))) {
    caps.push("chat");
  }
  return caps.length > 0 ? caps : ["chat"];
}
