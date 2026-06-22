// AgentProvider.tsx — Agent 工作流的 Context Provider
// 管理所有 AI 交互的状态、Session 记录、意图路由

import { useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import {
  AgentContext,
  type AgentState,
  type AgentSession,
  type AgentContextValue,
  DEFAULT_AGENT_STATE,
  generateSessionId,
  detectIntent,
  getSkillDisplayLabel,
} from "../lib/agent";
import { runSkill } from "../lib/skill";
import { sendChat, type ChatMessage } from "../lib/ai";
import { resolveModel } from "../lib/globalAIConfig";
import { getProvidersSync } from "../lib/providerModels";

export function AgentProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AgentState>(() => ({ ...DEFAULT_AGENT_STATE }));

  // Refs for ongoing operations
  const cancelledRef = useRef(false);

  // ── Panel actions ──
  const openPanel = useCallback(() => setState((s) => ({ ...s, panelOpen: true })), []);
  const closePanel = useCallback(() => setState((s) => ({ ...s, panelOpen: false })), []);
  const togglePanel = useCallback(() => setState((s) => ({ ...s, panelOpen: !s.panelOpen })), []);
  const setPanelTab = useCallback((tab: "chat" | "diff" | "history") => setState((s) => ({ ...s, panelTab: tab })), []);

  // ── Command Bar actions ──
  const openCommandBar = useCallback(() => setState((s) => ({ ...s, commandBarOpen: true })), []);
  const closeCommandBar = useCallback(() => setState((s) => ({ ...s, commandBarOpen: false, commandBarText: "" })), []);
  const setCommandBarText = useCallback((text: string) => setState((s) => ({ ...s, commandBarText: text })), []);

  // ── Cancel ──
  const cancel = useCallback(() => {
    cancelledRef.current = true;
    setState((s) => ({ ...s, isProcessing: false }));
  }, []);

  // ── Execute (core AI execution) ──
  const execute = useCallback(async (
    input: string,
    options?: { intent?: string; selection?: { from: number; to: number }; beforeContent?: string; blueprint?: any; currentSectionId?: string },
  ) => {
    if (!input.trim()) return;
    cancelledRef.current = false;

    const selection = options?.selection;
    const beforeContent = options?.beforeContent ?? "";

    // Detect intent
    const intent = options?.intent
      ? { id: options.intent, mode: options.intent === "chat" ? ("agent" as const) : ("inline" as const), skill: options.intent, label: options.intent === "chat" ? "对话" : getSkillDisplayLabel(options.intent), description: "" }
      : detectIntent(input, selection ? Math.abs(selection.to - selection.from) : 0);

    // Get provider
    const providers = getProvidersSync();
    const enabled = providers.find((p) => p.enabled && p.models.length > 0);
    if (!enabled) {
      setState((s) => ({ ...s, lastError: "请先在设置 → 模型中配置 AI 提供商" }));
      return;
    }

    const sessionId = generateSessionId();
    const model = resolveModel() || enabled.models[0];

    // Create initial session
    const session: AgentSession = {
      id: sessionId,
      intent: intent.id,
      skill: intent.skill,
      mode: intent.mode,
      userInput: input,
      selectionRange: selection,
      beforeContent,
      afterContent: "",
      alternativeVersions: [],
      state: "pending",
      createdAt: Date.now(),
      model,
    };

    setState((s) => ({
      ...s,
      isProcessing: true,
      currentSessionId: sessionId,
      ghostText: null,
      lastError: null,
      sessions: [...s.sessions, session],
      commandBarOpen: false,
      commandBarText: "",
    }));

    try {
      let result: string;

      if (intent.skill && intent.skill !== "") {
        // Use Skill system
        // Build conversation context from recent sessions
        let conversationCtx = "";
        if (intent.mode === "agent" || intent.mode === "command") {
          const recentSessions = state.sessions
            .filter(s => s.state !== "rejected" && s.userInput && s.afterContent)
            .slice(-4);
          if (recentSessions.length > 0) {
            conversationCtx = "\n\n## 对话历史\n";
            for (const prev of recentSessions) {
              conversationCtx += `用户: ${prev.userInput}\nAI: ${prev.afterContent.slice(0, 500)}\n---\n`;
            }
          }
        }
        const agentInput = conversationCtx ? input + conversationCtx : input;
        const agentResult = await runSkill(
          intent.skill,
          agentInput,
          beforeContent,
          selection ? beforeContent.slice(selection.from, selection.to) : "",
          options?.blueprint,
          options?.currentSectionId,
        );
        result = agentResult.content;
      } else {
        // Fallback to direct chat with conversation context
        const systemPrompt = buildSystemPrompt(intent.id, beforeContent, selection);
        
        // Build conversation history from recent sessions (agent mode only)
        const messages: ChatMessage[] = [
          { role: "system", content: systemPrompt },
        ];

        // Add conversation context for agent mode
        if (intent.mode === "agent" || intent.mode === "command") {
          const recentSessions = state.sessions
            .filter(s => s.state !== "rejected" && s.userInput && s.afterContent)
            .slice(-6); // Keep last 6 exchanges for context

          for (const prev of recentSessions) {
            messages.push({ role: "user", content: prev.userInput });
            messages.push({ role: "assistant", content: prev.afterContent });
          }
        }

        messages.push({ role: "user", content: input });
        result = await sendChat({
          providerId: enabled.id,
          model,
          messages,
          temperature: 0.7,
          maxTokens: 2048,
        });
      }

      if (cancelledRef.current) return;

      // For inline mode: show ghost text
      if (intent.mode === "inline") {
        setState((s) => ({
          ...s,
          isProcessing: false,
          ghostText: result,
          sessions: s.sessions.map((se) =>
            se.id === sessionId ? { ...se, afterContent: result, state: "pending" as const } : se
          ),
        }));
      } else {
        // For command/agent mode: show in panel
        setState((s) => ({
          ...s,
          isProcessing: false,
          panelOpen: true,
          panelTab: "chat",
          ghostText: null,
          sessions: s.sessions.map((se) =>
            se.id === sessionId ? { ...se, afterContent: result, state: "pending" as const } : se
          ),
        }));
      }
    } catch (e: any) {
      if (cancelledRef.current) return;
      setState((s) => ({
        ...s,
        isProcessing: false,
        lastError: e?.message || String(e),
        sessions: s.sessions.map((se) =>
          se.id === sessionId ? { ...se, state: "rejected" as const } : se
        ),
      }));
    }
  }, []);

  // ── Ghost text actions ──
  const acceptGhost = useCallback(() => {
    const ghost = state.ghostText;
    if (!ghost) return;

    // Insert via window.__insertGhostContent (provided by EditorContent)
    const editor = (window as any).editorInstance?.editor;
    if (editor && editor.commands) {
      editor.commands.insertContent(ghost);
    }

    // Update session
    setState((s) => ({
      ...s,
      ghostText: null,
      sessions: s.sessions.map((se) =>
        se.id === s.currentSessionId ? { ...se, state: "accepted" as const } : se
      ),
    }));
  }, [state.ghostText, state.currentSessionId]);

  const rejectGhost = useCallback(() => {
    setState((s) => ({
      ...s,
      ghostText: null,
      sessions: s.sessions.map((se) =>
        se.id === s.currentSessionId ? { ...se, state: "rejected" as const } : se
      ),
    }));
  }, [state.currentSessionId]);

  const setGhostText = useCallback((text: string | null) => {
    setState((s) => ({ ...s, ghostText: text }));
  }, []);

  // ── Session management ──
  const acceptSession = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      sessions: s.sessions.map((se) =>
        se.id === id ? { ...se, state: "accepted" as const } : se
      ),
    }));
  }, []);

  const rejectSession = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      sessions: s.sessions.map((se) =>
        se.id === id ? { ...se, state: "rejected" as const } : se
      ),
    }));
  }, []);

  const removeSession = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      sessions: s.sessions.filter((se) => se.id !== id),
    }));
  }, []);

  const value: AgentContextValue = {
    ...state,
    openPanel,
    closePanel,
    setPanelTab,
    togglePanel,
    openCommandBar,
    closeCommandBar,
    setCommandBarText,
    execute,
    cancel,
    acceptGhost,
    rejectGhost,
    acceptSession,
    rejectSession,
    removeSession,
    setGhostText,
    insertGhost: (content: string) => {
      // Default: try to insert via editorInstance (fallback)
      const editor = (window as any).editorInstance?.editor;
      if (editor && editor.commands) {
        editor.commands.insertContent(content);
      }
    },
  };

  return (
    <AgentContext.Provider value={value}>
      {children}
    </AgentContext.Provider>
  );
}

function buildSystemPrompt(intent: string, documentContent: string, selection?: { from: number; to: number }): string {
  const hasContent = documentContent.trim().length > 0;
  const isNewArticle = !hasContent || documentContent.trim().split("\n").length < 3;

  if (isNewArticle) {
    return "你是一位资深中文写作者。请根据用户要求写一篇完整的文章。\n\n## 要求\n- 结构完整：标题 → 引言 → 正文 → 总结\n- 每个段落至少 3-5 句\n- 使用流畅自然的中文\n- 使用 Markdown 格式\n- 直接输出文章内容，无需额外说明";
  }

  const systemPrompts: Record<string, string> = {
    "polish": "你是一位专业的文字润色专家。请优化用户提供的文本，使其更加流畅自然。保持原意，不改变核心信息。直接输出结果。",
    "rewrite": "你是一位专业的写作者。请根据用户的要求改写文本，提升表达质量。保持原意。直接输出结果。",
    "translate": "你是一位专业翻译。请翻译用户提供的文本。保持原文的语气和风格。直接输出翻译结果。",
    "expand": "你是一位专业的写作者。请对用户提供的文本进行扩写，补充细节、论据和例子，使内容更充实。直接输出结果。",
    "continue-writing": "你是一位资深中文写作者。请根据用户提供的上下文，自然地继续写作。保持原文的风格和语气。直接输出续写内容。",
    "summary": "你是一位专业摘要生成器。请为给定的文档生成简洁的摘要，概括核心要点。直接输出摘要。",
    "outline": "你是一位写作规划专家。请根据用户的需求生成文章大纲。使用 Markdown 列表格式。直接输出大纲。",
    "headline": "你是一位标题创作专家。请为文章生成 5 个吸引眼球的标题建议。直接输出标题列表。",
    "proofread": "你是一位专业校对员。请检查文本中的语法错误、错别字和标点问题，输出修正后的版本并用括号标注修改处。",
    "paraphrase": "你是一位语言专家。请用不同的句式重新表达用户的文本，保留原意。直接输出结果。",
    "academic": "你是一位学术写作专家。请以严谨、客观、规范的学术风格处理文本。使用正式的学术语言。直接输出结果。",
    "chat": "你是 AI 写作助手，可以与用户进行多轮对话。回答用户的问题，提供建议，协助分析文章。根据对话历史理解上下文，给出有针对性的回复。直接输出回答。",
    "creative": "你是一位富有创意的文学家。请以文学性强的风格处理文本，注重修辞、意象和节奏感。直接输出结果。",
  };

  return systemPrompts[intent] || "你是一位专业的 AI 写作助手。请根据用户的指令完成写作任务。直接输出结果，无需额外解释。";
}
