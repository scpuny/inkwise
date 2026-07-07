// ArticleContext.ts — 每篇文章独立的上下文
// 所有文章级别的状态（样式配置、蓝图等）由这个类统一管理。
// 组件通过 React Context 获取当前文章的上下文，所有读写操作都经过这里，
// 不直接操作 localStorage。切换文章时，旧实例被回收，新实例从存储加载。

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

  /** 持久化到存储 */
  save(): void {
    try {
      localStorage.setItem(
        "article-style-config:" + this.articleId,
        JSON.stringify(this._styleConfig),
      );
    } catch { console.warn("[ArticleContext.save] localStorage failed (quota exceeded?)"); }
  }

  // ── private ──

  private _loadStyleConfig(): ArticleStyleConfig {
    return loadArticleStyleConfig(this.articleId) ?? { ...DEFAULT_STYLE_CONFIG };
  }

  private _applyAndSave(): void {
    this.applyStyles();
    this.save();
  }
}

/* ───────────── React Context ───────────── */

/** 当前活动的文章上下文。组件通过 useContext(ArticleCtx) 获取 */
export const ArticleCtx = createContext<ArticleContext | null>(null);
