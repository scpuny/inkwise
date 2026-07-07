// editorStyles.ts — Editor style application (slimmed)
// Style application functions extracted from original editorStyles.ts
// Templates moved to editorTemplates.ts
// Re-exports template functions for backward compatibility

import type { EditorStyleTemplate } from "./editorTemplates";
export type { EditorStyleTemplate } from "./editorTemplates";
export { getBuiltinTemplates, getAllTemplates, getTemplate, getSelectedTemplateId, getEnabledTemplates, toggleTemplateEnabled, setSelectedTemplateId, saveCustomTemplate, deleteCustomTemplate } from "./editorTemplates";

let styleTag: HTMLStyleElement | null = null;

export function applyEditorStyle(template: EditorStyleTemplate): void {
  // Create or update a <style> tag that scopes the template CSS to .tiptap
  if (!styleTag) {
    styleTag = document.createElement("style");
    styleTag.id = "editor-template-style";
    document.head.appendChild(styleTag);
  }
  // Scope ALL selectors to .tiptap — prefix each selector group with ".tiptap "
  // while preserving the root body → .tiptap mapping
  const scoped = template.css
    .replace(/\bbody\b(?=\s*\{)/g, ".tiptap")
    .replace(/^\s*([^{}]+?)\s*\{/gm, (match, selectors) => {
      const prefixed = selectors
        .split(",")
        .map((s: string) => {
          const trimmed = s.trim();
          // Already scoped or a pseudo-selector/keyframe
          if (trimmed.startsWith(".tiptap") || trimmed.startsWith("&") || trimmed.startsWith("@") || trimmed.startsWith(":")) return trimmed;
          return ".tiptap " + trimmed;
        })
        .join(", ");
      return " " + prefixed + " {";
    });
  styleTag.textContent = scoped;
}

export function resetEditorStyle(): void {
  if (styleTag) {
    styleTag.remove();
    styleTag = null;
  }
}

// ─── Heading numbering in content (modifies actual markdown) ───

export function addHeadingNumbers(markdown: string): string {
  let h2Count = 0;
  let h3Count = 0;
  return markdown.split('\n').map(line => {
    const match = line.match(/^(#{1,3})\s+(.+)$/);
    if (!match) return line;
    const level = match[1].length;
    const text = match[2];

    // Strip ALL leading numbering (e.g. "1. " or "1. 1. " or "1.1. " etc.)
    const cleanText = text.replace(/^(\d+[.\s]*)+\s*/, '');

    if (level === 1) {
      // h1 (article title) - no numbering
      return '# ' + cleanText;
    }
    if (level === 2) {
      h2Count++;
      h3Count = 0;
      return '## ' + h2Count + '. ' + cleanText;
    }
    // h3 nested under h2: 1.1, 1.2, 2.1 etc.
    if (level === 3) {
      h3Count++;
      return '### ' + h2Count + '.' + h3Count + ' ' + cleanText;
    }
    return line;
  }).join('\n');
}export function stripHeadingNumbers(markdown: string): string {
  return markdown.split('\n').map(line => {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (!match) return line;
    const text = match[2].replace(/^(\d+[.\s]*)+\s*/, '');
    return match[1] + ' ' + text;
  }).join('\n');
}


// ─── Code theme (highlight.js based) ───

export interface CodeTheme {
  id: string;
  name: string;
  desc: string;
  /** CSS for <pre> and <code> background/text colors */
  css: string;
}

const CODE_THEMES: CodeTheme[] = [
  {
    id: "atom-one-light",
    name: "Atom One Light",
    desc: "清爽明亮，适合浅色主题",
    css: `pre { background: #fafafa !important; color: #383a42 !important; }
pre code.hljs { background: #fafafa; color: #383a42; }
.hljs-comment,.hljs-quote{color:#a0a1a7;font-style:italic}
.hljs-doctag,.hljs-keyword,.hljs-formula{color:#a626a4}
.hljs-section,.hljs-name,.hljs-selector-tag,.hljs-deletion,.hljs-subst{color:#e45649}
.hljs-literal{color:#0184bb}
.hljs-string,.hljs-regexp,.hljs-addition,.hljs-attribute,.hljs-meta .hljs-string{color:#50a14f}
.hljs-attr,.hljs-variable,.hljs-template-variable,.hljs-type,.hljs-selector-class,.hljs-selector-attr,.hljs-selector-pseudo,.hljs-number{color:#986801}
.hljs-symbol,.hljs-bullet,.hljs-link,.hljs-meta,.hljs-selector-id,.hljs-title{color:#4078f2}
.hljs-built_in,.hljs-title.class_,.hljs-class .hljs-title{color:#c18401}
.hljs-emphasis{font-style:italic}
.hljs-strong{font-weight:bold}
.hljs-link{text-decoration:underline}`,
  },
  {
    id: "atom-one-dark",
    name: "Atom One Dark",
    desc: "经典深色，护眼耐看",
    css: `pre { background: #282c34 !important; color: #abb2bf !important; }
pre code.hljs { background: #282c34; color: #abb2bf; }
.hljs-comment,.hljs-quote{color:#5c6370;font-style:italic}
.hljs-doctag,.hljs-keyword,.hljs-formula{color:#c678dd}
.hljs-section,.hljs-name,.hljs-selector-tag,.hljs-deletion,.hljs-subst{color:#e06c75}
.hljs-literal{color:#56b6c2}
.hljs-string,.hljs-regexp,.hljs-addition,.hljs-attribute,.hljs-meta .hljs-string{color:#98c379}
.hljs-attr,.hljs-variable,.hljs-template-variable,.hljs-type,.hljs-selector-class,.hljs-selector-attr,.hljs-selector-pseudo,.hljs-number{color:#d19a66}
.hljs-symbol,.hljs-bullet,.hljs-link,.hljs-meta,.hljs-selector-id,.hljs-title{color:#61afef}
.hljs-built_in,.hljs-title.class_,.hljs-class .hljs-title{color:#e5c07b}
.hljs-emphasis{font-style:italic}
.hljs-strong{font-weight:bold}
.hljs-link{text-decoration:underline}`,
  },
  {
    id: "github",
    name: "GitHub",
    desc: "GitHub 官方浅色代码风格",
    css: `pre { background: #f6f8fa !important; color: #1f2328 !important; }
pre code.hljs { background: #f6f8fa; color: #1f2328; }
.hljs-comment,.hljs-quote{color:#656d76;font-style:italic}
.hljs-doctag,.hljs-keyword{color:#cf222e}
.hljs-section,.hljs-name,.hljs-selector-tag,.hljs-deletion,.hljs-subst{color:#953800}
.hljs-literal{color:#0550ae}
.hljs-string,.hljs-regexp,.hljs-addition,.hljs-attribute,.hljs-meta .hljs-string{color:#116329}
.hljs-attr,.hljs-variable,.hljs-template-variable,.hljs-type,.hljs-selector-class,.hljs-selector-attr,.hljs-selector-pseudo,.hljs-number{color:#953800}
.hljs-symbol,.hljs-bullet,.hljs-link,.hljs-meta,.hljs-selector-id,.hljs-title{color:#0550ae}
.hljs-built_in,.hljs-title.class_,.hljs-class .hljs-title{color:#8250df}
.hljs-emphasis{font-style:italic}
.hljs-strong{font-weight:bold}
.hljs-link{text-decoration:underline}`,
  },
  {
    id: "github-dark",
    name: "GitHub Dark",
    desc: "GitHub 官方深色代码风格",
    css: `pre { background: #0d1117 !important; color: #e6edf3 !important; }
pre code.hljs { background: #0d1117; color: #e6edf3; }
.hljs-comment,.hljs-quote{color:#8b949e;font-style:italic}
.hljs-doctag,.hljs-keyword{color:#ff7b72}
.hljs-section,.hljs-name,.hljs-selector-tag,.hljs-deletion,.hljs-subst{color:#ffa198}
.hljs-literal{color:#79c0ff}
.hljs-string,.hljs-regexp,.hljs-addition,.hljs-attribute,.hljs-meta .hljs-string{color:#a5d6ff}
.hljs-attr,.hljs-variable,.hljs-template-variable,.hljs-type,.hljs-selector-class,.hljs-selector-attr,.hljs-selector-pseudo,.hljs-number{color:#d2a8ff}
.hljs-symbol,.hljs-bullet,.hljs-link,.hljs-meta,.hljs-selector-id,.hljs-title{color:#79c0ff}
.hljs-built_in,.hljs-title.class_,.hljs-class .hljs-title{color:#ffa657}
.hljs-emphasis{font-style:italic}
.hljs-strong{font-weight:bold}
.hljs-link{text-decoration:underline}`,
  },
  {
    id: "monokai",
    name: "Monokai",
    desc: "Sublime Text 经典配色",
    css: `pre { background: #272822 !important; color: #f8f8f2 !important; }
pre code.hljs { background: #272822; color: #f8f8f2; }
.hljs-comment,.hljs-quote{color:#75715e}
.hljs-doctag,.hljs-keyword,.hljs-selector-tag,.hljs-literal,.hljs-deletion{color:#f92672}
.hljs-section,.hljs-name,.hljs-selector-id,.hljs-selector-class,.hljs-title,.hljs-template-variable,.hljs-variable{color:#a6e22e}
.hljs-attr,.hljs-number,.hljs-built_in,.hljs-type{color:#ae81ff}
.hljs-string,.hljs-regexp,.hljs-addition,.hljs-attribute{color:#e6db74}
.hljs-symbol,.hljs-bullet{color:#66d9ef}
.hljs-emphasis{font-style:italic}
.hljs-strong{font-weight:bold}
.hljs-link{text-decoration:underline}`,
  },
  {
    id: "vs2015",
    name: "VS2015",
    desc: "Visual Studio 深色代码主题",
    css: `pre { background: #1e1e1e !important; color: #d4d4d4 !important; }
pre code.hljs { background: #1e1e1e; color: #d4d4d4; }
.hljs-comment,.hljs-quote{color:#6a9955;font-style:italic}
.hljs-doctag,.hljs-keyword,.hljs-formula{color:#569cd6}
.hljs-section,.hljs-name,.hljs-selector-tag,.hljs-deletion,.hljs-subst{color:#f44747}
.hljs-literal{color:#569cd6}
.hljs-string,.hljs-regexp,.hljs-addition,.hljs-attribute,.hljs-meta .hljs-string{color:#ce9178}
.hljs-attr,.hljs-variable,.hljs-template-variable,.hljs-type,.hljs-selector-class,.hljs-selector-attr,.hljs-selector-pseudo,.hljs-number{color:#b5cea8}
.hljs-symbol,.hljs-bullet,.hljs-link,.hljs-meta,.hljs-selector-id,.hljs-title{color:#dcdcaa}
.hljs-built_in,.hljs-title.class_,.hljs-class .hljs-title{color:#4ec9b0}
.hljs-emphasis{font-style:italic}
.hljs-strong{font-weight:bold}
.hljs-link{text-decoration:underline}`,
  },
  {
    id: "dracula",
    name: "Dracula",
    desc: "吸血鬼经典暗色主题",
    css: `pre { background: #282a36 !important; color: #f8f8f2 !important; }
pre code.hljs { background: #282a36; color: #f8f8f2; }
.hljs-comment,.hljs-quote{color:#6272a4}
.hljs-doctag,.hljs-keyword,.hljs-formula,.hljs-selector-tag{color:#ff79c6}
.hljs-section,.hljs-name,.hljs-deletion,.hljs-subst{color:#ff5555}
.hljs-literal{color:#8be9fd}
.hljs-string,.hljs-regexp,.hljs-addition,.hljs-attribute,.hljs-meta .hljs-string{color:#f1fa8c}
.hljs-attr,.hljs-variable,.hljs-template-variable,.hljs-type,.hljs-selector-class,.hljs-selector-attr,.hljs-selector-pseudo,.hljs-number{color:#50fa7b}
.hljs-symbol,.hljs-bullet,.hljs-link,.hljs-meta,.hljs-selector-id,.hljs-title{color:#bd93f9}
.hljs-built_in,.hljs-title.class_,.hljs-class .hljs-title{color:#8be9fd}
.hljs-emphasis{font-style:italic}
.hljs-strong{font-weight:bold}
.hljs-link{text-decoration:underline}`,
  },
  {
    id: "nord",
    name: "Nord",
    desc: "北欧极简风格，柔和舒适",
    css: `pre { background: #2e3440 !important; color: #d8dee9 !important; }
pre code.hljs { background: #2e3440; color: #d8dee9; }
.hljs-comment,.hljs-quote{color:#4c566a;font-style:italic}
.hljs-doctag,.hljs-keyword,.hljs-formula{color:#81a1c1}
.hljs-section,.hljs-name,.hljs-selector-tag,.hljs-deletion,.hljs-subst{color:#bf616a}
.hljs-literal{color:#81a1c1}
.hljs-string,.hljs-regexp,.hljs-addition,.hljs-attribute,.hljs-meta .hljs-string{color:#a3be8c}
.hljs-attr,.hljs-variable,.hljs-template-variable,.hljs-type,.hljs-selector-class,.hljs-selector-attr,.hljs-selector-pseudo,.hljs-number{color:#d08770}
.hljs-symbol,.hljs-bullet,.hljs-link,.hljs-meta,.hljs-selector-id,.hljs-title{color:#88c0d0}
.hljs-built_in,.hljs-title.class_,.hljs-class .hljs-title{color:#8fbcbb}
.hljs-emphasis{font-style:italic}
.hljs-strong{font-weight:bold}
.hljs-link{text-decoration:underline}`,
  },
  {
    id: "solarized-light",
    name: "Solarized Light",
    desc: "暖色调护眼浅色主题",
    css: `pre { background: #fdf6e3 !important; color: #586e75 !important; }
pre code.hljs { background: #fdf6e3; color: #586e75; }
.hljs-comment,.hljs-quote{color:#93a1a1;font-style:italic}
.hljs-doctag,.hljs-keyword,.hljs-formula,.hljs-selector-tag{color:#859900}
.hljs-section,.hljs-name,.hljs-deletion,.hljs-subst{color:#dc322f}
.hljs-literal{color:#2aa198}
.hljs-string,.hljs-regexp,.hljs-addition,.hljs-attribute,.hljs-meta .hljs-string{color:#2aa198}
.hljs-attr,.hljs-variable,.hljs-template-variable,.hljs-type,.hljs-selector-class,.hljs-selector-attr,.hljs-selector-pseudo,.hljs-number{color:#cb4b16}
.hljs-symbol,.hljs-bullet,.hljs-link,.hljs-meta,.hljs-selector-id,.hljs-title{color:#268bd2}
.hljs-built_in,.hljs-title.class_,.hljs-class .hljs-title{color:#b58900}
.hljs-emphasis{font-style:italic}
.hljs-strong{font-weight:bold}
.hljs-link{text-decoration:underline}`,
  },
  {
    id: "solarized-dark",
    name: "Solarized Dark",
    desc: "暖色调护眼深色主题",
    css: `pre { background: #002b36 !important; color: #839496 !important; }
pre code.hljs { background: #002b36; color: #839496; }
.hljs-comment,.hljs-quote{color:#586e75;font-style:italic}
.hljs-doctag,.hljs-keyword,.hljs-formula,.hljs-selector-tag{color:#859900}
.hljs-section,.hljs-name,.hljs-deletion,.hljs-subst{color:#dc322f}
.hljs-literal{color:#2aa198}
.hljs-string,.hljs-regexp,.hljs-addition,.hljs-attribute,.hljs-meta .hljs-string{color:#2aa198}
.hljs-attr,.hljs-variable,.hljs-template-variable,.hljs-type,.hljs-selector-class,.hljs-selector-attr,.hljs-selector-pseudo,.hljs-number{color:#cb4b16}
.hljs-symbol,.hljs-bullet,.hljs-link,.hljs-meta,.hljs-selector-id,.hljs-title{color:#268bd2}
.hljs-built_in,.hljs-title.class_,.hljs-class .hljs-title{color:#b58900}
.hljs-emphasis{font-style:italic}
.hljs-strong{font-weight:bold}
.hljs-link{text-decoration:underline}`,
  },
  {
    id: "one-dark-pro",
    name: "One Dark Pro",
    desc: "VSCode 默认深色，清晰护眼",
    css: `pre { background: #1e2127 !important; color: #abb2bf !important; }
pre code.hljs { background: #1e2127; color: #abb2bf; }
.hljs-comment,.hljs-quote{color:#5c6370;font-style:italic}
.hljs-doctag,.hljs-keyword,.hljs-formula{color:#c678dd}
.hljs-section,.hljs-name,.hljs-selector-tag,.hljs-deletion,.hljs-subst{color:#e06c75}
.hljs-literal{color:#56b6c2}
.hljs-string,.hljs-regexp,.hljs-addition,.hljs-attribute,.hljs-meta .hljs-string{color:#98c379}
.hljs-attr,.hljs-variable,.hljs-template-variable,.hljs-type,.hljs-selector-class,.hljs-selector-attr,.hljs-selector-pseudo,.hljs-number{color:#d19a66}
.hljs-symbol,.hljs-bullet,.hljs-link,.hljs-meta,.hljs-selector-id,.hljs-title{color:#61afef}
.hljs-built_in,.hljs-title.class_,.hljs-class .hljs-title{color:#e5c07b}
.hljs-emphasis{font-style:italic}
.hljs-strong{font-weight:bold}
.hljs-link{text-decoration:underline}`,
  },
  {
    id: "tokyo-night",
    name: "Tokyo Night",
    desc: "东京夜景，紫蓝色调炫酷主题",
    css: `pre { background: #1a1b26 !important; color: #a9b1d6 !important; }
pre code.hljs { background: #1a1b26; color: #a9b1d6; }
.hljs-comment,.hljs-quote{color:#565f89;font-style:italic}
.hljs-doctag,.hljs-keyword,.hljs-formula{color:#bb9af7}
.hljs-section,.hljs-name,.hljs-selector-tag,.hljs-deletion,.hljs-subst{color:#f7768e}
.hljs-literal{color:#7dcfff}
.hljs-string,.hljs-regexp,.hljs-addition,.hljs-attribute,.hljs-meta .hljs-string{color:#9ece6a}
.hljs-attr,.hljs-variable,.hljs-template-variable,.hljs-type,.hljs-selector-class,.hljs-selector-attr,.hljs-selector-pseudo,.hljs-number{color:#ff9e64}
.hljs-symbol,.hljs-bullet,.hljs-link,.hljs-meta,.hljs-selector-id,.hljs-title{color:#7aa2f7}
.hljs-built_in,.hljs-title.class_,.hljs-class .hljs-title{color:#e0af68}
.hljs-emphasis{font-style:italic}
.hljs-strong{font-weight:bold}
.hljs-link{text-decoration:underline}`,
  },
  {
    id: "gruvbox-light",
    name: "Gruvbox Light",
    desc: "复古暖黄，仿纸质阅读感",
    css: `pre { background: #fbf1c7 !important; color: #3c3836 !important; }
pre code.hljs { background: #fbf1c7; color: #3c3836; }
.hljs-comment,.hljs-quote{color:#928374;font-style:italic}
.hljs-doctag,.hljs-keyword,.hljs-formula{color:#9d0006}
.hljs-section,.hljs-name,.hljs-selector-tag,.hljs-deletion,.hljs-subst{color:#9d0006}
.hljs-literal{color:#076678}
.hljs-string,.hljs-regexp,.hljs-addition,.hljs-attribute,.hljs-meta .hljs-string{color:#79740e}
.hljs-attr,.hljs-variable,.hljs-template-variable,.hljs-type,.hljs-selector-class,.hljs-selector-attr,.hljs-selector-pseudo,.hljs-number{color:#8f3f71}
.hljs-symbol,.hljs-bullet,.hljs-link,.hljs-meta,.hljs-selector-id,.hljs-title{color:#076678}
.hljs-built_in,.hljs-title.class_,.hljs-class .hljs-title{color:#b57614}
.hljs-emphasis{font-style:italic}
.hljs-strong{font-weight:bold}
.hljs-link{text-decoration:underline}`,
  },
  {
    id: "gruvbox-dark",
    name: "Gruvbox Dark",
    desc: "复古暗色，温暖护眼",
    css: `pre { background: #282828 !important; color: #ebdbb2 !important; }
pre code.hljs { background: #282828; color: #ebdbb2; }
.hljs-comment,.hljs-quote{color:#928374;font-style:italic}
.hljs-doctag,.hljs-keyword,.hljs-formula{color:#fb4934}
.hljs-section,.hljs-name,.hljs-selector-tag,.hljs-deletion,.hljs-subst{color:#fb4934}
.hljs-literal{color:#83a598}
.hljs-string,.hljs-regexp,.hljs-addition,.hljs-attribute,.hljs-meta .hljs-string{color:#b8bb26}
.hljs-attr,.hljs-variable,.hljs-template-variable,.hljs-type,.hljs-selector-class,.hljs-selector-attr,.hljs-selector-pseudo,.hljs-number{color:#d3869b}
.hljs-symbol,.hljs-bullet,.hljs-link,.hljs-meta,.hljs-selector-id,.hljs-title{color:#83a598}
.hljs-built_in,.hljs-title.class_,.hljs-class .hljs-title{color:#fabd2f}
.hljs-emphasis{font-style:italic}
.hljs-strong{font-weight:bold}
.hljs-link{text-decoration:underline}`,
  },
  {
    id: "material-palenight",
    name: "Material Palenight",
    desc: "Material 紫灰色调，优雅耐看",
    css: `pre { background: #292d3e !important; color: #a6accd !important; }
pre code.hljs { background: #292d3e; color: #a6accd; }
.hljs-comment,.hljs-quote{color:#676e95;font-style:italic}
.hljs-doctag,.hljs-keyword,.hljs-formula{color:#c792ea}
.hljs-section,.hljs-name,.hljs-selector-tag,.hljs-deletion,.hljs-subst{color:#f07178}
.hljs-literal{color:#82aaff}
.hljs-string,.hljs-regexp,.hljs-addition,.hljs-attribute,.hljs-meta .hljs-string{color:#c3e88d}
.hljs-attr,.hljs-variable,.hljs-template-variable,.hljs-type,.hljs-selector-class,.hljs-selector-attr,.hljs-selector-pseudo,.hljs-number{color:#f78c6c}
.hljs-symbol,.hljs-bullet,.hljs-link,.hljs-meta,.hljs-selector-id,.hljs-title{color:#82aaff}
.hljs-built_in,.hljs-title.class_,.hljs-class .hljs-title{color:#ffcb6b}
.hljs-emphasis{font-style:italic}
.hljs-strong{font-weight:bold}
.hljs-link{text-decoration:underline}`,
  },
];

const CODE_THEME_STORAGE_KEY = "editor-code-theme-id";

export function getAllCodeThemes(): CodeTheme[] {
  return CODE_THEMES;
}

export function getCodeTheme(id: string): CodeTheme | undefined {
  return CODE_THEMES.find((t) => t.id === id);
}

export function getSelectedCodeThemeId(): string {
  try {
    return localStorage.getItem(CODE_THEME_STORAGE_KEY) || "atom-one-light";
  } catch {
    return "atom-one-light";
  }
}

export function setSelectedCodeTheme(id: string): void {
  try {
    localStorage.setItem(CODE_THEME_STORAGE_KEY, id);
  } catch {
    // ignore
  }
}

export function applyCodeTheme(themeId: string): void {
  const theme = getCodeTheme(themeId);
  if (!theme) return;
  let tag = document.getElementById("editor-code-theme-style") as HTMLStyleElement;
  if (!tag) {
    tag = document.createElement("style");
    tag.id = "editor-code-theme-style";
    document.head.appendChild(tag);
  }
  // Scope code theme CSS to same selector specificity as template CSS,
  // preventing template from overriding code theme colors.
  const scoped = theme.css
    .replace(/^\s*([^{}]+?)\s*\{/gm, (_m: string, sel: string) => {
      return sel
        .split(",")
        .map((s: string) => {
          const t = s.trim();
          if (t.startsWith(".editor-container") || t.startsWith("&") || t.startsWith("@") || t.startsWith(":")) return t;
          return ".editor-container .tiptap " + t;
        })
        .join(", ") + " {";
    });
  tag.textContent = scoped;
}

export function applyTextStyle(firstLineIndent: boolean, justifyAlign: boolean): void {
  let tag = document.getElementById("editor-text-style") as HTMLStyleElement;
  if (!tag) {
    tag = document.createElement("style");
    tag.id = "editor-text-style";
    document.head.appendChild(tag);
  }
  const rules: string[] = [];
  if (firstLineIndent) {
    // > p 直接段落首行缩进，blockquote 引用段落不缩进
    rules.push(`.editor-container .tiptap > p { text-indent: 2em !important; }`);
  }
  if (justifyAlign) {
    // 只对直接段落和引用段落两端对齐，不影响代码块
    rules.push(`.editor-container .tiptap > p, .editor-container .tiptap blockquote p { text-align: justify !important; }`);
  }
  tag.textContent = rules.join("\n");
}

export function applyHeadingDecorations(config: Record<string, string[]>): void {
  let tag = document.getElementById("editor-heading-deco") as HTMLStyleElement;
  if (!tag) {
    tag = document.createElement("style");
    tag.id = "editor-heading-deco";
    document.head.appendChild(tag);
  }
  const entries = Object.entries(config).filter(([, v]) => v.length > 0);
  if (entries.length === 0) {
    tag.textContent = "";
    return;
  }
  const allParts: string[] = [];
  for (const [level, decos] of entries) {
    const sel = `.editor-container .tiptap ${level}`;
    const parts: string[] = [];
    const extraCss: string[] = [];
    if (decos.includes("underline")) parts.push(`border-bottom: 2px solid var(--accent) !important; padding-bottom: 6px;`);
    if (decos.includes("overline")) parts.push(`border-top: 2px solid var(--accent) !important; padding-top: 6px;`);
    if (decos.includes("left-bar")) parts.push(`border-left: 4px solid var(--accent) !important; padding-left: 14px;`);
    if (decos.includes("right-bar")) parts.push(`border-right: 4px solid var(--accent) !important; padding-right: 14px;`);
    if (decos.includes("bg-block")) parts.push(`background: color-mix(in srgb, var(--accent) 12%, transparent) !important; padding: 4px 10px; border-radius: 6px; display: inline-block;`);
    if (decos.includes("left-icon")) {
      parts.push(`position: relative; padding-left: 1.6em;`);
      extraCss.push(`${sel}::before { content: "▎"; position: absolute; left: 0; color: var(--accent); font-size: 1.2em; font-weight: 700; }`);
    }
    if (decos.includes("badge")) parts.push(`background: var(--accent) !important; color: var(--accent-fg, #fff) !important; padding: 2px 12px; border-radius: 12px; display: inline-block; font-size: 0.85em;`);
    if (parts.length > 0) {
      allParts.push(`${sel} { ${parts.join(" ")} }`);
      allParts.push(...extraCss);
    }
  }
  tag.textContent = allParts.length > 0 ? allParts.join("\n") : "";
}

export function applyBgPattern(pattern: string): void {
  let tag = document.getElementById("editor-bg-pattern") as HTMLStyleElement;
  if (!tag) {
    tag = document.createElement("style");
    tag.id = "editor-bg-pattern";
    document.head.appendChild(tag);
  }
  if (!pattern) {
    tag.textContent = "";
    return;
  }
  // Read theme's background color so patterns layer on top correctly
  const themeTag = document.getElementById("editor-article-theme") as HTMLStyleElement;
  let bgColor = "";
  if (themeTag) {
    const match = themeTag.textContent?.match(/background-color:\s*([^!;]+)/);
    if (match) bgColor = match[1].trim();
  }
  const bgRule = bgColor ? `background-color: ${bgColor} !important;` : '';
  const patterns: Record<string, string> = {
    'grid': `.editor-container .tiptap.ProseMirror { ${bgRule} background-image: linear-gradient(90deg, color-mix(in srgb, currentColor 2%, transparent) 1px, transparent 1px), linear-gradient(0deg, color-mix(in srgb, currentColor 2%, transparent) 1px, transparent 1px) !important; background-size: 20px 20px !important; }`,
    'dots': `.editor-container .tiptap.ProseMirror { ${bgRule} background-image: radial-gradient(circle, color-mix(in srgb, currentColor 4%, transparent) 1px, transparent 1px) !important; background-size: 16px 16px !important; }`,
    'stripes': `.editor-container .tiptap.ProseMirror { ${bgRule} background-image: repeating-linear-gradient(45deg, transparent, transparent 10px, color-mix(in srgb, currentColor 1.5%, transparent) 10px, color-mix(in srgb, currentColor 1.5%, transparent) 11px) !important; }`,
  };
  tag.textContent = patterns[pattern] || "";
}

export function applyMacosCodeBlockStyle(enabled: boolean): void {
  let tag = document.getElementById("editor-macos-codeblock-style") as HTMLStyleElement;
  if (!tag) {
    tag = document.createElement("style");
    tag.id = "editor-macos-codeblock-style";
    document.head.appendChild(tag);
  }
  if (!enabled) {
    tag.textContent = "";
    return;
  }
  tag.textContent = `.editor-container .tiptap pre {
  position: relative;
  border-radius: 10px;
  box-shadow: 0 6px 16px rgba(0,0,0,0.18);
  padding-top: 36px !important;
  overflow: hidden;
  margin-top: 1.2em;
  margin-bottom: 1.2em;
}
.editor-container .tiptap pre::before {
  content: "";
  display: block;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 28px;
  background: #2b2b2b;
  border-radius: 10px 10px 0 0;
  z-index: 1;
}
.editor-container .tiptap pre::after {
  content: "";
  position: absolute;
  top: 9px;
  left: 12px;
  width: 40px;
  height: 10px;
  z-index: 2;
  pointer-events: none;
  background:
    radial-gradient(circle at 5px 5px, #ff5f57 5px, transparent 5px),
    radial-gradient(circle at 19px 5px, #ffbd2e 5px, transparent 5px),
    radial-gradient(circle at 33px 5px, #28c840 5px, transparent 5px);
}
.editor-container .tiptap pre .mac-dots {
  display: none !important;
}
`;
}



/* ─── Accent color ─── */
export function applyAccentColor(color: string): void {
  let tag = document.getElementById("editor-accent-color") as HTMLStyleElement;
  if (!tag) {
    tag = document.createElement("style");
    tag.id = "editor-accent-color";
    document.head.appendChild(tag);
  }
  if (!color) {
    tag.textContent = "";
    return;
  }
  tag.textContent = `.editor-container .tiptap .ProseMirror:not(#_) {
  --article-accent: ${color};
  --accent: ${color};
}
/* 行内代码（文字色 + 背景淡色） */
.editor-container .tiptap code:not(pre code) { color: ${color} !important; background: color-mix(in srgb, ${color} 8%, transparent) !important; }
/* 引用块左边框 */
.editor-container .tiptap blockquote { border-left: 4px solid ${color} !important; }
/* 链接 */
.editor-container .tiptap a { color: ${color} !important; text-decoration-color: ${color} !important; }
/* 表格表头 */
.editor-container .tiptap th { background: ${color} !important; color: var(--accent-fg, #fff) !important; }
/* 选中高亮 */
.editor-container .tiptap ::selection { background: color-mix(in srgb, ${color} 30%, transparent) !important; }
/* 代码块装饰点 */
.editor-container .tiptap pre::before { background: ${color} !important; }
/* 加粗文字 */
.editor-container .tiptap strong,
.editor-container .tiptap b { color: ${color} !important; }`;
}

/* ─── Image caption format ─── */
export function applyImageCaptionFormat(format: string): void {
  let tag = document.getElementById("editor-img-caption") as HTMLStyleElement;
  if (!tag) {
    tag = document.createElement("style");
    tag.id = "editor-img-caption";
    document.head.appendChild(tag);
  }
  switch (format) {
    case "none":
      tag.textContent = `.editor-container .tiptap figcaption { display: none !important; }`;
      break;
    case "title":
      tag.textContent = `.editor-container .tiptap figcaption { display: block !important; font-style: normal !important; }
.editor-container .tiptap figcaption img + br + em,
.editor-container .tiptap figcaption em { font-style: normal !important; }`;
      break;
    case "alt":
      tag.textContent = `.editor-container .tiptap figcaption { display: block !important; color: #888 !important; font-size: 0.85em !important; }`;
      break;
    case "filename":
      tag.textContent = `.editor-container .tiptap figcaption { display: block !important; font-family: "SF Mono", Consolas, monospace !important; font-size: 0.8em !important; color: #999 !important; }`;
      break;
    default:
      tag.textContent = `.editor-container .tiptap figcaption { display: block !important; }`;
  }
}

/* ─── Custom CSS ─── */
export function applyCustomCSS(css: string): void {
  let tag = document.getElementById("editor-custom-css") as HTMLStyleElement;
  if (!tag) {
    tag = document.createElement("style");
    tag.id = "editor-custom-css";
    document.head.appendChild(tag);
  }
  tag.textContent = css;
}

/* ─── Per-article style config ─── */

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

export function saveArticleStyleConfig(articleId: string): void {
  const config: ArticleStyleConfig = {
    editorStyleTemplateId: localStorage.getItem('editor-style-template') || 'default',
    lineHeight: parseFloat(localStorage.getItem('editor-line-height') || '1.75'),
    editorFontSize: parseInt(localStorage.getItem('editor-font-size') || '15'),
    editorMaxWidth: parseInt(localStorage.getItem('editor-max-width') || '820'),
    editorParagraphGap: parseFloat(localStorage.getItem('editor-paragraph-gap') || '1.25'),
    editorFontFamily: localStorage.getItem('editor-font-family') || '',
    codeThemeId: localStorage.getItem('code-theme-id') || 'atom-one-light',
    macosCodeBlock: localStorage.getItem('macos-code-block') === 'true',
    firstLineIndent: localStorage.getItem('first-line-indent') === 'true',
    justifyAlign: localStorage.getItem('justify-align') === 'true',
    headingConfig: (() => { try { return JSON.parse(localStorage.getItem("heading-deco-config") || "{}") || {}; } catch { return {}; } })(),
    bgPattern: localStorage.getItem('bg-pattern') || '',
    accentColor: localStorage.getItem('editor-accent-color') || '',
    captionFormat: localStorage.getItem('editor-caption-format') || '',
    customCSS: localStorage.getItem('editor-custom-css') || '',
    articleThemeId: localStorage.getItem('inkwise-selected-article-theme') || 'clean',
  };
  try {
    localStorage.setItem('article-style-config:' + articleId, JSON.stringify(config));
  } catch { /* ignore */ }
}

export function loadArticleStyleConfig(articleId: string): ArticleStyleConfig | null {
  try {
    const raw = localStorage.getItem('article-style-config:' + articleId);
    if (!raw) return null;
    return JSON.parse(raw) as ArticleStyleConfig;
  } catch {
    return null;
  }
}

export function applyArticleStyleConfig(config: ArticleStyleConfig): void {
  localStorage.setItem('editor-style-template', config.editorStyleTemplateId);
  localStorage.setItem('editor-line-height', String(config.lineHeight));
  localStorage.setItem('editor-font-size', String(config.editorFontSize));
  localStorage.setItem('editor-max-width', String(config.editorMaxWidth));
  localStorage.setItem('editor-paragraph-gap', String(config.editorParagraphGap));
  localStorage.setItem('editor-font-family', config.editorFontFamily);
  localStorage.setItem('code-theme-id', config.codeThemeId);
  localStorage.setItem('macos-code-block', String(config.macosCodeBlock));
  localStorage.setItem('first-line-indent', String(config.firstLineIndent));
	  localStorage.setItem('justify-align', String(config.justifyAlign));
  localStorage.setItem("heading-deco-config", JSON.stringify(config.headingConfig));
  localStorage.setItem('editor-accent-color', config.accentColor);
  localStorage.setItem('editor-caption-format', config.captionFormat);
  localStorage.setItem('editor-custom-css', config.customCSS);
	  localStorage.setItem('bg-pattern', config.bgPattern);
  localStorage.setItem('inkwise-selected-article-theme', config.articleThemeId);
  // Apply visual effects immediately
  applyAccentColor(config.accentColor);
  applyImageCaptionFormat(config.captionFormat);
  applyCustomCSS(config.customCSS);
  applyMacosCodeBlockStyle(config.macosCodeBlock);
  applyTextStyle(config.firstLineIndent, config.justifyAlign);
  applyHeadingDecorations(config.headingConfig || {});
  applyBgPattern(config.bgPattern);
}

export function getAllAccentColors(): { label: string; value: string }[] {
  return [
    { label: "经典蓝", value: "#0F4C81" },
    { label: "翡翠绿", value: "#009874" },
    { label: "活力橘", value: "#FA5151" },
    { label: "柠檬黄", value: "#FECE00" },
    { label: "薰衣紫", value: "#92617E" },
    { label: "天空蓝", value: "#55C9EA" },
    { label: "玫瑰金", value: "#B76E79" },
    { label: "橄榄绿", value: "#556B2F" },
    { label: "石墨黑", value: "#333333" },
    { label: "雾烟灰", value: "#A9A9A9" },
    { label: "樱花粉", value: "#FFB7C5" },
  ];
}
