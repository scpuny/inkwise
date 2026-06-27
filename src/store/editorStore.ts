// editorStore.ts — 编辑器偏好集中管理（基于 Zustand）
// 替代 App.tsx 中的 editorFormat / editorLineHeight / editorFontSize 等分散 state

import { create } from "zustand";
import {
  loadArticleStyleConfig,
  type ArticleStyleConfig,
} from "../lib/editor/editorStyles";
import { ArticleContext } from "../lib/article/ArticleContext";

/* ───────────── Editor Store ───────────── */

export interface EditorState {
  format: "rich" | "markdown";
  lineHeight: number;
  styleTemplate: string;
  fontSize: number;
  maxWidth: number;
  paragraphGap: number;
  fontFamily: string;
  codeThemeId: string;
  showHeadingNumber: boolean;
}

export interface EditorActions {
  setFormat: (format: "rich" | "markdown") => void;
  setLineHeight: (h: number) => void;
  setStyleTemplate: (t: string) => void;
  setFontSize: (s: number) => void;
  setMaxWidth: (w: number) => void;
  setParagraphGap: (g: number) => void;
  setFontFamily: (f: string) => void;
  setCodeThemeId: (id: string) => void;
  setShowHeadingNumber: (show: boolean) => void;
  loadFromArticle: (articleId: string) => Promise<void>;
  persistToArticle: (articleId: string) => void;
}

export const useEditorStore = create<EditorState & EditorActions>((set, get) => ({
  format: "rich",
  lineHeight: 1.75,
  styleTemplate: "default",
  fontSize: 15,
  maxWidth: 820,
  paragraphGap: 1.25,
  fontFamily: "",
  codeThemeId: "atom-one-light",
  showHeadingNumber: false,

  setFormat: (format) => set({ format }),
  setLineHeight: (lineHeight) => set({ lineHeight }),
  setStyleTemplate: (styleTemplate) => set({ styleTemplate }),
  setFontSize: (fontSize) => set({ fontSize }),
  setMaxWidth: (maxWidth) => set({ maxWidth }),
  setParagraphGap: (paragraphGap) => set({ paragraphGap }),
  setFontFamily: (fontFamily) => set({ fontFamily }),
  setCodeThemeId: (codeThemeId) => set({ codeThemeId }),
  setShowHeadingNumber: (showHeadingNumber) => set({ showHeadingNumber }),

  loadFromArticle: async (articleId: string) => {
    const config = loadArticleStyleConfig(articleId);
    if (config) {
      set({
        lineHeight: config.lineHeight ?? 1.75,
        styleTemplate: config.editorStyleTemplateId ?? "default",
        fontSize: config.editorFontSize ?? 15,
        maxWidth: config.editorMaxWidth ?? 820,
        paragraphGap: config.editorParagraphGap ?? 1.25,
        fontFamily: config.editorFontFamily ?? "",
        codeThemeId: config.codeThemeId ?? "atom-one-light",
      });
    }
  },

  persistToArticle: (articleId: string) => {
    const s = get();
    // 通过 ArticleContext 持久化
    const ctx = new ArticleContext(articleId);
    ctx.updateStyle({
      editorStyleTemplateId: s.styleTemplate,
      lineHeight: s.lineHeight,
      editorFontSize: s.fontSize,
      editorMaxWidth: s.maxWidth,
      editorParagraphGap: s.paragraphGap,
      editorFontFamily: s.fontFamily,
      codeThemeId: s.codeThemeId,
    });
  },
}));
