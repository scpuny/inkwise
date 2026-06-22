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

export async function sendChat(options: ChatOptions, timeoutMs = 120000): Promise<string> {
  if (!isTauriEnv()) {
    throw new Error("聊天功能仅在桌面应用中可用。请运行 `npm run tauri:dev` 启动桌面版。");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const result = await Promise.race([
      tryInvoke<string>("chat", {
        providerId: options.providerId,
        model: options.model,
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        maxTokens: options.maxTokens ?? 2048,
      }),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () => {
          reject(new Error("AI 响应超时，请检查网络或模型状态后重试"));
        });
      }),
    ]);
    clearTimeout(timeoutId);
    return result;
  } catch (e) {
    clearTimeout(timeoutId);
    console.error("Chat API error:", e);
    throw e;
  }
}
