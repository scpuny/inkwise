// agentEngine.ts — 支持 tool calling 的 Agent 执行引擎
// 前端主动循环：AI 请求 → 工具调用 → 工具执行 → AI 请求 → 最终回复
import { sendChatWithTools, type ChatMessage, type ToolDefinition, type ToolCall, type ChatToolOptions } from "../ai";
import { resolveProviderForModel } from "../../config/globalAIConfig";
import { TauriCommands, tryInvoke } from "../../bridge/tauri";

// ─── Tool progress events ───

export type ToolEventType = "thinking" | "thinking_done" | "tool_start" | "tool_end" | "error";

export interface ToolEvent {
  type: ToolEventType;
  toolName: string;
  toolCallId: string;
  arguments: string;
  result?: string;
  round?: number;
  summary?: string;
}

// ─── 工具定义 ───

export interface ProjectToolContext {
  projectPath: string;
}

const TOOL_READ_FILES: ToolDefinition = {
  function: {
    name: "read_project_files",
    description: "读取关联项目目录中的一个或多个文件内容。返回每个文件的完整源码。每次调用最多读取 6 个文件。",
    parameters: {
      type: "object",
      properties: {
        paths: {
          type: "array",
          items: { type: "string" },
          description: "相对项目根目录的文件路径列表，如 ['src/main.rs', 'src/lib.rs']",
        },
      },
      required: ["paths"],
    },
  },
};

const TOOL_LIST_FILES: ToolDefinition = {
  function: {
    name: "list_project_files",
    description: "列出关联项目目录中指定路径下的文件和子目录（不递归）。不传 path 时列出根目录。",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "相对项目根目录的目录路径，如 'src'，不传则列出根目录",
        },
      },
    },
  },
};

const TOOL_SEARCH_FILES: ToolDefinition = {
  function: {
    name: "search_project_files",
    description: "在关联项目目录中搜索匹配指定关键词的文件名。返回匹配的文件路径列表。",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "搜索关键词（匹配文件名，不区分大小写）",
        },
      },
      required: ["query"],
    },
  },
};

export const PROJECT_TOOLS: ToolDefinition[] = [
  TOOL_READ_FILES,
  TOOL_LIST_FILES,
  TOOL_SEARCH_FILES,
];

// ─── 工具执行器 ───

async function executeToolCall(
  call: ToolCall,
  context: ProjectToolContext,
): Promise<string> {
  const args = JSON.parse(call.function.arguments);

  switch (call.function.name) {
    case "read_project_files": {
      const paths: string[] = args.paths || [];
      if (paths.length === 0) return "错误：未指定文件路径";
      const results = await tryInvoke<Array<{ path: string; content?: string; error?: string }>>(
        TauriCommands.ReadProjectFiles,
        { path: context.projectPath, files: paths },
      );
      return results.map(function(r) {
        if (r.error) return "文件 " + r.path + ": " + r.error;
        return "### " + r.path + "\n```\n" + r.content + "\n```";
      }).join("\n\n");
    }

    case "list_project_files": {
      const dirPath: string = args.path || "";
      // Use the existing getProjectContext to list directory structure
      const { getProjectContext } = await import("../../storage/collections");
      const ctx = await getProjectContext(context.projectPath);
      // Walk tree to find the target directory
      function findDir(nodes: Array<{ name: string; isDir: boolean; children?: any[] }>, pathParts: string[]): any[] | null {
        if (pathParts.length === 0) return nodes;
        const [head, ...rest] = pathParts;
        for (const n of nodes) {
          if (n.isDir && n.name === head) return findDir(n.children || [], rest);
        }
        return null;
      }
      const parts = dirPath ? dirPath.split("/").filter(Boolean) : [];
      const entries = findDir(ctx.structure, parts);
      if (!entries) return "错误：目录 \"" + dirPath + "\" 不存在";
      return entries.map(function(e: any) {
        const icon = e.isDir ? "\uD83D\uDCC1" : "\uD83D\uDCC4";
        return icon + " " + e.name + (e.isDir ? "/" : "");
      }).join("\n");
    }

    case "search_project_files": {
      const query: string = args.query || "";
      if (!query) return "错误：未指定搜索关键词";
      const { getProjectContext } = await import("../../storage/collections");
      const ctx = await getProjectContext(context.projectPath);
      const matches: string[] = [];
      function walk(nodes: Array<{ name: string; isDir: boolean; children?: any[] }>, prefix: string) {
        for (const n of nodes) {
          const full = prefix ? prefix + "/" + n.name : n.name;
          if (!n.isDir && n.name.toLowerCase().includes(query.toLowerCase())) {
            matches.push(full);
          }
          if (n.isDir && n.children) walk(n.children, full);
        }
      }
      walk(ctx.structure, "");
      return matches.map(function(f) { return "- " + f; }).join("\n");
    }

    default:
      return "错误：未知工具 \"" + call.function.name + "\"";
  }
}

// ─── Agent 循环 ───

export interface AgentResult {
  content: string;
  toolCalls: number;
  thinking?: string;
}

export interface AgentOptions {
  systemPrompt: string;
  userMessage: string;
  tools: ToolDefinition[];
  toolContext?: ProjectToolContext;
  maxToolRounds?: number;
  requestTimeoutMs?: number;
  onToolEvent?: (event: ToolEvent) => void;
  onToken?: (token: string) => void;
  signal?: AbortSignal;
}

export async function runAgentLoop(options: AgentOptions): Promise<AgentResult> {
  const {
    systemPrompt,
    userMessage,
    tools,
    toolContext,
    maxToolRounds = 15,
    requestTimeoutMs = 150000,
    onToolEvent,
    signal,
    onToken,
  } = options;

  const { provider, model } = resolveProviderForModel();
  if (!provider) throw new Error("请先在设置中配置 AI 提供商");
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];

  let toolCallCount = 0;
  let toolRound = 0;
  let accumulatedThinking = "";
  const startTime = Date.now();

  // Initial thinking - show immediate progress
  onToolEvent?.({
    type: "thinking",
    toolName: "",
    toolCallId: "think_0",
    arguments: "",
    summary: "正在连接 AI…",
  });

  while (true) {
    if (signal?.aborted) throw new Error("扫描已取消");
    toolRound++;
    const isFirstRound = toolRound === 1;
    if (!isFirstRound) {
      onToolEvent?.({
        type: "thinking",
        toolName: "",
        toolCallId: "think_" + toolRound,
        arguments: "",
        round: toolRound,
        summary: "AI 正在根据已读取的文件内容，决定是否需要继续读取更多文件…",
      });
    }

    const chatOptions: ChatToolOptions = {
      providerId: provider.id,
      model,
      messages,
      temperature: 0.7,
      maxTokens: 4096,
      tools,
    };

    let response;
    try {
      // Show intermediate progress while waiting for AI
      const progressInterval = setInterval(function() {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        if (elapsed > 5 && elapsed % 10 < 2) {
          onToolEvent?.({
            type: "thinking",
            toolName: "",
            toolCallId: "think_" + toolRound + "_wait",
            arguments: "",
            round: toolRound,
            summary: "等待 AI 响应（" + elapsed + "s）…",
          });
        }
      }, 1000);
      response = await Promise.race([
        sendChatWithTools(chatOptions),
        new Promise<never>(function(_, reject) {
          setTimeout(function() {
            reject(new Error("AI 请求超时 (" + (requestTimeoutMs / 1000) + "s)。当前模型可能不支持 tool calling，或响应过慢。"));
          }, requestTimeoutMs);
        }),
      ]);
      clearInterval(progressInterval);
    } catch (err: any) {
      onToolEvent?.({
        type: "thinking_done",
        toolName: "",
        toolCallId: "think_" + toolRound,
        arguments: "",
        round: toolRound,
        summary: typeof err === "string" ? err : err?.message || "AI 调用失败",
      });
      onToolEvent?.({
        type: "error",
        toolName: "",
        toolCallId: "err_" + toolRound,
        arguments: "",
        round: toolRound,
        summary: typeof err === "string" ? err : err?.message || "未知错误",
      });
      throw err;
    }

    // Emit AI's thinking/reasoning content
    if (response.thinking) {
      accumulatedThinking = accumulatedThinking + response.thinking;
      onToolEvent?.({
        type: "thinking",
        toolName: "",
        toolCallId: "think_" + toolRound,
        arguments: response.thinking,
        round: toolRound,
        summary: response.thinking.slice(0, 300),
      });
    }

    // Mark thinking as done
    onToolEvent?.({
      type: "thinking_done",
      toolName: "",
      toolCallId: "think_" + toolRound,
      arguments: "",
      round: toolRound,
      summary: "AI 分析完成",
    });

    // AI decided to call tools
    if (response.tool_calls && response.tool_calls.length > 0) {
      toolCallCount += response.tool_calls.length;
      if (toolCallCount > maxToolRounds) {
        throw new Error("工具调用次数超过限制 (" + maxToolRounds + " 轮)");
      }

      messages.push({
        role: "assistant",
        content: null,
        tool_calls: response.tool_calls,
      });

      // Execute each tool call
      for (const toolCall of response.tool_calls) {
        // Build summary from arguments
        let summary = "";
        try {
          const parsed = JSON.parse(toolCall.function.arguments);
          if (toolCall.function.name === "read_project_files" && parsed.paths) {
            summary = "读取 " + parsed.paths.length + " 个文件：" + parsed.paths.join(", ");
          } else if (toolCall.function.name === "list_project_files") {
            summary = "列出目录：" + (parsed.path || "根目录");
          } else if (toolCall.function.name === "search_project_files") {
            summary = "搜索文件：" + parsed.query;
          }
        } catch {}

        onToolEvent?.({
          type: "tool_start",
          toolName: toolCall.function.name,
          toolCallId: toolCall.id,
          arguments: toolCall.function.arguments,
          round: toolRound,
          summary: summary || ("调用 " + toolCall.function.name),
        });

        if (!toolContext) {
          const errMsg = "错误：工具 \"" + toolCall.function.name + "\" 需要项目目录上下文但未提供";
          messages.push({ role: "tool", content: errMsg, tool_call_id: toolCall.id });
          onToolEvent?.({
            type: "tool_end",
            toolName: toolCall.function.name,
            toolCallId: toolCall.id,
            arguments: toolCall.function.arguments,
            result: errMsg,
            summary: "失败：缺少项目目录",
          });
          continue;
        }

        const result = await executeToolCall(toolCall, toolContext);
        messages.push({ role: "tool", content: result, tool_call_id: toolCall.id });

        // Build result summary
        let resultSummary = "";
        try {
          if (toolCall.function.name === "read_project_files") {
            const fileMatches = result.match(/### /g);
            const fileCount = fileMatches ? fileMatches.length : 0;
            const errMatches = result.match(/^文件 /gm);
            const errCount = errMatches ? errMatches.length : 0;
            if (fileCount > 0) {
              resultSummary = "读取完成：" + fileCount + " 个文件" + (errCount > 0 ? "，" + errCount + " 个失败" : "") + "，共 " + result.length + " 字符";
            } else if (errCount > 0) {
              resultSummary = "读取失败：" + errCount + " 个文件，共 " + result.length + " 字符";
            } else {
              resultSummary = "已响应，共 " + result.length + " 字符";
            }
          } else if (toolCall.function.name === "list_project_files") {
            const lines = result.split("\n").filter(function(l) { return l.trim(); });
            resultSummary = "找到 " + lines.length + " 个条目";
          } else if (toolCall.function.name === "search_project_files") {
            const lines = result.split("\n").filter(function(l) { return l.trim().startsWith("- "); });
            resultSummary = "找到 " + lines.length + " 个匹配文件";
          }
        } catch {}

        onToolEvent?.({
          type: "tool_end",
          toolName: toolCall.function.name,
          toolCallId: toolCall.id,
          arguments: toolCall.function.arguments,
          round: toolRound,
          summary: resultSummary || "完成",
          result: result.slice(0, 500),
        });
      }

      if (signal?.aborted) throw new Error("扫描已取消");
      continue; // Next round
    }

    // AI returned final content
    const content = response.content || "";
    if (onToken && content) {
      onToken(content);
    }

    return { content, toolCalls: toolCallCount, thinking: accumulatedThinking || undefined };
  }
}
