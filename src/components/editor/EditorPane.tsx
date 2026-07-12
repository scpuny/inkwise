import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useChatStream } from "../../hooks/useChatStream";
import { useAgent } from "../../lib/ai/agent";
import { getStyle, getAction, migrateSkillIdToStyleId } from "../../lib/ai/skill/styles";
import {
  ArticleBlueprint,
  buildBlueprintContext,
  createDefaultBlueprint,
  loadBlueprint,
  saveBlueprint,
  type ArticlePhase,
  type OutlineSection,
} from "../../lib/ai/article/blueprint";
import { generateFullArticleStream, generateFullArticleWithTools, generatePlanStream, generatePlanStage2, writeArticleSection, type ArticleGenInput, type PartialPlan, type PlanInput, type PlanStep } from "../../lib/ai/plan";
import { addHeadingNumbers, getSelectedTemplateId, getTemplate, setSelectedTemplateId } from "../../lib/editor/editorStyles";
import { emit, on } from "../../lib/events/eventBus";
import { ArticleCtx } from "../../lib/article/ArticleContext";
import { migrateArticleDocument, createDefaultDocument, DEFAULT_STYLE_CONFIG } from "../../lib/storage/articleDocument";
import { getProjectContext } from "../../lib/storage/collections";
import { StartupSplash } from "../common/StartupSplash";
import { parseOutlineFromMarkdown, type BlueprintOutlineItem, type OutlineItem } from "../sidebar/OutlinePanel";
import { ArticleHeader } from "./ArticleHeader";
import { BlueprintEditor } from "./BlueprintEditor";
import { EditorContent, type EditorMode } from "./EditorContent";
import { InlineToolbar } from "./InlineToolbar";
import { Toolbar } from "./Toolbar";
import { AICommandBar } from "../agent/AICommandBar";

import { extractImageKeywords, insertImagesIntoArticle, getCachedImages, cacheImages } from "../../lib/ai/draw";
import { tryInvoke } from "../../lib/bridge/tauri";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { useDrawConfig } from "../../lib/stores/drawConfig";
import { useDocument } from "../../hooks/useDocument";
import { useCollection } from "../../hooks/useCollection";
import type { ArticleDocument } from "../../domain";

export function EditorPane({
  hasActiveArticle,
  activeArticleId,
  activeCollectionId,
  onNewDoc,
  onPlanComplete,
  onEnterEditor,
  editorMode: parentEditorMode,
  editorLineHeight: parentLineHeight,
  editorFontSize = 15,
  editorMaxWidth = 820,
  editorParagraphGap = 1.25,
  editorFontFamily = "",
  codeThemeId = "atom-one-light",
  onApplyHeadingNumbers,
  applyHeadingNumbersRef,
  showHeadingNumber,
  editorStyleTemplateId,
  onSetEditorFormat,
  onSetEditorLineHeight,
  onSetEditorStyleTemplate,
  onOutlineChange,
  onSaveStateChange,
  onPhaseChange,
  onToggleFocus,
  onToggleStylePanel,
  onCloseStylePanel,
  saveState: saveStateProp,
  onToggleSidebar,}: {
  hasActiveArticle: boolean;
  saveState?: "idle" | "saving" | "saved" | "error";
  activeArticleId?: string | null;
  activeCollectionId?: string | null;
  onNewDoc?: (collectionId?: string) => Promise<void>;
  onPlanComplete?: (plan: {
    title: string;
    description: string;
    outline: OutlineSection[];
    tags: string[];
    tone: string;
    skillId?: string;
    styleId?: string;
    actionId?: string;
    targetAudience: string;
    targetWordCount: number;
  }, collectionId: string) => Promise<{ articleId: string; collectionId: string } | null>;
  onEnterEditor?: (articleId: string, collectionId: string) => void;
  editorMode: EditorMode;
  editorLineHeight: number;
  editorStyleTemplateId?: string;
  onSetEditorFormat?: (mode: EditorMode) => void;
  onSetEditorLineHeight?: (h: number) => void;
  editorFontSize?: number;
  editorMaxWidth?: number;
  editorParagraphGap?: number;
  editorFontFamily?: string;
  codeThemeId?: string;
  onApplyHeadingNumbers?: () => void;
  applyHeadingNumbersRef?: React.MutableRefObject<(() => void) | null>;
  showHeadingNumber?: boolean;
  onSetEditorStyleTemplate?: (id: string) => void;
  onOutlineChange?: (items: OutlineItem[]) => void;
  onSaveStateChange?: (state: "idle" | "saving" | "saved") => void;
  onPhaseChange?: (phase: string) => void;
  onToggleStylePanel?: () => void;
  onCloseStylePanel?: () => void;
  onToggleFocus?: () => void;
  onToggleSidebar?: () => void;}) {
  const articleCtx = useContext(ArticleCtx);
  const { state: streamState, startStream, cancelStream, clearResponse } = useChatStream();
  const { execute, isProcessing, openPanel, setPanelTab, openCommandBar } = useAgent();
  // ── Hooks (Phase 3 migration) ──
  const {
    loadDocument: loadArticleDocument,
    saveDocument: saveArticleDocument,
    saveVersionSnapshot,
    loadArticleContent, saveArticleContent,
    getProvidersSync,
  } = useDocument();
  const { loadCollections } = useCollection();
  // ───────────────────────────
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [planState, setPlanState] = useState<"idle" | "planning" | "review" | "review-title-desc" | "writing" | "article-review">("idle");
  const [planStep, setPlanStep] = useState<PlanStep>("idle");
  const [partialPlan, setPartialPlan] = useState<PartialPlan>({ title: "", description: "", outline: [], tags: [], tone: "", targetAudience: "", targetWordCount: 0, skillId: undefined, styleId: "general", actionId: undefined });
  const [planError, setPlanError] = useState<string | null>(null);
  const [lastPlanInput, setLastPlanInput] = useState<PlanInput | null>(null);
  const [editorContent, setEditorContent] = useState<string>("");
  const contentRef = useRef<string>("");
  const writtenContentRef = useRef<string | null>(null); // written content from plan flow
  const contentInjectedFromPlanRef = useRef(false); // true when handleEnterEditor injected content
  const folderContextRef = useRef<string>("");
  const seriesCtxRef = useRef<string>("");
  const [projectName, setProjectName] = useState<string>("");
  const [projectFiles, setProjectFiles] = useState<string[]>([]);
  const [projectStructure, setProjectStructure] = useState<any[]>([]);
  const [projectReady, setProjectReady] = useState(false);
  const [toolEvents, setToolEvents] = useState<import("../../lib/ai/agent/engine").ToolEvent[]>([]);
  const abortPlanRef = useRef<AbortController | null>(null);
  const autoSaveTimer = useRef<any>(undefined);
  const outlineTimer = useRef<any>(undefined);

  

  // Heading number processing
  const processHeadingNumbers = useCallback(() => {
    const numbered = addHeadingNumbers(editorContent);
    if (numbered !== editorContent) {
      setEditorContent(numbered);
      contentRef.current = numbered;
    }
  }, [editorContent]);

  // Store handler in ref for parent access
  useEffect(() => {
    if (applyHeadingNumbersRef) {
      applyHeadingNumbersRef.current = processHeadingNumbers;
    }
    return () => {
      if (applyHeadingNumbersRef) {
        applyHeadingNumbersRef.current = null;
      }
    };
  }, [applyHeadingNumbersRef, processHeadingNumbers]);

  // ArticleDocument (v2.1.0) — single source of truth
  const [activeDoc, setActiveDoc] = useState<ArticleDocument | null>(null);
  const [activeDocReady, setActiveDocReady] = useState(false);

  // Blueprint state (legacy — kept for backward compat, synced from activeDoc)
  const [blueprint, setBlueprint] = useState<ArticleBlueprint | null>(null);
  const [blueprintLoaded, setBlueprintLoaded] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [blueprintEditorOpen, setBlueprintEditorOpen] = useState(false);

  // Load project context for sidebar
  useEffect(() => {
    if (!activeCollectionId) {
      setProjectName("");
      setProjectFiles([]);
      setProjectReady(false);
      return;
    }
    (async () => {
      try {
        const { loadCollections } = await import("../../lib/storage/collections");
        const cols = await loadCollections();
        const col = cols.find(c => c.id === activeCollectionId);
        if (col?.linkedFolder) {
          const ctx = await getProjectContext(col.linkedFolder);
          setProjectName(ctx.name);
          const files: string[] = [];
          function collectNames(nodes: any[]) {
            for (const n of nodes) {
              if (!n.isDir) files.push(n.name);
              if (n.children) collectNames(n.children);
            }
          }
          if (ctx.structure) {
            collectNames(ctx.structure);
            setProjectStructure(ctx.structure);
          }
          setProjectFiles(files);
          setProjectReady(files.length > 0);
        } else {
          setProjectName("");
          setProjectFiles([]);
          setProjectReady(false);
        }
      } catch {
        setProjectName("");
        setProjectFiles([]);
        setProjectReady(false);
      }
    })();
  }, [activeCollectionId]);
  // Sync target word count to window for StatusBar
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).editorInstance = (window as any).editorInstance || {};
      (window as any).__blueprintTarget = blueprint?.targetWordCount || 0;
    }
  }, [blueprint?.targetWordCount]);
  const [writingSection, setWritingSection] = useState<string | null>(null); // section ID currently being written
  const [streamingContent, setStreamingContent] = useState(""); // live streaming preview
  const writingAbortRef = useRef(false);
  const pendingArticleRef = useRef<{ articleId: string; collectionId: string } | null>(null);

  // ── Write all pending sections (used during StartupSplash writing phase) ──
  async function writeAllSections(articleId: string, bp: ArticleBlueprint): Promise<boolean> {
    writingAbortRef.current = false;
    const pending = bp.outline.filter(s => s.status === "pending");
    if (pending.length === 0) return true;

    let currentContent: string = await loadArticleContent(articleId) || "";
    if (!currentContent) currentContent = "";

    let prevSectionTitle: string | undefined;
    let prevSectionContent: string | undefined;

    for (let i = 0; i < pending.length; i++) {
      if (writingAbortRef.current) return false;
      const section = pending[i];
      setWritingSection(section.id);

      // Update section status to writing
      setBlueprint(prev => {
        if (!prev) return prev;
        const updatedOutline = prev.outline.map(s =>
          s.id === section.id ? { ...s, status: "writing" as const } : s
        );
        const updatedBp = { ...prev, outline: updatedOutline };
        saveBlueprint(articleId, updatedBp);
        return updatedBp;
      });

      try {
        // Compute hierarchical section number
        const sectionIdx = bp.outline.indexOf(section);
        const counters = [0, 0, 0, 0, 0];
        for (let k = 0; k <= sectionIdx; k++) {
          const lvl = bp.outline[k].level;
          counters[lvl - 1]++;
          for (let m = lvl; m < 5; m++) counters[m] = 0;
        }
        const sectionNum = counters.slice(0, 1).join('.');

        const result = await writeArticleSection({
          sectionNumber: sectionNum,
          title: section.title,
          description: section.description,
          articleTitle: bp.workingTitle,
          articleDescription: bp.description,
          tone: bp.tone,
          targetWordCount: bp.targetWordCount,
          skillId: bp.skillId,
          totalSections: bp.outline.length,
          previousSectionTitle: prevSectionTitle,
          previousSectionContent: prevSectionContent,
        });

        if (writingAbortRef.current) return false;

        // Replace the section heading placeholder with actual content
        const headingLevel = Math.min(section.level + 1, 4);
        const heading = "#".repeat(headingLevel);
        const lines = currentContent.split("\n");
        let sectionStart = -1;
        let sectionEnd = lines.length;
        for (let li = 0; li < lines.length; li++) {
          const trimmed = lines[li].trim();
          if (trimmed.startsWith(heading + " ") && trimmed.includes(section.title)) {
            sectionStart = li;
            continue;
          }
          if (sectionStart >= 0 && li > sectionStart && trimmed.startsWith("#")) {
            const hLevel = trimmed.match(/^#+/)?.[0].length || 0;
            if (hLevel <= headingLevel) {
              sectionEnd = li;
              break;
            }
          }
        }

        const sectionContent = heading + " " + (section.level === 1 ? sectionNum + ". " : "") + section.title + "\n\n" + result + "\n";
        if (sectionStart >= 0) {
          lines.splice(sectionStart, sectionEnd - sectionStart, sectionContent);
          currentContent = lines.join("\n");
        } else {
          currentContent = currentContent ? currentContent + "\n\n" + sectionContent : sectionContent;
        }

        // Save content (browser → localStorage, Tauri → filesystem)
        await saveArticleContent(articleId, currentContent);

        // Track content for editor handoff
        writtenContentRef.current = currentContent;
        contentRef.current = currentContent;

        // Normalize: collapse 3+ consecutive blank lines to a single blank line (sections 2+)
        if (currentContent.includes("\n\n\n")) {
          currentContent = currentContent.replace(/\n{3,}/g, "\n\n");
        }

        // Mark section as complete
        setBlueprint(prev => {
          if (!prev) return prev;
          const completeOutline = prev.outline.map(s =>
            s.id === section.id ? { ...s, status: "complete" as const } : s
          );
          const completeBp = { ...prev, outline: completeOutline };
          saveBlueprint(articleId, completeBp);
          return completeBp;
        });

        prevSectionTitle = section.title;
        prevSectionContent = result;
      } catch (e) {
        console.warn(`写作章节「${section.title}」失败:`, e);
        return false;
      }
    }

    // All sections written — advance phase to reviewing
    if (!writingAbortRef.current) {
      setBlueprint(prev => {
        if (!prev) return prev;
        const finalBp = { ...prev, phase: "reviewing" as const };
        saveBlueprint(articleId, finalBp);
        onPhaseChange?.("reviewing");
        return finalBp;
      });
    }
    setWritingSection(null);
    // Final blank-line normalization across all sections
    if (currentContent.includes("\n\n\n")) {
      currentContent = currentContent.replace(/\n{3,}/g, "\n\n");
      await saveArticleContent(articleId, currentContent);
    }
    // Prompt user for illustration after article generation
    if (!writingAbortRef.current) {
      const drawCfg = useDrawConfig.getState().config;
      if (drawCfg.model) {
        setPendingImageArticleId(articleId);
        setPendingImageContent(currentContent);
        setShowImagePrompt(true);
      }
    }
    return true;
  }



  /**
   * 自动配图：提取关键词 → 批量生成 → 插入文章
   */
  async function autoGenerateImages(articleId: string, content: string): Promise<void> {
    const drawCfg = useDrawConfig.getState().config;
    if (!drawCfg.model) return;
    // Note: drawCfg.enabled is intentionally NOT checked here because this function
    // can also be triggered by the post-generation prompt dialog, where the user
    // explicitly chose to illustrate. The "自动配图" checkbox only controls automatic
    // (unprompted) illustration.

    // Check cache first (内容哈希缓存)
    const cacheConfig = { model: drawCfg.model, style: drawCfg.style, size: drawCfg.size || "1024x1024", count: drawCfg.count ?? 1 };
    const cached = getCachedImages(content, cacheConfig);
    if (cached && cached.length > 0) {
      const newContent = insertImagesIntoArticle(content, cached.map(c => ({ path: c.path, altText: c.altText, targetSectionTitle: c.sectionTitle })));
      await saveArticleContent(articleId, newContent);
      contentRef.current = newContent;
      setEditorContent(newContent);
      return;
    }

    emit("image-gen-start", { articleId, total: drawCfg.count ?? 1 });

    // 1. LLM 提取配图计划
    const imagePlans = await extractImageKeywords(content, drawCfg.count ?? 1);
    if (imagePlans.length === 0) {
      emit("image-gen-complete", { articleId, count: 0 });
      return;
    }

    // 2. 获取图片模型对应的 providerId
    let providerId = "";
    const providers = getProvidersSync() as Array<{ id: string; enabled: boolean; models: Array<{ id: string }> }>;
    for (const p of providers) {
      if (!p.enabled) continue;
      if (p.models.some(m => m.id === drawCfg.model)) {
        providerId = p.id;
        break;
      }
    }
    if (!providerId) {
      console.warn("未找到图片模型对应的 provider");
      emit("image-gen-complete", { articleId, count: 0 });
      return;
    }

    // 3. 获取 projectFolder（关联目录）
    let projectFolder: string | undefined;
    if (activeCollectionId) {
      try {
        const { loadCollections } = await import("../../lib/storage/collections");
        const cols = await loadCollections();
        const col = cols.find(c => c.id === activeCollectionId);
        if (col?.linkedFolder) {
          projectFolder = col.linkedFolder;
        }
      } catch { /* 非必须 */ }
    }

    // 4. 批量生成图片（并行）
    const savedImages = await Promise.all(
      imagePlans.map(async (plan, idx) => {
        emit("image-gen-progress", { articleId, index: idx, total: imagePlans.length, path: "" });
        try {
          const res = await tryInvoke<any[]>("generate_image", {
            providerId,
            model: drawCfg.model,
            prompt: plan.keywords + (drawCfg.style ? `, ${drawCfg.style}` : ""),
            negativePrompt: drawCfg.negativePrompt || null,
            size: drawCfg.size || null,
            quality: null,
            style: null,
            n: 1,
            articleId,
            projectFolder: projectFolder || null,
          });
          if (res && res.length > 0) {
            return {
              path: res[0].localPath,
              altText: plan.alt_text,
              targetSectionTitle: plan.section_title,
              revisedPrompt: res[0].revisedPrompt,
            };
          }
        } catch (e) {
          console.warn(`生成图片失败 (${plan.section_title}):`, e);
        }
        return null;
      }),
    );

    const validImages = savedImages.filter(Boolean) as { path: string; altText: string; targetSectionTitle?: string; revisedPrompt?: string }[];
    if (validImages.length === 0) {
      emit("image-gen-complete", { articleId, count: 0 });
      return;
    }

    // Cache the generated images
    cacheImages(content, cacheConfig, validImages.map(v => ({ path: v.path, altText: v.altText, sectionTitle: v.targetSectionTitle })));

    // 5. 插入图片到文章
    const newContent = insertImagesIntoArticle(content, validImages);

    // 6. 保存 + 刷新编辑器
    await saveArticleContent(articleId, newContent);
    contentRef.current = newContent;
    setEditorContent(newContent);

    // 7. 保存图片记录到数据库（用于 FTS5 检索 + 文章删除时清理）
    try {
      const now = Date.now();
      const imageRows = validImages.map((img, idx) => ({
        id: articleId + "-img-" + idx,
        articleId,
        localPath: img.path,
        altText: img.altText,
        revisedPrompt: img.revisedPrompt || null,
        sectionIndex: idx,
        createdAt: now,
      }));
      await tryInvoke("save_article_images", { articleId, images: imageRows });
    } catch (e) {
      console.warn("保存图片记录失败:", e);
    }

    // 8. 完成事件
    emit("image-gen-complete", { articleId, count: validImages.length });
  }

  // Style template - prefer localStorage values (set by ArticleContext constructor) over props
  const [styleTemplate, setStyleTemplate] = useState(() => {
    const storedId = getSelectedTemplateId();
    const effectiveId = editorStyleTemplateId || storedId;
    return getTemplate(storedId) || getTemplate(effectiveId) || getTemplate('default');
  });
  const [showImagePrompt, setShowImagePrompt] = useState(false);
  const [pendingImageArticleId, setPendingImageArticleId] = useState<string | null>(null);
  const [pendingImageContent, setPendingImageContent] = useState<string>("");
  const [imageGenStatus, setImageGenStatus] = useState<string | null>(null);
  // Listen to image-gen events for progress feedback
  useEffect(() => {
    const unsubStart = on("image-gen-start", () => setImageGenStatus("正在提取配图关键词…"));
    const unsubProgress = on("image-gen-progress", (d) => {
      if (d) setImageGenStatus(`正在生成配图 (${d.index + 1}/${d.total})…`);
    });
    const unsubComplete = on("image-gen-complete", (d) => {
      if (d && d.count > 0) setImageGenStatus(`配图完成 (${d.count} 张)`);
      else if (d && d.count === 0) setImageGenStatus("配图失败");
      else setImageGenStatus("配图完成");
      setTimeout(() => setImageGenStatus(null), 4000);
    });
    const unsubError = on("image-gen-error", (d) => {
      setImageGenStatus(d?.message || "配图失败");
      setTimeout(() => setImageGenStatus(null), 4000);
    });
    return () => { unsubStart(); unsubProgress(); unsubComplete(); unsubError(); };
  }, []);

  // Sync styleTemplate when parent changes editorStyleTemplateId (e.g. from StylePanel)
  useEffect(() => {
    // Compare localStorage vs prop - localStorage takes priority if it has a real value
    const storedId = getSelectedTemplateId();
    const propT = getTemplate(editorStyleTemplateId || storedId);
    const storedT = getTemplate(storedId);
    const effectiveT = storedT || propT;
    if (effectiveT && effectiveT.id !== styleTemplate?.id) {
      setStyleTemplate(effectiveT);
    }
  }, [editorStyleTemplateId, activeArticleId]);

  const handleSelectStyleTemplate = useCallback((id: string) => {
    const t = getTemplate(id);
    if (t) {
      setStyleTemplate(t);
      setSelectedTemplateId(id);
      onSetEditorStyleTemplate?.(id);
    }
  }, [onSetEditorStyleTemplate]);

  // Debounced outline sync — prefers blueprint outline when available
  const updateOutline = useCallback((content: string, _blueprintSections?: ArticleBlueprint["outline"]) => {
    // Always parse from actual content (one-shot generation may produce different headings)
    if (onOutlineChange) {
      const items = parseOutlineFromMarkdown(content);
      if (outlineTimer.current) clearTimeout(outlineTimer.current);
      outlineTimer.current = setTimeout(() => onOutlineChange(items), 300);
    }
  }, [onOutlineChange]);

  // Load article + blueprint when article changes
  const prevArticleIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Flush pending auto-save for previous article
    if (prevArticleIdRef.current && prevArticleIdRef.current !== activeArticleId) {
      const prevId = prevArticleIdRef.current;
      const prevContent = contentRef.current;
      if (prevContent) {
        onSaveStateChange?.("saving");
        Promise.all([
          saveVersionSnapshot(prevId, prevContent),
          saveArticleContent(prevId, prevContent),
        ]).then(() => {
          onSaveStateChange?.("saved");
          setTimeout(() => onSaveStateChange?.("idle"), 2000);
        });
      }
    }
    prevArticleIdRef.current = activeArticleId ?? null;

    if (!activeArticleId) {
      setEditorContent("");
      setActiveDoc(null);
      setActiveDocReady(false);
      setBlueprint(null);
      setBlueprintLoaded(false);
      onOutlineChange?.([]);
      writtenContentRef.current = null;
      contentInjectedFromPlanRef.current = false;
      pendingArticleRef.current = null;
      writingAbortRef.current = false;
      // Reset plan state so StartupSplash is fresh
      setPlanState("idle");
      setPlanStep("idle");
      setPartialPlan({ title: "", description: "", outline: [], tags: [], tone: "", targetAudience: "", targetWordCount: 0, skillId: undefined, styleId: "general", actionId: undefined });
      setLastPlanInput(null);
      setPlanError(null);
      // Reset folder context ref for fresh load
      folderContextRef.current = "";
      return;
    }

    // Load article content from storage
    // If content was injected by handleEnterEditor (plan flow → editor), use it directly
    // On article switch, always reload from storage
    if (contentInjectedFromPlanRef.current) {
      // Content was injected directly by handleEnterEditor
      updateOutline(contentRef.current);
      contentInjectedFromPlanRef.current = false;
    } else {
      loadArticleContent(activeArticleId).then((content) => {
        if (content) {
          setEditorContent(content);
          contentRef.current = content;
          updateOutline(content);
        } else {
          const defaultContent = "# 无标题\n\n开始写作…\n";
          setEditorContent(defaultContent);
          contentRef.current = defaultContent;
          updateOutline(defaultContent);
        }
      });
    }

    // (folder context loading moved to separate useEffect)

    // Check for unfinished plan draft
    try {
      const draftRaw = localStorage.getItem('plan-draft-' + activeArticleId);
      if (draftRaw) {
        const draft = JSON.parse(draftRaw) as PartialPlan;
        if (draft.outline && draft.outline.length > 0) {
          setPartialPlan(draft);
          setPlanState("review");
          setPlanStep("outline");
        }
      }
    } catch {}

    // Load ArticleDocument (v2.1.0) — with migration from old data
    (async () => {
      let doc = await loadArticleDocument(activeArticleId);
      if (!doc) {
        doc = await migrateArticleDocument(activeArticleId);
      }
      if (doc) {
        setActiveDoc(doc);
        setActiveDocReady(true);
        // Sync to legacy blueprint for backward compat
        const bp: ArticleBlueprint = {
          workingTitle: doc.title,
          description: doc.outline.length > 0 ? "" : doc.seriesContext || "",
          phase: doc.phase,
          outline: doc.outline,
          tags: doc.tags,
          tone: doc.tone,
          targetAudience: doc.targetAudience,
          targetWordCount: doc.targetWordCount,
          styleId: doc.styleId,
          actionId: doc.actionId,
          skillId: undefined,
          coverImage: undefined,
          updatedAt: doc.updatedAt,
        };
        setBlueprint(bp);
        setBlueprintLoaded(true);
        if (doc.phase === "planning") {
          setPartialPlan({
            title: doc.title,
            description: doc.seriesContext || "",
            outline: doc.outline,
            tags: doc.tags,
            tone: doc.tone || "",
            targetAudience: doc.targetAudience || "",
            targetWordCount: doc.targetWordCount || 0,
            styleId: doc.styleId || "general",
            actionId: doc.actionId,
          });
          setPlanState("review");
          setPlanStep("outline");
        }
        updateOutline(contentRef.current, doc.outline);
        onPhaseChange?.(doc.phase);
      } else {
        // No document yet — create default from content
        const content = contentRef.current;
        const title = content ? content.split('\n')[0].replace(/^#\s*/, '') : "无标题";
        const defaultDoc = createDefaultDocument(activeArticleId, title, {
          collectionId: activeCollectionId || undefined,
          createdAt: Date.now(),
        });
        setActiveDoc(defaultDoc);
        setActiveDocReady(true);
        const defaultBp: ArticleBlueprint = {
          workingTitle: title,
          description: "",
          phase: defaultDoc.phase,
          outline: [],
          tags: [],
          tone: undefined,
          targetAudience: undefined,
          targetWordCount: undefined,
          styleId: defaultDoc.styleId,
          actionId: defaultDoc.actionId,
          skillId: undefined,
          coverImage: undefined,
          updatedAt: Date.now(),
        };
        setBlueprint(defaultBp);
        updateOutline(contentRef.current, defaultBp.outline);
        onPhaseChange?.(defaultDoc.phase);
        setBlueprintLoaded(true);
      }
    })();
  }, [activeArticleId]);

  // Periodically save ArticleDocument from blueprint state (debounced)
  const lastDocSaveRef = useRef<number>(0);
  useEffect(() => {
    if (!activeDoc || !activeArticleId || !blueprint) return;
    const now = Date.now();
    if (now - lastDocSaveRef.current < 5000) return; // debounce 5s
    lastDocSaveRef.current = now;
    const next: ArticleDocument = {
      ...activeDoc,
      title: blueprint.workingTitle || activeDoc.title,
      content: contentRef.current,
      styleId: blueprint.styleId || activeDoc.styleId || "general",
      actionId: blueprint.actionId || activeDoc.actionId || "action-write",
      tone: blueprint.tone || activeDoc.tone,
      targetAudience: blueprint.targetAudience || activeDoc.targetAudience,
      targetWordCount: blueprint.targetWordCount || activeDoc.targetWordCount,
      phase: blueprint.phase || activeDoc.phase,
      outline: blueprint.outline || activeDoc.outline,
      tags: blueprint.tags || activeDoc.tags,
      updatedAt: now,
      version: activeDoc.version,
    };
    saveArticleDocument(next);
  }, [blueprint, editorContent, activeArticleId]);

  // Sync article/collection IDs to window for other components (AIBar, InlineToolbar)
  useEffect(() => {
    (window as any).__currentArticleId = activeArticleId ?? null;
  }, [activeArticleId]);
  useEffect(() => {
    (window as any).__currentCollectionId = activeCollectionId ?? null;
  }, [activeCollectionId]);

  // Sync AI processing state to blueprint section status
  const prevProcessingRef = useRef(false);

  useEffect(() => {
    const wasProcessing = prevProcessingRef.current;
    prevProcessingRef.current = isProcessing;

    if (!activeArticleId || !activeSectionId) return;
    if (isProcessing === wasProcessing) return;

    if (isProcessing && !wasProcessing) {
      // AI started processing — mark section as writing
      setBlueprint(prev => {
        if (!prev) return prev;
        const writingOutline = prev.outline.map(s =>
          s.id === activeSectionId ? { ...s, status: "writing" as const } : s
        );
        const writingBp = { ...prev, outline: writingOutline };
        saveBlueprint(activeArticleId, writingBp);
        return writingBp;
      });
    } else if (!isProcessing && wasProcessing) {
      // AI finished processing — mark section as complete
      setBlueprint(prev => {
        if (!prev) return prev;
        const completeOutline = prev.outline.map(s =>
          s.id === activeSectionId ? { ...s, status: "complete" as const } : s
        );
        const completeBp = { ...prev, outline: completeOutline };
        saveBlueprint(activeArticleId, completeBp);
        return completeBp;
      });
    }
  }, [isProcessing, activeArticleId, activeSectionId]);

  // Auto-save on content change
  const handleContentChange = useCallback((content: string, mode?: EditorMode) => {
    contentRef.current = content;
    setEditorContent(content);
    updateOutline(content, blueprint?.outline);
    if (!activeArticleId) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    onSaveStateChange?.("saving");
    autoSaveTimer.current = setTimeout(() => {
      Promise.all([
        saveVersionSnapshot(activeArticleId, contentRef.current),
        saveArticleContent(activeArticleId, content),
      ]).then(() => {
        onSaveStateChange?.("saved");
        setTimeout(() => onSaveStateChange?.("idle"), 2000);
      });
    }, 1500);
  }, [activeArticleId]);

  // Plan editing handlers (for StartupSplash response view)
  const handleEditTitle = useCallback((title: string) => {
    setPartialPlan(p => ({ ...p, title }));
  }, []);

  const handleEditDescription = useCallback((desc: string) => {
    setPartialPlan(p => ({ ...p, description: desc }));
  }, []);

  const handleEditOutline = useCallback((outline: OutlineSection[]) => {
    setPartialPlan(p => ({ ...p, outline }));
  }, []);

  const handlePlanRetry = useCallback(() => {
    if (!lastPlanInput) return;
    setPlanError(null);

    // If error during writing/article-review, retry only the writing phase
    if (planState === "writing" || planState === "article-review") {
      setToolEvents([]);
      setStreamingContent("");
      setPlanState("writing");

      const pending = pendingArticleRef.current;
      if (!pending) {
        setPlanError("文章信息丢失，请重新开始");
        setPlanState("article-review");
        return;
      }

      (async () => {
        const genInput: ArticleGenInput = {
          title: partialPlan.title || "",
          description: partialPlan.description || "",
          outline: partialPlan.outline,
          tone: lastPlanInput?.tone || partialPlan.tone || undefined,
          targetAudience: lastPlanInput?.targetAudience || partialPlan.targetAudience || undefined,
          targetWordCount: lastPlanInput?.targetWordCount || partialPlan.targetWordCount || 0,
          skillId: lastPlanInput?.skillId || partialPlan.skillId || undefined,
          projectContext: folderContextRef.current || undefined,
          projectName: "",
          seriesContext: seriesCtxRef.current || undefined,
          linkedFolder: (await (async () => {
            if (activeCollectionId) {
              try {
                const col = (await import("../../lib/storage/collections").then(m => m.loadCollections())).find(c => c.id === activeCollectionId);
                return col?.linkedFolder || undefined;
              } catch { return undefined; }
            }
            return undefined;
          })()) || undefined,
        };

        let accumulatedContent = writtenContentRef.current || "";
        try {
          const articleContent = await generateFullArticleWithTools(genInput, (token: string) => {
            accumulatedContent += token;
            writtenContentRef.current = accumulatedContent;
            contentRef.current = accumulatedContent;
            setEditorContent(accumulatedContent);
            setStreamingContent(accumulatedContent);
          }, (event: any) => {
            setToolEvents(prev => [...prev, event]);
          });

          // Save completed article
          if (articleContent && articleContent.length > 10) {
            const { saveArticleContent } = await import("../../lib/storage/articles");
            await saveArticleContent(pending.articleId, articleContent);
            writtenContentRef.current = articleContent;
            contentRef.current = articleContent;
            setEditorContent(articleContent);
          }
          setPlanState("article-review");
        } catch (e: any) {
          console.error("Writing retry failed:", e);
          // Save partial content
          if (accumulatedContent.length > 10) {
            try {
              const { saveArticleContent } = await import("../../lib/storage/articles");
              await saveArticleContent(pending.articleId, accumulatedContent);
            } catch {}
          }
          setPlanError(typeof e === "string" ? e : e?.message || "写作重试失败");
          setPlanState("article-review");
        }
      })();
      return;
    }

    // Otherwise retry from planning (existing behavior)
    if (activeArticleId) try { localStorage.removeItem('plan-draft-' + activeArticleId); } catch {}
    setPlanState("planning");
    (async () => {
      try {
        const gen = generatePlanStream(lastPlanInput);
        for await (const result of gen) {
          let updated: PartialPlan | null = null;
          if (result.step === "title" && result.data) {
            setPartialPlan(p => { updated = { ...p, title: result.data }; return updated; });
          } else if (result.step === "description" && result.data) {
            setPartialPlan(p => { updated = { ...p, description: result.data }; return updated; });
          } else if (result.step === "outline" && result.data) {
            setPartialPlan(p => { updated = { ...p, outline: result.data }; return updated; });
          } else if (result.step === "tags" && result.data) {
            setPartialPlan(p => { updated = { ...p, tags: result.data }; return updated; });
          } else if (result.step === "explored" && result.data) {
            setPartialPlan(p => ({ ...p, projectInsights: result.data }));
          }
          setPlanStep(result.step);
          // Persist draft after each step
          if (updated && activeArticleId) {
            try { localStorage.setItem('plan-draft-' + activeArticleId, JSON.stringify(updated)); } catch {}
          }
        }
        setPlanState("review");
      } catch (e: any) {
        setPlanError(typeof e === "string" ? e : e?.message || "生成失败");
        setPlanState("review");
      }
    })();
  }, [lastPlanInput, planState, partialPlan, activeCollectionId]);

  const handlePlanConfirm = useCallback(async () => {
    try {
      const result = await onPlanComplete?.({
        title: partialPlan.title,
        description: partialPlan.description,
        outline: partialPlan.outline,
        tags: partialPlan.tags,
        tone: lastPlanInput?.tone || partialPlan.tone || "",
        skillId: lastPlanInput?.skillId || partialPlan.skillId || undefined,
        targetAudience: lastPlanInput?.targetAudience || partialPlan.targetAudience || "",
        targetWordCount: lastPlanInput?.targetWordCount || partialPlan.targetWordCount || 0,
      }, activeCollectionId ?? "");

      if (!result) {
        setPlanError("创建文章失败");
        return;
      }

      // Store article info for later navigation
      pendingArticleRef.current = result;

      // Clear plan draft after confirm
      if (activeArticleId) try { localStorage.removeItem('plan-draft-' + activeArticleId); } catch {}

      // Build blueprint (用于元数据追踪，不再用于逐节拼接)
      const bp = createDefaultBlueprint(partialPlan.title);
      bp.workingTitle = partialPlan.title || "";
      bp.description = partialPlan.description || "";
      bp.tone = lastPlanInput?.tone || partialPlan.tone || undefined;
      bp.skillId = lastPlanInput?.skillId || undefined;
      bp.styleId = lastPlanInput?.styleId || migrateSkillIdToStyleId(bp.skillId);
      bp.actionId = lastPlanInput?.actionId || "action-write";
      bp.targetAudience = lastPlanInput?.targetAudience || partialPlan.targetAudience || undefined;
      bp.targetWordCount = lastPlanInput?.targetWordCount || partialPlan.targetWordCount || 0;
      bp.tags = partialPlan.tags || [];
      bp.outline = partialPlan.outline.map(s => ({ ...s, status: "complete" as const }));
      bp.phase = "reviewing";
      setBlueprint(bp);

      // 构建系列文章上下文（含系列计划 + 已有文章回顾 + 关联目录 + 内链引用）
      let seriesCtx = "";
      if (activeCollectionId) {
        try {
          const { loadCollections, loadAllSeriesPlans } = await import("../../lib/storage/collections");
          const { loadArticleContent } = await import("../../lib/storage/articles");
          const cols = await loadCollections();
          const col = cols.find(c => c.id === activeCollectionId);
          
          // 优先从系列计划获取结构化的文章顺序信息
          // Find the series plan that contains the current article
          const allPlans = await loadAllSeriesPlans(activeCollectionId);
          const seriesPlan = allPlans.find(p => p.articles.some(a => a.articleId === result.articleId || a.id === (pendingArticleRef.current as any)?.articleId)) || null;
          
          if (seriesPlan && seriesPlan.articles.length > 0) {
            // 已规划系列 — 使用系列计划的文章顺序
            const allArticles = seriesPlan.articles;
            const currentIdx = allArticles.findIndex(a => a.articleId === result.articleId);
            
            // 系列概览：标明每篇文章的状态
            seriesCtx += `\n### 系列概览\n`;
            allArticles.forEach((a, i) => {
              const prefix = i === currentIdx ? "→ [当前] " : a.articleId && a.status === "complete" ? "✅ [已完成] " : "⏳ [待写] ";
              const linkMark = a.articleId ? `(\`#article-${a.articleId}\`)` : "";
              seriesCtx += `${i + 1}. ${prefix}${a.title}${linkMark}${a.description ? " — " + a.description : ""}\n`;
            });
            
            // 加载前面已完成的文章内容作为回顾，并记录 articleId 用于内链
            for (let i = 0; i < currentIdx; i++) {
              const prev = allArticles[i];
              if (prev.articleId) {
                const artContent = await loadArticleContent(prev.articleId);
                if (artContent) {
                  const previewLines = artContent.split('\n').slice(0, 20).join('\n').slice(0, 1500);
                  seriesCtx += `\n### 已有文章回顾：${prev.title} (\`#article-${prev.articleId}\`)\n${previewLines}\n`;
                }
              }
            }
            
            // 标记当前文章位置
            seriesCtx += `\n### 当前文章\n本文是系列「${seriesPlan.title}」的第 ${currentIdx + 1}/${allArticles.length} 篇。`;

            // 要求开场白：系列文章不能在 # 标题后直接进入正文
            seriesCtx += `\n请在文章标题（# 一级标题）之后、正文之前，写一段简短的开场白或引言，交代本篇在系列中的位置、串联前文并预告本篇核心内容。`;
            
            // 如果有上一篇，记录引用ID
            if (currentIdx > 0) {
              const prev = allArticles[currentIdx - 1];
              if (prev.articleId) {
                seriesCtx += `\n上一篇：[${prev.title}](\#article-${prev.articleId})`;
              } else {
                seriesCtx += `\n上一篇：${prev.title}`;
              }
            }
            
            // 如果有下一篇，记录引用ID并要求预告
            if (currentIdx >= 0 && currentIdx < allArticles.length - 1) {
              const next = allArticles[currentIdx + 1];
              if (next.articleId) {
                seriesCtx += `\n下一篇：[${next.title}](\#article-${next.articleId})`;
              } else {
                seriesCtx += `\n下一篇：${next.title}${next.description ? " — " + next.description : ""}`;
              }
              seriesCtx += `\n请在文章末尾添加导航区块：`;
              seriesCtx += `\n> ---`;
              seriesCtx += `\n> **系列导航**`;
              if (currentIdx > 0) {
                const prev = allArticles[currentIdx - 1];
                seriesCtx += `\n> 上一篇：[${prev.title}](\#article-${prev.articleId || ""})`;
              }
              seriesCtx += `\n> 下一篇：[${next.title}](\#article-${next.articleId || ""})`;
            }
          } else if (col && col.articles.length > 0) {
            // 无系列计划但同 collection 有其他文章 — 退回到按文章列表构建
            const otherArticles = col.articles
              .filter(a => a.id !== result.articleId)
              .slice(0, 5);
            for (const art of otherArticles) {
              const artContent = await loadArticleContent(art.id);
              if (artContent) {
                const preview = artContent.split('\n').slice(0, 10).join('\n').slice(0, 1000);
                seriesCtx += `\n### 已有文章：${art.title}`;
                seriesCtx += ` (\`#article-${art.id}\`)\n${preview}\n`;
              }
            }
          }
        } catch { /* 系列上下文非必须，失败不影响主流程 */ }
      }

      // 如果关联了项目目录，获取 linkedFolder 路径传给 AI 自行读取
      let projectLinkedFolder = "";
      if (activeCollectionId) {
        try {
          const col = (await import("../../lib/storage/collections").then(m => m.loadCollections())).find(c => c.id === activeCollectionId);
          if (col?.linkedFolder) {
            projectLinkedFolder = col.linkedFolder;
          }
        } catch { /* 非必须 */ }
      }

      // Start writing phase — immediately enter editor with live streaming
      const genInput: ArticleGenInput = {
        title: partialPlan.title || "",
        description: partialPlan.description || "",
        outline: partialPlan.outline,
        tone: lastPlanInput?.tone || partialPlan.tone || undefined,
        targetAudience: lastPlanInput?.targetAudience || partialPlan.targetAudience || undefined,
        targetWordCount: lastPlanInput?.targetWordCount || partialPlan.targetWordCount || 0,
        skillId: lastPlanInput?.skillId || partialPlan.skillId || undefined,
        styleId: lastPlanInput?.styleId || partialPlan.styleId || undefined,
        actionId: lastPlanInput?.actionId || partialPlan.actionId || undefined,
        projectContext: folderContextRef.current || undefined,
        projectName: "",
        seriesContext: seriesCtx || undefined,
        linkedFolder: projectLinkedFolder || undefined,
      };
      // Store series context for AI editor to use
      seriesCtxRef.current = seriesCtx;

      // Start writing phase（保持 StartupSplash 可见并实时展示生成内容）
      setPlanState("writing");

      pendingArticleRef.current = result;

      // 所有大纲节统一标记为 writing（整体进度）
      setBlueprint(prev => {
        if (!prev) return prev;
        const writingOutline = prev.outline.map(s => ({ ...s, status: "writing" as const }));
        const writingBp = { ...prev, outline: writingOutline };
        saveBlueprint(result.articleId, writingBp);
        emit("collections-changed");
        return writingBp;
      });

      // 流式生成全文（逐 token 实时展示在 StartupSplash 上）
      let accumulatedContent = "";
      try {
        const articleContent = await generateFullArticleWithTools(genInput, (token) => {
          accumulatedContent += token;
          writtenContentRef.current = accumulatedContent;
          contentRef.current = accumulatedContent;
          setEditorContent(accumulatedContent);
          setStreamingContent(accumulatedContent);


        }, handleToolEvent);

        // 保存成品文章到磁盘
        if (articleContent && articleContent.length > 10) {
          await saveArticleContent(result.articleId, articleContent);
          writtenContentRef.current = articleContent;
          contentRef.current = articleContent;
          setEditorContent(articleContent);
        }
        // 所有节标记为完成
        setBlueprint(prev => {
          if (!prev) return prev;
          const completeOutline = prev.outline.map(s => ({ ...s, status: "complete" as const }));
          const completeBp = { ...prev, outline: completeOutline };
          saveBlueprint(result.articleId, completeBp);
          emit("collections-changed");
          return completeBp;
        });

        // Save ArticleDocument with full style/action context (v2.1.0)
        const doc: ArticleDocument = {
          id: result.articleId,
          title: partialPlan.title || "",
          content: articleContent || accumulatedContent || "",
          styleId: lastPlanInput?.styleId || partialPlan.styleId || "general",
          actionId: lastPlanInput?.actionId || partialPlan.actionId || "action-write",
          tone: lastPlanInput?.tone || partialPlan.tone || undefined,
          targetAudience: lastPlanInput?.targetAudience || partialPlan.targetAudience || undefined,
          targetWordCount: lastPlanInput?.targetWordCount || partialPlan.targetWordCount || 0,
          phase: "reviewing",
          outline: partialPlan.outline.map(s => ({ ...s, status: "complete" as const })),
          tags: partialPlan.tags || [],
          styleConfig: DEFAULT_STYLE_CONFIG,
          linkedFolder: projectLinkedFolder || undefined,
          projectContext: folderContextRef.current || undefined,
          seriesContext: seriesCtx || undefined,
          publishRecords: [],
          version: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await saveArticleDocument(doc);
        setActiveDoc(doc);
        setActiveDocReady(true);

        // Auto-generate images if configured (非阻塞)
        const drawCfg = useDrawConfig.getState().config;
        if (drawCfg.enabled && drawCfg.model) {
          autoGenerateImages(result.articleId, contentRef.current || "").catch(console.warn);
        }
      } catch (e: any) {
        console.error("Stream writing failed:", e);
        // 保存已累积的部分内容
        if (accumulatedContent.length > 10) {
          await saveArticleContent(result.articleId, accumulatedContent);
          contentRef.current = accumulatedContent;
          writtenContentRef.current = accumulatedContent;
        } else {
          // 没有累积到任何内容，向上传播错误
          throw e;
        }
      }

      // Auto-promote phase to reviewing after full article generation
      (async () => {
        const bp = await loadBlueprint(result.articleId);
        if (bp && bp.phase === "writing") {
          bp.phase = "reviewing";
          bp.updatedAt = Date.now();
          await saveBlueprint(result.articleId, bp);
          emit("collections-changed");
          onPhaseChange?.("reviewing");
        }
      })();

      // Show article review
      setPlanState("article-review");
      // If this is a series article, update its status to reviewing
      if (pendingArticleRef.current) {
        const detail = { ...pendingArticleRef.current };
        setTimeout(() => {
          emit("series-article-review", detail);
        }, 0);
      }
    } catch (e: any) {
      console.error("Plan execution failed:", e);
      setPlanError(typeof e === "string" ? e : e?.message || "写作过程出错");
      setPlanState("article-review");
    }
  }, [partialPlan, lastPlanInput, activeCollectionId, onPlanComplete, folderContextRef]);

  const handleEnterEditor = useCallback(() => {
    const pending = pendingArticleRef.current;
    if (pending && onEnterEditor) {
      // Inject written content directly into editor before navigating
      const writtenContent = writtenContentRef.current;
      if (writtenContent) {
        setEditorContent(writtenContent);
        contentRef.current = writtenContent;
        contentInjectedFromPlanRef.current = true;
      }
      onEnterEditor(pending.articleId, pending.collectionId);
    }
    setPlanState("idle");
    setPartialPlan({ title: "", description: "", outline: [], tags: [], tone: "", targetAudience: "", targetWordCount: 0, skillId: undefined, styleId: "general", actionId: undefined });
    setPlanError(null);
    pendingArticleRef.current = null;
    writtenContentRef.current = null;
  }, [onEnterEditor]);

  const handleToolEvent = useCallback((event: import("../../lib/ai/agent/engine").ToolEvent) => {
    setToolEvents(prev => [...prev, event]);
  }, []);

  const handlePlanCancel = useCallback(() => {
    if (activeArticleId) try { localStorage.removeItem('plan-draft-' + activeArticleId); } catch {}
    setPlanState("idle");
    setPartialPlan({ title: "", description: "", outline: [], tags: [], tone: "", targetAudience: "", targetWordCount: 0, skillId: undefined, styleId: "general", actionId: undefined });
    setPlanError(null);
  }, []);

  // Save blueprint
  const handleCompleteArticle = useCallback(() => {
    if (!activeArticleId || !blueprint) return;
    const updated = {
      ...blueprint,
      phase: "complete" as ArticlePhase,
      outline: blueprint.outline.map((s: any) => ({ ...s, status: "complete" as const })),
    };
    setBlueprint(updated);
    onPhaseChange?.("complete");
    saveBlueprint(activeArticleId, updated);
    import("../../lib/storage/articles").then(m => m.saveArticleContent(activeArticleId!, contentRef.current || ""));
    // 通过 ArticleContext 持久化并应用样式
    articleCtx?.applyStyles();
    articleCtx?.save();
    emit("article-theme-changed");
    // Prompt for illustration when completing article
    if (activeArticleId && contentRef.current) {
      const drawCfg = useDrawConfig.getState().config;
      if (drawCfg.model && activeArticleId) {
        setPendingImageArticleId(activeArticleId);
        setPendingImageContent(contentRef.current);
        setShowImagePrompt(true);
      }
    }
  }, [activeArticleId, blueprint, onPhaseChange]);

  const handleSaveBlueprint = useCallback((bp: ArticleBlueprint) => {
    setBlueprint(bp);
    onPhaseChange?.(bp.phase);
    // Sync outline to sidebar
    if (onOutlineChange && bp.outline.length > 0) {
      const items: BlueprintOutlineItem[] = bp.outline.map(s => ({
        id: s.id,
        text: s.title,
        level: s.level,
        status: s.status,
        description: s.description,
      }));
      onOutlineChange(items);
    }
    if (activeArticleId) {
      saveBlueprint(activeArticleId, bp);
      // Also sync to ArticleDocument for unified state
      setActiveDoc(prev => {
        if (!prev) return prev;
        const next = { ...prev };
        let changed = false;
        if (next.title !== bp.workingTitle) { next.title = bp.workingTitle; changed = true; }
        if (next.phase !== bp.phase) { next.phase = bp.phase; changed = true; }
        if (next.tone !== bp.tone) { next.tone = bp.tone; changed = true; }
        if (next.targetAudience !== bp.targetAudience) { next.targetAudience = bp.targetAudience; changed = true; }
        if (next.targetWordCount !== bp.targetWordCount) { next.targetWordCount = bp.targetWordCount; changed = true; }
        if (next.styleId !== (bp.styleId || "general")) { next.styleId = bp.styleId || "general"; changed = true; }
        if (next.actionId !== (bp.actionId || "action-write")) { next.actionId = bp.actionId || "action-write"; changed = true; }
        if (JSON.stringify(next.outline) !== JSON.stringify(bp.outline)) { next.outline = bp.outline; changed = true; }
        if (JSON.stringify(next.tags) !== JSON.stringify(bp.tags || [])) { next.tags = bp.tags || []; changed = true; }
        if (!changed) return prev;
        next.updatedAt = Date.now();
        next.version += 1;
        saveArticleDocument(next);
        return next;
      });
    }
  }, [activeArticleId, onPhaseChange, onOutlineChange]);

  // Handle AI execution with blueprint context
  const handleExecute = useCallback(async (input: string) => {
    if (!activeArticleId || !blueprint) {
      execute(input);
      return;
    }

    const docContent = contentRef.current;
    // Get current selection
    const editor = (window as any).editorInstance?.editor;
    let selection;
    if (editor?.state?.selection) {
      const { from, to } = editor.state.selection;
      if (from !== to) {
        selection = { from, to };
      }
    }

    // Build blueprint context and inject into execute
    const blueprintCtx = buildBlueprintContext(blueprint, activeSectionId || undefined);

    // The execute function will handle intent detection
    // The blueprint context is injected through the beforeContent / selection
    // We need to prepend the blueprint context to the document content
    const augmentedContent = blueprintCtx
      ? `${blueprintCtx}\n\n## 当前文档内容\n${docContent}`
      : docContent;

    // Prepend project context if available (prefer planning exploration result)
    const projectCtx = partialPlan.projectInsights || folderContextRef.current || "";
    let ctxWithFolder = projectCtx
      ? `## 项目结构
以下是你已经知道的当前项目目录结构和关键文件。不要重新探索目录结构，直接读具体文件取代码示例。
\`\`\`
${String(projectCtx || "").slice(0, 8000)}
\`\`\`

${augmentedContent}`
      : augmentedContent;

    // Append series context if available
    const seriesCtx = seriesCtxRef.current;
    if (seriesCtx) {
      ctxWithFolder += `

## 系列文章上下文
${seriesCtx}`;
    }

    execute(input, {
      selection,
      beforeContent: ctxWithFolder,
      blueprint,
      currentSectionId: activeSectionId || undefined,
    });
  }, [activeArticleId, blueprint, activeSectionId, execute]);

  // Extract planning logic so it can be called from both UI and auto-plan event
  const handleStartPlan = useCallback(async (input: PlanInput) => {
    // Cancel any previous plan and writing
    if (abortPlanRef.current) {
      abortPlanRef.current.abort();
    }
    writingAbortRef.current = true;
    const abortController = new AbortController();
    abortPlanRef.current = abortController;
    
    // Load linked folder path for tool-based file reading
    // Use planCollectionId from input if provided (avoids race condition with activeCollectionId store)
    const targetCollectionId = input.planCollectionId || activeCollectionId;
    const _linkedFolder = targetCollectionId
      ? (await import("../../lib/storage/collections").then(m => m.loadCollections())).find(c => c.id === targetCollectionId)?.linkedFolder || undefined
      : undefined;
    // Also update project context if we got an explicit collectionId from event
    const targetFolderContext = (input.planCollectionId && _linkedFolder && !folderContextRef.current)
      ? await (async () => {
          try {
            const { buildContextText } = await import("../../lib/utils/projectContext");
            return await buildContextText(_linkedFolder, undefined);
          } catch {
            try {
              const { getCollectionFolderContext } = await import("../../lib/storage/collections");
              return await getCollectionFolderContext(input.planCollectionId!);
            } catch { return undefined; }
          }
        })()
      : undefined;
    // If folder context not yet loaded, try to load it directly (race condition fix)
    let projectCtx = folderContextRef.current;
    if (!projectCtx && _linkedFolder) {
      try {
        const { buildContextText } = await import("../../lib/utils/projectContext");
        projectCtx = await buildContextText(_linkedFolder, undefined);
      } catch {
        try {
          const { getCollectionFolderContext } = await import("../../lib/storage/collections");
          projectCtx = await getCollectionFolderContext(activeCollectionId!);
        } catch {}
      }
    }
    // CRITICAL: Save loaded context back to ref so it persists for confirm/writing phase
    folderContextRef.current = targetFolderContext || projectCtx || folderContextRef.current;
    const enrichedInput: PlanInput = {
      ...input,
      projectContext: targetFolderContext || projectCtx || undefined,
      projectName: "",
      collectionId: targetCollectionId || undefined,
      linkedFolder: _linkedFolder,
    };
    setLastPlanInput(enrichedInput);
    setPartialPlan({ title: "", description: "", outline: [], tags: [], tone: input.tone || "", targetAudience: input.targetAudience || "", targetWordCount: input.targetWordCount || 0, skillId: input.skillId || undefined, styleId: input.styleId || "general", actionId: input.actionId || "action-write" });
    setPlanError(null);
    setToolEvents([]);
    setPlanState("planning");

    // ✅ STEP 1: Create/load ArticleDocument immediately (not after plan completes)
    if (activeArticleId) {
      let doc = await loadArticleDocument(activeArticleId);
      if (!doc) {
        doc = createDefaultDocument(activeArticleId, "", {
          source: input.prefilledTitle ? "series-plan" : "ai-plan",
          inspiration: input.inspiration,
          collectionId: targetCollectionId || undefined,
          styleId: input.styleId || "general",
          actionId: input.actionId || "action-write",
          tone: input.tone || undefined,
          targetAudience: input.targetAudience || undefined,
          targetWordCount: input.targetWordCount || 0,
        });
        await saveArticleDocument(doc);
        console.log("[plan] ✅ Created ArticleDocument:", doc.id, "source:", doc.source);
      } else {
        console.log("[plan] ✅ ArticleDocument exists:", doc.id, "phase:", doc.phase, "source:", doc.source);
        // Reset plan fields for regeneration
        doc.title = "";
        doc.outline = [];
        doc.tags = [];
        doc.inspiration = input.inspiration;
        doc.phase = "planning";
        await saveArticleDocument(doc);
      }
      setActiveDoc(doc);
      setActiveDocReady(true);
    }

    let _title = "", _desc = "", _outlineCount = 0, _tagCount = 0;
    try {
      // New document (no prefilled title): generate title+description first
      const useStage1 = !input.prefilledTitle;
      const gen = generatePlanStream(enrichedInput, useStage1 || undefined);
      for await (const result of gen) {
        if (abortController.signal.aborted) {
          setPlanState("idle");
          setPartialPlan({ title: "", description: "", outline: [], tags: [], tone: "", targetAudience: "", targetWordCount: 0, skillId: undefined, styleId: "general", actionId: undefined });
          return;
        }
        if (result.step === "title") {
          _title = typeof result.data === "string" ? result.data : "";
          setPartialPlan(p => ({ ...p, title: _title }));
        } else if (result.step === "description") {
          _desc = typeof result.data === "string" ? result.data : "";
          setPartialPlan(p => ({ ...p, description: _desc }));
        } else if (result.step === "outline" && Array.isArray(result.data)) {
          _outlineCount = result.data.length;
          setPartialPlan(p => ({ ...p, outline: result.data }));
        } else if (result.step === "tags" && Array.isArray(result.data)) {
          _tagCount = result.data.length;
          setPartialPlan(p => ({ ...p, tags: result.data }));
        } else if (result.step === "explored" && result.data) {
          setPartialPlan(p => ({ ...p, projectInsights: result.data }));
        } else if (result.step === "stage1-done") {
          console.log("[plan] Stage1 done. title:", _title?.slice(0,40), "desc:", _desc?.slice(0,40));
          // ✅ Save title+description to document
          if (activeArticleId) {
            const doc = await loadArticleDocument(activeArticleId);
            if (doc) {
              doc.title = _title;
              doc.tone = enrichedInput.tone || "";
              doc.targetAudience = enrichedInput.targetAudience || "";
              doc.targetWordCount = enrichedInput.targetWordCount || 0;
              await saveArticleDocument(doc);
            }
          }
          setPlanState("review-title-desc");
          return;
        }
        setPlanStep(result.step);
      }
      if (!abortController.signal.aborted) {
        console.log("[plan] ✅ Done. title:", _title?.slice(0,40), "desc:", _desc?.slice(0,40), "outline:", _outlineCount, "tags:", _tagCount);
        // ✅ Save full plan to document
        if (activeArticleId) {
          const doc = await loadArticleDocument(activeArticleId);
          if (doc) {
            doc.title = _title;
            doc.outline = partialPlan.outline;
            doc.tags = partialPlan.tags;
            doc.phase = "planning";
            await saveArticleDocument(doc);
          }
        }
        setPlanState("review");
      }
    } catch (e: any) {
      if (!abortController.signal.aborted) {
        setPlanError(typeof e === "string" ? e : e?.message || "生成失败");
        setPlanState("review");
      }
    }
  }, []);

  /** Continue from title+description review → generate outline+tags */
  const handleContinueToOutline = useCallback(async () => {
    if (!lastPlanInput) return;
    setPlanState("planning");
    abortPlanRef.current = new AbortController();
    const abortController = abortPlanRef.current;
    try {
      const gen = generatePlanStage2(lastPlanInput, partialPlan.title, partialPlan.description);
      for await (const result of gen) {
        if (abortController.signal.aborted) { setPlanState("idle"); return; }
        if (result.step === "outline" && Array.isArray(result.data)) {
          setPartialPlan(p => ({ ...p, outline: result.data }));
        } else if (result.step === "tags" && Array.isArray(result.data)) {
          setPartialPlan(p => ({ ...p, tags: result.data }));
          // ✅ Save outline+tags to document
          if (activeArticleId) {
            const doc = await loadArticleDocument(activeArticleId);
            if (doc) {
              doc.outline = result.data;
              doc.tags = result.data;
              doc.phase = "planning";
              await saveArticleDocument(doc);
            }
          }
        }
        setPlanStep(result.step);
      }
      if (!abortController.signal.aborted) setPlanState("review");
    } catch (e: any) {
      if (!abortController.signal.aborted) {
        setPlanError(typeof e === "string" ? e : e?.message || "生成失败");
        setPlanState("review");
      }
    }
  }, [lastPlanInput, partialPlan.title, partialPlan.description, activeArticleId]);

  // Cancel plan function exposed to StartupSplash
  const cancelPlan = useCallback(() => {
    if (abortPlanRef.current) {
      abortPlanRef.current.abort();
      abortPlanRef.current = null;
    }
    setPlanState("idle");
    setPlanStep("idle");
    setPartialPlan({ title: "", description: "", outline: [], tags: [], tone: "", targetAudience: "", targetWordCount: 0, skillId: undefined, styleId: "general", actionId: undefined });
    setLastPlanInput(null);
    setPlanError(null);
  }, []);

  // Listen for external blueprint changes (e.g. from sidebar, ArticleManager)
  useEffect(() => {
    return on("blueprint-changed", (detail) => {
      if (!detail?.articleId || detail.articleId !== activeArticleId) return;
      // Re-read blueprint from storage to pick up external changes
      loadBlueprint(detail.articleId).then((bp) => {
        if (bp) {
          setBlueprint(bp);
          setBlueprintLoaded(true);
          if (bp.phase === "planning") {
            setPartialPlan({
              title: bp.workingTitle,
              description: bp.description,
              outline: bp.outline,
              tags: bp.tags || [],
              tone: bp.tone || "",
              targetAudience: bp.targetAudience || "",
              targetWordCount: bp.targetWordCount || 0,
              skillId: bp.skillId,
              styleId: bp.styleId || "general",
              actionId: bp.actionId,
            });
            setPlanState("review");
            setPlanStep("outline");
          }
          updateOutline(contentRef.current, bp.outline);
          onPhaseChange?.(bp.phase);
        }
      });
    });
  }, [activeArticleId]);

// Cleanup plan on unmount
  useEffect(() => {
    return () => {
      if (abortPlanRef.current) {
        abortPlanRef.current.abort();
        abortPlanRef.current = null;
      }
    };
  }, []);

  // Listen for auto-plan-article event (from series planner)
  useEffect(() => {
    return on("auto-plan-article", (detail) => {
      if (!detail?.title) return;
      const { title, description, tone: articleTone, targetAudience,
              skillId, styleId, actionId, targetWordCount, seriesId, seriesTitle, seriesDescription } = detail;
      const inspiration = description 
        ? `写一篇关于「${title}」的文章：${description}`
        : `写一篇关于「${title}」的文章`;
      const seriesCtx = seriesTitle
        ? `系列「${seriesTitle}」
${seriesDescription || ""}`
        : undefined;
      handleStartPlan({
        inspiration,
        tone: articleTone || undefined,
        targetAudience: targetAudience || undefined,
        targetWordCount: targetWordCount || undefined,
        skillId: skillId || undefined,
        styleId: styleId || undefined,
        actionId: actionId || undefined,
        prefilledTitle: title || undefined,
        prefilledDescription: description || undefined,
        seriesContext: seriesCtx,
        seriesId: seriesId || undefined,
        planCollectionId: detail.collectionId || undefined,
      });
    });
  }, [handleStartPlan]);


  // Load folder context when activeCollectionId changes
  useEffect(() => {
    // Always clear first
    folderContextRef.current = "";
    // Reset plan state when switching collections on startup splash
    if (!activeArticleId) {
      setPlanState("idle");
      setPlanStep("idle");
      setPartialPlan({ title: "", description: "", outline: [], tags: [], tone: "", targetAudience: "", targetWordCount: 0, skillId: undefined, styleId: "general", actionId: undefined });
      setLastPlanInput(null);
      setPlanError(null);
    }

    if (!activeCollectionId) return;

    loadCollections().then(cols => {
      const col = cols.find(c => c.id === activeCollectionId);
      if (col?.linkedFolder) {
        import("../../lib/utils/projectContext").then(({ buildContextText }) => {
          buildContextText(col.linkedFolder!, undefined).then(ctx => {
            if (ctx) folderContextRef.current = ctx;
          });
        }).catch(() => {
          import("../../lib/storage/collections").then(({ getCollectionFolderContext }) => {
            getCollectionFolderContext(activeCollectionId!).then(ctx => {
              if (ctx) folderContextRef.current = ctx;
            });
          });
        });
      }
    });
  }, [activeCollectionId, hasActiveArticle]);

  // Keyboard shortcut: Ctrl+K opens Agent panel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === "k") {
        e.preventDefault();
        openPanel?.();
        setPanelTab?.("chat");
        return;
      }
      // Slash key opens AI command bar
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "TEXTAREA" || tag === "INPUT" || (e.target as HTMLElement)?.isContentEditable) {
          // Let the editor handle / normally in text inputs
        } else {
          e.preventDefault();
          openCommandBar?.();
          return;
        }
      }
      // Skill shortcuts: Alt+1..5 for quick polish/rewrite/translate/expand/analysis
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        const skillMap: Record<string, string> = {
          "1": "polish", "2": "rewrite", "3": "translate", "4": "expand", "5": "analysis",
        };
        const skill = skillMap[e.key];
        if (skill) {
          e.preventDefault();
          const editor = (window as any).editorInstance?.editor;
          const docContent = editor ? editor.getText() || "" : "";
          const sel = (window as any).__lastEditorSelection;
          const selectionText = sel && editor ? editor.state.doc.textBetween(sel.from, sel.to, " ") : "";
          if (selectionText) {
            // Execute skill with selected text
            execute?.(selectionText, { intent: skill, beforeContent: docContent, selection: sel });
            openPanel?.();
            setPanelTab?.("chat");
          }
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <section className="editor-pane">
      {/* ── TOOLBAR: only when actively editing ── */}
      {(hasActiveArticle && activeArticleId && blueprintLoaded && blueprint && blueprint.phase !== "planning") ? (
        <Toolbar
          onModeSwitch={onSetEditorFormat}
          editorMode={parentEditorMode}
          onStyleTemplate={handleSelectStyleTemplate}
          styleTemplateId={styleTemplate?.id || "default"}
          onToggleStylePanel={onToggleStylePanel}
          onCloseStylePanel={onCloseStylePanel}
          onToggleFocus={onToggleFocus}
          onToggleSidebar={onToggleSidebar}        />
      ) : null}

      {/* ── MAIN CONTENT ── */}
      {!hasActiveArticle || !activeArticleId ? (
        /* Welcome page — no active article */
        <StartupSplash
          onQuickStart={() => onNewDoc?.(activeCollectionId ?? undefined)}
          onAIPlan={handleStartPlan}
          onContinueToOutline={handleContinueToOutline}
          planState={planState}
          planStep={planStep}
          streamingContent={streamingContent}
          partialPlan={partialPlan}
          planError={planError}
          lastPlanInput={lastPlanInput}
          writingOutline={blueprint?.outline || partialPlan.outline}
          writingSectionId={writingSection}
          onConfirm={handlePlanConfirm}
          onCancel={handlePlanCancel}
          onCancelPlan={cancelPlan}
          onEditTitle={handleEditTitle}
          onEditDescription={handleEditDescription}
          onEditOutline={handleEditOutline}
          onRetry={handlePlanRetry}
          onEnterEditor={handleEnterEditor}
          projectName={projectName}
          projectReady={projectReady}
          projectFiles={projectFiles}
          projectStructure={projectStructure}
          toolEvents={toolEvents}
        />
      ) : !blueprintLoaded ? (
        /* Loading — blueprint is loading in background */
        <div className="editor-pane__loading">
          <svg className="editor-pane__loading-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
          <span>加载中…</span>
        </div>
      ) : blueprint && blueprint.phase === "planning" ? (
        /* Planning review — article is in planning phase */
        <StartupSplash
          onQuickStart={() => {
            // 规划中文章：快速开始 → 转为写作阶段
            if (activeArticleId && blueprint) {
              const updatedBp = { ...blueprint, phase: "writing" as const };
              setBlueprint(updatedBp);
              saveBlueprint(activeArticleId, updatedBp);
              onPhaseChange?.("writing");
              setPlanState("idle");
            }
          }}
          onAIPlan={handleStartPlan}
          onContinueToOutline={handleContinueToOutline}
          planState={planState}
          planStep={planStep}
          partialPlan={partialPlan}
          planError={planError}
          lastPlanInput={lastPlanInput}
          writingOutline={blueprint?.outline || partialPlan.outline}
          writingSectionId={writingSection}
          onConfirm={handlePlanConfirm}
          onCancel={() => { setPlanState("idle"); setPartialPlan({ title: "", description: "", outline: [], tags: [], tone: "", targetAudience: "", targetWordCount: 0, skillId: undefined, styleId: "general", actionId: undefined }); }}
          onCancelPlan={cancelPlan}
          onEditTitle={handleEditTitle}
          onEditDescription={handleEditDescription}
          onEditOutline={handleEditOutline}
          onRetry={handlePlanRetry}
          onEnterEditor={() => {
            // 跳过规划直接进入编辑
            if (activeArticleId && blueprint) {
              const updatedBp = { ...blueprint, phase: "writing" as const };
              setBlueprint(updatedBp);
              saveBlueprint(activeArticleId, updatedBp);
              onPhaseChange?.("writing");
              setPlanState("idle");
              writtenContentRef.current = contentRef.current || "";
              contentInjectedFromPlanRef.current = true;
              onEnterEditor?.(activeArticleId, activeCollectionId || "");
              setPlanState("idle");
            }
          }}
          streamingContent={streamingContent}
          projectName={projectName}
          projectReady={projectReady}
          projectFiles={projectFiles}
          toolEvents={toolEvents}
        />
      ) : (
        /* Full editor */
        <div className="editor-content-area">
          {/* Article Blueprint Header */}
          {blueprint && (
            <ArticleHeader
              blueprint={blueprint}
              activeSectionId={activeSectionId}
              onUpdateBlueprint={handleSaveBlueprint}
              onSelectSection={setActiveSectionId}
              onOpenBlueprintEditor={() => setBlueprintEditorOpen(true)}
              onSave={handleCompleteArticle}
            />
          )}

          <EditorContent
            content={editorContent}
            mode={parentEditorMode}
            lineHeight={parentLineHeight}
            paragraphGap="1.25em"
            aiResponse={streamState.content || aiResponse}
            sending={streamState.streaming || sending}
            onCancelStream={cancelStream}
            streamElapsed={streamState.elapsed}
            streamError={streamState.error}
            onChange={handleContentChange}
            onClearResponse={() => { clearResponse(); setAiResponse(null); }}
            onInsertResponse={() => { clearResponse(); setAiResponse(null); }}
            onOutlineChange={onOutlineChange}
            styleTemplate={styleTemplate}
            editorFontSize={editorFontSize}
            editorMaxWidth={editorMaxWidth}
            editorFontFamily={editorFontFamily}
            editorParagraphGap={editorParagraphGap}
            codeThemeId={codeThemeId}
            showHeadingNumber={showHeadingNumber}
          />
          <InlineToolbar />
          <AICommandBar />
          {/* Save state indicator: green dot / spinning icon */}
          {saveStateProp && saveStateProp !== "idle" && (
            <div className="editor-save-indicator" title={saveStateProp === "saving" ? "保存中…" : saveStateProp === "saved" ? "已保存" : saveStateProp === "error" ? "保存失败" : ""}>
              {saveStateProp === "saving" ? (
                <svg className="editor-save-indicator__spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 11-6.219-8.56" />
                </svg>
              ) : saveStateProp === "saved" ? (
                <span className="editor-save-indicator__dot editor-save-indicator__dot--saved" />
              ) : (
                <span className="editor-save-indicator__dot editor-save-indicator__dot--error" />
              )}
              <span className="editor-save-indicator__label">
                {saveStateProp === "saving" ? "保存中" : saveStateProp === "saved" ? "已保存" : "保存失败"}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Blueprint Editor Modal */}
      {/* Blueprint Editor Modal */}
      {blueprint && (
        <BlueprintEditor
          blueprint={blueprint}
          open={blueprintEditorOpen}
          onClose={() => setBlueprintEditorOpen(false)}
          onSave={handleSaveBlueprint}
        />
      )}

      {/* Image generation status bar */}
      {imageGenStatus && (
        <div className="editor-pane__image-status">
          <span>{imageGenStatus}</span>
        </div>
      )}

      {/* Illustration prompt after article generation */}
      <ConfirmDialog
        open={showImagePrompt}
        title="文章已生成"
        message="是否要为这篇文章生成配套插图？插图将根据文章内容自动提取关键词并调用绘图模型生成。"
        confirmLabel="配图"
        cancelLabel="不配"
        onConfirm={() => {
          setShowImagePrompt(false);
          const id = pendingImageArticleId;
          const c = pendingImageContent;
          setPendingImageArticleId(null);
          setPendingImageContent("");
          if (id && c) {
            autoGenerateImages(id, c).catch(console.warn);
          }
        }}
        onCancel={() => {
          setShowImagePrompt(false);
          setPendingImageArticleId(null);
          setPendingImageContent("");
        }}
      />
    </section>
  );
}
