// articleThemes.ts — 文章渲染主题系统
import { isTauriEnv, tryInvoke, TauriCommands } from '../bridge/tauri';

// 定义文章在导出/分享到各平台时的视觉风格
// 每个平台有多套主题可选，通用主题适用于任何平台

/* ─── 可配置的 CSS 变量项 ─── */
export interface ArticleThemeVars {
  fontFamily: string;          // 正文字体
  fontSize: PxValue;           // 正文字号（如 "16" → "16px"）
  lineHeight: number;          // 行距
  paragraphGap: EmValue;       // 段落间距（如 "1.25" → "1.25em"）
  maxWidth: PxValue;           // 内容最大宽度（如 "780" → "780px"）
  textColor: HexColor;         // 正文颜色
  bgColor: HexColor;           // 背景色
  headingColor: HexColor;      // 标题颜色
  linkColor: HexColor;         // 链接颜色
  codeBg: HexColor;            // 代码块背景
  codeText: HexColor;          // 代码块文字颜色
  blockquoteBorder: HexColor;  // 引用块边框色
  blockquoteBg: HexColor;      // 引用块背景
  // 增强视觉
  accentColor?: HexColor;      // 强调色（引用块/装饰元素）
  strongColor?: HexColor;      // 加粗文字色，缺省用 headingColor
  markBg?: HexColor;           // ==高亮== 背景色
  hrColor?: HexColor;          // 分割线颜色，缺省用 #e0e0e0
  pageBg?: string;             // 整页背景（可渐变/图案），缺省用 bgColor
  pageBgSize?: string;         // 背景尺寸
  // 标题变体
  headingVariant?: 'ribbon';   // 标题视觉结构
  headingBg?: HexColor;        // 标题块背景
  headingText?: HexColor;      // 标题块文字色，缺省用 #ffffff
  headingLine?: HexColor;      // 标题底线色，缺省用 accentColor
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
// ─── 语义类型别名 ───

/** 像素值（数字字符串，构建 CSS 时自动追加 "px"） */
export type PxValue = string;

/** EM 相对单位值（数字字符串，构建 CSS 时自动追加 "em"） */
export type EmValue = string;

/** 十六进制颜色值，如 "#2c2c2c" */
export type HexColor = string;

/** CSS 变量键值对 */
export interface CssVarEntry {
  key: string;
  value: string;
  important?: boolean;
}

/** CSS 单位 */
export type CssUnit = 'px' | 'em' | 'rem' | '%' | 'vh' | 'vw';

/**
 * 将主题变量值拼合 CSS 单位。
 * 保持向后兼容：纯数字字符串（如 "16"）自动拼单位，已有单位的（如 "16px"）原样输出。
 *
 * @param value  变量值
 * @param unit   目标 CSS 单位（默认 'px'）
 * @returns 拼合单位后的值，如 "16px"
 *
 * @example
 *   renderThemeUnit('16')        → '16px'
 *   renderThemeUnit('1.75', 'em') → '1.75em'
 *   renderThemeUnit('50%')        → '50%'
 */
export function renderThemeUnit(value: string, unit: CssUnit = 'px'): string {
  if (!value) return value;
  // 已有单位或 % → 直接返回
  if (/[a-z%]$/i.test(value)) return value;
  return value + unit;
}

/**
 * 将 ArticleThemeVars 转换为 CSS 自定义属性字符串。
 * 统一处理单位拼接，供 buildThemeCss / buildEditorThemeCss 等函数使用。
 *
 * @param vars  主题变量
 * @param prefix  CSS 变量前缀，默认 "--"
 * @returns CSS 自定义属性文本
 *
 * @example
 *   renderThemeVars(theme.vars)
 *   // → "--font-size: 16px; --line-height: 1.75; --text-color: #2c2c2c; ..."
 */
export function renderThemeVars(vars: ArticleThemeVars, prefix = '--'): CssVarEntry[] {
  const entries: CssVarEntry[] = [];

  if (vars.fontFamily) entries.push({ key: prefix + 'font-family', value: vars.fontFamily });
  if (vars.fontSize) entries.push({ key: prefix + 'font-size', value: renderThemeUnit(vars.fontSize, 'px') });
  if (vars.lineHeight) entries.push({ key: prefix + 'line-height', value: String(vars.lineHeight) });
  if (vars.paragraphGap) entries.push({ key: prefix + 'paragraph-gap', value: renderThemeUnit(vars.paragraphGap, 'em') });
  if (vars.maxWidth) entries.push({ key: prefix + 'max-width', value: renderThemeUnit(vars.maxWidth, 'px') });
  if (vars.textColor) entries.push({ key: prefix + 'text-color', value: vars.textColor });
  if (vars.bgColor) entries.push({ key: prefix + 'bg-color', value: vars.bgColor });
  if (vars.headingColor) entries.push({ key: prefix + 'heading-color', value: vars.headingColor });
  if (vars.linkColor) entries.push({ key: prefix + 'link-color', value: vars.linkColor });
  if (vars.codeBg) entries.push({ key: prefix + 'code-bg', value: vars.codeBg });
  if (vars.codeText) entries.push({ key: prefix + 'code-text', value: vars.codeText });
  if (vars.blockquoteBorder) entries.push({ key: prefix + 'blockquote-border', value: vars.blockquoteBorder });
  if (vars.blockquoteBg) entries.push({ key: prefix + 'blockquote-bg', value: vars.blockquoteBg });
  if (vars.accentColor) entries.push({ key: prefix + 'accent-color', value: vars.accentColor });
  if (vars.strongColor) entries.push({ key: prefix + 'strong-color', value: vars.strongColor });
  if (vars.markBg) entries.push({ key: prefix + 'mark-bg', value: vars.markBg });
  if (vars.hrColor) entries.push({ key: prefix + 'hr-color', value: vars.hrColor });
  if (vars.pageBg) entries.push({ key: prefix + 'page-bg', value: vars.pageBg });
  if (vars.pageBgSize) entries.push({ key: prefix + 'page-bg-size', value: vars.pageBgSize });
  if (vars.headingBg) entries.push({ key: prefix + 'heading-bg', value: vars.headingBg });
  if (vars.headingText) entries.push({ key: prefix + 'heading-text', value: vars.headingText });
  if (vars.headingLine) entries.push({ key: prefix + 'heading-line', value: vars.headingLine });

  return entries;
}

/**
 * 将 CssVarEntry[] 渲染为 CSS 文本。
 */
export function cssEntriesToText(entries: CssVarEntry[]): string {
  return entries
    .map(e => `${e.key}: ${e.value}${e.important ? ' !important' : ''};`)
    .join('\n');
}


// ─── 平台覆写类型 ───

/**
 * 平台覆写：为同一核心主题在不同平台的差异化调整。
 * 只包含跨平台会变化的字段，固定字段由核心主题提供。
 */
export interface PlatformOverride {
  /** 覆写主题的 ID（默认自动生成） */
  id?: string;
  /** 目标平台 ID */
  platform: string;
  /** 平台标签后缀（如 "默认"、"暗色"），用于生成 label */
  labelSuffix?: string;
  /** 平台描述后缀 */
  descSuffix?: string;
  /** 覆写的主题变量 */
  vars: Partial<ArticleThemeVars>;
  /** 额外标签 */
  tags?: string[];
}

/**
 * 核心主题定义：比 ArticleTheme 更精简，
 * 通过 platformOverrides 生成平台变体。
 */
export interface CoreTheme {
  id: string;
  label: string;
  desc: string;
  tags: string[];
  vars: ArticleThemeVars;
  /** 平台覆写列表。不指定则只保留通用（general）版本 */
  platformOverrides?: PlatformOverride[];
}

/** 平台默认覆写：各平台的基础差异化配置（字号、最大宽度、字体等） */
export const CORE_THEMES: CoreTheme[] = [
  // ═══ 简约（干净、无彩色干扰）═══
  {
    id: 'clean',
    label: '极简白',
    desc: '最高可读性，无彩色干扰',
    tags: ['简约', '通用'],
    vars: { ...BASE_VARS, accentColor: '#1a73e8', strongColor: '#111111', markBg: '#e8f0fe', hrColor: '#d0d7de' },
    platformOverrides: [
      { id: 'wechat-default', platform: 'wechat', labelSuffix: '默认', descSuffix: '微信默认风格',
        vars: { fontSize: '17', lineHeight: 1.8, paragraphGap: '1.4', linkColor: '#576b95', codeBg: '#f0f0f0',
                fontFamily: '"PingFang SC", "Microsoft YaHei", "Helvetica Neue", sans-serif', maxWidth: '660' } },
      { id: 'zhihu-default', platform: 'zhihu', labelSuffix: '默认', descSuffix: '知乎默认风格',
        vars: { lineHeight: 1.7, linkColor: '#056de8', blockquoteBorder: '#056de8', blockquoteBg: '#f0f7ff',
                fontFamily: '"PingFang SC", "Microsoft YaHei", Arial, sans-serif', fontSize: '15', maxWidth: '768' } },
      { id: 'toutiao-default', platform: 'toutiao', labelSuffix: '默认', descSuffix: '头条默认风格',
        vars: { lineHeight: 1.6, paragraphGap: '1.0', headingColor: '#cc0000', blockquoteBorder: '#cc0000', blockquoteBg: '#fff5f5',
                fontSize: '18', maxWidth: '720' } },
      { id: 'jianshu-default', platform: 'jianshu', labelSuffix: '默认', descSuffix: '简书默认风格，暖灰底色',
        vars: { bgColor: '#f7f7f7', textColor: '#404040', linkColor: '#3194d0', codeBg: '#f8f8f8', blockquoteBorder: '#d0d0d0', blockquoteBg: '#f0f0f0',
                fontSize: '16', maxWidth: '760', fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif' } },
      { id: 'csdn-default', platform: 'csdn', labelSuffix: '默认', descSuffix: 'CSDN 默认风格，代码友好',
        vars: { lineHeight: 1.65, linkColor: '#c00000', codeBg: '#f5f5f5', codeText: '#c7254e', blockquoteBorder: '#c00000', blockquoteBg: '#fff5f5',
                fontSize: '15', maxWidth: '860' } },
    ],
  },
  // ═══ 暖色 ═══
  {
    id: 'paper',
    label: '纸墨',
    desc: '暖色底色，仿纸张质感',
    tags: ['暖色', '阅读'],
    vars: { ...BASE_VARS, bgColor: '#faf8f5', textColor: '#3a3a3a', blockquoteBg: '#f5f0eb', accentColor: '#b08968', strongColor: '#5a4a3a', markBg: '#f0e3cc', hrColor: '#d7c19a' },
    platformOverrides: [
      { id: 'wechat-novel', platform: 'wechat', labelSuffix: '小说', descSuffix: '微信小说风格，宽行距',
        vars: { fontSize: '17', lineHeight: 2.0, paragraphGap: '1.6', textColor: '#3a3a3a', blockquoteBg: '#f5f5f5',
                fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif', maxWidth: '660' } },
      { id: 'zhihu-essay', platform: 'zhihu', labelSuffix: '专栏', descSuffix: '知乎专栏风格，大留白',
        vars: { fontSize: '16', lineHeight: 1.8, paragraphGap: '1.5', linkColor: '#056de8',
                fontFamily: '"PingFang SC", "Microsoft YaHei", Arial, sans-serif', maxWidth: '720' } },
    ],
  },
  // ═══ 暗色 ═══
  {
    id: 'night',
    label: '暗色护眼',
    desc: '深色背景，适合夜间阅读',
    tags: ['暗色', '护眼'],
    vars: { ...BASE_VARS, bgColor: '#1a1a2e', textColor: '#e0e0e0', headingColor: '#ffffff', codeBg: '#16213e', codeText: '#e0e0e0', blockquoteBg: '#16213e', blockquoteBorder: '#4a4a6a', accentColor: '#7c8cff', strongColor: '#ffffff', markBg: '#1f2a55', hrColor: '#2f3763' },
    platformOverrides: [
      { id: 'zhihu-dark', platform: 'zhihu', labelSuffix: '暗色', descSuffix: '知乎暗色风格',
        vars: { bgColor: '#1e1e1e', textColor: '#d0d0d0', linkColor: '#58a6ff', codeBg: '#2d2d2d', blockquoteBorder: '#58a6ff', blockquoteBg: '#1a2332',
                fontFamily: '"PingFang SC", "Microsoft YaHei", Arial, sans-serif', fontSize: '15', maxWidth: '768' } },
      { id: 'toutiao-dark', platform: 'toutiao', labelSuffix: '暗色', descSuffix: '头条暗色风格',
        vars: { bgColor: '#1a1a1a', textColor: '#d4d4d4', headingColor: '#ff4444', linkColor: '#ff4444', codeBg: '#2a2a2a', codeText: '#ff6b6b', blockquoteBorder: '#ff4444', blockquoteBg: '#221111',
                fontSize: '18', lineHeight: 1.6, maxWidth: '720' } },
      { id: 'jianshu-dark', platform: 'jianshu', labelSuffix: '暗色', descSuffix: '简书暗色风格',
        vars: { bgColor: '#1c1c1c', textColor: '#cfcfcf', headingColor: '#f0f0f0', linkColor: '#58a6ff', codeBg: '#2a2a2a', codeText: '#e0e0e0', blockquoteBorder: '#444444', blockquoteBg: '#252525',
                fontSize: '16', maxWidth: '760', fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif' } },
      { id: 'csdn-dark', platform: 'csdn', labelSuffix: '暗色', descSuffix: 'CSDN 暗色风格',
        vars: { bgColor: '#1d1d1d', textColor: '#cccccc', headingColor: '#e0e0e0', linkColor: '#ff6b6b', codeBg: '#2b2b2b', codeText: '#ff6b6b', blockquoteBorder: '#ff6b6b', blockquoteBg: '#2a1a1a',
                fontSize: '15', maxWidth: '860' } },
    ],
  },
  {
    id: 'medium-dark',
    label: 'Medium 暗色',
    desc: '深色版 Medium 阅读体验',
    tags: ['暗色', '衬线'],
    vars: { ...BASE_VARS, fontFamily: '"Georgia", "Noto Serif SC", serif', fontSize: '18', lineHeight: 1.8, paragraphGap: '1.5', maxWidth: '740', bgColor: '#121212', textColor: '#d4d4d4', headingColor: '#ffffff', linkColor: '#3ea660', codeBg: '#1e1e1e', codeText: '#d4d4d4', blockquoteBorder: '#333333', blockquoteBg: '#1a1a1a' },
  },
  // ═══ 衬线 / 优雅 ═══
  {
    id: 'elegant',
    label: '典雅',
    desc: '衬线字体，传统排版',
    tags: ['衬线', '正式'],
    vars: { ...BASE_VARS, fontFamily: '"Noto Serif SC", "Source Han Serif SC", Georgia, serif', fontSize: '17', lineHeight: 1.9, accentColor: '#b08968', strongColor: '#8a5a36', markBg: '#f6e6cf', hrColor: '#d7c19a' },
  },
  // ═══ 无衬线 / 现代 ═══
  {
    id: 'modern',
    label: '现代',
    desc: '无衬线字体，干净利落',
    tags: ['无衬线', '商务'],
    vars: { ...BASE_VARS, fontFamily: '-apple-system, "PingFang SC", "Noto Sans SC", sans-serif', maxWidth: '800', accentColor: '#2d8cf0', strongColor: '#1a1a1a', markBg: '#dcedff', hrColor: '#d0d7de' },
    platformOverrides: [
      { id: 'medium-sans', platform: 'medium', labelSuffix: '', descSuffix: 'Medium 无衬线风格',
        vars: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', fontSize: '17', lineHeight: 1.75,
                maxWidth: '740', linkColor: '#1a8917' } },
      { id: 'jianshu-minimal', platform: 'jianshu', labelSuffix: '极简', descSuffix: '简书极简风格',
        vars: { bgColor: '#ffffff', textColor: '#333333', lineHeight: 1.8, linkColor: '#3194d0', codeBg: '#f8f8f8', blockquoteBorder: '#e0e0e0', blockquoteBg: '#fafafa',
                fontSize: '16', maxWidth: '740', fontFamily: '-apple-system, "PingFang SC", sans-serif' } },
    ],
  },
  // ═══ 暖陶 ═══
  {
    id: 'warm-clay',
    label: '暖陶',
    desc: '暖色调，陶土质感',
    tags: ['暖色', '温和'],
    vars: { ...BASE_VARS, bgColor: '#fcf6f0', textColor: '#4a4a4a', headingColor: '#6b3a2a', linkColor: '#c0755a', accentColor: '#c0755a', strongColor: '#6b3a2a', blockquoteBg: '#f5ede4', blockquoteBorder: '#d4a88c', codeBg: '#f0e8e0', markBg: '#f0daca', hrColor: '#d4c4b4' },
  },
  // ═══ 杂志风格 ═══
  {
    id: 'magazine',
    label: '杂志',
    desc: '正式浓烈，杂志风格',
    tags: ['正式', '浓烈'],
    vars: { ...BASE_VARS, fontFamily: '"Noto Serif SC", "Source Han Serif SC", Georgia, serif', fontSize: '17', lineHeight: 1.85, maxWidth: '800', headingColor: '#8b0000', linkColor: '#8b0000', accentColor: '#8b0000', strongColor: '#5a0000', codeBg: '#faf0f0', blockquoteBg: '#fef5f5', blockquoteBorder: '#8b0000', markBg: '#fce8e8', hrColor: '#d0a0a0' },
  },
  // ═══ 复古 ═══
  {
    id: 'retro',
    label: '复古',
    desc: '复古风格，纸质质感',
    tags: ['复古', '衬线', '纸质'],
    vars: { ...BASE_VARS, fontFamily: '"Noto Serif SC", "Source Han Serif SC", serif', fontSize: '17', lineHeight: 1.9, paragraphGap: '1.4', maxWidth: '720', bgColor: '#f5f0e8', textColor: '#5c4a3a', headingColor: '#3a2a1a', linkColor: '#8b6b4b', accentColor: '#8b6b4b', strongColor: '#5a3a2a', codeBg: '#ece4d8', codeText: '#5a4a3a', blockquoteBg: '#f0e8dc', blockquoteBorder: '#b8a088', markBg: '#e8dcc8', hrColor: '#c8b8a8' },
  },
  // ═══ 海洋 ═══
  {
    id: 'ocean',
    label: '海洋',
    desc: '清爽蓝色系，自然',
    tags: ['清爽', '自然'],
    vars: { ...BASE_VARS, bgColor: '#f7fbfe', textColor: '#2c3e50', headingColor: '#1a4a6e', linkColor: '#2980b9', accentColor: '#2980b9', strongColor: '#1a4a6e', codeBg: '#eef5fa', blockquoteBg: '#f0f8ff', blockquoteBorder: '#5b9bd5', markBg: '#d4eaf7', hrColor: '#a8c8dd' },
  },
  // ═══ 琥珀 ═══
  {
    id: 'amber',
    label: '琥珀',
    desc: '暖色沉稳，琥珀色调',
    tags: ['暖色', '沉稳'],
    vars: { ...BASE_VARS, bgColor: '#fdf8f0', textColor: '#4a3a2a', headingColor: '#8b6b3a', linkColor: '#c09040', accentColor: '#c09040', strongColor: '#7a5a2a', codeBg: '#f5f0e0', blockquoteBg: '#faf0e0', blockquoteBorder: '#d4a850', markBg: '#f0e0c0', hrColor: '#d0c0a0' },
  },
  // ═══ 健康 ═══
  {
    id: 'health',
    label: '健康',
    desc: '自然护眼绿色调',
    tags: ['自然', '护眼'],
    vars: { ...BASE_VARS, bgColor: '#f4faf0', textColor: '#3a4a3a', headingColor: '#2a5a3a', linkColor: '#4a8a5a', accentColor: '#4a8a5a', strongColor: '#2a5a3a', codeBg: '#eaf5e8', blockquoteBg: '#f0f8ee', blockquoteBorder: '#6aaa6a', markBg: '#d8eed8', hrColor: '#aac8aa' },
  },
  // ═══ 靛蓝粉红 ═══
  {
    id: 'indigo-pink',
    label: '靛粉',
    desc: '现代渐变风格，醒目',
    tags: ['渐变', '现代', '醒目'],
    vars: { ...BASE_VARS, fontFamily: '-apple-system, "PingFang SC", "Noto Sans SC", sans-serif', fontSize: '16', lineHeight: 1.75, maxWidth: '780', bgColor: '#fafafe', textColor: '#2a2a3a', headingColor: '#3a2a6a', linkColor: '#6a3a9a', accentColor: '#8a3a8a', strongColor: '#5a2a7a', codeBg: '#f4f0fa', codeText: '#5a3a8a', blockquoteBg: '#f8f4fe', blockquoteBorder: '#8a6aba', markBg: '#e8e0f8', hrColor: '#ccc0dd' },
  },
];

/** 获取平台默认覆写：各平台的基础差异化配置 */
export function getPlatformDefaults(platform: string): Partial<ArticleThemeVars> {
  const defaults: Record<string, Partial<ArticleThemeVars>> = {
    wechat:  { fontSize: '17', maxWidth: '660', fontFamily: '"PingFang SC", "Microsoft YaHei", "Helvetica Neue", sans-serif', linkColor: '#576b95' },
    zhihu:   { fontSize: '15', maxWidth: '768', fontFamily: '"PingFang SC", "Microsoft YaHei", Arial, sans-serif', linkColor: '#056de8' },
    toutiao: { fontSize: '18', maxWidth: '720', linkColor: '#cc0000' },
    medium:  { fontSize: '18', maxWidth: '740', fontFamily: '"Georgia", "Noto Serif SC", serif', linkColor: '#1a8917' },
    jianshu: { fontSize: '16', maxWidth: '760', fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif', linkColor: '#3194d0', bgColor: '#f7f7f7', textColor: '#404040' },
    csdn:    { fontSize: '15', maxWidth: '860', linkColor: '#c00000' },
  };
  return defaults[platform] || {};
}

/**
 * 将核心主题 + 平台覆写展开为完整的 ArticleTheme[]。
 * 每个核心主题生成一个 general 版本 + 每个平台覆写版本。
 */
export function generateFullThemes(coreThemes: CoreTheme[]): ArticleTheme[] {
  const results: ArticleTheme[] = [];
  for (const ct of coreThemes) {
    // general 版本
    results.push({
      id: ct.id,
      label: ct.label,
      desc: ct.desc,
      platform: 'general',
      tags: [...ct.tags],
      vars: { ...ct.vars },
    });
    // 平台覆写版本
    if (ct.platformOverrides) {
      for (const ov of ct.platformOverrides) {
        results.push({
          id: ov.id || ct.id + '-' + ov.platform,
          label: ct.label + (ov.labelSuffix ? ' ' + ov.labelSuffix : ''),
          desc: ct.desc + (ov.descSuffix ? '（' + ov.descSuffix + '）' : ''),
          platform: ov.platform,
          tags: [...new Set([...ct.tags, ...(ov.tags || [])])],
          vars: { ...ct.vars, ...getPlatformDefaults(ov.platform), ...ov.vars },
        });
      }
    }
  }
  return results;
}

/** 预生成完整主题列表，保持向后兼容。运行时展开 CORE_THEMES + 追加独特主题。 */
export const ARTICLE_THEMES: ArticleTheme[] = (() => {
  const themes = generateFullThemes(CORE_THEMES);

  // ─── 额外独特主题（无法通过覆写生成，有独立视觉风格） ───
  const extras: ArticleTheme[] = [
    {
      id: 'wechat-card', label: '微信卡片', desc: '圆角卡片，图文并茂',
      platform: 'wechat', tags: ['卡片', '图文'],
      vars: { ...BASE_VARS, fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif', fontSize: '16', lineHeight: 1.75, maxWidth: '640', bgColor: '#f5f5f5', blockquoteBg: '#ffffff', codeBg: '#ffffff',
        accentColor: '#576b95', strongColor: '#2c2c2c', markBg: '#e8f0fe', hrColor: '#d0d7de' },
    },
    {
      id: 'wechat-grace', label: '微信优雅', desc: '精致优雅风格',
      platform: 'wechat', tags: ['精致', '优雅'],
      vars: { ...BASE_VARS, fontFamily: '"PingFang SC", "Noto Serif SC", sans-serif', fontSize: '16', lineHeight: 1.85, paragraphGap: '1.4', maxWidth: '660', textColor: '#3a3a3a', linkColor: '#8a6a4a',
        accentColor: '#8a6a4a', strongColor: '#5a4a3a', markBg: '#f0e6d8', hrColor: '#d0c0b0' },
    },
    {
      id: 'wechat-simple', label: '微信简约', desc: '简约干净风格',
      platform: 'wechat', tags: ['简约', '干净'],
      vars: { ...BASE_VARS, fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif', fontSize: '16', lineHeight: 1.75, maxWidth: '640', bgColor: '#ffffff', textColor: '#333333', linkColor: '#576b95', codeBg: '#f5f5f5',
        accentColor: '#576b95', strongColor: '#333333', markBg: '#e8f0fe', hrColor: '#d0d7de' },
    },
    {
      id: 'toutiao-hot', label: '头条热文', desc: '红色强调，突出爆点',
      platform: 'toutiao', tags: ['热文', '红色'],
      vars: { ...BASE_VARS, fontSize: '18', lineHeight: 1.65, maxWidth: '720', headingColor: '#e60012', linkColor: '#e60012', blockquoteBorder: '#e60012', blockquoteBg: '#fff0f0', textColor: '#1a1a1a' },
    },
    {
      id: 'medium-default', label: 'Medium 经典', desc: '衬线字体，极简阅读',
      platform: 'medium', tags: ['衬线', '极简'],
      vars: { ...BASE_VARS, fontFamily: '"Georgia", "Noto Serif SC", serif', fontSize: '18', lineHeight: 1.8, paragraphGap: '1.5', maxWidth: '740', linkColor: '#1a8917', codeBg: '#f4f4f4', blockquoteBorder: '#d0d0d0', blockquoteBg: '#f9f9f9' },
    },
  ];

  extras.forEach(t => themes.push(t));
  return themes;
})();

// ─── 主题选择器与自定义主题管理 ───

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

/** Tauri 模式下从 Rust 后端加载自定义主题（异步，覆盖 localStorage） */
export async function loadCustomThemesFromBackend(): Promise<void> {
  if (!isTauriEnv()) return;
  try {
    const themes = await tryInvoke<ArticleTheme[]>(TauriCommands.ListCustomThemes);
    if (Array.isArray(themes)) {
      localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(themes));
    }
  } catch { /* ignore */ }
}

/** Tauri 模式下同步到 Rust 后端 */
export async function saveCustomThemesToBackend(themes: ArticleTheme[]): Promise<void> {
  if (!isTauriEnv()) return;
  try {
    await tryInvoke(TauriCommands.SaveCustomThemes, { themes });
  } catch { /* ignore */ }
}

export function saveCustomThemes(themes: ArticleTheme[]): void {
  try {
    localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(themes));
  } catch {}
  // Also persist to Rust backend (best effort, non-blocking)
  if (isTauriEnv()) {
    tryInvoke(TauriCommands.SaveCustomThemes, { themes }).catch(() => {});
  }
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
