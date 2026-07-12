// ─── AI 规划领域类型 ───
// 纯数据定义，不含业务逻辑
import type { ArticlePhase, OutlineSection } from "./Document";

export interface PartialPlan {
  title: string;
  description: string;
  outline: OutlineSection[];
  tags: string[];
  tone?: string;
  targetAudience?: string;
  targetWordCount?: number;
  skillId?: string;
  styleId?: string;
  actionId?: string;
  projectInsights?: string;
}

/** 文章蓝图 — 规划时的结构化元数据 + 大纲 */
export interface ArticleBlueprint {
  workingTitle: string;
  description: string;
  targetWordCount?: number;
  tone?: string;
  targetAudience?: string;
  coverImage?: string;
  phase: ArticlePhase;
  tags: string[];
  outline: OutlineSection[];
  skillId?: string;
  /** 写作风格 ID（v2.0.0 新增，替代 skillId） */
  styleId?: string;
  /** 写作动作 ID（v2.0.0 新增） */
  actionId?: string;
  updatedAt: number;
}

export interface PlanInput {
  inspiration: string;
  tone?: string;
  targetAudience?: string;
  targetWordCount?: number;
  skillId?: string;
  styleId?: string;
  actionId?: string;
  articleDescription?: string;
  prefilledTitle?: string;
  prefilledDescription?: string;
  collectionId?: string;
  planCollectionId?: string;
  projectContext?: string;
  projectName?: string;
  seriesContext?: string;
  linkedFolder?: string;
}

export interface ArticleGenInput {
  title: string;
  description: string;
  outline: OutlineSection[];
  tone?: string;
  targetAudience?: string;
  targetWordCount?: number;
  skillId?: string;
  styleId?: string;
  actionId?: string;
  projectContext?: string;
  projectName?: string;
  seriesContext?: string;
  linkedFolder?: string;
}

export interface SectionWriteInput {
  sectionNumber: string;
  title: string;
  description?: string;
  articleTitle: string;
  articleDescription?: string;
  tone?: string;
  targetWordCount?: number;
  skillId?: string;
  styleId?: string;
  actionId?: string;
  totalSections?: number;
  previousSectionTitle?: string;
  previousSectionContent?: string;
  linkedFolder?: string;
}

export type PlanGenStep =
  | "idle"
  | "title"
  | "description"
  | "outline"
  | "tags"
  | "explored"
  | "stage1-done"
  | "done";

export type PlanStepResult = { step: PlanGenStep; data: unknown };

// ─── 工具函数 ───

let _oid = 0;
function genOutlineId(): string {
  return `sec_${Date.now()}_${_oid++}`;
}

/** 创建默认蓝图 */
export function createDefaultBlueprint(title: string): ArticleBlueprint {
  return {
    workingTitle: title,
    description: "",
    phase: "planning",
    tags: [],
    styleId: "general",
    outline: [
      { id: genOutlineId(), title: "引言", level: 1, description: "用真实场景或问题切入主题", status: "pending" },
      { id: genOutlineId(), title: "核心概念与原理", level: 1, description: "深入讲解核心概念和工作原理", status: "pending" },
      { id: genOutlineId(), title: "实践与应用", level: 1, description: "通过案例展示如何应用所学知识", status: "pending" },
      { id: genOutlineId(), title: "总结与对比", level: 1, description: "总结要点，与市面方案对比分析", status: "pending" },
    ],
    updatedAt: Date.now(),
  };
}

/** 获取阶段中文标签 */
export function getPhaseLabel(phase: ArticlePhase): string {
  switch (phase) {
    case "planning": return "规划中";
    case "writing": return "写作中";
    case "reviewing": return "审校中";
    case "complete": return "已完成";
  }
}

/** 获取下一阶段 */
export function getPhaseNext(phase: ArticlePhase): ArticlePhase | null {
  switch (phase) {
    case "planning": return "writing";
    case "writing": return "reviewing";
    case "reviewing": return "complete";
    case "complete": return null;
  }
}

/** 构建蓝图上下文文本 */
export function buildBlueprintContext(
  blueprint: ArticleBlueprint,
  currentSectionId?: string,
): string {
  const lines: string[] = [];

  if (blueprint.workingTitle) lines.push(`## 文章标题\n${blueprint.workingTitle}`);
  if (blueprint.description) lines.push(`## 文章简介\n${blueprint.description}`);
  if (blueprint.tone) lines.push(`## 语气风格\n${blueprint.tone}`);
  if (blueprint.targetAudience) lines.push(`## 目标读者\n${blueprint.targetAudience}`);
  if (blueprint.targetWordCount) lines.push(`## 目标字数\n${blueprint.targetWordCount} 字`);

  if (blueprint.outline.length > 0) {
    lines.push(`## 文章大纲`);
    const currentSection = currentSectionId
      ? blueprint.outline.find((s) => s.id === currentSectionId)
      : null;

    blueprint.outline.forEach((s, i) => {
      const marker = s.id === currentSectionId ? " ← 当前位置" : "";
      const statusIcon = s.status === "complete" ? "✅" : s.status === "writing" ? "✍️" : s.status === "revised" ? "📝" : "⏳";
      const desc = s.description ? ` — ${s.description}` : "";
      lines.push(`  ${statusIcon} ${"  ".repeat(s.level - 1)}${i + 1}. ${s.title}${desc}${marker}`);
    });
  }

  return lines.join("\n");
}
