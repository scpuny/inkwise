/**
 * export/html.ts — 标准 HTML 导出
 *
 * 生成带行内样式的完整 HTML，适合复制到编辑器、邮件等场景。
 * 不做微信专用的语义 class 处理。
 */
import { markdownToHtml } from "../markdown/renderer";
import { collectPublishCss } from "../styles/collector";
import { resolveCssColors } from "../styles/resolver";
import { inlineCssFull } from "../styles/inliner";

/**
 * 编译为完整内联样式的 HTML（通用发布用）。
 *
 * @param markdown Markdown 原文
 * @returns        内联后的 HTML 字符串（已剥离外部 <html>/<body> 包裹）
 */
export async function compileToInlinedHtml(markdown: string): Promise<string> {
  const bodyHtml = markdownToHtml(markdown);
  const cssText = collectPublishCss();
  const accentColor = localStorage.getItem("editor-accent-color") || "";
  const resolvedCss = resolveCssColors(cssText, accentColor);

  const cleanedContent = await inlineCssFull(resolvedCss, bodyHtml);

  const fontFamily =
    localStorage.getItem("article-font-family") ||
    "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif";
  const fontColor = localStorage.getItem("article-text-color") || "#2b2b2b";

  // 通用清理：!important 和多余 class（微信不适用，优化通用场景）
  const result = cleanedContent
    .replace(/\s*!important\s*/g, " ")
    .replace(/\sclass="[^"]*"/g, "");

  return `<div style="font-family:${fontFamily};word-break:break-word;color:${fontColor};">${result}</div>`;
}
