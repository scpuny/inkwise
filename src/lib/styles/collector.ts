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
import { getSelectedArticleThemeId, getThemeById } from "../theme/articleThemes";
import { getSelectedCodeThemeId, getCodeTheme, getTemplate, getSelectedTemplateId } from "../editor/editorStyles";

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
  accentColor?: string;
  strongColor?: string;
  markBg?: string;
  hrColor?: string;
  pageBg?: string;
  pageBgSize?: string;
  headingVariant?: string;
  headingBg?: string;
  headingText?: string;
  headingLine?: string;
}

// ─── Helpers ───

/** 从模板 CSS 中提取主色调（取 a 标签的 color 值作为模板主题色） */
function extractTemplateAccent(templateCss: string): string {
  const match = templateCss.match(/a\s*\{[^}]*color\s*:\s*([^;}]+)/i);
  return match ? match[1].trim() : '';
}

/** 将 body → {scope} 并 scope 所有选择器到 {scope} */
function scopeCSS(css: string, scope: string = ".article-body"): string {
  const bodyRe = new RegExp("\\bbody\\b(?=\\s*\\{)", "g");
  const escScope = scope.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return css
    .replace(bodyRe, scope)
    .replace(new RegExp("^\\s*([^{}]+?)\\s*\\{", "gm"), (_m: string, sel: string) =>
      sel
        .split(",")
        .map((s: string) => {
          const t = s.trim();
          if (new RegExp("^(" + escScope + "|&|@|:)").test(t)) return t;
          return scope + " " + t;
        })
        .join(", ") + " {",
    );
}

/** 从主题变量生成完整 CSS */
function buildThemeCss(vars: ThemeVars, scope: string = ".article-body"): string {
  const ff = vars.fontFamily || "-apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";
  const fs = vars.fontSize ?? 16;
  const lh = vars.lineHeight ?? 1.75;
  const tc = vars.textColor || "#333";
  const bg = vars.pageBg || vars.bgColor || "#fff";
  const mw = vars.maxWidth ?? 720;
  const hc = vars.headingColor || "inherit";
  const lc = vars.linkColor || "#0969da";
  const cb = vars.codeBg || "#f0f0f0";
  const ct = vars.codeText || "#333";
  const ac = vars.accentColor || lc;
  const sc = vars.strongColor || hc;
  const mb = vars.markBg || "#fff3cd";
  const hr = vars.hrColor || "#d0d7de";
  const pg = vars.paragraphGap || "0.5em";

  let css = `${scope} {
  font-family: ${ff} !important;
  font-size: ${fs}px !important;
  line-height: ${lh} !important;
  color: ${tc} !important;
  max-width: ${mw}px !important;
  margin: 0 auto !important;
  padding: 24px 20px !important;
  background: ${bg} !important;
  background-size: ${vars.pageBgSize || 'auto'} !important;
}
${scope} p, ${scope} li, ${scope} blockquote, ${scope} td, ${scope} th {
  font-family: ${ff} !important; font-size: ${fs}px !important; line-height: ${lh} !important; color: ${tc} !important;
}
${scope} h1, ${scope} h2, ${scope} h3, ${scope} h4 {
  color: ${hc} !important; margin: 1.2em 0 0.5em !important; line-height: 1.3 !important;
}
${scope} strong { color: ${sc} !important; }
${scope} a { color: ${lc} !important; }
${scope} p { margin: 0 0 ${pg} !important; }
${scope} mark {
  background: ${mb} !important;
  padding: 0 4px !important;
  border-radius: 3px !important;
}
${scope} code {
  background: ${cb} !important; color: ${ct} !important; padding: 2px 6px !important; border-radius: 4px !important;
  font-size: 0.9em !important; font-family: "SF Mono", Consolas, "Courier New", monospace !important;
}
${scope} pre { background: ${cb}; color: ${ct}; padding: 12px 16px !important; overflow-x: auto !important; border-radius: 4px !important; }
${scope} pre code { padding: 0 !important; background: none !important; }
${scope} blockquote {
  margin: 1em 0 !important;
  border-radius: 0 6px 6px 0 !important;
}
${scope} blockquote > * { margin-left: 0 !important; padding-left: 0 !important; }
${scope} img { max-width: 100% !important; border-radius: 4px !important; margin: 1em auto !important; display: block !important; }
${scope} figcaption { text-align: center !important; color: ${tc} !important; opacity: 0.6 !important; font-size: 0.85em !important; margin-top: 4px !important; }
${scope} table { width: 100% !important; border-collapse: collapse !important; margin: 1em 0 !important; }
${scope} th, ${scope} td { border: 1px solid ${hr} !important; padding: 6px 10px !important; text-align: left !important; }
${scope} th { background: ${cb} !important; font-weight: 600 !important; }
${scope} hr { border: none !important; border-top: 1px solid ${hr} !important; margin: 1.5em 0 !important; }
${scope} ul, ${scope} ol { margin: 0.5em 0 !important; padding-left: 1.2em !important; }
${scope} li { margin: 0.3em 0 !important; }
`;

  // Ribbon heading variant
  if (vars.headingVariant === 'ribbon') {
    const hBg = vars.headingBg || ac;
    const hText = vars.headingText || '#ffffff';
    const hLine = vars.headingLine || ac;
    css += `
${scope} h1, ${scope} h2, ${scope} h3, ${scope} h4, ${scope} h5 {
  display: inline-block !important;
  background: ${hBg} !important;
  color: ${hText} !important;
  padding: 6px 24px 6px 16px !important;
  position: relative !important;
  clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%) !important;
  margin-bottom: 0.6em !important;
}
${scope} h1::after, ${scope} h2::after, ${scope} h3::after, ${scope} h4::after, ${scope} h5::after {
  content: '' !important;
  position: absolute !important;
  bottom: -4px !important;
  left: 0 !important;
  right: 12px !important;
  height: 3px !important;
  background: ${hLine} !important;
  border-radius: 2px !important;
}`;
  }

  return css;
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
  if (template) parts.push(scopeCSS(template.css, scope));

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
    parts.push(buildThemeCss(overrideVars, scope));
  }

  // 3. 文本样式（> p 直接段落首行缩进，两端对齐同时作用于直接段落和引用段落）
  if (localStorage.getItem("first-line-indent") === "true") {
    parts.push(`${scope} > p { text-indent: 2em !important; }`);
  } else {
    // 显式重置所有段落（含 blockquote），覆盖模板 CSS 自带 text-indent
    parts.push(`${scope} p { text-indent: 0 !important; }`);
  }
  if (localStorage.getItem("justify-align") === "true") {
    parts.push(`${scope} > p, ${scope} blockquote p { text-align: justify !important; }`);
  } else {
    parts.push(`${scope} > p, ${scope} blockquote p { text-align: initial !important; }`);
  }

  // 4. 标题装饰
  try {
    const hConfig: Record<string, string[]> = JSON.parse(localStorage.getItem("heading-deco-config") || "{}") || {};
    for (const [hl, decos] of Object.entries(hConfig)) {
      if (!decos.length) continue;
      const sel = `${scope} ${hl}`;
      const s: string[] = [];
      const extra: string[] = [];
      if (decos.includes("underline")) s.push("border-bottom:2px solid var(--accent,#0969da)!important;padding-bottom:6px");
      if (decos.includes("overline")) s.push("border-top:2px solid var(--accent,#0969da)!important;padding-top:6px");
      if (decos.includes("left-bar")) s.push("border-left:4px solid color-mix(in srgb,var(--accent,#0969da) 70%,currentColor)!important;padding-left:14px");
      if (decos.includes("right-bar")) s.push("border-right:4px solid var(--accent,#0969da)!important;padding-right:14px");
      if (decos.includes("bg-block")) s.push("background:color-mix(in srgb,var(--accent,#0969da) 12%,transparent)!important;padding:4px 10px;border-radius:6px;display:inline-block");
      if (decos.includes("left-icon")) {
        s.push("position:relative;padding-left:1.6em");
        extra.push(`${sel}::before{content:"\\258e";position:absolute;left:0;color:var(--accent,#0969da);font-size:1.2em;font-weight:700}`);
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

  // 6. 强调色 + CSS 变量（始终设置 --accent，用于标题装饰等）
  const accentColor = localStorage.getItem("editor-accent-color") || "";
  const themeAccent = theme?.vars?.accentColor || "";
  const headingColor = theme?.vars?.headingColor || "";
  const templateAccent = template ? extractTemplateAccent(template.css) : "";
  const effectiveAccent = accentColor || themeAccent || headingColor || templateAccent || "#0969da";
  // 始终注入 --accent 变量（标题装饰、strong、代码块等依赖它）
  const accentVarCss = `${scope}{--article-accent:${effectiveAccent};--accent:${effectiveAccent}}`;
  // 始终注入 accent 元素样式，用 var(--accent) 跟随模版/主题主色
  const accentElCss = `${scope} blockquote{border-left:4px solid var(--accent,#0969da)!important}
${scope} a{color:var(--accent,#0969da)!important;text-decoration-color:var(--accent,#0969da)!important}
${scope} code:not(pre code){color:var(--accent,#0969da)!important;background:color-mix(in srgb,var(--accent,#0969da) 8%,transparent)!important}
${scope} th{background:var(--accent,#0969da)!important;color:var(--accent-fg,#fff)!important}
${scope} ::selection{background:color-mix(in srgb,var(--accent,#0969da) 30%,transparent)!important}
`;
  if (accentColor) {
    // 有明确强调色：用具体值（兼容不支持 CSS 变量的环境）+ CSS 变量
    parts.push(`${accentVarCss}
${scope} blockquote{border-left:4px solid ${accentColor}!important}
${scope} a{color:${accentColor}!important;text-decoration-color:${accentColor}!important}
${scope} code:not(pre code){color:${accentColor}!important;background:color-mix(in srgb,${accentColor} 8%,transparent)!important}
${scope} th{background:${accentColor}!important;color:var(--accent-fg,#fff)!important}
${scope} ::selection{background:color-mix(in srgb,${accentColor} 30%,transparent)!important}
${scope} strong,${scope} b{color:${accentColor}!important;display:inline!important}`);
  } else if (themeId !== 'clean') {
    // 有选非默认文章主题：仅注入 --accent 变量，元素颜色由 buildThemeCss 控制
    parts.push(`${accentVarCss}`);
  } else {
    // 无强调色 + 默认主题：注入 --accent 变量，strong 跟随主题 strongColor 或 fallback
    // 直接从 theme?.vars 获取 strongColor（该分支仅 clean 主题触发）
    const cs = theme?.vars?.strongColor || "";
    const strongCss = cs
      ? `${scope} strong,${scope} b{color:${cs}!important;display:inline!important}`
      : `${scope} strong,${scope} b{color:var(--accent,#0969da)!important;display:inline!important}`;
    parts.push(`${accentVarCss}
${accentElCss}
${strongCss}`);
  }

  // 7. 代码主题
  const cThemeId = getSelectedCodeThemeId();
  const cTheme = getCodeTheme(cThemeId);
  if (cTheme) parts.push(scopeCSS(cTheme.css, scope));

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
    } else if (templateAccent) {
      macBarBg = templateAccent;
    } else if (cTheme_) {
      // 从代码主题 CSS 中提取背景色（格式: pre { background: #xxx !important; }）
      const bgMatch = cTheme_.css.match(/(?:pre|\bhljs\b)\s*\{[^}]*background(?:-color)?:\s*([^;!}]+)/i);
      if (bgMatch) macBarBg = bgMatch[1].trim();
    }
    if (!macBarBg) macBarBg = '#2b2b2b';
    // pre 背景色由代码主题 CSS（步骤 7）控制，与编辑器预览保持一致
    parts.push(`${scope} pre{padding:0!important;overflow:hidden!important;border-radius:10px!important;box-shadow:0 6px 16px rgba(0,0,0,.18)!important;margin:1.2em 0!important}
${scope} pre .mac-dots{display:flex!important;padding:10px 14px 0!important;background:${macBarBg}!important}
${scope} pre code{display:block!important;padding:1em 1em 1em!important;overflow-x:auto!important;white-space:nowrap!important;background:transparent!important;font-size:13px!important;font-family:"SF Mono",Consolas,"Courier New",monospace!important}`);
  } else {
    // pre 背景色由代码主题 CSS 控制，与编辑器预览保持一致
    parts.push(`${scope} pre{border-radius:6px!important;padding:14px!important;margin:1em 0!important;overflow-x:auto!important;border:1px solid #e0e0e0!important}
${scope} pre .mac-dots{display:none!important}
${scope} pre code{background:transparent!important;padding:0!important;font-size:13px!important;font-family:"SF Mono",Consolas,"Courier New",monospace!important;white-space:nowrap!important;overflow-x:auto!important;display:block!important}`);
  }

  return parts.join("\n\n");
}
