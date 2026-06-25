/**
 * export/wechat.ts — 微信公众号导出
 *
 * 工作流程：
 *  1. markdownToHtml() 渲染 HTML
 *  2. collectPublishCss() 收集所有样式
 *  3. resolveCssColors() 解析 CSS 变量
 *  4. inlineCss() / inlineCssFull() 内联样式
 *  5. addStyledClasses() 加语义 class（辅助微信识别元素）
 *  6. renderWechatHtml() 组装最终 HTML
 */
import { markdownToHtml } from "../markdown/renderer";
import { collectPublishCss } from "../styles/collector";
import { resolveCssColors } from "../styles/resolver";
import { inlineCss } from "../styles/inliner";
import type { ImageItem, ExportResult } from "./types";

// ─── 语义 class 添加 ───

/**
 * 为元素添加语义 class（doocs/md 风格），辅助微信编辑器识别元素类型。
 */
export function addStyledClasses(bodyHtml: string): string {
  let html = bodyHtml;

  // 所有替换原则：保留已有属性（尤其是 style），只追加 class/data 属性
  html = html.replace(/<(h[1-6])(\b[^>]*)?>/gi, (_m, tag, attrs) => {
    if (/class\s*=/.test(attrs || "")) return _m;
    return `<${tag} class="${tag}" data-heading="true"${attrs || ""}>`;
  });
  html = html.replace(/<p(\b[^>]*)?>/gi, (_m, attrs) => {
    if (/class\s*=/.test(attrs || "")) return _m;
    return `<p class="p"${attrs || ""}>`;
  });
  html = html.replace(/<blockquote(\b[^>]*)?>/gi, (_m, attrs) => {
    if (/class\s*=/.test(attrs || "")) return _m;
    return `<blockquote class="blockquote"${attrs || ""}>`;
  });
  html = html.replace(/<code(\b[^>]*)?>/gi, (_m, attrs) => {
    if (/class\s*=/.test(attrs || "")) return _m;
    return `<code class="codespan"${attrs || ""}>`;
  });
  html = html.replace(/<pre\b([^>]*)>/gi, (_m, attrs) => {
    if (/code__pre/.test(attrs)) return _m;
    if (/class\s*=/.test(attrs)) return `<pre ${attrs.replace(/class="([^"]*)"/, 'class="$1 code__pre"')}>`;
    return `<pre class="hljs code__pre"${attrs}>`;
  });
  html = html.replace(/<strong(\b[^>]*)?>/gi, (_m, attrs) => {
    if (/class\s*=/.test(attrs || "")) return _m;
    return `<strong class="strong"${attrs || ""}>`;
  });
  html = html.replace(/<em(\b[^>]*)?>/gi, (_m, attrs) => {
    if (/class\s*=/.test(attrs || "")) return _m;
    return `<em class="em"${attrs || ""}>`;
  });
  html = html.replace(/<img\b([^>]*)>/gi, (_m, attrs) => {
    if (/class\s*=/.test(attrs || "")) return _m;
    return `<img ${attrs} class="img">`;
  });
  html = html.replace(/<figcaption(\b[^>]*)?>/gi, (_m, attrs) => {
    if (/class\s*=/.test(attrs || "")) return _m;
    return `<figcaption class="figcaption"${attrs || ""}>`;
  });
  html = html.replace(/<(ul|ol)(\b[^>]*)?>/gi, (_m, tag, attrs) => {
    if (/class\s*=/.test(attrs || "")) return _m;
    return `<${tag} class="${tag}"${attrs || ""}>`;
  });
  html = html.replace(/<li(\b[^>]*)?>/gi, (_m, attrs) => {
    if (/class\s*=/.test(attrs || "")) return _m;
    return `<li class="listitem"${attrs || ""}>`;
  });
  html = html.replace(/<table(\b[^>]*)?>/gi, (_m, attrs) => {
    if (/class\s*=/.test(attrs || "")) return _m;
    return `<table class="preview-table"${attrs || ""}>`;
  });
  html = html.replace(/<th(\b[^>]*)?>/gi, (_m, attrs) => {
    if (/class\s*=/.test(attrs || "")) return _m;
    return `<th class="th"${attrs || ""}>`;
  });
  html = html.replace(/<td(\b[^>]*)?>/gi, (_m, attrs) => {
    if (/class\s*=/.test(attrs || "")) return _m;
    return `<td class="td"${attrs || ""}>`;
  });
  html = html.replace(/<hr\b([^>]*)>/gi, (_m, attrs) => {
    if (/class\s*=/.test(attrs || "")) return _m;
    return `<hr class="hr hr-dash"${attrs || ""}>`;
  });

  return html;
}

// ─── 图片提取 ───

function extractImages(bodyHtml: string): ImageItem[] {
  const images: ImageItem[] = [];
  const re = /<img[^>]+src="([^"]*)"[^>]*alt="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(bodyHtml)) !== null) {
    images.push({ originalSrc: m[1], alt: m[2], index: images.length });
  }
  return images;
}

// ─── 组装 ───

/**
 * 将已内联样式的 body HTML 组装为微信兼容的完整 HTML。
 *
 * @param bodyHtml  已内联样式的 body 内容
 * @param css       预览用 CSS（微信忽略，仅调试用）
 * @param baseStyle 容器兜底样式（如 font-family）
 */
export function renderWechatHtml(
  bodyHtml: string,
  css: string,
  baseStyle?: string,
): ExportResult {
  // 1. 加语义 class
  const styledHtml = addStyledClasses(bodyHtml);

  // 2. 提取图片
  const images = extractImages(bodyHtml);

  // 3. 组装
  const styleAttr = baseStyle ? ` style="${baseStyle.replace(/"/g, "'")}"` : "";
  const html = `<style>${css}</style>
<div id="output"${styleAttr}>
${styledHtml}
</div>`;

  return { html, images };
}

// ─── 主入口 ───

/**
 * 编译为微信公众号专用 HTML。
 *
 * 流程：markdown → markdownToHtml → collectPublishCss → resolveCssColors → juice 内联 → renderWechatHtml
 *
 * @param markdown  Markdown 原文
 */
export async function compileToWechatHtml(markdown: string): Promise<ExportResult> {
  // 1. markdown → 纯净 HTML
  const bodyHtml = markdownToHtml(markdown);

  // 2. 收集发布样式，作用域改为 section.wechat-wrapper，背景色/字体直接内联到 <section> 上
  let cssText = collectPublishCss().replace(/\.article-body\b/g, "section.wechat-wrapper");

  // 3. 微信专用 CSS 调整：已统一用 .mac-dots span 替代 ::before/::after，无需额外处理
  const wechatCss = cssText
    // 隐藏默认列表符号
    + "\nsection.wechat-wrapper ul,section.wechat-wrapper ol{list-style:none!important}"
    + "\nsection.wechat-wrapper h1,section.wechat-wrapper h2,section.wechat-wrapper h3,section.wechat-wrapper h4,section.wechat-wrapper h5,section.wechat-wrapper h6{line-height:1.3!important;margin:1.2em 0 0.5em!important}";
  // 微信会丢弃外层 wrapper 上的样式，复制到所有内容块级元素上
  // 取最后一条 section.wechat-wrapper 规则（主题覆盖模板后的最终值）
  const styleRules = wechatCss.match(/section\.wechat-wrapper\s*\{[^}]*\}/g) || [];
  // 倒序查找最后一条带 font-size 的规则（accent-color 等也会产生不带 font-size 的 wrapper 块）
  let styleEl = styleRules.length > 0 ? styleRules[styleRules.length - 1] : "";
  for (let i = styleRules.length - 1; i >= 0; i--) {
    if (/\bfont-size\s*:/.test(styleRules[i])) { styleEl = styleRules[i]; break; }
  }
  const fontS = styleEl.match(/\bfont-size\s*:\s*([^;}]+)/)?.[1];
  const lineH = styleEl.match(/\bline-height\s*:\s*([^;}]+)/)?.[1];
  const bgClr = styleEl.match(/\bbackground\s*:\s*([^;}]+)/)?.[1];
  const fontF = styleEl.match(/\bfont-family\s*:\s*([^;}]+)/)?.[1];
  const colorV = styleEl.match(/\bcolor\s*:\s*([^;}]+)/)?.[1];
  let extraCss = "";
  if (bgClr) extraCss += `\nsection.wechat-wrapper p,section.wechat-wrapper li{background-color:${bgClr.trim()}!important}\nsection.wechat-wrapper blockquote p,section.wechat-wrapper blockquote li{background:none!important;background-color:transparent!important}`;
  if (fontS) extraCss += `\nsection.wechat-wrapper p,section.wechat-wrapper li,section.wechat-wrapper blockquote{font-size:${fontS.trim()}}`;
  if (lineH) extraCss += `\nsection.wechat-wrapper p,section.wechat-wrapper li,section.wechat-wrapper blockquote{line-height:${lineH.trim()}}`;
  if (fontF) extraCss += `\nsection.wechat-wrapper p,section.wechat-wrapper li,section.wechat-wrapper blockquote{font-family:${fontF.trim()}}`;
  if (colorV) extraCss += `\nsection.wechat-wrapper p,section.wechat-wrapper li,section.wechat-wrapper blockquote{color:${colorV.trim()}}`;
  const bgPropagated = extraCss ? wechatCss + extraCss : wechatCss;


  const accentColor = localStorage.getItem("editor-accent-color") || "";
  const resolvedCss = resolveCssColors(bgPropagated, accentColor);

  // 4. 直接用 juice 内联，背景色等样式正确落到包装器上
  //    使用 inlineCss 而非 inlineCssFull
  const cleanedContent = await inlineCss(resolvedCss, '<section class="wechat-wrapper">' + bodyHtml + '</section>', {
    inlinePseudoElements: false,
  });

  // 5. 清理 !important
  const cleaned = cleanedContent.replace(/\s*!important\s*/g, " ");

  // 6. 代码块后处理：确保 white-space 正确（微信不支持 overflow-x）
  //     macOS 的 code 已有 white-space:nowrap;overflow-x:auto，pre 只需要确保 white-space 正确
  const fixed = cleaned
    // 先给没有 style 的 <pre> 补上
    .replace(/(<pre\b)((?![^>]*style=)[^>]*>)/gi, '$1 style="white-space:pre;"$2')
    // 再修正已有 style 的 <pre>
    .replace(/(<pre\b[^>]*style=")([^"]*)(")/gi, (_m: string, pre: string, styles: string, post: string) => {
      let s = styles;
      // 只处理 white-space，其他属性由 CSS 决定
      if (/white-space\s*:\s*pre-wrap/.test(s)) s = s.replace(/white-space\s*:\s*pre-wrap/gi, 'white-space:pre');
      else if (!/white-space\s*:\s*pre\b/.test(s) && !/white-space\s*:\s*nowrap/.test(s)) s = 'white-space:pre;' + s;
      return pre + s + post;
    })
    // 确保 <li> 是 block 显示
    .replace(/(<li\b)((?![^>]*style=)[^>]*>)/gi, '$1 style="display:block;list-style:none;"$2')
    // 修正已有 style 的 <li>：追加 list-style:none 和 display:block
    .replace(/(<li\b[^>]*style=")([^"]*)(")/gi, (_m: string, pre: string, styles: string, post: string) => { if (!/display\s*:\s*block/.test(styles)) styles = 'display:block;' + styles; if (!/list-style\s*:\s*none/.test(styles)) styles += ';list-style:none'; return pre + styles + post; })

  // 7. 首行缩进后处理（juice 不处理 :not 伪类，需手动添加）
  //    排除 <li> 和 <blockquote> 内的 <p>
  let postHtml = fixed;
  if (localStorage.getItem("first-line-indent") === "true") {
    // 先标记所有 <p>
    postHtml = postHtml.replace(/(<p\b)/g, '<p data-fi="1"');
    // 移除 <li> 和 <blockquote> 内 <p> 的标记
    postHtml = postHtml.replace(/<(li|blockquote)[^>]*>[\s\S]*?<\/\1>/g, m => m.replace(/data-fi="1"/g, ''));
    // 给有标记的 <p> 添加 text-indent
    postHtml = postHtml.replace(/<p data-fi="1"\b([^>]*style=")([^"]*)(")/g, (_m: string, pre: string, styles: string, post: string) => {
      if (!/text-indent/.test(styles)) styles = 'text-indent:2em;' + styles;
      return '<p' + pre + styles + post;
    });
    // 清理残留标记
    postHtml = postHtml.replace(/ data-fi="1"/g, '');
  }

  // 8. 加语义 class并包装
  //    inlineCss 的输出已包含 <section class="wechat-wrapper">
  const styledHtml = addStyledClasses(postHtml);

  // 提取图片
  const images: ImageItem[] = [];
  const re = /<img[^>]+src="([^"]*)"[^>]*alt="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fixed)) !== null) {
    images.push({ originalSrc: m[1], alt: m[2], index: images.length });
  }

  return { html: styledHtml, images };
}


