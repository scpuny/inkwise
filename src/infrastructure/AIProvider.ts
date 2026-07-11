// ─── AIProvider 接口 ───
// 抽象 AI 聊天调用，可被 OpenAI / Anthropic / DeepSeek / Mock 实现

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface AIProvider {
  /** 非流式聊天：一次请求返回完整内容 */
  chat(messages: ChatMessage[], opts?: ChatOptions): Promise<string>;
  /** 流式聊天：逐 token 回调 */
  chatStream(
    messages: ChatMessage[],
    opts?: ChatOptions,
    onToken?: (token: string) => void,
  ): Promise<string>;
}
