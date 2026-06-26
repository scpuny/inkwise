/**
 * compileHtml.ts — 向后兼容层
 *
 * 所有功能已迁移至：
 *  - src/lib/markdown/      (markdownToHtml)
 *  - src/lib/styles/        (collectPublishCss, resolveCssColors, inlineCss)
 *  - src/lib/export/        (compileToWechatHtml, compileToInlinedHtml)
 *
 * 请直接引用新模块。此处保留以兼容现有导入。
 */

export { markdownToHtml } from "../markdown/renderer";
export { resolveCssColors } from "../styles/resolver";
export { collectPublishCss } from "../styles/collector";
export { compileToWechatHtml, renderWechatHtml, addStyledClasses } from "../export/wechat";
export { compileToInlinedHtml } from "../export/html";
export type { ImageItem, ExportResult } from "../export/types";
