import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { loadBlueprint, saveBlueprint } from "../../lib/ai/article/blueprint";
import type { ArticleBlueprint } from "../../domain";
import { compileToInlinedHtml, compileToWechatHtml } from "../../lib/editor/compileHtml";
import { copyAsHtml, copyAsWechatHtml } from "../../lib/editor/importExport";
import { on } from "../../lib/events/eventBus";
import { useSettings } from "../../hooks/useSettings";
import type { PublishOptions, PublishResult, PublishRecord } from "../../domain";
import { collectPublishCss } from "../../lib/styles/collector";
import { PublishDialog } from "../collections/PublishDialog";
import { ArticleCtx } from "../../lib/article/ArticleContext";
import { ArticlePreview } from "./ArticlePreview";
import { FinalSidePanel } from "./FinalSidePanel";
import { FinalTopBar } from "./FinalTopBar";
import { useDocument } from "../../hooks/useDocument";

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
  const { addPublishRecord, publishArticle } = useSettings();
  const { loadDocument: loadArticleDocument, saveDocument: saveArticleDocument, loadArticleContent } = useDocument();
  const [markdown, setMarkdown] = useState("");
  const [blueprint, setBlueprint] = useState<ArticleBlueprint | null>(null);
  const [publishRecords, setPublishRecords] = useState<PublishRecord[]>([]);
  const [publishOpen, setPublishOpen] = useState(false);
  const [articleTitle, setArticleTitle] = useState("");
  const [createdAt, setCreatedAt] = useState(0);
  const [updatedAt, setUpdatedAt] = useState(0);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const ctx = useContext(ArticleCtx);
  const styleRefs = useRef<HTMLStyleElement[]>([]);

  // Use the same unified CSS pipeline as export (collectPublishCss)
  // to ensure editor preview, final page, and WeChat export are always consistent.
  const [previewRev, setPreviewRev] = useState(0);
  const refreshPreview = useCallback(() => setPreviewRev(v => v + 1), []);
  useEffect(() => {
    const handler = () => setPreviewRev(v => v + 1);
    return on("article-theme-changed", handler);
  }, []);
  useEffect(() => {
    // Ensure article's own styles are applied
    ctx?.applyStyles();

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
  }, [previewRev, ctx]);

  // 挂载后强制刷新 CSS（确保 handleCompleteArticle 保存的样式被拾取）
  useEffect(() => {
    const timer = setTimeout(() => setPreviewRev(v => v + 1), 50);
    return () => clearTimeout(timer);
  }, []);

  // Load article data from unified ArticleDocument
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const doc = await loadArticleDocument(articleId);
      if (cancelled) return;
      if (doc) {
        setMarkdown(doc.content || DEFAULT_CONTENT);
        setArticleTitle(doc.title);
        setBlueprint({
          workingTitle: doc.title,
          description: "",
          outline: doc.outline,
          phase: doc.phase,
          tags: doc.tags,
          tone: doc.tone,
          targetAudience: doc.targetAudience,
          targetWordCount: doc.targetWordCount,
          skillId: undefined,
          styleId: doc.styleId,
          actionId: doc.actionId,
          coverImage: undefined,
          updatedAt: doc.updatedAt,
        });
        setPublishRecords(doc.publishRecords || []);
        setCreatedAt(doc.createdAt);
        setUpdatedAt(doc.updatedAt);
      } else {
        // Fallback: load from old storage
        const [meta, content, bp, records] = await Promise.all([
          import("../../lib/storage/articles").then(m => m.loadArticleMeta(articleId)),
          import("../../lib/storage/articles").then(m => m.loadArticleContent(articleId)),
          import("../../lib/ai/article/blueprint").then(m => m.loadBlueprint(articleId)),
          import("../../lib/storage/platforms").then(m => m.getPublishHistory(articleId)),
        ]);
        if (cancelled) return;
        if (meta) {
          setCreatedAt(meta.createdAt ?? Date.now());
          setUpdatedAt(meta.updatedAt ?? Date.now());
        }
        const md = content || DEFAULT_CONTENT;
        setMarkdown(md);
        const firstLine = md.split("\n").find((l) => l.trim().startsWith("# "));
        if (firstLine) setArticleTitle(firstLine.trim().replace(/^#\s+/, ""));
        if (bp) {
          setBlueprint(bp);
          if (bp.workingTitle && !firstLine) setArticleTitle(bp.workingTitle);
        }
        setPublishRecords(records);
      }
    })();
    return () => { cancelled = true; };
  }, [articleId]);

  const wordCount = markdown === DEFAULT_CONTENT
    ? 0
    : markdown.replace(/^#+\s.*$/gm, "").replace(/\s/g, "").length;

  const handlePublish = useCallback(() => setPublishOpen(true), []);

  const handleBackWithReview = useCallback(async () => {
    if (articleId) {
      // Update phase to reviewing in ArticleDocument
      const doc = await loadArticleDocument(articleId);
      if (doc) {
        doc.phase = "reviewing";
        doc.updatedAt = Date.now();
        await saveArticleDocument(doc);
      } else {
        // Fallback to old blueprint
        const bp = await loadBlueprint(articleId);
        if (bp) {
          bp.phase = "reviewing";
          await saveBlueprint(articleId, bp);
        }
      }
    }
    onBackToEdit();
  }, [articleId, onBackToEdit]);

  const handlePublishSubmit = useCallback(async (
    platform: string, options: PublishOptions, action: "draft" | "publish"
  ): Promise<PublishResult> => {
    // Build the styled HTML for publishing
    const styledHtml = await compileToInlinedHtml(markdown);
    const wechatHtml = platform === "wechat"
      ? (await compileToWechatHtml(markdown)).html
      : styledHtml;
    const result = await publishArticle(articleId, platform, markdown, wechatHtml, options, action);
    if (result.success) {
      const record: PublishRecord = {
        id: genId(), articleId, platform,
        platformArticleId: result.platformArticleId,
        status: result.isDraft ? "draft" : "published",
        publishedAt: Date.now(), platformUrl: result.platformUrl,
      };
      await addPublishRecord(record);
      setPublishRecords((prev) => [...prev, record]);
      // Also save to ArticleDocument for unified state
      const doc = await loadArticleDocument(articleId);
      if (doc) {
        doc.publishRecords = [...(doc.publishRecords || []), record];
        doc.updatedAt = Date.now();
        await saveArticleDocument(doc);
      }
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
