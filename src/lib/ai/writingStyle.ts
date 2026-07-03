/* ═══════════════════════════════════════════════════
   writingStyle.ts — 写作风格/动作分离定义
   将原本 WritingSkill 拆分为独立 Style（风格）和 Action（动作）
   风格 = 写得怎么样（语气/正式度/受众）
   动作 = 写什么（规划/写作/审阅/改写）
   ═══════════════════════════════════════════════════ */

import type { StyleDimension, ContextSource } from "./writingSkill/types";
import { getBuiltinSkills } from "./writingSkill/builtins";

/* ─── 写作风格 ─── */

export interface WritingStyle {
  id: string;
  name: string;
  description: string;
  icon: string;
  /** 风格维度标签 */
  dimensions: StyleDimension[];
  /** 上下文来源声明 */
  contextSources: ContextSource[];
  /** 示例文本 */
  exampleText?: string;
  /** 是否内置 */
  builtin: boolean;
  createdAt: number;
  updatedAt: number;
}

/* ─── 写作动作 ─── */

export type ActionPhase = "planning" | "writing" | "reviewing" | "rewriting";

export interface WritingAction {
  id: string;
  name: string;
  description: string;
  icon: string;
  /** 目标阶段 */
  phase: ActionPhase;
  /** 系统提示词模板（用 {{styleContext}} / {{context}} 占位） */
  systemPrompt: string;
  /** 温度 */
  temperature?: number;
  /** 上下文来源声明 */
  contextSources?: ContextSource[];
  /** 工具声明 */
  tools?: string[];
  /** 是否内置 */
  builtin: boolean;
}

/* ─── 默认动作 ─── */

export const BUILTIN_ACTIONS: WritingAction[] = [
  {
    id: "action-plan",
    name: "规划",
    description: "生成标题、描述、标签和大纲",
    icon: "📋",
    phase: "planning",
    systemPrompt: `你是一位写作规划助手。为文章生成标题、描述、标签和大纲。

## 核心规则
- 标题简洁有力，能吸引目标读者
- 第一段概括文章主旨
- 标签 3-5 个，用逗号分隔
- 大纲 3-6 个章节，逻辑递进
{{styleContext}}`,
    temperature: 0.7,
    builtin: true,
  },
  {
    id: "action-write",
    name: "写作",
    description: "根据大纲逐章节写作",
    icon: "✍️",
    phase: "writing",
    systemPrompt: `你是一位专业写作者。根据大纲和背景信息，完成文章写作。

## 核心规则
- 遵循大纲结构逐章展开
- 段落之间自然过渡
- 控制每节长度与整体比例协调
{{styleContext}}`,
    temperature: 0.7,
    builtin: true,
  },
  {
    id: "action-review",
    name: "审阅",
    description: "从多个维度审阅文章质量",
    icon: "🔍",
    phase: "reviewing",
    systemPrompt: `你是一位专业审稿人。从以下维度全面审阅文章质量。

## 审阅维度
1. 内容价值：信息密度、观点深度
2. 结构逻辑：章节安排、论证链条
3. 语言表达：用词准确、句式多样
4. 读者体验：代入感、可读性
5. 风格一致：是否符合目标风格
{{styleContext}}`,
    temperature: 0.3,
    builtin: true,
  },
  {
    id: "action-rewrite",
    name: "改写",
    description: "在保持原意基础上优化表达",
    icon: "🔄",
    phase: "rewriting",
    systemPrompt: `你是一位文字编辑。在保持原意和结构的前提下优化文章表达。

## 核心规则
- 保留原文核心信息和数据
- 改进句式流畅度和表达精准度
- 调整语气和风格以匹配目标
- 不改变原文整体结构和长度
{{styleContext}}`,
    temperature: 0.5,
    builtin: true,
  },
];

/* ─── 内置风格（从 WritingSkill 提取风格部分） ─── */

/** 从旧 WritingSkill 提取 Style 部分 */
function styleFromSkill(skill: import("./writingSkill/types").WritingSkill): WritingStyle {
  return {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    icon: skill.icon,
    dimensions: skill.dimensions,
    contextSources: skill.contextSources,
    exampleText: skill.exampleText,
    builtin: true,
    createdAt: 0,
    updatedAt: 0,
  };
}

/** 获取所有内置风格 */
export function getBuiltinStyles(): WritingStyle[] {
  return getBuiltinSkills().map(styleFromSkill);
}

/** 按 styleId 查找风格 */
export function getStyle(id: string): WritingStyle | undefined {
  return getBuiltinStyles().find((s) => s.id === id);
}

/** 按动作 ID 查找 */
export function getAction(id: string): WritingAction | undefined {
  return BUILTIN_ACTIONS.find((a) => a.id === id);
}

/** 按阶段过滤动作 */
export function getActionsByPhase(phase: ActionPhase): WritingAction[] {
  return BUILTIN_ACTIONS.filter((a) => a.phase === phase);
}

/** 将旧的 WritingSkill id 转换为新的 styleId（后向兼容） */
export function migrateSkillIdToStyleId(skillId?: string): string {
  if (!skillId) return "general";
  return skillId;
}
