// articleDocument.ts — 统一文章生命周期上下文
// 每篇文章一个 ArticleDocument，从创建到发布通吃。
// 存储：Tauri → {data_dir}/data/documents/{id}.json | 浏览器 → localStorage

import { isTauriEnv, TauriCommands, tryInvoke } from "../bridge/tauri";
import { emit } from "../events/eventBus";

/* ─── 类型定义 ─── */

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
  headingConfig: Record<string, unknown>;
  bgPattern: string;
  accentColor: string;
  captionFormat: string;
  customCSS: string;
  articleThemeId: string;
}

export interface PublishRecord {
  platform: string;
  platformName: string;
  status: "draft" | "published" | "failed";
  url?: string;
  publishTime?: number;
  errorMessage?: string;
}

export interface ReviewState {
  reviewedAt: number;
  suggestions: ReviewSuggestion[];
  styleId: string;
  actionId: string;
}

export interface ReviewSuggestion {
  sectionIndex: number;
  original: string;
  suggestion: string;
  accepted: boolean;
  rejected: boolean;
}

export interface ArticleDocument {
  // ─── 身份 ───
  id: string;
  collectionId?: string;
  seriesId?: string;

  // ─── 内容 ───
  title: string;
  content: string;

  // ─── 写作参数 ───
  styleId: string;
  actionId: string;
  tone?: string;
  targetAudience?: string;
  targetWordCount?: number;

  // ─── 生命周期 ───
  phase: ArticlePhase;
  outline: OutlineSection[];
  tags: string[];

  // ─── 样式配置 ───
  styleConfig: ArticleStyleConfig;

  // ─── 上下文 ───
  linkedFolder?: string;
  projectContext?: string;
  seriesContext?: string;

  // ─── 发布 ───
  publishRecords: PublishRecord[];

  // ─── 审阅 ───
  reviewState?: ReviewState;

  // ─── 版本 ───
  version: number;
  createdAt: number;
  updatedAt: number;
}

/* ─── 默认值 ─── */

const DEFAULT_STYLE_CONFIG: ArticleStyleConfig = {
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

/* ─── 存储：Tauri 模式 ─── */

const LOCALSTORAGE_PREFIX = "inkwise-doc:";

export async function saveArticleDocument(doc: ArticleDocument): Promise<void> {
  doc.updatedAt = Date.now();
  doc.version += 1;

  if (isTauriEnv()) {
    try {
      await tryInvoke(TauriCommands.SaveArticleDocument, { doc });
      emit("article-document-changed", { articleId: doc.id });
      return;
    } catch (err) {
      console.error("[articleDocument] Tauri save failed, falling back to localStorage:", err);
    }
  }

  // Browser / fallback
  try {
    localStorage.setItem(LOCALSTORAGE_PREFIX + doc.id, JSON.stringify(doc));
  } catch (err) {
    console.error("[articleDocument] localStorage save failed:", err);
    throw err;
  }
  emit("article-document-changed", { articleId: doc.id });
}

export async function loadArticleDocument(id: string): Promise<ArticleDocument | null> {
  if (isTauriEnv()) {
    try {
      const result = await tryInvoke<ArticleDocument | null>(TauriCommands.LoadArticleDocument, { id });
      if (result) return result;
    } catch {
      // not found or error → fallback
    }
  }

  // Browser / fallback
  try {
    const raw = localStorage.getItem(LOCALSTORAGE_PREFIX + id);
    if (raw) {
      const doc = JSON.parse(raw) as ArticleDocument;
      return doc;
    }
  } catch {
    // ignore
  }

  return null;
}

/* ─── 迁移 ─── */

export async function migrateArticleDocument(id: string): Promise<ArticleDocument | null> {
  // 1. 如果已有新格式 doc，直接返回
  const existing = await loadArticleDocument(id);
  if (existing) return existing;

  // 2. 从旧数据重建
  const meta = await loadOldArticleMeta(id);
  const content = await loadOldArticleContent(id);
  const blueprint = await loadOldBlueprint(id);
  const styleConfig = loadOldStyleConfig(id);

  if (!meta && !blueprint) {
    // 没有任何旧数据
    return null;
  }

  const doc = createDefaultDocument(
    id,
    meta?.title || blueprint?.workingTitle || "未命名",
    {
      collectionId: meta?.collectionId,
      content: content || "",
      styleId: blueprint?.styleId || meta?.styleId || "general",
      actionId: blueprint?.actionId || meta?.actionId || "action-write",
      tone: blueprint?.tone,
      targetAudience: blueprint?.targetAudience,
      targetWordCount: blueprint?.targetWordCount,
      phase: blueprint?.phase || "planning",
      outline: blueprint?.outline || [],
      tags: blueprint?.tags || [],
      styleConfig: styleConfig || { ...DEFAULT_STYLE_CONFIG },
      createdAt: meta?.createdAt || Date.now(),
    },
  );

  // 3. 保存迁移后的文档
  await saveArticleDocument(doc);
  return doc;
}

/* ─── 旧数据读取桥接（迁移用） ─── */

interface OldArticleMeta {
  id: string;
  collectionId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  styleId?: string;
  actionId?: string;
}

interface OldBlueprint {
  workingTitle: string;
  description?: string;
  phase?: ArticlePhase;
  outline?: OutlineSection[];
  tags?: string[];
  styleId?: string;
  actionId?: string;
  tone?: string;
  targetAudience?: string;
  targetWordCount?: number;
}

async function loadOldArticleMeta(id: string): Promise<OldArticleMeta | null> {
  if (isTauriEnv()) {
    try {
      return await tryInvoke<OldArticleMeta | null>(TauriCommands.LoadArticleMeta, { id });
    } catch {}
  }
  try {
    const raw = localStorage.getItem("article-meta:" + id);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function loadOldArticleContent(id: string): Promise<string | null> {
  if (isTauriEnv()) {
    try {
      return await tryInvoke<string | null>(TauriCommands.LoadArticle, { id });
    } catch {}
  }
  try {
    return localStorage.getItem("article:" + id);
  } catch {
    return null;
  }
}

async function loadOldBlueprint(id: string): Promise<OldBlueprint | null> {
  if (isTauriEnv()) {
    try {
      return await tryInvoke<OldBlueprint | null>(TauriCommands.LoadArticleBlueprint, { id });
    } catch {}
  }
  try {
    const raw = localStorage.getItem("blueprint:" + id);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function loadOldStyleConfig(id: string): ArticleStyleConfig | null {
  try {
    const raw = localStorage.getItem("article-style-config:" + id);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
