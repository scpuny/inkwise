import { useState, useCallback, useEffect, useRef } from "react";
import { Toolbar } from "./Toolbar";
import { EditorContent, type EditorMode } from "./EditorContent";
import { InlineToolbar } from "./InlineToolbar";
import { ArticleHeader } from "./ArticleHeader";
import { BlueprintEditor } from "./BlueprintEditor";
import { StartupSplash } from "./StartupSplash";
import { useChatStream } from "../lib/useChatStream";
import { useAgent } from "../lib/agent";
import { getProvidersSync } from "../lib/providerModels";
import { loadCollections } from "../lib/collections";
import { saveArticleContent, loadArticleContent } from "../lib/articles";
import { saveVersionSnapshot } from "../lib/articleVersions";
import { parseOutlineFromMarkdown, type OutlineItem, type BlueprintOutlineItem } from "./OutlinePanel";
import { getTemplate, getSelectedTemplateId, setSelectedTemplateId, addHeadingNumbers } from "../lib/editorStyles";
import {
  ArticleBlueprint,
  type OutlineSection,
  loadBlueprint,
  saveBlueprint,
  createDefaultBlueprint,
  buildBlueprintContext,
} from "../lib/articleBlueprint";
import { generatePlanStream, writeArticleSection, type PlanInput, type PlanStep, type PartialPlan } from "../lib/plan";

export function EditorPane({
  aiDockOpen,
  onToggleAIDock,
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
}: {
  aiDockOpen: boolean;
  onToggleAIDock: () => void;
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
}) {
  const { state: streamState, startStream, cancelStream, clearResponse } = useChatStream();
  const { execute, isProcessing, openPanel, setPanelTab } = useAgent();
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [planState, setPlanState] = useState<"idle" | "planning" | "review" | "writing" | "article-review">("idle");
  const [planStep, setPlanStep] = useState<PlanStep>("idle");
  const [partialPlan, setPartialPlan] = useState<PartialPlan>({ title: "", description: "", outline: [], tags: [], tone: "", targetAudience: "", targetWordCount: 0 });
  const [planError, setPlanError] = useState<string | null>(null);
  const [lastPlanInput, setLastPlanInput] = useState<PlanInput | null>(null);
  const [editorContent, setEditorContent] = useState<string>("");
  const contentRef = useRef<string>("");
  const writtenContentRef = useRef<string | null>(null); // written content from plan flow
  const contentInjectedFromPlanRef = useRef(false); // true when handleEnterEditor injected content
  const folderContextRef = useRef<string>("");
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
          if (sectionStart >= 0 && li > sectionStart && trimmed.startsWith("#") && !trimmed.startsWith(heading + " ")) {
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
  const updateOutline = useCallback((content: string, blueprintSections?: ArticleBlueprint["outline"]) => {
    if (onOutlineChange) {
      let items: OutlineItem[];
      if (blueprintSections && blueprintSections.length > 0) {
        // Use blueprint outline with status
        items = blueprintSections.map(s => ({
          id: s.id,
          text: s.title,
          level: s.level,
          status: s.status,
          description: s.description,
        } as BlueprintOutlineItem));
      } else {
        // Fallback to markdown headings
        items = parseOutlineFromMarkdown(content);
      }
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

    // Load folder context if collection has linked folder
    if (activeCollectionId) {
      loadCollections().then(cols => {
        const col = cols.find(c => c.id === activeCollectionId);
        if (col?.linkedFolder) {
          import("../lib/collections").then(({ getCollectionFolderContext }) => {
            getCollectionFolderContext(activeCollectionId!).then(ctx => {
              if (ctx) {
                folderContextRef.current = ctx;
              }
            });
          });
        }
      });
    }

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
    setPlanState("planning");
    (async () => {
      try {
        const gen = generatePlanStream(lastPlanInput);
        for await (const result of gen) {
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
        targetAudience: lastPlanInput?.targetAudience || partialPlan.targetAudience || "",
        targetWordCount: lastPlanInput?.targetWordCount || partialPlan.targetWordCount || 0,
      }, activeCollectionId ?? "");

      if (!result) {
        setPlanError("创建文章失败");
        return;
      }

      // Store article info for later navigation
      pendingArticleRef.current = result;

      // Build full blueprint with pending status
      const bp = createDefaultBlueprint(partialPlan.title);
      bp.workingTitle = partialPlan.title || "";
      bp.description = partialPlan.description || "";
      bp.tone = lastPlanInput?.tone || partialPlan.tone || undefined;
      bp.targetAudience = lastPlanInput?.targetAudience || partialPlan.targetAudience || undefined;
      bp.targetWordCount = lastPlanInput?.targetWordCount || partialPlan.targetWordCount || 0;
      bp.tags = partialPlan.tags || [];
      bp.outline = partialPlan.outline.map(s => ({ ...s, status: "pending" as const }));
      bp.phase = "writing";
      setBlueprint(bp);

      // Save skeleton content (already saved by onPlanComplete, but ensure it's persisted)
      const skelDoc = (partialPlan.description || "") + "\n\n";

      saveArticleContent(result.articleId, skelDoc);

      // Start writing phase
      setPlanState("writing");

      // Write all sections
      const success = await writeAllSections(result.articleId, bp);

      if (!success) {
        console.warn("部分章节写作失败");
      }

      // Final persist to storage
      const finalContent = writtenContentRef.current || contentRef.current;
      if (finalContent && finalContent.length > 10 && result.articleId) {
        saveArticleContent(result.articleId, finalContent);
      }

      // Show article review
      setPlanState("article-review");
    } catch (e: any) {
      console.error("Plan execution failed:", e);
      setPlanError(e?.message || "写作过程出错");
      setPlanState("article-review");
    }
  }, [partialPlan, lastPlanInput, activeCollectionId, onPlanComplete]);

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
    setPartialPlan({ title: "", description: "", outline: [], tags: [], tone: "", targetAudience: "", targetWordCount: 0 });
    setPlanError(null);
    pendingArticleRef.current = null;
    writtenContentRef.current = null;
  }, [onEnterEditor]);

  const handlePlanCancel = useCallback(() => {
    setPlanState("idle");
    setPartialPlan({ title: "", description: "", outline: [], tags: [], tone: "", targetAudience: "", targetWordCount: 0 });
    setPlanError(null);
  }, []);

  // Save blueprint
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

  // Keyboard shortcut: Ctrl+K opens Agent panel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === "k") {
        e.preventDefault();
        openPanel?.();
        setPanelTab?.("chat");
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <section className="editor-pane">
      {(hasActiveArticle && activeArticleId) || planState === "planning" || planState === "review" || planState === "article-review" ? (
        <Toolbar
          aiDockOpen={aiDockOpen}
          onToggleAIDock={onToggleAIDock}
          onModeSwitch={onSetEditorFormat}
          editorMode={parentEditorMode}
          onStyleTemplate={handleSelectStyleTemplate}
          styleTemplateId={styleTemplate?.id || "default"}
          onToggleStylePanel={onToggleStylePanel}
          onCloseStylePanel={onCloseStylePanel}
          onToggleFocus={onToggleFocus}
        />
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
      ) : (
        <StartupSplash
          onQuickStart={() => onNewDoc?.(activeCollectionId ?? undefined)}
          onAIPlan={async (input: PlanInput) => {
            setLastPlanInput(input);
            setPartialPlan({ title: "", description: "", outline: [], tags: [], tone: input.tone || "", targetAudience: input.targetAudience || "", targetWordCount: input.targetWordCount || 0 });
            setPlanError(null);
            setPlanState("planning");
            try {
              const gen = generatePlanStream(input);
              for await (const result of gen) {
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
              setPlanState("review");
            } catch (e: any) {
              setPlanError(e?.message || "生成失败");
              setPlanState("review");
            }
          }}
          planState={planState}
          planStep={planStep}
          partialPlan={partialPlan}
          planError={planError}
          lastPlanInput={lastPlanInput}
          writingOutline={blueprint?.outline || partialPlan.outline}
          writingSectionId={writingSection}
          onConfirm={handlePlanConfirm}
          onCancel={handlePlanCancel}
          onEditTitle={handleEditTitle}
          onEditDescription={handleEditDescription}
          onEditOutline={handleEditOutline}
          onRetry={handlePlanRetry}
          onEnterEditor={handleEnterEditor}
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
