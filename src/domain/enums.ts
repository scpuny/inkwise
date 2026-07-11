// ─── 枚举与常量（零魔法字符串） ───
// 所有 const 枚举集中在此，前端各处引用枚举而非字面量

/** 文章生命周期阶段 */
export const enum DocumentPhase {
  PLANNING = "planning",
  WRITING = "writing",
  REVIEWING = "reviewing",
  COMPLETE = "complete",
}

/** AI 生成阶段 */
export const enum Phase {
  TITLE = "title",
  DESCRIPTION = "description",
  OUTLINE = "outline",
  TAGS = "tags",
  WRITING = "writing",
}

/** 规划步骤 */
export const enum PlanStep {
  IDLE = "idle",
  EXPLORED = "explored",
  TITLE = "title",
  DESCRIPTION = "description",
  OUTLINE = "outline",
  TAGS = "tags",
  STAGE1_DONE = "stage1-done",
  DONE = "done",
}

/** UI 规划状态 */
export const enum PlanState {
  IDLE = "idle",
  PLANNING = "planning",
  REVIEW_TITLE_DESC = "review-title-desc",
  REVIEW = "review",
  WRITING = "writing",
  ARTICLE_REVIEW = "article-review",
}

/** 事件名（集中管理，防拼错） */
export const enum EventName {
  COLLECTIONS_CHANGED = "collections-changed",
  ARTICLE_DOCUMENT_CHANGED = "article-document-changed",
  ARTICLE_THEME_CHANGED = "article-theme-changed",
  CONTENT_SAVED = "content-saved",
  BLUEPRINT_CHANGED = "blueprint-changed",
}

/** 文章来源 */
export const enum DocumentSource {
  QUICK_START = "quick-start",
  AI_PLAN = "ai-plan",
  SERIES_PLAN = "series-plan",
}

/** 默认值 */
export const DEFAULTS = {
  STYLE_ID: "general",
  ACTION_ID: "action-write",
  MAX_TOKENS: 1024,
  TEMPERATURE: 0.7,
} as const;
