import { FileText, FolderInput } from "lucide-react";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useChatStream } from "../../hooks/useChatStream";
import { useAgent } from "../../lib/ai/agent";
import {
  ArticleBlueprint,
  buildBlueprintContext,
  createDefaultBlueprint,
  loadBlueprint,
  saveBlueprint,
  type ArticlePhase,
  type OutlineSection,
} from "../../lib/ai/articleBlueprint";
import { generateFullArticleStream, generateFullArticleWithTools, generatePlanStream, writeArticleSection, type ArticleGenInput, type PartialPlan, type PlanInput, type PlanStep } from "../../lib/ai/plan";
import { addHeadingNumbers, getSelectedTemplateId, getTemplate, setSelectedTemplateId } from "../../lib/editor/editorStyles";
import { emit, on } from "../../lib/events/eventBus";
import { ArticleCtx } from "../../lib/article/ArticleContext";
import { loadArticleContent, saveArticleContent } from "../../lib/storage/articles";
import { saveVersionSnapshot } from "../../lib/storage/articleVersions";
import type { FileNode } from "../../lib/storage/collections";
import { loadCollections } from "../../lib/storage/collections";
import { ProjectFileTree } from "../common/ProjectFileTree";
import { StartupSplash } from "../common/StartupSplash";
import { parseOutlineFromMarkdown, type BlueprintOutlineItem, type OutlineItem } from "../sidebar/OutlinePanel";
import { ArticleHeader } from "./ArticleHeader";
import { BlueprintEditor } from "./BlueprintEditor";
import { EditorContent, type EditorMode } from "./EditorContent";
import { InlineToolbar } from "./InlineToolbar";
import { Toolbar } from "./Toolbar";

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
  onToggleSidebar,}: {
  hasActiveArticle: boolean;
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
  const { execute, isProcessing, openPanel, setPanelTab } = useAgent();
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [planState, setPlanState] = useState<"idle" | "planning" | "review" | "writing" | "article-review">("idle");
  const [planStep, setPlanStep] = useState<PlanStep>("idle");
  const [partialPlan, setPartialPlan] = useState<PartialPlan>({ title: "", description: "", outline: [], tags: [], tone: "", targetAudience: "", targetWordCount: 0, skillId: undefined });
  const [planError, setPlanError] = useState<string | null>(null);
  const [lastPlanInput, setLastPlanInput] = useState<PlanInput | null>(null);
  const [editorContent, setEditorContent] = useState<string>("");
  const contentRef = useRef<string>("");
  const writtenContentRef = useRef<string | null>(null); // written content from plan flow
  const contentInjectedFromPlanRef = useRef(false); // true when handleEnterEditor injected content
  const folderContextRef = useRef<string>("");
  const folderProjectNameRef = useRef<string>("");
  const [folderProjectName, setFolderProjectName] = useState("");
  const [projectFiles, setProjectFiles] = useState<string[]>([]);
const [projectTree, setProjectTree] = useState<FileNode[] | null>(null);
  const [toolEvents, setToolEvents] = useState<import("../../lib/ai/agentEngine").ToolEvent[]>([]);
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

  // Blueprint state
  const [blueprint, setBlueprint] = useState<ArticleBlueprint | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [blueprintEditorOpen, setBlueprintEditorOpen] = useState(false);

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
    return true;
  }


  // Style template
  const [styleTemplate, setStyleTemplate] = useState(() => getTemplate(editorStyleTemplateId || getSelectedTemplateId()));

  // Sync styleTemplate when parent changes editorStyleTemplateId (e.g. from StylePanel)
  useEffect(() => {
    const t = getTemplate(editorStyleTemplateId || getSelectedTemplateId());
    if (t && t.id !== styleTemplate?.id) {
      setStyleTemplate(t);
    }
  }, [editorStyleTemplateId]);

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
      setBlueprint(null);
      onOutlineChange?.([]);
      writtenContentRef.current = null;
      contentInjectedFromPlanRef.current = false;
      pendingArticleRef.current = null;
      writingAbortRef.current = false;
      // Reset plan state so StartupSplash is fresh
      setPlanState("idle");
      setPlanStep("idle");
      setPartialPlan({ title: "", description: "", outline: [], tags: [], tone: "", targetAudience: "", targetWordCount: 0, skillId: undefined });
      setLastPlanInput(null);
      setPlanError(null);
      // Reset folder context refs for fresh load
      folderContextRef.current = "";
      folderProjectNameRef.current = "";
      setFolderProjectName("");
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

    // Load blueprint
    loadBlueprint(activeArticleId).then((bp) => {
      if (bp) {
        setBlueprint(bp);
        updateOutline(contentRef.current, bp.outline);
        onPhaseChange?.(bp.phase);
      } else {
        // Create default blueprint from article title
        loadArticleContent(activeArticleId).then((content) => {
          const title = content ? content.split('\n')[0].replace(/^#\s*/, '') : "无标题";
          const defaultBp = createDefaultBlueprint(title);
          setBlueprint(defaultBp);
          updateOutline(contentRef.current, defaultBp.outline);
          onPhaseChange?.(defaultBp.phase);
          saveBlueprint(activeArticleId, defaultBp);
        });
      }
    });
  }, [activeArticleId]);

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
          }
          setPlanStep(result.step);
          // Persist draft after each step
          if (updated && activeArticleId) {
            try { localStorage.setItem('plan-draft-' + activeArticleId, JSON.stringify(updated)); } catch {}
          }
        }
        setPlanState("review");
      } catch (e: any) {
        setPlanError(e?.message || "生成失败");
        setPlanState("review");
      }
    })();
  }, [lastPlanInput]);

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
        projectContext: folderContextRef.current || undefined,
        projectName: folderProjectNameRef.current || undefined,
        seriesContext: seriesCtx || undefined,
        linkedFolder: projectLinkedFolder || undefined,
      };

      // Start writing phase（保持 StartupSplash 可见并实时展示生成内容）
      setPlanState("writing");

      pendingArticleRef.current = result;

      // 所有大纲节统一标记为 writing（整体进度）
      setBlueprint(prev => {
        if (!prev) return prev;
        const writingOutline = prev.outline.map(s => ({ ...s, status: "writing" as const }));
        const writingBp = { ...prev, outline: writingOutline };
        saveBlueprint(result.articleId, writingBp);
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
          return completeBp;
        });
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
      setPlanError(e?.message || "写作过程出错");
      setPlanState("article-review");
    }
  }, [partialPlan, lastPlanInput, activeCollectionId, onPlanComplete, folderContextRef, folderProjectNameRef]);

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
    setPartialPlan({ title: "", description: "", outline: [], tags: [], tone: "", targetAudience: "", targetWordCount: 0, skillId: undefined });
    setPlanError(null);
    pendingArticleRef.current = null;
    writtenContentRef.current = null;
  }, [onEnterEditor]);

  const handleToolEvent = useCallback((event: import("../../lib/ai/agentEngine").ToolEvent) => {
    setToolEvents(prev => [...prev, event]);
  }, []);

  const handlePlanCancel = useCallback(() => {
    if (activeArticleId) try { localStorage.removeItem('plan-draft-' + activeArticleId); } catch {}
    setPlanState("idle");
    setPartialPlan({ title: "", description: "", outline: [], tags: [], tone: "", targetAudience: "", targetWordCount: 0, skillId: undefined });
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

    // Prepend folder context if available
    const ctxWithFolder = folderContextRef.current
      ? `## 关联项目目录上下文
${folderContextRef.current}

${augmentedContent}`
      : augmentedContent;

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
    
    setLastPlanInput(input);
    // Load linked folder path for tool-based file reading
    const _linkedFolder = activeCollectionId
      ? (await import("../../lib/storage/collections").then(m => m.loadCollections())).find(c => c.id === activeCollectionId)?.linkedFolder || undefined
      : undefined;
    const enrichedInput: PlanInput = {
      ...input,
      projectContext: folderContextRef.current || undefined,
      projectName: folderProjectNameRef.current || undefined,
      linkedFolder: _linkedFolder,
    };
    setPartialPlan({ title: "", description: "", outline: [], tags: [], tone: input.tone || "", targetAudience: input.targetAudience || "", targetWordCount: input.targetWordCount || 0, skillId: input.skillId || undefined });
    setPlanError(null);
    setToolEvents([]);
    setPlanState("planning");
    try {
      const gen = generatePlanStream(enrichedInput);
      for await (const result of gen) {
        // Check if cancelled
        if (abortController.signal.aborted) {
          setPlanState("idle");
          setPartialPlan({ title: "", description: "", outline: [], tags: [], tone: "", targetAudience: "", targetWordCount: 0, skillId: undefined });
          return;
        }
        if (result.step === "title" && result.data) {
          setPartialPlan(p => ({ ...p, title: result.data }));
        } else if (result.step === "description" && result.data) {
          setPartialPlan(p => ({ ...p, description: result.data }));
        } else if (result.step === "outline" && result.data) {
          setPartialPlan(p => ({ ...p, outline: result.data }));
        } else if (result.step === "tags" && result.data) {
          setPartialPlan(p => ({ ...p, tags: result.data }));
        }
        setPlanStep(result.step);
      }
      if (!abortController.signal.aborted) {
        setPlanState("review");
      }
    } catch (e: any) {
      if (!abortController.signal.aborted) {
        setPlanError(e?.message || "生成失败");
        setPlanState("review");
      }
    }
  }, []);

  // Cancel plan function exposed to StartupSplash
  const cancelPlan = useCallback(() => {
    if (abortPlanRef.current) {
      abortPlanRef.current.abort();
      abortPlanRef.current = null;
    }
    setPlanState("idle");
    setPlanStep("idle");
    setPartialPlan({ title: "", description: "", outline: [], tags: [], tone: "", targetAudience: "", targetWordCount: 0, skillId: undefined });
    setLastPlanInput(null);
    setPlanError(null);
  }, []);

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
      const { title, description, tone: articleTone, targetAudience, skillId, targetWordCount } = detail;
      const inspiration = description 
        ? `写一篇关于「${title}」的文章：${description}`
        : `写一篇关于「${title}」的文章`;
      handleStartPlan({
        inspiration,
        tone: articleTone || undefined,
        targetAudience: targetAudience || undefined,
        targetWordCount: targetWordCount || undefined,
        skillId: skillId || undefined,
      });
    });
  }, [handleStartPlan]);


  // Load folder context when activeCollectionId changes
  useEffect(() => {
    // Always clear first
    folderContextRef.current = "";
    folderProjectNameRef.current = "";
    setFolderProjectName("");

    setProjectFiles([]);
    // Reset plan state when switching collections on startup splash
    if (!activeArticleId) {
      setPlanState("idle");
      setPlanStep("idle");
      setPartialPlan({ title: "", description: "", outline: [], tags: [], tone: "", targetAudience: "", targetWordCount: 0, skillId: undefined });
      setLastPlanInput(null);
      setPlanError(null);
    }

    if (!activeCollectionId) return;

    loadCollections().then(cols => {
      const col = cols.find(c => c.id === activeCollectionId);
      if (col?.linkedFolder) {
        folderProjectNameRef.current = col.title;
        setFolderProjectName(col.title);
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
        // Load project context data for left panel
        import("../../lib/storage/collections").then(({ getProjectContext }) => {
          getProjectContext(col.linkedFolder!).then(ctx => {
            // Store tree structure and extract top-level files for flat list fallback
            setProjectTree(ctx.structure);
            const topFiles = ctx.summary.topFiles
              .filter(f => f.language)
              .slice(0, 15)
              .map(f => f.path.replace(ctx.rootPath + "/", ""));
            const topSymbols = ctx.symbols
              .filter(s => s.kind === "function" || s.kind === "class")
              .slice(0, 10)
              .map(s => s.name);
            setProjectFiles([...topFiles, ...topSymbols]);
          }).catch(() => {
            // getProjectContext 失败时（浏览器模式或 IPC 错误），
            // 用 collection 的基本信息作为 fallback
            setProjectFiles([]);
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
      {(hasActiveArticle && activeArticleId) ? (
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
      {hasActiveArticle && activeArticleId ? (
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
        </div>
      ) : folderProjectName ? (
        <div className="editor-pane__startup-split">
          <div className="editor-pane__project-panel">
            <div className="editor-pane__project-header">
              <FolderInput size={13} />
              <span>项目灵感</span>
            </div>
            <div className="editor-pane__project-name">{folderProjectName}</div>
            {projectFiles.length > 0 ? (
              <>
              <p className="editor-pane__project-hint">浏览项目文件获取灵感，点击「AI 规划」开始写作</p>
              <div className="editor-pane__project-files">
                {projectTree ? (
                  <ProjectFileTree
                    nodes={projectTree}
                    maxDepth={3}
                    onSelect={(_path) => {
                      // 项目灵感树仅作浏览，不触发生成
                    }}
                  />
                ) : (
                  projectFiles.map((f, i) => (
                    <button key={i} className="editor-pane__file-chip"
                      onClick={() => {
                        // 项目灵感文件仅作浏览，不触发生成
                      }}
                    >
                      <FileText size={10} />
                      <span>{f}</span>
                    </button>
                  ))
                )}
              </div>
              </>
            ) : (
              <p className="editor-pane__project-hint">关联了目录「{folderProjectName}」，点击下方 AI 规划开始写作</p>
            )}
          </div>
          <StartupSplash
            onQuickStart={() => onNewDoc?.(activeCollectionId ?? undefined)}
            onAIPlan={handleStartPlan}
            planState={planState}
            planStep={planStep}
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
            streamingContent={streamingContent}
            projectName={folderProjectName || undefined}
            projectReady={!!folderProjectName}
            projectFiles={projectFiles}
            toolEvents={toolEvents}
          />
        </div>
      ) : (
        <StartupSplash
          onQuickStart={() => onNewDoc?.(activeCollectionId ?? undefined)}
          onAIPlan={handleStartPlan}
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
          projectName={folderProjectName || undefined}
          projectReady={!!folderProjectName}
          projectFiles={projectFiles}
          toolEvents={toolEvents}
        />
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
    </section>
  );
}
