/**
 * collector.ts — 从所有配置源统一收集 CSS
 *
 * 收集来源（按优先级升序）：
 *  1. 模板 CSS（editor-style-template）
 *  2. 文章主题 CSS（article-theme）
 *  3. 文本样式覆盖（首行缩进、两端对齐）
 *  4. 标题装饰（heading-deco-config）
 *  5. 背景图案（bg-pattern）
 *  6. 强调色（editor-accent-color）
 *  7. 代码主题 CSS（code-theme）
 *  8. 代码块基础样式（macOS 圆点、pre 样式）
 *
 * 所有样式作用域为 .article-body，供 juice 内联使用。
 */
import { getSelectedArticleThemeId, getThemeById } from "../articleThemes";
import { getSelectedCodeThemeId, getCodeTheme, getTemplate, getSelectedTemplateId } from "../editorStyles";

/** 文章主题变量 */
interface ThemeVars {
  fontFamily?: string;
  fontSize?: string;
  lineHeight?: number;
  textColor?: string;
  bgColor?: string;
  maxWidth?: string;
  headingColor?: string;
  linkColor?: string;
  codeBg?: string;
  codeText?: string;
  blockquoteBorder?: string;
  blockquoteBg?: string;
  paragraphGap?: string;
}

// ─── Helpers ───

/** 将 body → .article-body 并 scope 所有选择器到 .article-body */
function scopeCSS(css: string): string {
  return css
    .replace(/\bbody\b(?=\s*\{)/g, ".article-body")
    .replace(/^\s*([^{}]+?)\s*\{/gm, (_m: string, sel: string) =>
      sel
        .split(",")
        .map((s: string) => {
          const t = s.trim();
          if (/^(\.article-body|&|@|:)/.test(t)) return t;
          return ".article-body " + t;
        })
        .join(", ") + " {",
    );
}

/** 从主题变量生成完整 CSS */
function buildThemeCss(vars: ThemeVars): string {
  const ff = vars.fontFamily || "-apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";
  const fs = vars.fontSize ?? 16;
  const lh = vars.lineHeight ?? 1.75;
  const tc = vars.textColor || "#333";
  const bg = vars.bgColor || "#fff";
  const mw = vars.maxWidth ?? 720;
  const hc = vars.headingColor || "inherit";
  const lc = vars.linkColor || "#0969da";
  const cb = vars.codeBg || "#f0f0f0";
  const ct = vars.codeText || "#333";

  const pg = vars.paragraphGap || "0.5em";

  return `.article-body {
  font-family: ${ff} !important;
  font-size: ${fs}px !important;
  line-height: ${lh} !important;
  color: ${tc} !important;
  max-width: ${mw}px !important;
  margin: 0 auto !important;
  padding: 24px 20px !important;
  background: ${bg} !important;
}
.article-body p, .article-body li, .article-body blockquote, .article-body td, .article-body th {
  font-family: ${ff} !important; font-size: ${fs}px !important; line-height: ${lh} !important; color: ${tc} !important;
}
.article-body h1, .article-body h2, .article-body h3, .article-body h4 {
  color: ${hc} !important; margin: 1.2em 0 0.5em !important; line-height: 1.3 !important;
}
.article-body strong { color: ${hc} !important; }
.article-body a { color: ${lc} !important; }
.article-body p { margin: 0 0 ${pg} !important; }
.article-body code {
  background: ${cb} !important; color: ${ct} !important; padding: 2px 6px !important; border-radius: 4px !important;
  font-size: 0.9em !important; font-family: "SF Mono", Consolas, "Courier New", monospace !important;
}
.article-body pre { background: ${cb}; color: ${ct}; padding: 12px 16px !important; overflow-x: auto !important; border-radius: 4px !important; }
.article-body pre code { padding: 0 !important; background: none !important; }
.article-body blockquote {
  margin: 1em 0 !important;
  padding: 0.8em 1.2em !important; border-radius: 0 6px 6px 0 !important;
}
.article-body blockquote p { margin: 0 !important; }
.article-body img { max-width: 100% !important; border-radius: 4px !important; margin: 1em auto !important; display: block !important; }
.article-body figcaption { text-align: center !important; color: ${tc} !important; opacity: 0.6 !important; font-size: 0.85em !important; margin-top: 4px !important; }
.article-body table { width: 100% !important; border-collapse: collapse !important; margin: 1em 0 !important; }
.article-body th, .article-body td { border: 1px solid #d0d7de !important; padding: 6px 10px !important; text-align: left !important; }
.article-body th { background: #f0f2f5 !important; font-weight: 600 !important; }
.article-body hr { border: none !important; border-top: 1px solid #eee !important; margin: 1.5em 0 !important; }
.article-body ul, .article-body ol { margin: 0.5em 0 !important; padding-left: 1.5em !important; list-style: none !important; }
.article-body li { margin: 0.3em 0 !important; word-break: keep-all !important; }
.article-body li::marker { unicode-bidi: normal !important; font-variant-numeric: normal !important; text-transform: none !important; }
`;
}

// ─── Main ───

/**
 * 收集所有发布用 CSS，返回完整的 CSS 文本。
 *
 * @param scope 作用域选择器，默认 ".article-body"
 */
export function collectPublishCss(scope = ".article-body"): string {
  const parts: string[] = [];

  // 1. 模板 CSS（内置 + 自定义）
  const template = getTemplate(getSelectedTemplateId());
  if (template) parts.push(scopeCSS(template.css));

  // 2. 文章主题 CSS + 样式面板覆盖（样式面板值优先）
  const themeId = getSelectedArticleThemeId();
  const theme = getThemeById(themeId);
  if (theme) {
    // 从 localStorage 读取样式面板覆盖值（由 App.tsx 的 sync useEffect 同步）
    const overrideVars = { ...theme.vars };
    const ovFs = localStorage.getItem('editor-font-size');
    if (ovFs) overrideVars.fontSize = ovFs;
    const ovLh = localStorage.getItem('editor-line-height');
    if (ovLh) overrideVars.lineHeight = parseFloat(ovLh);
    const ovFf = localStorage.getItem('editor-font-family');
    if (ovFf) overrideVars.fontFamily = ovFf;
    const ovMw = localStorage.getItem('editor-max-width');
    if (ovMw) overrideVars.maxWidth = ovMw;
    const ovPg = localStorage.getItem('editor-paragraph-gap');
    if (ovPg) overrideVars.paragraphGap = ovPg;
    parts.push(buildThemeCss(overrideVars));
  }

  // 3. 文本样式
  if (localStorage.getItem("first-line-indent") === "true")
    parts.push(`${scope} p:not(li p) { text-indent: 2em !important; }`);
  if (localStorage.getItem("justify-align") === "true")
    parts.push(`${scope} { text-align: justify !important; } ${scope} p:not(li p) { text-align: justify !important; }`);

  // 4. 标题装饰
  try {
    const hConfig: Record<string, string[]> = JSON.parse(localStorage.getItem("heading-deco-config") || "{}") || {};
    for (const [hl, decos] of Object.entries(hConfig)) {
      if (!decos.length) continue;
      const sel = `${scope} ${hl}`;
      const s: string[] = [];
      const extra: string[] = [];
      if (decos.includes("underline")) s.push("border-bottom:2px solid currentColor!important;padding-bottom:6px");
      if (decos.includes("overline")) s.push("border-top:2px solid currentColor!important;padding-top:6px");
      if (decos.includes("left-bar")) s.push("border-left:4px solid color-mix(in srgb,var(--accent,#0969da) 70%,currentColor)!important;padding-left:14px");
      if (decos.includes("right-bar")) s.push("border-right:4px solid currentColor!important;padding-right:14px");
      if (decos.includes("bg-block")) s.push("background:color-mix(in srgb,var(--accent,#0969da) 12%,transparent)!important;padding:4px 10px;border-radius:6px;display:inline-block");
      if (decos.includes("left-icon")) {
        s.push("position:relative;padding-left:1.6em");
        extra.push(`${sel}::before{content:"\\258e";position:absolute;left:0;color:currentColor;font-size:1.2em;font-weight:700}`);
      }
      if (decos.includes("badge")) s.push("background:var(--accent,#0969da)!important;color:var(--accent-fg,#fff)!important;padding:2px 12px;border-radius:12px;display:inline-block;font-size:.85em");
      if (s.length) parts.push(`${sel}{${s.join(";")}}${extra.join("")}`);
    }
  } catch { /* ignore malformed config */ }

  // 5. 背景图案
  const bgPattern = localStorage.getItem("bg-pattern") || "";
  if (bgPattern) {
    const bgColor = theme?.vars?.bgColor || "#fff";
    const patterns: Record<string, string> = {
      grid: `${scope}{background-color:${bgColor}!important;background-image:linear-gradient(90deg,rgba(0,0,0,.04)1px,transparent 1px),linear-gradient(0deg,rgba(0,0,0,.04)1px,transparent 1px)!important;background-size:20px 20px!important}`,
      dots: `${scope}{background-color:${bgColor}!important;background-image:radial-gradient(circle,rgba(0,0,0,.08)1px,transparent 1px)!important;background-size:16px 16px!important}`,
      stripes: `${scope}{background-color:${bgColor}!important;background-image:repeating-linear-gradient(45deg,transparent,transparent 10px,rgba(0,0,0,.03)10px,rgba(0,0,0,.03)11px)!important}`,
    };
    if (patterns[bgPattern]) parts.push(patterns[bgPattern]);
  }

  // 6. 强调色
  const accentColor = localStorage.getItem("editor-accent-color") || "";
  if (accentColor) {
    parts.push(`${scope}{--article-accent:${accentColor};--accent:${accentColor}}
${scope} blockquote{border-left:4px solid ${accentColor}!important}
${scope} a{color:${accentColor}!important;text-decoration-color:${accentColor}!important}
${scope} code:not(pre code){color:${accentColor}!important;background:color-mix(in srgb,${accentColor} 8%,transparent)!important}
${scope} th{background:${accentColor}!important;color:var(--accent-fg,#fff)!important}
${scope} ::selection{background:color-mix(in srgb,${accentColor} 30%,transparent)!important}
${scope} strong,${scope} b{color:${accentColor}!important;display:inline!important}`);
  }

  // 7. 代码主题
  const cThemeId = getSelectedCodeThemeId();
  const cTheme = getCodeTheme(cThemeId);
  if (cTheme) parts.push(scopeCSS(cTheme.css));

  // 8. 代码块基础样式（微信兼容：mac-dots 使用普通 flex 布局，不使用 absolute）
  const macos = localStorage.getItem("macos-code-block") === "true";
  if (macos) {
    // 获取代码主题背景色用于 macOS 顶栏（优先级：强调色 > 文章主题标题色 > 代码主题背景）
    const cThemeId_ = getSelectedCodeThemeId();
    const cTheme_ = getCodeTheme(cThemeId_);
    const accentColor_ = localStorage.getItem("editor-accent-color") || "";
    let macBarBg = '';
    if (accentColor_) {
      macBarBg = accentColor_;
    } else if (theme?.vars?.headingColor) {
      macBarBg = theme.vars.headingColor;
    } else if (cTheme_) {
      // 从代码主题 CSS 中提取背景色（格式: pre { background: #xxx !important; }）
      const bgMatch = cTheme_.css.match(/(?:pre|\bhljs\b)\s*\{[^}]*background(?:-color)?:\s*([^;!}]+)/i);
      if (bgMatch) macBarBg = bgMatch[1].trim();
    }
    if (!macBarBg) macBarBg = '#2b2b2b';
    // pre 背景色由代码主题 CSS（步骤 7）控制，与编辑器预览保持一致
    parts.push(`${scope} pre{padding:0!important;overflow:hidden!important;border-radius:10px!important;box-shadow:0 6px 16px rgba(0,0,0,.18)!important;margin:1.2em 0!important}
${scope} pre .mac-dots{display:flex!important;padding:10px 14px 0!important;background:${macBarBg}!important}
${scope} pre code{display:block!important;padding:0.5em 1em 1em!important;overflow-x:auto!important;white-space:nowrap!important;background:transparent!important;font-size:13px!important;font-family:"SF Mono",Consolas,"Courier New",monospace!important}`);
  } else {
    // pre 背景色由代码主题 CSS 控制，与编辑器预览保持一致
    parts.push(`${scope} pre{border-radius:6px!important;padding:14px!important;margin:1em 0!important;overflow-x:auto!important;border:1px solid #e0e0e0!important}
${scope} pre .mac-dots{display:none!important}
${scope} pre code{background:transparent!important;padding:0!important;font-size:13px!important;font-family:"SF Mono",Consolas,"Courier New",monospace!important}`);
  }

  return parts.join("\n\n");
}
