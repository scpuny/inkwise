// text.ts — 文本处理工具函数

/** 去除 HTML 标签，返回纯文本 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

/**
 * 统计文章字数。
 * - 先去除 HTML 标签
 * - 中文/日文/韩文等 CJK 字符每个算 1 字
 * - 英文单词按空格分词计数
 * - 数字、标点不计数
 */
export function getWordCount(content: string | null | undefined): number {
  if (!content) return 0;

  // 1. 去除 HTML 标签
  const text = stripHtml(content);

  // 2. 统计中文字符（CJK 统一表意文字区段）
  const cjkChars = text.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g);
  const cjkCount = cjkChars ? cjkChars.length : 0;

  // 3. 统计英文单词（连续的字母）
  const englishWords = text.match(/[a-zA-Z]+/g);
  const wordCount = englishWords ? englishWords.length : 0;

  return cjkCount + wordCount;
}
