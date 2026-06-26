/**
 * inliner.ts — CSS 内联引擎（juice 封装）
 *
 * 将 HTML 内容 + CSS 样式表 → juice 内联 → 返回已内联的 body HTML。
 * 供各平台导出模块共享。
 */
/** juice 选项 */
const DEFAULT_JUICE_OPTIONS = {
  inlinePseudoElements: true,
  preserveImportant: true,
  removeStyleTags: true,
  preserveMediaQueries: false,
};

/** Lazy import juice (browser-compatible build) */
async function getJuice() {
  // @ts-ignore - dynamic import works in Vite
  const mod = await import("juice");
  return mod.default || mod;
}

/**
 * 将 CSS 内联到 HTML 上。
 *
 * @param cssText         CSS 样式文本
 * @param bodyHtml        HTML body 内容（不含 <html>/<head>/<body> 包裹）
 * @returns               内联后的 body HTML
 */
export async function inlineCss(cssText: string, bodyHtml: string, juiceOptions?: Partial<typeof DEFAULT_JUICE_OPTIONS>): Promise<string> {
  const options = juiceOptions ? { ...DEFAULT_JUICE_OPTIONS, ...juiceOptions } : DEFAULT_JUICE_OPTIONS;
  const htmlWithCss = `<style>${cssText}</style>${bodyHtml}`;

  const juice = await getJuice();
  const inlined = await juice(htmlWithCss, options);

  // 清理 !important 残留（微信不认）
  return inlined.replace(/\s*!important\s*/g, " ");
}

/**
 * 将 CSS 内联到完整 HTML 文档上，并提取 body 内容。
 *
 * @param cssText         CSS 样式文本
 * @param bodyHtml        HTML body 内容
 * @param wrapperClass    body 的 class（如 "article-body"）
 * @param withFontWrap    是否用字体外层 div 包裹
 * @returns               内联且清理后的 body HTML
 */
export async function inlineCssFull(
  cssText: string,
  bodyHtml: string,
  wrapperClass = "article-body",
  juiceOptions?: Partial<typeof DEFAULT_JUICE_OPTIONS>,
): Promise<string> {
  const options = juiceOptions ? { ...DEFAULT_JUICE_OPTIONS, ...juiceOptions } : DEFAULT_JUICE_OPTIONS;
  const htmlDoc = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8">
<style>${cssText}</style>
</head>
<body class="${wrapperClass}">
${bodyHtml}
</body>
</html>`;

  const juice = await getJuice();
  const inlined = await juice(htmlDoc, options);

  const bodyMatch = inlined.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return bodyMatch ? bodyMatch[1].trim() : inlined;
}
