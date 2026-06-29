/**
 * export/html.ts — 标准 HTML 导出
 *
 * 生成带行内样式的完整 HTML，适合复制到编辑器、邮件等场景。
 * 不做微信专用的语义 class 处理。
 *
 * Mermaid 图表在导出时自动渲染为 SVG，确保图文完整性。
 */
import { markdownToHtml } from "../markdown/renderer";
import { collectPublishCss } from "../styles/collector";
import { resolveCssColors } from "../styles/resolver";
import { inlineCssFull } from "../styles/inliner";
import { renderMermaidInHtml } from "./mermaid";

/** Mermaid 导出样式（作用域跟随 collectPublishCss 的 scope） */
const MERMAID_EXPORT_CSS = `.article-body .mermaid-export,.article-preview .mermaid-export{text-align:center;margin:16px 0}.article-body .mermaid-export svg,.article-preview .mermaid-export svg{max-width:100%;height:auto;display:inline-block}`;

/**
 * 编译为完整内联样式的 HTML（通用发布用）。
 *
 * @param markdown Markdown 原文
 * @returns        内联后的 HTML 字符串（已剥离外部 <html>/<body> 包裹）
 */
export async function compileToInlinedHtml(markdown: string): Promise<string> {
  // 1. Markdown → HTML（含 mermaid 占位 div）
  let bodyHtml = markdownToHtml(markdown);

  // 2. Mermaid 占位 → 渲染的 SVG
  bodyHtml = await renderMermaidInHtml(bodyHtml);

  // 3. 收集样式
  let cssText = collectPublishCss();
  // 追加 mermaid 导出样式（scope 自适应）
  cssText += "\n" + MERMAID_EXPORT_CSS;

  const accentColor = localStorage.getItem("editor-accent-color") || "";
  const resolvedCss = resolveCssColors(cssText, accentColor);

  const cleanedContent = await inlineCssFull(resolvedCss, bodyHtml);

  const fontFamily =
    localStorage.getItem("article-font-family") ||
    "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif";
  const fontColor = localStorage.getItem("article-text-color") || "#2b2b2b";

  // 通用清理：!important 和多余 class
  const result = cleanedContent
    .replace(/\s*!important\s*/g, " ")
    .replace(/\sclass="[^"]*"/g, "");

  return `<div style="font-family:${fontFamily};word-break:break-word;color:${fontColor};">${result}</div>`;
}
