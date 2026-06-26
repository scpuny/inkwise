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
  // 增强视觉
  accentColor?: string;     // 强调色（引用块/装饰元素）
  strongColor?: string;     // 加粗文字色，缺省用 headingColor
  markBg?: string;          // ==高亮== 背景色
  hrColor?: string;         // 分割线颜色，缺省用 #e0e0e0
  pageBg?: string;          // 整页背景（可渐变/图案），缺省用 bgColor
  pageBgSize?: string;      // 背景尺寸
  // 标题变体
  headingVariant?: 'ribbon';  // 标题视觉结构
  headingBg?: string;         // 标题块背景
  headingText?: string;       // 标题块文字色，缺省用 #ffffff
  headingLine?: string;       // 标题底线色，缺省用 accentColor
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
    vars: { ...BASE_VARS ,
    accentColor: '#1a73e8',
    strongColor: '#111111',
    markBg: '#e8f0fe',
    hrColor: '#d0d7de',},
  },
  {
    id: 'paper',
    label: '纸墨',
    desc: '暖色底色，仿纸张质感',
    platform: 'general',
    tags: ['暖色', '阅读'],
    vars: { ...BASE_VARS, bgColor: '#faf8f5', textColor: '#3a3a3a', blockquoteBg: '#f5f0eb' ,
    accentColor: '#b08968',
    strongColor: '#5a4a3a',
    markBg: '#f0e3cc',
    hrColor: '#d7c19a',},
  },
  {
    id: 'night',
    label: '暗色护眼',
    desc: '深色背景，适合夜间阅读',
    platform: 'general',
    tags: ['暗色', '护眼'],
    vars: { ...BASE_VARS, bgColor: '#1a1a2e', textColor: '#e0e0e0', headingColor: '#ffffff', codeBg: '#16213e', codeText: '#e0e0e0', blockquoteBg: '#16213e', blockquoteBorder: '#4a4a6a' ,
    accentColor: '#7c8cff',
    strongColor: '#ffffff',
    markBg: '#1f2a55',
    hrColor: '#2f3763',},
  },
  {
    id: 'elegant',
    label: '典雅',
    desc: '衬线字体，传统排版',
    platform: 'general',
    tags: ['衬线', '正式'],
    vars: { ...BASE_VARS, fontFamily: '"Noto Serif SC", "Source Han Serif SC", Georgia, serif', fontSize: '17', lineHeight: 1.9 ,
    accentColor: '#b08968',
    strongColor: '#8a5a36',
    markBg: '#f6e6cf',
    hrColor: '#d7c19a',},
  },
  {
    id: 'modern',
    label: '现代',
    desc: '无衬线字体，干净利落',
    platform: 'general',
    tags: ['无衬线', '商务'],
    vars: { ...BASE_VARS, fontFamily: '-apple-system, "PingFang SC", "Noto Sans SC", sans-serif', maxWidth: '800' ,
    accentColor: '#2d8cf0',
    strongColor: '#1a1a1a',
    markBg: '#dcedff',
    hrColor: '#d0d7de',},
  },

  // ═══ 微信 ═══
  {
    id: 'wechat-default',
    label: '微信默认',
    desc: '窄版大字号，经典微信风格',
    platform: 'wechat',
    tags: ['默认', '窄版'],
    vars: { ...BASE_VARS, fontFamily: '"PingFang SC", "Microsoft YaHei", "Helvetica Neue", sans-serif', fontSize: '17', lineHeight: 1.8, paragraphGap: '1.4', maxWidth: '660', linkColor: '#576b95', codeBg: '#f0f0f0' ,
    accentColor: '#576b95',
    strongColor: '#1a1a1a',
    markBg: '#e8f0fe',
    hrColor: '#d0d7de',},
  },
  {
    id: 'wechat-novel',
    label: '微信小说',
    desc: '宽行距，适合长文阅读',
    platform: 'wechat',
    tags: ['长文', '舒适'],
    vars: { ...BASE_VARS, fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif', fontSize: '17', lineHeight: 2.0, paragraphGap: '1.6', maxWidth: '660', textColor: '#3a3a3a', blockquoteBg: '#f5f5f5' ,
    accentColor: '#576b95',
    strongColor: '#3a3a3a',
    markBg: '#e8f0fe',
    hrColor: '#d0d7de',},
  },
  {
    id: 'wechat-card',
    label: '微信卡片',
    desc: '圆角卡片，图文并茂',
    platform: 'wechat',
    tags: ['卡片', '图文'],
    vars: { ...BASE_VARS, fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif', fontSize: '16', lineHeight: 1.75, maxWidth: '640', bgColor: '#f5f5f5', blockquoteBg: '#ffffff', codeBg: '#ffffff' ,
    accentColor: '#576b95',
    strongColor: '#2c2c2c',
    markBg: '#e8f0fe',
    hrColor: '#d0d7de',},
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


  // ═══ 新增（受外部 WechatTheme 启发）═══
  {
    id: 'warm-clay',
    label: '暖陶米白',
    desc: '暖色调，陶土红强调，仿 Claude 风格',
    platform: 'general',
    tags: ['暖色', '温和'],
    vars: { ...BASE_VARS, fontFamily: '-apple-system,BlinkMacSystemFont,"Helvetica Neue","PingFang SC","Microsoft YaHei",sans-serif', textColor: '#3d3929', headingColor: '#181815', linkColor: '#d97757', bgColor: '#faf9f5', codeBg: '#f5f4ef', blockquoteBorder: '#d97757', blockquoteBg: '#faf9f5', accentColor: '#d97757', strongColor: '#c2613f', markBg: '#f9e8e0', hrColor: '#e8e6dc' },
  },
  {
    id: 'indigo-pink',
    label: '靛粉渐变',
    desc: '靛蓝标题粉红强调，渐变背景带网格',
    platform: 'general',
    tags: ['渐变', '现代', '醒目'],
    vars: { ...BASE_VARS, fontFamily: 'Inter,"PingFang SC","Microsoft YaHei",sans-serif', textColor: '#334155', headingColor: '#312e81', linkColor: '#6366f1', headingVariant: 'ribbon', headingBg: 'linear-gradient(135deg,#6366f1,#ec4899)', headingText: '#ffffff', headingLine: '#6366f1', bgColor: '#ffffff', codeBg: '#eef2ff', codeText: '#4338ca', strongColor: '#ec4899', markBg: '#fce7f3', hrColor: '#e0e7ff', blockquoteBorder: '#ec4899', blockquoteBg: '#f8f7ff', pageBg: 'linear-gradient(rgba(99,102,241,0.045) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,0.045) 1px,transparent 1px),radial-gradient(circle at 92% 8%,rgba(236,72,153,0.16) 0 120px,transparent 122px),radial-gradient(circle at 6% 88%,rgba(99,102,241,0.16) 0 140px,transparent 142px),#ffffff', pageBgSize: '40px 40px,40px 40px,auto,auto,auto' },
  },
  {
    id: 'magazine',
    label: '杂志红',
    desc: '深红标题，浓烈编辑风',
    platform: 'general',
    tags: ['正式', '浓烈'],
    vars: { ...BASE_VARS, fontFamily: '"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif', textColor: '#2f2f33', headingColor: '#7a1f1f', linkColor: '#c23a3a', bgColor: '#fffcfc', codeBg: '#ffeef0', codeText: '#9c2f3a', strongColor: '#992d2d', markBg: '#ffe0de', hrColor: '#e8c2c2', blockquoteBorder: '#c23a3a', blockquoteBg: '#fff3f2' },
  },
  {
    id: 'retro',
    label: '复古纸',
    desc: 'Georgia 衬线字体，暖黄纸质感',
    platform: 'general',
    tags: ['复古', '衬线', '纸质'],
    vars: { ...BASE_VARS, fontFamily: 'Georgia,"Times New Roman","PingFang SC",serif', textColor: '#2f261b', headingColor: '#4a3215', linkColor: '#8b6a35', bgColor: '#fcf8f0', codeBg: '#f2e7d4', codeText: '#704a1a', strongColor: '#7a4e14', markBg: '#f0e3cc', hrColor: '#d7c19a', blockquoteBorder: '#8b6a35', blockquoteBg: '#f8f2e8', fontSize: '17', lineHeight: 1.9, paragraphGap: '1.4' },
  },
  {
    id: 'ocean',
    label: '海盐青',
    desc: '青绿主调，清爽海洋感',
    platform: 'general',
    tags: ['清爽', '自然'],
    vars: { ...BASE_VARS, fontFamily: '-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif', textColor: '#1f3a3d', headingColor: '#0b4f55', linkColor: '#0e9594', bgColor: '#f4fbfa', codeBg: '#e8f6f5', codeText: '#0b6b6a', strongColor: '#0a7e7d', markBg: '#d6f3f1', hrColor: '#cdeae8', blockquoteBorder: '#0e9594', blockquoteBg: '#effbfa' },
  },
  {
    id: 'amber',
    label: '琥珀橙',
    desc: '温暖橙色调，沉稳琥珀感',
    platform: 'general',
    tags: ['暖色', '沉稳'],
    vars: { ...BASE_VARS, textColor: '#2c2c2c', headingColor: '#c8722a', linkColor: '#c8722a', bgColor: '#fffcf7', codeBg: '#faebd7', codeText: '#a05a20', strongColor: '#c8722a', markBg: '#fdf0e0', hrColor: '#f0d5b0', blockquoteBorder: '#c8722a', blockquoteBg: '#fdf5ec' },
  },
  {
    id: 'health',
    label: '健康绿',
    desc: '自然绿色调，网格背景护眼',
    platform: 'general',
    tags: ['自然', '护眼'],
    vars: { ...BASE_VARS, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif', textColor: '#183d34', headingColor: '#123f34', linkColor: '#0f8f67', bgColor: '#f4faf7', codeBg: '#edf7f2', codeText: '#0f3129', strongColor: '#087857', markBg: '#e5f5ee', hrColor: '#dcebe3', blockquoteBorder: '#5a8f75', blockquoteBg: '#f7fcf9', pageBg: 'linear-gradient(rgba(18,63,52,0.045) 1px,transparent 1px),linear-gradient(90deg,rgba(18,63,52,0.045) 1px,transparent 1px),#f4faf7', pageBgSize: '48px 48px,48px 48px,auto' },
  },
];

/* ─── 自定义主题存储 ─── */
const CUSTOM_THEMES_KEY = 'inkwise-custom-article-themes';
const SELECTED_THEME_KEY = 'inkwise-selected-article-theme';

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
    const parsed: ArticleTheme[] = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
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
  const ac = vars.accentColor || vars.linkColor || '#1a73e8';
  const sc = vars.strongColor || vars.headingColor;
  const hc = vars.hrColor || '#e0e0e0';

  let css = `:root {
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
  --article-accent-color: ${ac};
  --article-strong-color: ${sc};
  --article-mark-bg: ${vars.markBg || '#fff3cd'};
  --article-hr-color: ${hc};
  --article-page-bg: ${vars.pageBg || vars.bgColor};
  --article-page-bg-size: ${vars.pageBgSize || 'auto'};
}

.article-body {
  font-family: var(--article-font-family);
  font-size: var(--article-font-size);
  line-height: var(--article-line-height);
  color: var(--article-text-color);
  background: var(--article-page-bg);
  background-size: var(--article-page-bg-size);
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
.article-body strong { color: var(--article-strong-color); }

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

.article-body mark {
  background: var(--article-mark-bg);
  padding: 0 4px;
  border-radius: 3px;
}

.article-body ul, .article-body ol { padding-left: 1.5em; margin: 0.5em 0; }
.article-body li { margin: 0.3em 0; }
.article-body img { max-width: 100%; height: auto; border-radius: 6px; margin: 1em 0; }
.article-body hr { border: none; border-top: 1px solid var(--article-hr-color); margin: 2em 0; }

.article-body table { border-collapse: collapse; width: 100%; margin: 1em 0; }
.article-body th, .article-body td { border: 1px solid var(--article-hr-color); padding: 8px 12px; text-align: left; }
.article-body th { background: var(--article-code-bg); font-weight: 600; }
`;

  // Ribbon heading variant
  if (vars.headingVariant === 'ribbon') {
    const hBg = vars.headingBg || ac;
    const hText = vars.headingText || '#ffffff';
    const hLine = vars.headingLine || ac;
    css += `
.article-body h1, .article-body h2, .article-body h3,
.article-body h4, .article-body h5 {
  display: inline-block;
  background: ${hBg};
  color: ${hText};
  padding: 6px 24px 6px 16px;
  position: relative;
  clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%);
  margin-bottom: 0.6em;
}
.article-body h1::after, .article-body h2::after, .article-body h3::after,
.article-body h4::after, .article-body h5::after {
  content: '';
  position: absolute;
  bottom: -4px;
  left: 0;
  right: 12px;
  height: 3px;
  background: ${hLine};
  border-radius: 2px;
}`;
  }

  return css;
}

/* ─── 生成完整可分享 HTML ─── */
export function buildShareableHtml(content: string, title: string, vars: ArticleThemeVars): string {
  const pageBg = vars.pageBg || vars.bgColor;
  const bgSize = vars.pageBgSize ? `;background-size:${vars.pageBgSize}` : '';
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>${buildThemeCss(vars)}</style></head>
<body style="margin:0;background:${pageBg}${bgSize}">
<div class="article-body">${content}</div>
</body></html>`;
}

/* ─── 生成编辑器适用的主题 CSS（覆盖 editorContainer 作用域） ─── */
export function buildEditorThemeCss(vars: ArticleThemeVars): string {
  const sc = vars.strongColor || vars.headingColor;
  const hc = vars.hrColor || vars.blockquoteBorder;
  const pageBg = vars.pageBg || vars.bgColor;
  return `.editor-container .tiptap {
  font-family: ${vars.fontFamily} !important;
  color: ${vars.textColor} !important;
  background: ${pageBg} !important;
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
  color: ${sc} !important;
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
.editor-container .tiptap mark {
  background: ${vars.markBg || '#fff3cd'} !important;
  padding: 0 4px !important;
  border-radius: 3px !important;
}
.editor-container .tiptap ul, .editor-container .tiptap ol { padding-left: 1.5em !important; margin: 0.5em 0 !important; }
.editor-container .tiptap li { margin: 0.3em 0 !important; }
.editor-container .tiptap img { max-width: 100% !important; height: auto !important; border-radius: 6px !important; margin: 1em 0 !important; }
.editor-container .tiptap hr { border: none !important; border-top: 1px solid ${hc} !important; margin: 2em 0 !important; }
.editor-container .tiptap table { border-collapse: collapse !important; width: 100% !important; margin: 1em 0 !important; }
.editor-container .tiptap th, .editor-container .tiptap td { border: 1px solid ${hc} !important; padding: 8px 12px !important; text-align: left !important; }
.editor-container .tiptap th { background: ${vars.codeBg} !important; font-weight: 600 !important; }
`;
}
