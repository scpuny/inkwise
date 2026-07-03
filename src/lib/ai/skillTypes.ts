/* ═══════════════════════════════════════════════════
   skillTypes.ts — 统一技能类型定义（v2.0.0）
   与 Rust skill.rs 中的类型一一对应，作为前后端共用契约
   ═══════════════════════════════════════════════════ */

/* ─── ToolCapability 工具能力枚举 ─── */

export type ToolCapability =
  | "read_document"
  | "write_document"
  | "search_document"
  | "read_project_files"
  | "list_project_files"
  | "search_project_files"
  | "git_diff"
  | "vector_search"
  | "call_web_search";

export const ALL_TOOLS: ToolCapability[] = [
  "read_document",
  "write_document",
  "search_document",
  "read_project_files",
  "list_project_files",
  "search_project_files",
  "git_diff",
  "vector_search",
  "call_web_search",
];

export const TOOL_LABELS: Record<ToolCapability, string> = {
  read_document: "读取文档",
  write_document: "写入文档",
  search_document: "搜索文档",
  read_project_files: "读取项目文件",
  list_project_files: "列出项目文件",
  search_project_files: "搜索项目文件",
  git_diff: "Git 差异",
  vector_search: "向量检索",
  call_web_search: "联网搜索",
};

/* ─── ContextSourceType 语境来源类型 ─── */

export type ContextSourceType =
  | "project"
  | "series"
  | "linked_folder"
  | "custom_text"
  | "git_diff"
  | "ast_analysis"
  | "vector_search"
  | "publish_history";

export interface SkillContextSource {
  sourceType: ContextSourceType;
  label: string;
  required: boolean;
  maxTokens?: number;
}

/* ─── EffortLevel 努力程度 ─── */

export type EffortLevel = "low" | "medium" | "high";

/* ─── SkillPhase 写作阶段 ─── */

export type SkillPhase = "title" | "description" | "outline" | "tags" | "writing";

export const PHASES: SkillPhase[] = ["title", "description", "outline", "tags", "writing"];

export const PHASE_LABELS: Record<SkillPhase, string> = {
  title: "标题",
  description: "描述",
  outline: "大纲",
  tags: "标签",
  writing: "写作",
};

/* ─── PhaseConfig 阶段配置 ─── */

export interface PhaseConfigUnified {
  phase: SkillPhase;
  systemPrompt: string;
  temperature?: number;
  model?: string;
  maxTokens?: number;
}

/* ─── RunAs 执行方式 ─── */

export type RunAs = "inline" | "subagent";

/* ─── SkillScope 作用范围 ─── */

export type SkillScope = "builtin" | "global" | "custom" | "project";

/* ─── UnifiedSkill 统一技能定义 ─── */

export interface UnifiedSkill {
  name: string;
  description: string;
  icon: string;
  body: string;
  runAs: RunAs;
  allowedTools: ToolCapability[];
  phaseConfigs: PhaseConfigUnified[];
  contextSources: SkillContextSource[];
  model?: string;
  effort?: EffortLevel;
  scope: SkillScope;
  enabled: boolean;
}
