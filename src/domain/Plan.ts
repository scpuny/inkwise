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
