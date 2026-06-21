// Editor style templates — complete CSS themes for Markdown rendering
// Each template is a full CSS stylesheet that styles all Markdown elements.
// When exporting/copying, this CSS is used to produce styled HTML.

export interface EditorStyleTemplate {
  id: string;
  name: string;
  builtIn: boolean;
  disabled?: boolean;
  /** Complete CSS stylesheet for Markdown rendering */
  css: string;
  /** Preview description */
  desc: string;
}

// ─── Built-in templates ───

const BUILTIN_TEMPLATES: EditorStyleTemplate[] = [
  {
    id: "default",
    name: "默认",
    builtIn: true,
    desc: "简洁清晰，适合各类写作场景",
    css: `/* 默认主题 */
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif; font-size: 15px; line-height: 1.75; color: #1e1e1e; max-width: 820px; margin: 0 auto; padding: 40px 32px; }
h1 { font-size: 28px; font-weight: 700; margin: 1.2em 0 0.6em; line-height: 1.3; }
h2 { font-size: 22px; font-weight: 700; margin: 1em 0 0.5em; line-height: 1.35; }
h3 { font-size: 18px; font-weight: 650; margin: 1em 0 0.5em; }
h4 { font-size: 15px; font-weight: 650; margin: 0.8em 0 0.4em; }
p { margin: 0 0 1.25em; }
a { color: #0969da; text-decoration: underline; }
blockquote { margin: 1em 0; padding: 0.5em 1em; border-left: 4px solid #d0d7de; color: #656d76; background: #f6f8fa; border-radius: 0 6px 6px 0; }
blockquote p { margin: 0; }
ul, ol { padding-left: 24px; margin: 0.5em 0; }
li { margin-bottom: 0.25em; }
code { font-family: "SF Mono", "Cascadia Code", "JetBrains Mono", "Fira Code", Consolas, monospace; font-size: 0.92em; background: #f0f0f0; padding: 2px 6px; border-radius: 4px; }
pre { background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 8px; padding: 16px; overflow-x: auto; margin: 1em 0; }
pre code { background: transparent; padding: 0; font-size: 13px; }
table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 14px; }
th, td { border: 1px solid #d0d7de; padding: 8px 12px; text-align: left; }
th { background: #f6f8fa; font-weight: 600; }
hr { border: none; border-top: 1px solid #d0d7de; margin: 1.5em 0; }
img { max-width: 100%; border-radius: 6px; margin: 1em 0; }
.task-list-item { list-style: none; }
.task-list-item input[type="checkbox"] { margin-right: 6px; }`,
  },
  {
    id: "github",
    name: "GitHub",
    builtIn: true,
    desc: "GitHub Markdown 风格，开发者熟悉的味道",
    css: `/* GitHub Markdown 主题 */
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"; font-size: 16px; line-height: 1.6; color: #1F2328; max-width: 820px; margin: 0 auto; padding: 40px 32px; }
h1 { font-size: 2em; font-weight: 600; margin: 0.67em 0; padding-bottom: 0.3em; border-bottom: 1px solid #d0d7de; }
h2 { font-size: 1.5em; font-weight: 600; margin: 0.83em 0; padding-bottom: 0.3em; border-bottom: 1px solid #d0d7de; }
h3 { font-size: 1.25em; font-weight: 600; margin: 1em 0 0.5em; }
h4 { font-size: 1em; font-weight: 600; margin: 1em 0 0.5em; }
h5 { font-size: 0.875em; font-weight: 600; margin: 1em 0 0.5em; }
h6 { font-size: 0.85em; font-weight: 600; margin: 1em 0 0.5em; color: #656d76; }
p { margin: 0 0 1em; }
a { color: #0969da; text-decoration: none; }
a:hover { text-decoration: underline; }
blockquote { margin: 1em 0; padding: 0 1em; border-left: 0.25em solid #d0d7de; color: #656d76; }
blockquote p { margin: 0; }
ul, ol { padding-left: 2em; margin: 0 0 1em; }
li { margin-bottom: 0.25em; }
code { font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace; font-size: 0.85em; background: rgba(175,184,193,0.2); padding: 0.2em 0.4em; border-radius: 6px; }
pre { font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace; font-size: 0.85em; background: #f6f8fa; border-radius: 6px; padding: 16px; overflow-x: auto; margin: 1em 0; line-height: 1.45; }
pre code { background: transparent; padding: 0; font-size: inherit; }
table { width: 100%; border-collapse: collapse; margin: 1em 0; }
th, td { border: 1px solid #d0d7de; padding: 6px 13px; text-align: left; }
th { background: #f6f8fa; font-weight: 600; }
tr:nth-child(even) { background: #f6f8fa; }
hr { border: none; border-top: 1px solid #d0d7de; margin: 1.5em 0; }
img { max-width: 100%; border-radius: 6px; }
ul.contains-task-list { padding-left: 0; }
.task-list-item { list-style: none; margin-left: 0; }
.task-list-item input[type="checkbox"] { margin: 0 0.5em 0 0; }`,
  },
  {
    id: "typora-dark",
    name: "Typora 深色",
    builtIn: true,
    desc: "深色护眼，适合夜间写作",
    css: `/* Typora 深色主题 */
body { font-family: "PingFang SC", "Noto Sans SC", "Microsoft YaHei", -apple-system, sans-serif; font-size: 15px; line-height: 1.8; color: #d4d4d4; background: #1e1e1e; max-width: 820px; margin: 0 auto; padding: 40px 32px; }
h1 { font-size: 26px; font-weight: 700; margin: 1.2em 0 0.5em; color: #e0e0e0; }
h2 { font-size: 22px; font-weight: 700; margin: 1em 0 0.5em; color: #e0e0e0; border-bottom: 1px solid #333; padding-bottom: 0.3em; }
h3 { font-size: 18px; font-weight: 650; margin: 1em 0 0.5em; color: #e0e0e0; }
h4 { font-size: 15px; font-weight: 650; margin: 0.8em 0 0.4em; color: #d0d0d0; }
p { margin: 0 0 1.25em; }
a { color: #6cb6ff; text-decoration: underline; }
blockquote { margin: 1em 0; padding: 0.5em 1em; border-left: 4px solid #565656; color: #9a9a9a; background: #2a2a2a; border-radius: 0 6px 6px 0; }
blockquote p { margin: 0; }
ul, ol { padding-left: 24px; margin: 0.5em 0; }
li { margin-bottom: 0.25em; }
code { font-family: "SF Mono", "Cascadia Code", "JetBrains Mono", "Fira Code", Consolas, monospace; font-size: 0.92em; background: #2d2d2d; padding: 2px 6px; border-radius: 4px; color: #ce9178; }
pre { background: #252526; border: 1px solid #333; border-radius: 8px; padding: 16px; overflow-x: auto; margin: 1em 0; }
pre code { background: transparent; padding: 0; font-size: 13px; color: #d4d4d4; }
table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 14px; }
th, td { border: 1px solid #333; padding: 8px 12px; text-align: left; }
th { background: #2a2a2a; font-weight: 600; color: #e0e0e0; }
td { color: #d4d4d4; }
tr:nth-child(even) td { background: #252525; }
hr { border: none; border-top: 1px solid #333; margin: 1.5em 0; }
img { max-width: 100%; border-radius: 6px; filter: brightness(0.9); }
.task-list-item { list-style: none; }
.task-list-item input[type="checkbox"] { margin-right: 6px; filter: invert(0.8); }`,
  },
  {
    id: "academic",
    name: "学术",
    builtIn: true,
    desc: "衬线字体，两端对齐，适合论文与正式文档",
    css: `/* 学术主题 */
body { font-family: "Noto Serif SC", "Source Han Serif SC", STSong, Georgia, "Times New Roman", serif; font-size: 15px; line-height: 1.8; color: #222; max-width: 820px; margin: 0 auto; padding: 48px 40px; }
h1 { font-size: 24px; font-weight: 600; margin: 1.5em 0 0.8em; text-align: center; }
h2 { font-size: 20px; font-weight: 600; margin: 1.2em 0 0.6em; }
h3 { font-size: 17px; font-weight: 600; margin: 1em 0 0.5em; }
h4 { font-size: 15px; font-weight: 600; margin: 0.8em 0 0.4em; }
p { margin: 0 0 1em; text-align: justify; text-indent: 2em; }
a { color: #2563eb; text-decoration: underline; }
blockquote { margin: 1em 0; padding: 0.5em 1.2em; border-left: 3px solid #4b5563; color: #555; background: #f9fafb; border-radius: 0 6px 6px 0; }
blockquote p { margin: 0; text-indent: 0; }
ul, ol { padding-left: 24px; margin: 0.5em 0; }
li { margin-bottom: 0.25em; }
code { font-family: "SF Mono", "Cascadia Code", "JetBrains Mono", Consolas, monospace; font-size: 0.9em; background: #f3f4f6; padding: 2px 6px; border-radius: 3px; }
pre { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 14px 16px; overflow-x: auto; margin: 1em 0; }
pre code { background: transparent; padding: 0; font-size: 13px; }
table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 14px; }
th, td { border: 1px solid #d1d5db; padding: 6px 12px; text-align: left; }
th { background: #f3f4f6; font-weight: 600; }
hr { border: none; border-top: 1px solid #d1d5db; margin: 2em 0; }
img { max-width: 100%; border-radius: 4px; margin: 1em 0; }
.task-list-item { list-style: none; }`,
  },
  {
    id: "minimal",
    name: "极简",
    builtIn: true,
    desc: "大量留白，干净清爽，适合阅读与写作",
    css: `/* 极简主题 */
body { font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif; font-size: 16px; line-height: 2; color: #2c2c2c; max-width: 720px; margin: 0 auto; padding: 48px 24px; }
h1 { font-size: 28px; font-weight: 500; margin: 2em 0 0.8em; letter-spacing: -0.01em; }
h2 { font-size: 22px; font-weight: 500; margin: 1.8em 0 0.6em; letter-spacing: -0.01em; }
h3 { font-size: 18px; font-weight: 500; margin: 1.5em 0 0.5em; }
h4 { font-size: 16px; font-weight: 500; margin: 1.2em 0 0.4em; }
p { margin: 0 0 1.5em; }
a { color: #2563eb; text-decoration: none; font-weight: 500; }
a:hover { text-decoration: underline; }
blockquote { margin: 1.5em 0; padding: 0.5em 1.2em; border-left: 2px solid #cbd5e1; color: #64748b; }
blockquote p { margin: 0; }
ul, ol { padding-left: 24px; margin: 0.5em 0; }
li { margin-bottom: 0.3em; }
code { font-family: "SF Mono", "Cascadia Code", "JetBrains Mono", Consolas, monospace; font-size: 0.9em; background: #f1f5f9; padding: 2px 6px; border-radius: 3px; }
pre { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 16px; overflow-x: auto; margin: 1.5em 0; }
pre code { background: transparent; padding: 0; font-size: 13px; }
table { width: 100%; border-collapse: collapse; margin: 1.5em 0; }
th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; }
th { background: #f8fafc; font-weight: 500; }
hr { border: none; border-top: 1px solid #e2e8f0; margin: 2em 0; }
img { max-width: 100%; border-radius: 4px; margin: 1.5em 0; }
.task-list-item { list-style: none; }`,
  },
];

// ─── Persistence ───

const STORAGE_KEY = "editor-style-templates";
const SELECTED_KEY = "editor-style-template-id";

export function getBuiltinTemplates(): EditorStyleTemplate[] {
  return BUILTIN_TEMPLATES;
}

export function getAllTemplates(): EditorStyleTemplate[] {
  const builtin = BUILTIN_TEMPLATES;
  const custom = loadCustomTemplates();
  const disabledIds = loadDisabledIds();
  const all = [...builtin, ...custom];
  return all.map((t) => ({
    ...t,
    disabled: t.disabled || disabledIds.has(t.id),
  }));
}

function loadDisabledIds(): Set<string> {
  try {
    const raw = localStorage.getItem("editor-style-disabled");
    return new Set<string>(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export function getTemplate(id: string): EditorStyleTemplate | undefined {
  return getAllTemplates().find((t) => t.id === id);
}

export function getSelectedTemplateId(): string {
  try {
    return localStorage.getItem(SELECTED_KEY) || "default";
  } catch {
    return "default";
  }
}

export function getEnabledTemplates(): EditorStyleTemplate[] {
  return getAllTemplates().filter((t) => !t.disabled);
}

export function toggleTemplateEnabled(id: string): void {
  const all = getAllTemplates();
  const t = all.find((t) => t.id === id);
  if (!t) return;
  t.disabled = !t.disabled;
  const customs = all.filter((t) => !t.builtIn);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customs));
  } catch { /* ignore */ }
  const disabledKey = "editor-style-disabled";
  try {
    const disabled = JSON.parse(localStorage.getItem(disabledKey) || "[]");
    const set = new Set<string>(disabled);
    if (t.disabled) set.add(id);
    else set.delete(id);
    localStorage.setItem(disabledKey, JSON.stringify([...set]));
  } catch { /* ignore */ }
}

export function setSelectedTemplateId(id: string): void {
  try {
    localStorage.setItem(SELECTED_KEY, id);
  } catch { /* ignore */ }
}

export function saveCustomTemplate(template: EditorStyleTemplate): void {
  const customs = loadCustomTemplates();
  const idx = customs.findIndex((t) => t.id === template.id);
  if (idx >= 0) {
    customs[idx] = template;
  } else {
    customs.push(template);
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customs));
  } catch { /* ignore */ }
}

export function deleteCustomTemplate(id: string): void {
  const customs = loadCustomTemplates().filter((t) => t.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customs));
  } catch { /* ignore */ }
}

function loadCustomTemplates(): EditorStyleTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const templates: EditorStyleTemplate[] = raw ? JSON.parse(raw) : [];
    // Migrate old object-format css to string format
    return templates.map((t) => {
      if (typeof t.css === "object" && !Array.isArray(t.css)) {
        const obj = t.css as Record<string, string>;
        t.css = Object.entries(obj).map(([k, v]) => `${k}: ${v}`).join(";\n") + ";";
      }
      return t;
    });
  } catch {
    return [];
  }
}

// ─── Temporary style tag injection (for editor preview) ───

let styleTag: HTMLStyleElement | null = null;

export function applyEditorStyle(template: EditorStyleTemplate): void {
  // Create or update a <style> tag that scopes the template CSS to .tiptap
  if (!styleTag) {
    styleTag = document.createElement("style");
    styleTag.id = "editor-template-style";
    document.head.appendChild(styleTag);
  }
  // Scope CSS to .tiptap so it only affects the editor content
  // Replace 'body' with '.tiptap' as the root selector
  const scoped = template.css.replace(/\bbody\b/g, ".tiptap");
  styleTag.textContent = scoped;
}

export function resetEditorStyle(): void {
  if (styleTag) {
    styleTag.remove();
    styleTag = null;
  }
}
