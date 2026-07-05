// events.ts — 全局事件类型定义
// 所有自定义事件名和 payload 类型集中在此管理
import type { ToolEvent } from "../ai/agentEngine";

export interface OutlineNavigateDetail {
  headingText: string;
}

export interface AutoPlanArticleDetail {
  collectionId: string;
  title: string;
  description: string;
  seriesId?: string;
  seriesTitle?: string;
  seriesDescription?: string;
  tone?: string;
  targetAudience?: string;
  skillId?: string;
  styleId?: string;
  actionId?: string;
  targetWordCount?: number;
}

export interface PlanSeriesArticleDetail {
  collectionId: string;
  seriesId: string;
  article: {
    id: string;
    title: string;
    description?: string;
    targetWordCount?: number;
  };
}

export interface PlanSeriesSavedDetail {
  collectionId: string;
}

export interface PlanSeriesDetail {
  collectionId: string;
}

export interface EditSeriesPlanDetail {
  collectionId: string;
  seriesId?: string;
}

export interface SeriesArticleReviewDetail {
  articleId: string;
  collectionId: string;
  seriesId?: string;
}

export interface BlueprintChangedDetail {
  articleId: string;
}

export interface ContentSavedDetail {
  articleId: string;
  content: string;
}

// ── Project Exploring Events ──

export interface ProjectExploringStartDetail {
  collectionId: string;
  status: "start";
}

export interface ProjectExploringProgressDetail {
  collectionId: string;
  status: "progress";
  toolEvent: ToolEvent;
}

export interface ProjectExploringDoneDetail {
  collectionId: string;
  status: "done" | "error";
  message?: string;
}

// ── Review Complete Event ──

export interface ReviewCompleteDetail {
  articleId: string;
  summary?: string;
}

// ── Image Generation Events ──

export interface ImageGenStartDetail {
  articleId: string;
  total: number;
}

export interface ImageGenProgressDetail {
  articleId: string;
  index: number;
  total: number;
  path: string;
}

export interface ImageGenCompleteDetail {
  articleId: string;
  count: number;
}

export interface ImageGenErrorDetail {
  message: string;
}

export type EventBusKey =
  | "article-theme-changed"
  | "collections-changed"
  | "outline-navigate"
  | "auto-plan-article"
  | "plan-series-saved"
  | "plan-series"
  | "edit-series-plan"
  | "plan-series-article"
  | "series-article-review"
  | "blueprint-changed"
  | "content-saved"
  | "editor-ready"
  | "providers-changed"
  | "reset-plan"
  | "ai-config-changed"
  | "image-gen-start"
  | "image-gen-progress"
  | "image-gen-complete"
  | "image-gen-error"
  | "writing-skill-changed"
  | "project-exploring"
  | "review-complete";

export interface EventBusMap {
  "article-theme-changed": void;
  "collections-changed": void;
  "outline-navigate": OutlineNavigateDetail;
  "auto-plan-article": AutoPlanArticleDetail;
  "plan-series-saved": PlanSeriesSavedDetail;
  "plan-series": PlanSeriesDetail;
  "edit-series-plan": EditSeriesPlanDetail;
  "plan-series-article": PlanSeriesArticleDetail;
  "series-article-review": SeriesArticleReviewDetail;
  "blueprint-changed": BlueprintChangedDetail;
  "content-saved": ContentSavedDetail;
  "editor-ready": void;
  "providers-changed": void;
  "reset-plan": void;
  "ai-config-changed": void;
  "image-gen-start": ImageGenStartDetail;
  "image-gen-progress": ImageGenProgressDetail;
  "image-gen-complete": ImageGenCompleteDetail;
  "image-gen-error": ImageGenErrorDetail;
  "writing-skill-changed": string;
  "project-exploring": ProjectExploringStartDetail | ProjectExploringProgressDetail | ProjectExploringDoneDetail;
  "review-complete": ReviewCompleteDetail;
}
