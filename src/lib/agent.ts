// agent.ts — Agent 工作流核心抽象层
// 管理所有 AI 交互的 Context、Session 记录、意图路由

import { createContext, useContext } from "react";
import type { ChatMessage } from "./ai";
import type { Skill, AgentResult } from "./skill";
import { runSkill, listSkills } from "./skill";
import { sendChat } from "./ai";
import { getProvidersSync } from "./providerModels";
import { isTauriEnv, tryInvoke } from "./tauri";

/* ─── AgentSession（每次 AI 操作的不可变记录） ─── */

export type AgentMode = "inline" | "command" | "agent";

export interface AgentSession {
  id: string;
  intent: string;         // "polish", "continue-writing", "translate" 等
  skill: string;          // 使用的技能名称
  mode: AgentMode;        // 触发模式
  userInput: string;      // 用户的原始指令
  selectionRange?: { from: number; to: number }; // 操作范围（字符偏移）
  beforeContent: string;  // 操作前的内容
  afterContent: string;   // 操作后的内容（接受后的最终内容）
  alternativeVersions?: string[]; // 多个改写版本
  state: "pending" | "accepted" | "rejected";
  createdAt: number;
  model: string;
  tokensUsed?: number;
}

/* ─── Intent（意图定义） ─── */

export interface Intent {
  id: string;
  mode: AgentMode;
  skill: string;
  label: string;
  description: string;
}

/* ─── 内置意图路由 ─── */

export function detectIntent(input: string, selectedTextLength: number): Intent {
  const trimmed = input.trim().toLowerCase();

  // Agent 模式：复杂分析/研究/自定义指令（超过 15 字且不是简单动作）
  const agentPatterns = [
    "分析", "研究", "检查", "评估", "总结全文", "帮我看看",
    "review", "analyze", "research",
  ];
  const isComplex = agentPatterns.some((p) => trimmed.includes(p))
    || (trimmed.length > 15 && !trimmed.startsWith("/"));

  if (isComplex) {
    return { id: "agent-custom", mode: "agent", skill: "", label: "AI 分析", description: "复杂分析任务" };
  }

  // 指令模式：以 "/" 开头
  if (trimmed.startsWith("/")) {
    const cmd = trimmed.slice(1).split(/\s+/)[0];
    const intent = INTENT_MAP[cmd];
    if (intent) return { ...intent, mode: "command" };
    return { id: "custom", mode: "command", skill: "", label: cmd, description: `执行 ${cmd}` };
  }

  // 选中文本 + 短指令 → agent（结果展示在 ChatPanel）
  if (selectedTextLength > 0 && trimmed.length < 30) {
    for (const [keyword, intent] of Object.entries(INTENT_KEYWORD_MAP)) {
      if (trimmed.includes(keyword)) return { ...intent, mode: "command" };
    }
    return { id: "rewrite-selection", mode: "command", skill: "rewrite", label: "改写选中", description: "根据指令改写选中文本" };
  }

  // 默认：续写 → agent
  return { id: "continue", mode: "command", skill: "continue-writing", label: "续写", description: "从光标位置继续写作" };
}

const INTENT_MAP: Record<string, { id: string; skill: string; label: string; description: string }> = {
  "续写":   { id: "continue", skill: "continue-writing", label: "续写", description: "从光标位置继续写作" },
  "润色":   { id: "polish", skill: "polish", label: "润色", description: "使语言更流畅自然" },
  "改写":   { id: "rewrite", skill: "rewrite", label: "改写", description: "提升表达质量" },
  "翻译":   { id: "translate", skill: "translate", label: "翻译", description: "中英互译" },
  "扩写":   { id: "expand", skill: "expand", label: "扩写", description: "补充细节和论据" },
  "摘要":   { id: "summary", skill: "summary", label: "摘要", description: "生成内容摘要" },
  "校对":   { id: "proofread", skill: "proofread", label: "校对", description: "语法和错别字检查" },
  "学术":   { id: "academic", skill: "academic", label: "学术风格", description: "严谨客观的学术写作" },
  "创意":   { id: "creative", skill: "creative", label: "创意风格", description: "富有文学性的表达" },
  "大纲":   { id: "outline", skill: "outline", label: "大纲", description: "自动生成大纲" },
  "标题":   { id: "headline", skill: "headline", label: "标题建议", description: "生成多个标题选项" },
  "同义":   { id: "paraphrase", skill: "paraphrase", label: "同义改写", description: "保留原意改变句式" },
};

const INTENT_KEYWORD_MAP: Record<string, { id: string; skill: string; label: string; description: string }> = {
  "润色":   { id: "polish", skill: "polish", label: "润色", description: "使语言更流畅自然" },
  "改写":   { id: "rewrite", skill: "rewrite", label: "改写", description: "提升表达质量" },
  "翻译":   { id: "translate", skill: "translate", label: "翻译", description: "中英互译" },
  "扩写":   { id: "expand", skill: "expand", label: "扩写", description: "补充细节和论据" },
  "缩写":   { id: "shorten", skill: "rewrite", label: "缩写", description: "精简文本" },
  "同义":   { id: "paraphrase", skill: "paraphrase", label: "同义改写", description: "保留原意改变句式" },
  "校对":   { id: "proofread", skill: "proofread", label: "校对", description: "语法和错别字检查" },
  "学术":   { id: "academic", skill: "academic", label: "学术风格", description: "严谨客观的学术写作" },
  "创意":   { id: "creative", skill: "creative", label: "创意风格", description: "富有文学性的表达" },
};

/* ─── AgentContext（React Context） ─── */

export interface AgentState {
  panelOpen: boolean;
  panelTab: "chat" | "diff" | "history";
  commandBarOpen: boolean;
  commandBarText: string;
  isProcessing: boolean;
  currentSessionId: string | null;
  ghostText: string | null;
  sessions: AgentSession[];
  lastError: string | null;
}

export interface AgentActions {
  openPanel: () => void;
  closePanel: () => void;
  setPanelTab: (tab: "chat" | "history") => void;
  togglePanel: () => void;
  openCommandBar: () => void;
  closeCommandBar: () => void;
  setCommandBarText: (text: string) => void;
  execute: (input: string, options?: { intent?: string; selection?: { from: number; to: number }; beforeContent?: string; blueprint?: any; currentSectionId?: string }) => Promise<void>;
  cancel: () => void;
  acceptGhost: () => void;
  rejectGhost: () => void;
  acceptSession: (id: string) => void;
  rejectSession: (id: string) => void;
  removeSession: (id: string) => void;
  setGhostText: (text: string | null) => void;
  insertGhost: (content: string) => void;
  setActiveArticleId: (id: string | null) => void;
}

export type AgentContextValue = AgentState & AgentActions;

export const AgentContext = createContext<AgentContextValue | null>(null);

export function useAgent(): AgentContextValue {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error("useAgent must be used within AgentProvider");
  return ctx;
}

/* ─── 默认状态 ─── */

export const DEFAULT_AGENT_STATE: AgentState = {
  panelOpen: false,
  panelTab: "chat",
  commandBarOpen: false,
  commandBarText: "",
  isProcessing: false,
  currentSessionId: null,
  ghostText: null,
  sessions: [],
  lastError: null,
};

/* ─── Utility ─── */

let sessionCounter = 0;
export function generateSessionId(): string {
  sessionCounter++;
  return `session-${Date.now()}-${sessionCounter}`;
}

export function getSkillDisplayLabel(name: string): string {
  const labels: Record<string, string> = {
    "continue-writing": "续写",
    "rewrite": "改写",
    "polish": "润色",
    "translate": "翻译",
    "academic": "学术",
    "creative": "创意",
    "summary": "摘要",
    "outline": "大纲",
    "expand": "扩写",
    "paraphrase": "同义改写",
    "proofread": "校对",
    "blog": "博客",
    "novel": "小说",
    "headline": "标题",
    "email": "邮件",
    "keyword-extract": "关键词",
    "readability": "可读性",
    "citation": "引用",
    "general": "通用",
    "professional": "商务",
  };
  return labels[name] || name;
}
