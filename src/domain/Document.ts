// ─── 文档领域类型 ───
// 纯数据定义，不含业务逻辑

export type ArticlePhase = "planning" | "writing" | "reviewing" | "complete";

export type SectionStatus = "pending" | "writing" | "complete" | "revised";

export interface OutlineSection {
  id: string;
  title: string;
  level: 1 | 2 | 3;
  description?: string;
  targetWordCount?: number;
  status: SectionStatus;
  notes?: string;
}

export interface ArticleStyleConfig {
  editorStyleTemplateId: string;
  lineHeight: number;
  editorFontSize: number;
  editorMaxWidth: number;
  editorParagraphGap: number;
  editorFontFamily: string;
  codeThemeId: string;
  macosCodeBlock: boolean;
  firstLineIndent: boolean;
  justifyAlign: boolean;
  headingConfig: Record<string, string[]>;
  bgPattern: string;
  accentColor: string;
  captionFormat: string;
  customCSS: string;
  articleThemeId: string;
}

export interface PublishRecord {
  id: string;
  articleId: string;
  platform: string;
  platformName?: string;
  platformArticleId?: string;
  status: "draft" | "published" | "failed";
  url?: string;
  publishTime?: number;
  publishedAt: number;
  platformUrl?: string;
  errorMessage?: string;
}

export interface ReviewSuggestion {
  sectionIndex: number;
  original: string;
  suggestion: string;
  accepted: boolean;
  rejected: boolean;
}

export interface ReviewState {
  reviewedAt: number;
  suggestions: ReviewSuggestion[];
  styleId: string;
  actionId: string;
}

export interface ArticleDocument {
  id: string;
  collectionId?: string;
  seriesId?: string;
  title: string;
  content: string;
  source?: "quick-start" | "ai-plan" | "series-plan";
  inspiration?: string;
  styleId: string;
  actionId: string;
  tone?: string;
  targetAudience?: string;
  targetWordCount?: number;
  phase: ArticlePhase;
  outline: OutlineSection[];
  tags: string[];
  styleConfig: ArticleStyleConfig;
  linkedFolder?: string;
  projectContext?: string;
  seriesContext?: string;
  publishRecords: PublishRecord[];
  reviewState?: ReviewState;
  reviewData?: Record<string, unknown>;
  version: number;
  createdAt: number;
  updatedAt: number;
}

/* ─── 默认值 ─── */

export const DEFAULT_STYLE_CONFIG: ArticleStyleConfig = {
  editorStyleTemplateId: "default",
  lineHeight: 1.75,
  editorFontSize: 15,
  editorMaxWidth: 820,
  editorParagraphGap: 1.25,
  editorFontFamily: "",
  codeThemeId: "atom-one-light",
  macosCodeBlock: false,
  firstLineIndent: false,
  justifyAlign: false,
  headingConfig: {},
  bgPattern: "",
  accentColor: "",
  captionFormat: "",
  customCSS: "",
  articleThemeId: "clean",
};

export function createDefaultDocument(
  id: string,
  title: string,
  overrides?: Partial<ArticleDocument>,
): ArticleDocument {
  const now = Date.now();
  return {
    id,
    title,
    content: "",
    styleId: "general",
    actionId: "action-write",
    phase: "planning",
    outline: [],
    tags: [],
    styleConfig: { ...DEFAULT_STYLE_CONFIG },
    publishRecords: [],
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
