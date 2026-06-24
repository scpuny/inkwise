import { useState, useEffect, useCallback, useRef } from "react";
import { FinalTopBar } from "./FinalTopBar";
import { FinalSidePanel } from "./FinalSidePanel";
import { ArticlePreview, markdownToHtml } from "./ArticlePreview";
import { compileToInlinedHtml } from "../lib/compileHtml";
import { copyAsHtml } from "../lib/importExport";
import { PublishDialog } from "./PublishDialog";
import { loadArticleContent, loadArticleMeta } from "../lib/articles";
import { loadBlueprint, saveBlueprint, type ArticleBlueprint } from "../lib/articleBlueprint";
import { getPublishHistory, publishArticle, addPublishRecord, type PublishRecord, type PublishOptions, type PublishResult } from "../lib/platforms";
import { getTemplate, getSelectedTemplateId } from "../lib/editorStyles";
import { getSelectedArticleThemeId, getThemeById, buildThemeCss } from "../lib/articleThemes";

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

/** Build a complete styled HTML document for publishing */
function buildPublishHtml(markdown: string, articleTitle: string): string {
  // 1. Convert markdown to HTML body
  const bodyHtml = markdownToHtml(markdown);

  // 2. Collect all CSS
  const cssParts: string[] = [];

  // Template CSS (body-scoped → article-body-scoped for publish)
  const templateId = getSelectedTemplateId();
  const template = getTemplate(templateId);
  if (template) {
    const scoped = template.css
      .replace(/\bbody\b(?=\s*\{)/g, ".article-body")
      .replace(/^\s*([^{}]+?)\s*\{/gm, (_m: string, sel: string) => {
        return sel
          .split(",")
          .map((s: string) => {
            const t = s.trim();
            if (t.startsWith(".article-body") || t.startsWith("&") || t.startsWith("@") || t.startsWith(":")) return t;
            return ".article-body " + t;
          })
          .join(", ") + " {";
      });
    cssParts.push(scoped);
  }

  // Article theme CSS
  const themeId = getSelectedArticleThemeId();
  const theme = getThemeById(themeId);
  if (theme) {
    cssParts.push(buildThemeCss(theme.vars));
  }

  // Text style overrides (from localStorage)
  const firstLineIndent = localStorage.getItem('first-line-indent') === 'true';
  const justifyAlign = localStorage.getItem('justify-align') === 'true';
  const textStyleRules: string[] = [];
  if (firstLineIndent) {
    textStyleRules.push(`.article-body p:not(li p) { text-indent: 2em !important; }`);
  }
  if (justifyAlign) {
    textStyleRules.push(`.article-body.ProseMirror { text-align: justify !important; }`);
    textStyleRules.push(`.article-body p:not(li p) { text-align: justify !important; }`);
  }
  if (textStyleRules.length > 0) {
    cssParts.push(textStyleRules.join("\n"));
  }

  // Heading decorations (from localStorage)
  const headingLevel = localStorage.getItem('heading-deco-level') || '';
  let headingDecos: string[] = [];
  try { headingDecos = JSON.parse(localStorage.getItem('heading-deco-styles') || '[]'); } catch {}
  if (headingLevel && headingDecos.length > 0) {
    const sel = `.article-body ${headingLevel}`;
    const parts: string[] = [];
    const extra: string[] = [];
    if (headingDecos.includes('underline')) parts.push(`border-bottom: 2px solid var(--accent, #0969da) !important; padding-bottom: 6px;`);
    if (headingDecos.includes('overline')) parts.push(`border-top: 2px solid var(--accent, #0969da) !important; padding-top: 6px;`);
    if (headingDecos.includes('left-bar')) parts.push(`border-left: 4px solid var(--accent, #0969da) !important; padding-left: 14px;`);
    if (headingDecos.includes('right-bar')) parts.push(`border-right: 4px solid var(--accent, #0969da) !important; padding-right: 14px;`);
    if (headingDecos.includes('bg-block')) parts.push(`background: color-mix(in srgb, var(--accent, #0969da) 12%, transparent) !important; padding: 4px 10px; border-radius: 6px; display: inline-block;`);
    if (headingDecos.includes('left-icon')) {
      parts.push(`position: relative; padding-left: 1.6em;`);
      extra.push(`${sel}::before { content: '▎'; position: absolute; left: 0; color: var(--accent, #0969da); font-size: 1.2em; font-weight: 700; }`);
    }
    if (headingDecos.includes('badge')) parts.push(`background: var(--accent, #0969da) !important; color: var(--accent-fg, #fff) !important; padding: 2px 12px; border-radius: 12px; display: inline-block; font-size: 0.85em;`);
    if (parts.length > 0) {
      cssParts.push(`${sel} { ${parts.join(" ")} }\n${extra.join("\n")}`);
    }
  }

  // BG pattern (from localStorage)
  const bgPattern = localStorage.getItem('bg-pattern') || '';
  if (bgPattern) {
    let bgColor = '';
    if (theme) {
      bgColor = theme.vars.bgColor;
    }
    const bgRule = bgColor ? `background-color: ${bgColor} !important;` : '';
    const bgPatterns: Record<string, string> = {
      'grid': `.article-body { ${bgRule} background-image: linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(0deg, rgba(0,0,0,0.04) 1px, transparent 1px) !important; background-size: 20px 20px !important; }`,
      'dots': `.article-body { ${bgRule} background-image: radial-gradient(circle, rgba(0,0,0,0.08) 1px, transparent 1px) !important; background-size: 16px 16px !important; }`,
      'stripes': `.article-body { ${bgRule} background-image: repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.03) 10px, rgba(0,0,0,0.03) 11px) !important; }`,
    };
    if (bgPatterns[bgPattern]) cssParts.push(bgPatterns[bgPattern]);
  }

  // Accent color (from editor-accent-color) — defines --article-accent for var() references in template CSS
  const accentColor = localStorage.getItem("editor-accent-color") || "";
  if (accentColor) {
    cssParts.push(`.article-body {
  --article-accent: ${accentColor};
  --accent: ${accentColor};
}
.article-body h2 { background: ${accentColor} !important; color: var(--accent-fg, #fff) !important; padding: 0.2em 0.5em !important; display: inline-block !important; }
.article-body h3 { border-left: 3px solid ${accentColor} !important; padding-left: 8px !important; }
.article-body h4,
.article-body h5,
.article-body h6 { color: ${accentColor} !important; }
.article-body blockquote { border-left: 4px solid ${accentColor} !important; }
.article-body a { color: ${accentColor} !important; text-decoration-color: ${accentColor} !important; }
.article-body code:not(pre code) { color: ${accentColor} !important; background: color-mix(in srgb, ${accentColor} 8%, transparent) !important; }
.article-body th { background: ${accentColor} !important; color: var(--accent-fg, #fff) !important; }
.article-body ::selection { background: color-mix(in srgb, ${accentColor} 30%, transparent) !important; }
.article-body strong { color: ${accentColor} !important; }`);
  }

  const allCss = cssParts.join("\n\n");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(articleTitle)}</title>
<style>${allCss}</style></head>
<body style="margin:0;background:${theme ? theme.vars.bgColor : '#ffffff'}">
<div class="article-body">${bodyHtml}</div>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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

    // 3. If bg-pattern is set, ensure background-color from theme is also on .article-preview
    const bgPattern = localStorage.getItem('bg-pattern') || '';
    const hasBgPatternClone = tags.some(t => t.id === "preview-editor-bg-pattern");
    if (bgPattern && !hasBgPatternClone) {
      // Create bg-pattern style directly
      const themeId = getSelectedArticleThemeId();
      const theme = getThemeById(themeId);
      const bgColor = theme ? theme.vars.bgColor : '#ffffff';
      const bgPatterns: Record<string, string> = {
        'grid': `.article-preview { background-color: ${bgColor} !important; background-image: linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(0deg, rgba(0,0,0,0.04) 1px, transparent 1px) !important; background-size: 20px 20px !important; }`,
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
    if (ok) {
      // Brief visual feedback
      const btn = document.querySelector('.final-topbar [title="复制为HTML"]');
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = "已复制 ✓";
        setTimeout(() => { btn.textContent = orig; }, 2000);
      }
    }
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
