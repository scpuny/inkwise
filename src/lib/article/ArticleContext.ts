// ArticleContext.ts — 每篇文章独立的上下文
// 所有文章级别的状态（样式配置等）由这个类统一管理。
// 现在样式配置同时写入 ArticleDocument.styleConfig 以保证统一。
// 仍然保留 localStorage 作为构造时的同步快速加载源。

import { createContext } from "react";
import { emit } from "../events/eventBus";
import {
  type ArticleStyleConfig,
  applyArticleStyleConfig,
  loadArticleStyleConfig,
} from "../editor/editorStyles";

/* ───────────── 默认样式配置 ───────────── */

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

/* ───────────── ArticleContext 类 ───────────── */

export class ArticleContext {
  readonly articleId: string;
  private _styleConfig: ArticleStyleConfig;

  constructor(articleId: string) {
    this.articleId = articleId;
    this._styleConfig = this._loadStyleConfig();
    this.applyStyles();
    emit("article-theme-changed");
  }

  /** 当前文章完整样式配置 */
  get styleConfig(): ArticleStyleConfig {
    return this._styleConfig;
  }

  /** 更新部分样式，立即应用 CSS 并持久化 */
  updateStyle(partial: Partial<ArticleStyleConfig>): void {
    this._styleConfig = { ...this._styleConfig, ...partial };
    this._applyAndSave();
    emit("article-theme-changed");
  }

  /** 将当前样式配置应用到 document */
  applyStyles(): void {
    applyArticleStyleConfig(this._styleConfig);
  }

  /** 持久化到存储（localStorage + ArticleDocument.styleConfig） */
  save(): void {
    // Primary: save to ArticleDocument.styleConfig for unified state
    this._saveToDocument();
    // Fallback: localStorage for backward compat
    try {
      localStorage.setItem(
        "article-style-config:" + this.articleId,
        JSON.stringify(this._styleConfig),
      );
    } catch { console.warn("[ArticleContext.save] localStorage failed (quota exceeded?)"); }
  }

  /** 异步从 ArticleDocument 加载样式配置 */
  static async loadFromDocument(articleId: string): Promise<ArticleStyleConfig | null> {
    try {
      const { loadArticleDocument } = await import("../storage/articleDocument");
      const doc = await loadArticleDocument(articleId);
      if (doc?.styleConfig) return doc.styleConfig;
    } catch { /* ignore */ }
    return null;
  }

  // ── private ──

  private _loadStyleConfig(): ArticleStyleConfig {
    return loadArticleStyleConfig(this.articleId) ?? { ...DEFAULT_STYLE_CONFIG };
  }

  private async _saveToDocument(): Promise<void> {
    try {
      const { loadArticleDocument, saveArticleDocument } = await import("../storage/articleDocument");
      const doc = await loadArticleDocument(this.articleId);
      if (doc) {
        doc.styleConfig = { ...this._styleConfig };
        doc.updatedAt = Date.now();
        await saveArticleDocument(doc);
      }
    } catch { /* ignore — backward compat */ }
  }

  private _applyAndSave(): void {
    this.applyStyles();
    this.save();
  }
}

/* ───────────── React Context ───────────── */

/** 当前活动的文章上下文。组件通过 useContext(ArticleCtx) 获取 */
export const ArticleCtx = createContext<ArticleContext | null>(null);
