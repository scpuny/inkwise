import { useState, useEffect, useCallback, useRef } from "react";
import { FinalTopBar } from "./FinalTopBar";
import { FinalSidePanel } from "./FinalSidePanel";
import { ArticlePreview } from "./ArticlePreview";
import { markdownToHtml } from "../lib/markdown/renderer";
import { compileToInlinedHtml } from "../lib/compileHtml";
import { getCodeTheme, getSelectedCodeThemeId, getSelectedTemplateId, getTemplate } from "../lib/editorStyles";
import { collectPublishCss } from "../lib/styles/collector";
import { copyAsHtml, copyAsWechatHtml } from "../lib/importExport";
import { PublishDialog } from "./PublishDialog";
import { loadArticleContent, loadArticleMeta } from "../lib/articles";
import { loadBlueprint, saveBlueprint, type ArticleBlueprint } from "../lib/articleBlueprint";
import { getPublishHistory, publishArticle, addPublishRecord, type PublishRecord, type PublishOptions, type PublishResult } from "../lib/platforms";

const DEFAULT_CONTENT = "# 无标题\n\n开始写作…\n";

interface ArticleFinalPageProps {
  articleId: string;
  collectionId: string;
  onBackToEdit: () => void;
  genId: () => string;
}

export function ArticleFinalPage({
  articleId,
  onBackToEdit,
  genId,
}: ArticleFinalPageProps) {
  const [markdown, setMarkdown] = useState("");
  const [blueprint, setBlueprint] = useState<ArticleBlueprint | null>(null);
  const [publishRecords, setPublishRecords] = useState<PublishRecord[]>([]);
  const [publishOpen, setPublishOpen] = useState(false);
  const [articleTitle, setArticleTitle] = useState("");
  const [createdAt, setCreatedAt] = useState(0);
  const [updatedAt, setUpdatedAt] = useState(0);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const styleRefs = useRef<HTMLStyleElement[]>([]);

  // Use the same unified CSS pipeline as export (collectPublishCss)
  // to ensure editor preview, final page, and WeChat export are always consistent.
  useEffect(() => {
    const tags: HTMLStyleElement[] = [];

    // 1. Collect all CSS from unified pipeline (template + theme + code + decorations + accent + etc.)
    const cssText = collectPublishCss(".article-preview");
    if (cssText.trim()) {
      const s = document.createElement("style");
      s.id = "preview-unified-styles";
      s.textContent = cssText;
      document.head.appendChild(s);
      tags.push(s);
    }

    // 2. Add list-style:none to hide default markers
    const listStyleTag = document.createElement("style");
    listStyleTag.id = "preview-list-style-override";
    listStyleTag.textContent = ".article-preview ul, .article-preview ol { list-style: none !important; padding-left: 1.5em !important; }";
    document.head.appendChild(listStyleTag);
    tags.push(listStyleTag);

    styleRefs.current = tags;

    return () => {
      for (const t of styleRefs.current) t.remove();
      styleRefs.current = [];
    };
  }, []);

  // Load article data
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const meta = await loadArticleMeta(articleId);
      if (!cancelled) {
        setCreatedAt(meta?.createdAt ?? Date.now());
        setUpdatedAt(meta?.updatedAt ?? Date.now());
      }
      const content = await loadArticleContent(articleId);
      if (cancelled) return;
      const md = content || DEFAULT_CONTENT;
      setMarkdown(md);
      const firstLine = md.split("\n").find((l) => l.trim().startsWith("# "));
      if (firstLine) setArticleTitle(firstLine.trim().replace(/^#\s+/, ""));
      const bp = await loadBlueprint(articleId);
      if (!cancelled && bp) {
        setBlueprint(bp);
        if (bp.workingTitle && !firstLine) setArticleTitle(bp.workingTitle);
      }
      const records = await getPublishHistory(articleId);
      if (!cancelled) setPublishRecords(records);
    })();
    return () => { cancelled = true; };
  }, [articleId]);

  const wordCount = markdown === DEFAULT_CONTENT
    ? 0
    : markdown.replace(/^#+\s.*$/gm, "").replace(/\s/g, "").length;

  const handlePublish = useCallback(() => setPublishOpen(true), []);

  const handleBackWithReview = useCallback(async () => {
    if (articleId) {
      const bp = await loadBlueprint(articleId);
      if (bp) {
        bp.phase = "reviewing";
        await saveBlueprint(articleId, bp);
      }
    }
    onBackToEdit();
  }, [articleId, onBackToEdit]);

  const handlePublishSubmit = useCallback(async (
    platform: string, options: PublishOptions, action: "draft" | "publish"
  ): Promise<PublishResult> => {
    // Build the styled HTML for publishing
    const styledHtml = await compileToInlinedHtml(markdown);
    const result = await publishArticle(articleId, platform, markdown, styledHtml, options, action);
    if (result.success) {
      const record: PublishRecord = {
        id: genId(), articleId, platform,
        platformArticleId: result.platformArticleId,
        status: result.isDraft ? "draft" : "published",
        publishedAt: Date.now(), platformUrl: result.platformUrl,
      };
      await addPublishRecord(record);
      setPublishRecords((prev) => [...prev, record]);
    }
    return result;
  }, [articleId, markdown, articleTitle, genId]);

  const handleCopyHtml = useCallback(async () => {
    const ok = await copyAsHtml(articleId, articleTitle);
    return ok;
  }, [articleId, articleTitle]);

  const handleCopyWechatHtml = useCallback(async () => {
    const ok = await copyAsWechatHtml(articleId, articleTitle);
    return ok;
  }, [articleId, articleTitle]);

  const tags = blueprint?.tags || [];
  const sections = blueprint?.outline || [];
  const phase = blueprint?.phase || "complete";
  const coverImage = blueprint?.coverImage || undefined;

  const contentClass = [
    "final-page__content",
    previewMode === "mobile" ? "final-page__content--mobile" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className="final-page">
      <FinalTopBar
        title={articleTitle}
        onBackToEdit={handleBackWithReview}
        onPublish={handlePublish}
        onCopyHtml={handleCopyHtml}
        onCopyWechatHtml={handleCopyWechatHtml}
        hasUnpublished={publishRecords.length === 0}
        previewMode={previewMode}
        onPreviewModeChange={setPreviewMode}
      />
      <div className="final-page__body">
        <FinalSidePanel
          title={articleTitle}
          wordCount={wordCount}
          createdAt={createdAt}
          updatedAt={updatedAt}
          tags={tags}
          coverImage={coverImage}
          blueprintSections={sections}
          blueprintPhase={phase}
          publishRecords={publishRecords}
          onPublish={handlePublish}
        />
        <div className={contentClass}>
          <ArticlePreview content={markdown} />
        </div>
      </div>
      {publishOpen && (
        <PublishDialog
          articleTitle={articleTitle}
          markdown={markdown}
          onClose={() => setPublishOpen(false)}
          onSubmit={handlePublishSubmit}
        />
      )}
    </div>
  );
}
