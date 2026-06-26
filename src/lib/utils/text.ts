// text.ts — 文本处理工具函数

/** 去除 HTML 标签，返回纯文本 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

/**
 * 将 Markdown 文本转换为纯文本（可见文字），用于字数统计。
 *
 * - 移除代码块（```...```），代码不计入字数
 * - 移除行内代码（`...`）
 * - 移除图片标记 ![alt](url)
 * - 保留链接文字 [text](url) → text
 * - 移除 URL
 * - 移除 Markdown 标记符号（#, *, _, >, -, | 等）
 * - 移除表格格式
 * - 计数：中文字符每个算 1 字，英文按空格分词
 */
export function markdownToPlainText(md: string): string {
  let text = md;

  // 1. 先去除 HTML 标签（某些边缘场景 TipTap 输出混合 HTML）
  text = text.replace(/<[^>]*>/g, '');

  // 2. 移除代码块（三反引号）——代码不算字数
  text = text.replace(/```[\s\S]*?```/g, '');

  // 3. 移除行内代码
  text = text.replace(/`[^`]*`/g, '');

  // 4. 移除图片标记
  text = text.replace(/!\[.*?\]\(.*?\)/g, '');

  // 5. 保留链接文字，移除 URL 部分
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');

  // 6. 移除裸 URL
  text = text.replace(/https?:\/\/\S+/g, '');

  // 7. 移除标题标记
  text = text.replace(/^#{1,6}\s*/gm, '');

  // 8. 移除引用标记
  text = text.replace(/^>\s?/gm, '');

  // 9. 移除无序列表标记
  text = text.replace(/^[\s]*[-*+]\s+/gm, '');
  // 10. 移除有序列表标记
  text = text.replace(/^[\s]*\d+\.\s+/gm, '');

  // 11. 移除加粗/斜体标记
  text = text.replace(/[*_]{2,}/g, '');

  // 12. 移除分隔线
  text = text.replace(/^[-*_]{3,}\s*$/gm, '');

  // 13. 移除表格分隔行
  text = text.replace(/^\|?[-:]+\|[-:|]+\|?$/gm, '');

  // 14. 移除表格边框
  text = text.replace(/\|/g, ' ');

  // 15. 折叠空白
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

/** 统计文本字数：CJK 字符 + 英文单词 */
export function countWords(text: string): number {
  const cjk = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) || []).length;
  const words = (text.match(/[a-zA-Z]+/g) || []).length;
  return cjk + words;
}

/**
 * 从文章内容（Markdown 或 HTML）中统计字数。
 * - 统一先转纯文本再计数
 */
export function getWordCount(content: string | null | undefined): number {
  if (!content) return 0;
  const plain = markdownToPlainText(content);
  return countWords(plain);
}
