/**
 * ArticlePreview.tsx — 文章预览（编辑器终稿面板）
 *
 * 使用 src/lib/markdown/renderer.ts 中的单一 markdownToHtml。
 */
import { useMemo } from "react";
import { markdownToHtml } from "../../lib/markdown/renderer";

interface ArticlePreviewProps {
  content: string;
}

export function ArticlePreview({ content }: ArticlePreviewProps) {
  const html = useMemo(() => markdownToHtml(content), [content]);
  return <section className="article-preview" dangerouslySetInnerHTML={{ __html: html }} />;
}
