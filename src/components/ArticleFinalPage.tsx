import { useState, useEffect, useCallback, useRef } from "react";
import { FinalTopBar } from "./FinalTopBar";
import { FinalSidePanel } from "./FinalSidePanel";
import { ArticlePreview } from "./ArticlePreview";
import { markdownToHtml } from "../lib/markdown/renderer";
import { compileToInlinedHtml } from "../lib/compileHtml";
import { getCodeTheme, getSelectedCodeThemeId, getSelectedTemplateId, getTemplate } from "../lib/editorStyles";
import { copyAsHtml, copyAsWechatHtml } from "../lib/importExport";
import { PublishDialog } from "./PublishDialog";
import { loadArticleContent, loadArticleMeta } from "../lib/articles";
import { loadBlueprint, saveBlueprint, type ArticleBlueprint } from "../lib/articleBlueprint";
import { getPublishHistory, publishArticle, addPublishRecord, type PublishRecord, type PublishOptions, type PublishResult } from "../lib/platforms";
import { getSelectedArticleThemeId, getThemeById } from "../lib/articleThemes";

const DEFAULT_CONTENT = "# 无标题\n\n开始写作…\n";

interface ArticleFinalPageProps {
  articleId: string;
  collectionId: string;
  onBackToEdit: () => void;
  genId: () => string;
}

// Editor style tag IDs that need to be mirrored for preview
const STYLE_TAG_IDS = [
  "editor-style-overrides",
  "editor-code-theme-style",
  "editor-text-style",
  "editor-heading-deco",
  "editor-macos-codeblock-style",
  "editor-bg-pattern",
  "editor-article-theme",
  "editor-accent-color",
];

/** Re-scope a CSS string from `.editor-container .tiptap` → `.article-preview` */
function rescopePreviewCss(css: string): string {
  if (!css) return "";
  let result = css;
  result = result.replace(/\.editor-container\s*\.tiptap\.ProseMirror/g, ".article-preview");
  result = result.replace(/\.editor-container\s*\.tiptap/g, ".article-preview");
  result = result.replace(/\.tiptap/g, ".article-preview");
  return result;
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

  // Clone all editor styles (template + overrides) scoped to .article-preview
  useEffect(() => {
    const tags: HTMLStyleElement[] = [];

    // 1. Template CSS
    const templateId = getSelectedTemplateId();
    const template = getTemplate(templateId);
    if (template) {
      const scoped = template.css
        .replace(/\bbody\b(?=\s*\{)/g, ".article-preview")
        .replace(/^\s*([^{}]+?)\s*\{/gm, (_m: string, sel: string) => {
          return sel
            .split(",")
            .map((s: string) => {
              const t = s.trim();
              if (t.startsWith(".article-preview") || t.startsWith("&") || t.startsWith("@") || t.startsWith(":")) return t;
              return ".article-preview " + t;
            })
            .join(", ") + " {";
        });
      const s = document.createElement("style");
      s.id = "preview-template-style";
      s.textContent = scoped;
      document.head.appendChild(s);
      tags.push(s);
    }

    // 2. Clone all editor override style tags, re-scoped to .article-preview
    for (const id of STYLE_TAG_IDS) {
      const original = document.getElementById(id) as HTMLStyleElement | null;
      if (!original || !original.textContent || !original.textContent.trim()) continue;
      const s = document.createElement("style");
      s.id = "preview-" + id;
      let scopedCss = rescopePreviewCss(original.textContent);
      // For bg-pattern, ensure !important background-image isn't overridden by template background shorthand
      if (id === "editor-bg-pattern") {
        // Add extra specificity to ensure bg-pattern works
        scopedCss = scopedCss.replace(/\.article-preview/g, ".article-preview.article-preview");
      }
      s.textContent = scopedCss;
      document.head.appendChild(s);
      tags.push(s);
    }

    // 2.5 Add list-style:none to hide default markers (we use manual • / "1." prefixes)
    const listStyleTag = document.createElement("style");
    listStyleTag.id = "preview-list-style-override";
    listStyleTag.textContent = ".article-preview ul, .article-preview ol { list-style: none !important; padding-left: 1.5em !important; }";
    document.head.appendChild(listStyleTag);
    tags.push(listStyleTag);

    // 3. If bg-pattern is set, ensure background-color from theme is also on .article-preview
    const bgPattern = localStorage.getItem('bg-pattern') || '';
    const hasBgPatternClone = tags.some(t => t.id === "preview-editor-bg-pattern");
    if (bgPattern && !hasBgPatternClone) {
      // Create bg-pattern style directly
      const themeId = getSelectedArticleThemeId();
      const theme = getThemeById(themeId);
      const bgColor = theme ? theme.vars.bgColor : '#ffffff';
      const bgPatterns: Record<string, string> = {
        'grid': `.article-preview { background-color: ${bgColor} !important; background-image: linear-gradient(90deg, color-mix(in srgb, currentColor 2%, transparent) 1px, transparent 1px), linear-gradient(0deg, color-mix(in srgb, currentColor 2%, transparent) 1px, transparent 1px) !important; background-size: 20px 20px !important; }`,
        'dots': `.article-preview { background-color: ${bgColor} !important; background-image: radial-gradient(circle, rgba(0,0,0,0.08) 1px, transparent 1px) !important; background-size: 16px 16px !important; }`,
        'stripes': `.article-preview { background-color: ${bgColor} !important; background-image: repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.03) 10px, rgba(0,0,0,0.03) 11px) !important; }`,
      };
      if (bgPatterns[bgPattern]) {
        const s = document.createElement("style");
        s.id = "preview-bg-pattern-direct";
        s.textContent = bgPatterns[bgPattern];
        document.head.appendChild(s);
        tags.push(s);
      }
    }

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
