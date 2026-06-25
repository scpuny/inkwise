// articleThemes.ts — 文章渲染主题系统
// 定义文章在导出/分享到各平台时的视觉风格
// 每个平台有多套主题可选，通用主题适用于任何平台

/* ─── 可配置的 CSS 变量项 ─── */
export interface ArticleThemeVars {
  fontFamily: string;       // 正文字体
  fontSize: string;         // 正文字号 (px)
  lineHeight: number;       // 行距
  paragraphGap: string;     // 段落间距 (em)
  maxWidth: string;         // 内容最大宽度 (px)
  textColor: string;        // 正文颜色
  bgColor: string;          // 背景色
  headingColor: string;     // 标题颜色
  linkColor: string;        // 链接颜色
  codeBg: string;           // 代码块背景
  codeText: string;         // 代码块文字颜色
  blockquoteBorder: string; // 引用块边框色
  blockquoteBg: string;     // 引用块背景
}

/* ─── 主题定义 ─── */
export interface ArticleTheme {
  id: string;
  label: string;            // 显示名称
  desc: string;             // 简短描述
  platform: string;         // 目标平台
  tags: string[];           // 风格标签
  vars: ArticleThemeVars;   // CSS 变量值
}

/* ─── 平台定义 ─── */
export interface PlatformGroup {
  id: string;
  label: string;
  icon: string;
}

export const PLATFORMS: PlatformGroup[] = [
  { id: "general", label: "通用", icon: "📄" },
  { id: "wechat", label: "微信公众号", icon: "💬" },
  { id: "zhihu", label: "知乎", icon: "🟦" },
  { id: "toutiao", label: "今日头条", icon: "📰" },
  { id: "medium", label: "Medium", icon: "✍️" },
  { id: "jianshu", label: "简书", icon: "📝" },
  { id: "csdn", label: "CSDN", icon: "💻" },
];

/* ─── 默认变量 ─── */
const BASE_VARS: ArticleThemeVars = {
  fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
  fontSize: '16',
  lineHeight: 1.75,
  paragraphGap: '1.25',
  maxWidth: '780',
  textColor: '#2c2c2c',
  bgColor: '#ffffff',
  headingColor: '#111111',
  linkColor: '#1a73e8',
  codeBg: '#f5f5f5',
  codeText: '#333333',
  blockquoteBorder: '#dfe1e5',
  blockquoteBg: '#f8f9fa',
};

/* ─── 预设主题 ─── */
export const ARTICLE_THEMES: ArticleTheme[] = [
  // ═══ 通用 ═══
  {
    id: 'clean',
    label: '极简白',
    desc: '最高可读性，无彩色干扰',
    platform: 'general',
    tags: ['简约', '通用'],
    vars: { ...BASE_VARS },
  },
  {
    id: 'paper',
    label: '纸墨',
    desc: '暖色底色，仿纸张质感',
    platform: 'general',
    tags: ['暖色', '阅读'],
    vars: { ...BASE_VARS, bgColor: '#faf8f5', textColor: '#3a3a3a', blockquoteBg: '#f5f0eb' },
  },
  {
    id: 'night',
    label: '暗色护眼',
    desc: '深色背景，适合夜间阅读',
    platform: 'general',
    tags: ['暗色', '护眼'],
    vars: { ...BASE_VARS, bgColor: '#1a1a2e', textColor: '#e0e0e0', headingColor: '#ffffff', codeBg: '#16213e', codeText: '#e0e0e0', blockquoteBg: '#16213e', blockquoteBorder: '#4a4a6a' },
  },
  {
    id: 'elegant',
    label: '典雅',
    desc: '衬线字体，传统排版',
    platform: 'general',
    tags: ['衬线', '正式'],
    vars: { ...BASE_VARS, fontFamily: '"Noto Serif SC", "Source Han Serif SC", Georgia, serif', fontSize: '17', lineHeight: 1.9 },
  },
  {
    id: 'modern',
    label: '现代',
    desc: '无衬线字体，干净利落',
    platform: 'general',
    tags: ['无衬线', '商务'],
    vars: { ...BASE_VARS, fontFamily: '-apple-system, "PingFang SC", "Noto Sans SC", sans-serif', maxWidth: '800' },
  },

  // ═══ 微信 ═══
  {
    id: 'wechat-default',
    label: '微信默认',
    desc: '窄版大字号，经典微信风格',
    platform: 'wechat',
    tags: ['默认', '窄版'],
    vars: { ...BASE_VARS, fontFamily: '"PingFang SC", "Microsoft YaHei", "Helvetica Neue", sans-serif', fontSize: '17', lineHeight: 1.8, paragraphGap: '1.4', maxWidth: '660', linkColor: '#576b95', codeBg: '#f0f0f0' },
  },
  {
    id: 'wechat-novel',
    label: '微信小说',
    desc: '宽行距，适合长文阅读',
    platform: 'wechat',
    tags: ['长文', '舒适'],
    vars: { ...BASE_VARS, fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif', fontSize: '17', lineHeight: 2.0, paragraphGap: '1.6', maxWidth: '660', textColor: '#3a3a3a', blockquoteBg: '#f5f5f5' },
  },
  {
    id: 'wechat-card',
    label: '微信卡片',
    desc: '圆角卡片，图文并茂',
    platform: 'wechat',
    tags: ['卡片', '图文'],
    vars: { ...BASE_VARS, fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif', fontSize: '16', lineHeight: 1.75, maxWidth: '640', bgColor: '#f5f5f5', blockquoteBg: '#ffffff', codeBg: '#ffffff' },
  },

  // ═══ 知乎 ═══
  {
    id: 'zhihu-default',
    label: '知乎默认',
    desc: '蓝链风格，阅读舒适',
    platform: 'zhihu',
    tags: ['默认', '蓝色'],
    vars: { ...BASE_VARS, fontFamily: '"PingFang SC", "Microsoft YaHei", Arial, sans-serif', fontSize: '15', lineHeight: 1.7, maxWidth: '768', linkColor: '#056de8', blockquoteBorder: '#056de8', blockquoteBg: '#f0f7ff' },
  },
  {
    id: 'zhihu-essay',
    label: '知乎专栏',
    desc: '大留白，适合深度文章',
    platform: 'zhihu',
    tags: ['留白', '深度'],
    vars: { ...BASE_VARS, fontFamily: '"PingFang SC", "Microsoft YaHei", Arial, sans-serif', fontSize: '16', lineHeight: 1.8, paragraphGap: '1.5', maxWidth: '720', linkColor: '#056de8' },
  },
  {
    id: 'zhihu-dark',
    label: '知乎暗色',
    desc: '深色版知乎风格',
    platform: 'zhihu',
    tags: ['暗色', '护眼'],
    vars: { ...BASE_VARS, bgColor: '#1e1e1e', textColor: '#d0d0d0', headingColor: '#ffffff', linkColor: '#58a6ff', codeBg: '#2d2d2d', codeText: '#d0d0d0', blockquoteBorder: '#58a6ff', blockquoteBg: '#1a2332' },
  },

  // ═══ 今日头条 ═══
  {
    id: 'toutiao-default',
    label: '头条默认',
    desc: '大标题短段落，强对比',
    platform: 'toutiao',
    tags: ['醒目', '强对比'],
    vars: { ...BASE_VARS, fontSize: '18', lineHeight: 1.6, paragraphGap: '1.0', maxWidth: '720', headingColor: '#cc0000', linkColor: '#cc0000', blockquoteBorder: '#cc0000', blockquoteBg: '#fff5f5' },
  },
  {
    id: 'toutiao-hot',
    label: '头条热文',
    desc: '红色强调，突出爆点',
    platform: 'toutiao',
    tags: ['热文', '红色'],
    vars: { ...BASE_VARS, fontSize: '18', lineHeight: 1.65, maxWidth: '720', headingColor: '#e60012', linkColor: '#e60012', blockquoteBorder: '#e60012', blockquoteBg: '#fff0f0', textColor: '#1a1a1a' },
  },

  // ═══ Medium ═══
  {
    id: 'medium-default',
    label: 'Medium 经典',
    desc: '衬线字体，极简阅读',
    platform: 'medium',
    tags: ['衬线', '极简'],
    vars: { ...BASE_VARS, fontFamily: '"Georgia", "Noto Serif SC", serif', fontSize: '18', lineHeight: 1.8, paragraphGap: '1.5', maxWidth: '740', linkColor: '#1a8917', codeBg: '#f4f4f4', blockquoteBorder: '#d0d0d0', blockquoteBg: '#f9f9f9' },
  },
  {
    id: 'medium-sans',
    label: 'Medium 无衬线',
    desc: '无衬线版 Medium 风格',
    platform: 'medium',
    tags: ['无衬线', '现代'],
    vars: { ...BASE_VARS, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', fontSize: '17', lineHeight: 1.75, maxWidth: '740', linkColor: '#1a8917', codeBg: '#f4f4f4' },
  },

  // ═══ 简书 ═══
  {
    id: 'jianshu-default',
    label: '简书默认',
    desc: '暖灰底色，舒适阅读',
    platform: 'jianshu',
    tags: ['暖色', '舒适'],
    vars: { ...BASE_VARS, fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif', fontSize: '16', lineHeight: 1.75, maxWidth: '760', bgColor: '#f7f7f7', textColor: '#404040', linkColor: '#3194d0', blockquoteBorder: '#d0d0d0', blockquoteBg: '#f0f0f0' },
  },

  // ═══ CSDN ═══
  {
    id: 'csdn-default',
    label: 'CSDN 默认',
    desc: '技术博客风格，代码友好',
    platform: 'csdn',
    tags: ['技术', '代码'],
    vars: { ...BASE_VARS, fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif', fontSize: '15', lineHeight: 1.65, maxWidth: '860', linkColor: '#c00000', codeBg: '#f5f5f5', codeText: '#c7254e', blockquoteBorder: '#c00000', blockquoteBg: '#fff5f5' },
  },
  {
    id: 'csdn-dark',
    label: 'CSDN 暗色',
    desc: '深色技术博客风格',
    platform: 'csdn',
    tags: ['暗色', '技术'],
    vars: { ...BASE_VARS, bgColor: '#1d1d1d', textColor: '#cccccc', headingColor: '#e0e0e0', linkColor: '#ff6b6b', codeBg: '#2b2b2b', codeText: '#ff6b6b', blockquoteBorder: '#ff6b6b', blockquoteBg: '#2a1a1a', maxWidth: '860' },
  },
  // ═══ 今日头条 ═══
  {
    id: 'toutiao-dark',
    label: '头条暗色',
    desc: '深色版今日头条风格',
    platform: 'toutiao',
    tags: ['暗色', '醒目'],
    vars: { ...BASE_VARS, bgColor: '#1a1a1a', textColor: '#d4d4d4', headingColor: '#ff4444', linkColor: '#ff4444', fontSize: '18', lineHeight: 1.6, maxWidth: '720', codeBg: '#2a2a2a', codeText: '#ff6b6b', blockquoteBorder: '#ff4444', blockquoteBg: '#221111' },
  },

  // ═══ Medium ═══
  {
    id: 'medium-dark',
    label: 'Medium 暗色',
    desc: '深色版 Medium 阅读体验',
    platform: 'medium',
    tags: ['暗色', '衬线'],
    vars: { ...BASE_VARS, fontFamily: '"Georgia", "Noto Serif SC", serif', fontSize: '18', lineHeight: 1.8, paragraphGap: '1.5', maxWidth: '740', bgColor: '#121212', textColor: '#d4d4d4', headingColor: '#ffffff', linkColor: '#3ea660', codeBg: '#1e1e1e', codeText: '#d4d4d4', blockquoteBorder: '#333333', blockquoteBg: '#1a1a1a' },
  },

  // ═══ 简书 ═══
  {
    id: 'jianshu-dark',
    label: '简书暗色',
    desc: '深色版简书风格',
    platform: 'jianshu',
    tags: ['暗色', '舒适'],
    vars: { ...BASE_VARS, fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif', fontSize: '16', lineHeight: 1.75, maxWidth: '760', bgColor: '#1c1c1c', textColor: '#cfcfcf', headingColor: '#f0f0f0', linkColor: '#58a6ff', codeBg: '#2a2a2a', codeText: '#e0e0e0', blockquoteBorder: '#444444', blockquoteBg: '#252525' },
  },
  {
    id: 'jianshu-minimal',
    label: '简书极简',
    desc: '纯白底色，干净清爽',
    platform: 'jianshu',
    tags: ['简约', '干净'],
    vars: { ...BASE_VARS, fontFamily: '-apple-system, "PingFang SC", sans-serif', fontSize: '16', lineHeight: 1.8, maxWidth: '740', bgColor: '#ffffff', textColor: '#333333', linkColor: '#3194d0', codeBg: '#f8f8f8', blockquoteBorder: '#e0e0e0', blockquoteBg: '#fafafa' },
  },

  // ═══ 微信 ═══
  {
    id: 'wechat-grace',
    label: '微信优雅',
    desc: '精致微信排版，带阴影圆角',
    platform: 'wechat',
    tags: ['精致', '优雅'],
    vars: { ...BASE_VARS, fontFamily: '"Optima-Regular", "PingFang SC", "Noto Serif SC", serif', fontSize: '16', lineHeight: 1.85, paragraphGap: '1.3', maxWidth: '660', textColor: '#3a3a3a', linkColor: '#8b7cff', codeBg: '#f3eefb', codeText: '#6b4fa0', blockquoteBorder: '#8b7cff', blockquoteBg: '#f8f6ff' },
  },
  {
    id: 'wechat-simple',
    label: '微信简洁',
    desc: '极简微信排版，清爽干净',
    platform: 'wechat',
    tags: ['简约', '干净'],
    vars: { ...BASE_VARS, fontFamily: '-apple-system, "PingFang SC", sans-serif', fontSize: '16', lineHeight: 1.75, paragraphGap: '1.2', maxWidth: '660', textColor: '#2c2c2c', linkColor: '#4a90d9', codeBg: '#f5f5f5', codeText: '#555555', blockquoteBorder: '#d0d0d0', blockquoteBg: '#f9fafb' },
  },

];

/* ─── 自定义主题存储 ─── */
const CUSTOM_THEMES_KEY = 'aiwriter-custom-article-themes';
const SELECTED_THEME_KEY = 'aiwriter-selected-article-theme';

export function getSelectedArticleThemeId(): string {
  try {
    return localStorage.getItem(SELECTED_THEME_KEY) || 'clean';
  } catch {
    return 'clean';
  }
}

export function setSelectedArticleThemeId(id: string): void {
  try {
    localStorage.setItem(SELECTED_THEME_KEY, id);
  } catch {}
}

export function loadCustomThemes(): ArticleTheme[] {
  try {
    const raw = localStorage.getItem(CUSTOM_THEMES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCustomThemes(themes: ArticleTheme[]): void {
  try {
    localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(themes));
  } catch {}
}

export function getThemesByPlatform(platformId: string): ArticleTheme[] {
  return getAllThemes().filter(t => t.platform === platformId);
}

export function getPlatformsWithThemes(): PlatformGroup[] {
  const themes = getAllThemes();
  const platforms = PLATFORMS.filter(p => themes.some(t => t.platform === p.id));
  return platforms;
}

export function getAllThemes(): ArticleTheme[] {
  const presets = [...ARTICLE_THEMES];
  const customs = loadCustomThemes();
  const presetIds = new Set(presets.map(t => t.id));
  const merged = [...presets];
  for (const ct of customs) {
    const existing = merged.findIndex(t => t.id === ct.id);
    if (existing >= 0) merged[existing] = ct;
    else merged.push(ct);
  }
  return merged;
}

export function getThemeById(id: string): ArticleTheme | undefined {
  return getAllThemes().find(t => t.id === id);
}

export function isPresetTheme(id: string): boolean {
  return ARTICLE_THEMES.some(t => t.id === id);
}

/* ─── 生成内联 CSS ─── */
export function buildThemeCss(vars: ArticleThemeVars): string {
  return `:root {
  --article-font-family: ${vars.fontFamily};
  --article-font-size: ${vars.fontSize}px;
  --article-line-height: ${vars.lineHeight};
  --article-paragraph-gap: ${vars.paragraphGap}em;
  --article-max-width: ${vars.maxWidth}px;
  --article-text-color: ${vars.textColor};
  --article-bg-color: ${vars.bgColor};
  --article-heading-color: ${vars.headingColor};
  --article-link-color: ${vars.linkColor};
  --article-code-bg: ${vars.codeBg};
  --article-code-text: ${vars.codeText};
  --article-blockquote-border: ${vars.blockquoteBorder};
  --article-blockquote-bg: ${vars.blockquoteBg};
}

.article-body {
  font-family: var(--article-font-family);
  font-size: var(--article-font-size);
  line-height: var(--article-line-height);
  color: var(--article-text-color);
  background: var(--article-bg-color);
  max-width: var(--article-max-width);
  margin: 0 auto;
  padding: 20px;
}

.article-body h1, .article-body h2, .article-body h3,
.article-body h4, .article-body h5, .article-body h6 {
  color: var(--article-heading-color);
  margin: 1.2em 0 0.5em;
  line-height: 1.3;
}
.article-body strong { color: var(--article-heading-color); }

.article-body p { margin: 0 0 var(--article-paragraph-gap); }
.article-body a { color: var(--article-link-color); }

.article-body code, .article-body pre {
  background: var(--article-code-bg);
  color: var(--article-code-text);
  border-radius: 4px;
}

.article-body code { padding: 2px 6px; font-size: 0.9em; }
.article-body pre { padding: 12px 16px; overflow-x: auto; }
.article-body pre code { padding: 0; background: none; }

.article-body blockquote {
  border-left: 3px solid var(--article-blockquote-border);
  background: var(--article-blockquote-bg);
  margin: 1em 0;
  padding: 8px 16px;
  border-radius: 0 4px 4px 0;
}

.article-body ul, .article-body ol { padding-left: 1.5em; margin: 0.5em 0; }
.article-body li { margin: 0.3em 0; }
.article-body img { max-width: 100%; height: auto; border-radius: 6px; margin: 1em 0; }
.article-body hr { border: none; border-top: 1px solid #e0e0e0; margin: 2em 0; }

.article-body table { border-collapse: collapse; width: 100%; margin: 1em 0; }
.article-body th, .article-body td { border: 1px solid #e0e0e0; padding: 8px 12px; text-align: left; }
.article-body th { background: var(--article-code-bg); font-weight: 600; }
`;
}

/* ─── 生成完整可分享 HTML ─── */
export function buildShareableHtml(content: string, title: string, vars: ArticleThemeVars): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>${buildThemeCss(vars)}</style></head>
<body style="margin:0;background:${vars.bgColor}">
<div class="article-body">${content}</div>
</body></html>`;
}

/* ─── 生成编辑器适用的主题 CSS（覆盖 editorContainer 作用域） ─── */
export function buildEditorThemeCss(vars: ArticleThemeVars): string {
  return `.editor-container .tiptap {
  font-family: ${vars.fontFamily} !important;
  color: ${vars.textColor} !important;
  background-color: ${vars.bgColor} !important;
}
.editor-container .tiptap h1,
.editor-container .tiptap h2,
.editor-container .tiptap h3,
.editor-container .tiptap h4,
.editor-container .tiptap h5,
.editor-container .tiptap h6 {
  color: ${vars.headingColor} !important;
  line-height: 1.3 !important;
  margin: 1.2em 0 0.5em !important;
}
.editor-container .tiptap strong {
  color: ${vars.headingColor} !important;
}
.editor-container .tiptap a { color: ${vars.linkColor} !important; }
.editor-container .tiptap code, .editor-container .tiptap pre {
  background: ${vars.codeBg} !important;
  color: ${vars.codeText} !important;
}
.editor-container .tiptap blockquote {
  border-left-color: ${vars.blockquoteBorder} !important;
  background: ${vars.blockquoteBg} !important;
  color: ${vars.textColor} !important;
}
.editor-container .tiptap ul, .editor-container .tiptap ol { padding-left: 1.5em !important; margin: 0.5em 0 !important; }
.editor-container .tiptap li { margin: 0.3em 0 !important; }
.editor-container .tiptap img { max-width: 100% !important; height: auto !important; border-radius: 6px !important; margin: 1em 0 !important; }
.editor-container .tiptap hr { border: none !important; border-top: 1px solid ${vars.blockquoteBorder} !important; margin: 2em 0 !important; }
.editor-container .tiptap table { border-collapse: collapse !important; width: 100% !important; margin: 1em 0 !important; }
.editor-container .tiptap th, .editor-container .tiptap td { border: 1px solid ${vars.blockquoteBorder} !important; padding: 8px 12px !important; text-align: left !important; }
.editor-container .tiptap th { background: ${vars.codeBg} !important; font-weight: 600 !important; }
`;
}
