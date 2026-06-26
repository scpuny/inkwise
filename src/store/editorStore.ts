// editorStore.ts — 编辑器偏好集中管理（基于 Zustand）
// 替代 App.tsx 中的 editorFormat / editorLineHeight / editorFontSize 等分散 state

import { create } from "zustand";
import {
  loadArticleStyleConfig,
  saveArticleStyleConfig,
  applyArticleStyleConfig,
  type ArticleStyleConfig,
} from "../lib/editor/editorStyles";

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
      // Also apply to document localStorage for backward compat
      applyArticleStyleConfig(config);
    }
  },

  persistToArticle: (articleId: string) => {
    const s = get();
    // Sync current store state to localStorage (used by saveArticleStyleConfig)
    localStorage.setItem("editor-line-height", String(s.lineHeight));
    localStorage.setItem("editor-style-template", s.styleTemplate);
    localStorage.setItem("editor-font-size", String(s.fontSize));
    localStorage.setItem("editor-max-width", String(s.maxWidth));
    localStorage.setItem("editor-paragraph-gap", String(s.paragraphGap));
    localStorage.setItem("editor-font-family", s.fontFamily);
    localStorage.setItem("code-theme-id", s.codeThemeId);
    // Trigger the full save
    saveArticleStyleConfig(articleId);
  },
}));
