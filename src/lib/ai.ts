import { isTauriEnv, tryInvoke } from "./tauri";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatOptions = {
  providerId: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
};

export async function sendChat(options: ChatOptions): Promise<string> {
  if (!isTauriEnv()) {
    return "聊天功能仅在桌面应用中可用。请运行 `npm run tauri:dev` 启动桌面版。";
  }

  try {
    return await tryInvoke<string>("chat", {
      providerId: options.providerId,
      model: options.model,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      maxTokens: options.maxTokens ?? 2048,
    });
  } catch (e) {
    console.error("Chat API error:", e);
    return `**API 调用失败**: ${e}`;
  }
}
