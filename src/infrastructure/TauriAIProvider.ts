// TauriAIProvider — AIProvider 的 Tauri/桥接实现
// 当前通过旧 sendChat/sendChatStream 实现

import type { AIProvider, ChatMessage, ChatOptions } from "./AIProvider";
import { sendChat, sendChatStream } from "../lib/ai/ai";
import { resolveProviderForModel } from "../lib/config/globalAIConfig";

export class TauriAIProvider implements AIProvider {
  async chat(messages: ChatMessage[], opts?: ChatOptions): Promise<string> {
    const { provider, model } = resolveProviderForModel();
    if (!provider) throw new Error("请先在设置中配置 AI 提供商");

    return sendChat({
      providerId: provider.id,
      model,
      messages: messages as any,
      temperature: opts?.temperature ?? 0.7,
      maxTokens: opts?.maxTokens ?? 1024,
    });
  }

  async chatStream(
    messages: ChatMessage[],
    opts?: ChatOptions,
    onToken?: (token: string) => void,
  ): Promise<string> {
    const { provider, model } = resolveProviderForModel();
    if (!provider) throw new Error("请先在设置中配置 AI 提供商");

    return sendChatStream(
      {
        providerId: provider.id,
        model,
        messages: messages as any,
        temperature: opts?.temperature ?? 0.7,
        maxTokens: opts?.maxTokens ?? 2048,
      },
      onToken,
    );
  }
}
