// ai.ts — AI chat interface: streaming, non-streaming, tool-calling
import { isTauriEnv, tryInvoke, TauriCommands } from "../bridge/tauri";

// ─── Types ───

export type ChatMessageRole = "system" | "user" | "assistant" | "tool";

export interface ToolDefinition {
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface ChatMessage {
  role: ChatMessageRole;
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ChatToolResponse {
  content: string | null;
  thinking: string | null;
  tool_calls?: ToolCall[];
}

export type ChatOptions = {
  providerId: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
};

export type ChatToolOptions = ChatOptions & {
  tools?: ToolDefinition[];
  tool_choice?: "auto" | "any" | { name: string };
};

export type ChatStreamOptions = ChatOptions;

// ─── Helpers ───

export function userMsg(content: string): ChatMessage {
  return { role: "user", content };
}

export function systemMsg(content: string): ChatMessage {
  return { role: "system", content };
}

export function assistantMsg(content: string): ChatMessage {
  return { role: "assistant", content };
}

export function toolMsg(toolCallId: string, content: string): ChatMessage {
  return { role: "tool", content, tool_call_id: toolCallId };
}

export function assistantToolCallsMsg(toolCalls: ToolCall[]): ChatMessage {
  return { role: "assistant", content: null, tool_calls: toolCalls };
}

// ─── Non-streaming chat (simple, no tools) ───

export async function sendChat(options: ChatOptions): Promise<string> {
  if (!isTauriEnv()) {
    throw new Error("聊天功能仅在桌面应用中可用。请运行 `npm run tauri:dev` 启动桌面版。");
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
    throw e;
  }
}

// ─── Tool-calling chat (non-streaming, returns content + tool_calls) ───

export async function sendChatWithTools(options: ChatToolOptions): Promise<ChatToolResponse> {
  if (!isTauriEnv()) {
    throw new Error("聊天功能仅在桌面应用中可用。");
  }

  try {
    return await tryInvoke<ChatToolResponse>("chat_tool", {
      providerId: options.providerId,
      model: options.model,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      maxTokens: options.maxTokens ?? 4096,
      tools: options.tools,
      toolChoice: options.tool_choice === "any" ? "any" 
        : typeof options.tool_choice === "object" ? options.tool_choice
        : undefined,
    });
  } catch (e) {
    console.error("ChatWithTools API error:", e);
    throw e;
  }
}

// ─── Streaming chat ───

export async function sendChatStream(
  options: ChatStreamOptions,
  onToken?: (token: string) => void,
): Promise<string> {
  if (!isTauriEnv()) {
    const result = await sendChat(options);
    onToken?.(result);
    return result;
  }

  return new Promise<string>(async (resolve, reject) => {
    const { listen } = await import("@tauri-apps/api/event");

    await listen<{ token: string }>("chat:token", (event) => {
      onToken?.(event.payload.token);
    });
    await listen<{ content: string }>("chat:done", (event) => {
      resolve(event.payload.content);
    });
    await listen<{ error: string }>("chat:error", (event) => {
      reject(new Error(event.payload.error));
    });

    await tryInvoke(TauriCommands.ChatStream, {
      providerId: options.providerId,
      model: options.model,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      maxTokens: options.maxTokens ?? 2048,
    });
  });
}
