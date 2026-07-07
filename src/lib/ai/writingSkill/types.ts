// types.ts [DEPRECATED] — 旧版 WritingSkill 类型定义
// @deprecated 请使用 ../skillTypes.ts 中的 UnifiedSkill 替代。将在 v2.0.0 后移除。

/** 技能作用范围 */
export type SkillScope = "full" | "phase";

/** 可独立配置的阶段 */
export type SkillPhase = "title" | "description" | "outline" | "tags" | "writing";

/** 上下文来源声明 */
export interface ContextSource {
  type: "project" | "series" | "linked_folder" | "custom_text";
  label: string;
  required: boolean;
  maxLength?: number;
}

/** 单个阶段的 AI 配置 */
export interface PhaseConfig {
  systemPrompt: string;
  temperature?: number;
  model?: string;
  maxTokens?: number;
}

/** 工具调用声明（未来扩展） */
export interface ToolDeclaration {
  name: string;
  description: string;
}

/** 风格维度标签（0-10） */
export interface StyleDimension {
  name: string;
  value: number;
}

/* ─── 核心模型 ─── */

export interface WritingSkill {
  id: string;
  name: string;
  description: string;
  icon: string;

  /** 作用范围 */
  scope: SkillScope;
  /** phase 模式下指定目标阶段 */
  phase?: SkillPhase;

  /** 各阶段配置 */
  configs: Partial<Record<SkillPhase, PhaseConfig>>;

  /** 上下文来源声明 */
  contextSources: ContextSource[];

  /** 工具调用（未来） */
  tools?: ToolDeclaration[];

  /** 风格维度标签 */
  dimensions: StyleDimension[];

  /** 示例文本 */
  exampleText?: string;

  /** 是否为内置 */
  builtin: boolean;
  createdAt: number;
  updatedAt: number;
}
