import { useState, useCallback, useEffect, useRef } from "react";
import { Toolbar } from "./Toolbar";
import { EditorContent, type EditorMode } from "./EditorContent";
import { AICommandBar } from "./AICommandBar";
import { InlineToolbar } from "./InlineToolbar";
import { ArticleHeader } from "./ArticleHeader";
import { BlueprintEditor } from "./BlueprintEditor";
import { StartupSplash } from "./StartupSplash";
import { PlanReview } from "./PlanReview";
import { useChatStream } from "../lib/useChatStream";
import { useAgent } from "../lib/agent";
import { getProvidersSync } from "../lib/providerModels";
import { loadCollections } from "../lib/collections";
import { saveArticleContent, loadArticleContent } from "../lib/articles";
import { parseOutlineFromMarkdown, type OutlineItem } from "./OutlinePanel";
import { getTemplate, getSelectedTemplateId, setSelectedTemplateId } from "../lib/editorStyles";
import {
  ArticleBlueprint,
  loadBlueprint,
  saveBlueprint,
  createDefaultBlueprint,
  buildBlueprintContext,
} from "../lib/articleBlueprint";
import { generatePlanStream, type PlanInput, type PlanStep, type PartialPlan } from "../lib/plan";

export function EditorPane({
  aiDockOpen,
  onToggleAIDock,
  hasActiveArticle,
  activeArticleId,
  activeCollectionId,
  onNewDoc,
  editorMode: parentEditorMode,
  editorLineHeight: parentLineHeight,
  editorStyleTemplateId,
  onSetEditorFormat,
  onSetEditorLineHeight,
  onSetEditorStyleTemplate,
  onOutlineChange,
  onSaveStateChange,
}: {
  aiDockOpen: boolean;
  onToggleAIDock: () => void;
  hasActiveArticle: boolean;
  activeArticleId?: string | null;
  activeCollectionId?: string | null;
  onNewDoc?: (collectionId?: string) => Promise<void>;
  editorMode: EditorMode;
  editorLineHeight: number;
  editorStyleTemplateId?: string;
  onSetEditorFormat?: (mode: EditorMode) => void;
  onSetEditorLineHeight?: (h: number) => void;
  onSetEditorStyleTemplate?: (id: string) => void;
  onOutlineChange?: (items: OutlineItem[]) => void;
  onSaveStateChange?: (state: "idle" | "saving" | "saved") => void;
}) {
  const { state: streamState, startStream, cancelStream, clearResponse } = useChatStream();
  const { openCommandBar, closeCommandBar, commandBarOpen, execute } = useAgent();
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [planState, setPlanState] = useState<"idle" | "planning" | "review">("idle");
  const [planStep, setPlanStep] = useState<PlanStep>("idle");
  const [partialPlan, setPartialPlan] = useState<PartialPlan>({ title: "", description: "", outline: [], tags: [], tone: "", targetAudience: "", targetWordCount: 0 });
  const [planError, setPlanError] = useState<string | null>(null);
  const [lastPlanInput, setLastPlanInput] = useState<PlanInput | null>(null);
  const [editorContent, setEditorContent] = useState<string>("");
  const contentRef = useRef<string>("");
  const folderContextRef = useRef<string>("");
  const autoSaveTimer = useRef<any>(undefined);
  const outlineTimer = useRef<any>(undefined);

  // Blueprint state
  const [blueprint, setBlueprint] = useState<ArticleBlueprint | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [blueprintEditorOpen, setBlueprintEditorOpen] = useState(false);

  // Style template
  const [styleTemplate, setStyleTemplate] = useState(() => getTemplate(editorStyleTemplateId || getSelectedTemplateId()));

  const handleSelectStyleTemplate = useCallback((id: string) => {
    const t = getTemplate(id);
    if (t) {
      setStyleTemplate(t);
      setSelectedTemplateId(id);
      onSetEditorStyleTemplate?.(id);
    }
  }, [onSetEditorStyleTemplate]);

  // Debounced outline sync
  const updateOutline = useCallback((content: string) => {
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
        saveArticleContent(prevId, prevContent).then(() => {
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
      return;
    }

    // Load article content
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
      } else {
        // Create default blueprint with article title
        loadArticleContent(activeArticleId).then((content) => {
          const title = content ? content.split('\n')[0].replace(/^#\s*/, '') : "无标题";
          const defaultBp = createDefaultBlueprint(title);
          setBlueprint(defaultBp);
          saveBlueprint(activeArticleId, defaultBp);
        });
        // Check for pending plan from PlanReview (legacy, handled by App.tsx now)
        const pendingPlan = sessionStorage.getItem("pendingPlan");
        if (pendingPlan) {
          sessionStorage.removeItem("pendingPlan");
          try {
            const plan = JSON.parse(pendingPlan);
            const bpFromPlan: ArticleBlueprint = {
              workingTitle: plan.title || "无标题",
              description: plan.description || "",
              phase: "writing",
              tags: plan.tags || [],
              tone: plan.tone || undefined,
              targetAudience: plan.targetAudience || undefined,
              targetWordCount: plan.estimatedWordCount || undefined,
              outline: plan.outline.map((s: any, i: number) => ({
                id: s.id || `sec_plan_${i}`,
                title: s.title || "新章节",
                level: s.level || 1,
                description: s.description || undefined,
                targetWordCount: s.targetWordCount || undefined,
                status: "pending" as const,
              })),
              updatedAt: Date.now(),
            };
            setBlueprint(bpFromPlan);
            saveBlueprint(activeArticleId, bpFromPlan);
            return;
          } catch {}
        }
        // Create default blueprint
        const defaultBp = createDefaultBlueprint("无标题");
        setBlueprint(defaultBp);
        saveBlueprint(activeArticleId, defaultBp);
      }
    });
  }, [activeArticleId]);

  // Auto-save on content change
  const handleContentChange = useCallback((content: string, mode?: EditorMode) => {
    contentRef.current = content;
    setEditorContent(content);
    updateOutline(content);
    if (!activeArticleId) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    onSaveStateChange?.("saving");
    autoSaveTimer.current = setTimeout(() => {
      saveArticleContent(activeArticleId, content).then(() => {
        onSaveStateChange?.("saved");
        setTimeout(() => onSaveStateChange?.("idle"), 2000);
      });
    }, 1500);
  }, [activeArticleId]);

  // Save blueprint
  const handleSaveBlueprint = useCallback((bp: ArticleBlueprint) => {
    setBlueprint(bp);
    if (activeArticleId) {
      saveBlueprint(activeArticleId, bp);
    }
  }, [activeArticleId]);

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

  // Keyboard shortcut for command bar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === "k") {
        e.preventDefault();
        if (!commandBarOpen) {
          openCommandBar();
        } else {
          closeCommandBar();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [commandBarOpen, openCommandBar, closeCommandBar]);

  return (
    <section className="editor-pane">
      {(hasActiveArticle && activeArticleId) || planState === "review" ? (
        <Toolbar
          aiDockOpen={aiDockOpen}
          onToggleAIDock={onToggleAIDock}
          onModeSwitch={onSetEditorFormat}
          editorMode={parentEditorMode}
          onStyleTemplate={handleSelectStyleTemplate}
          styleTemplateId={styleTemplate?.id || "default"}
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
          />
          <AICommandBar />
          <InlineToolbar />
        </div>
      ) : planState === "review" ? (
        <PlanReview
          inspiration={lastPlanInput?.inspiration || ""}
          tone={lastPlanInput?.tone}
          audience={lastPlanInput?.targetAudience}
          wordCount={lastPlanInput?.targetWordCount}
          currentStep={planStep}
          plan={partialPlan}
          error={planError}
          onRetryStep={async () => {
            if (!lastPlanInput) return;
            setPlanError(null);
            setPlanState("planning");
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
          }}
          onConfirm={async (plan) => {
            const pendingPlan = {
              title: plan.title,
              description: plan.description,
              outline: plan.outline,
              tags: plan.tags,
              tone: lastPlanInput?.tone || plan.tone || "",
              targetAudience: lastPlanInput?.targetAudience || plan.targetAudience || "",
              estimatedWordCount: lastPlanInput?.targetWordCount || plan.targetWordCount || 0,
            };
            sessionStorage.setItem("pendingPlan", JSON.stringify(pendingPlan));
            setPlanState("idle");
            if (onNewDoc) onNewDoc(activeCollectionId ?? undefined);
          }}
          onCancel={() => { setPlanState("idle"); setPartialPlan({ title: "", description: "", outline: [], tags: [], tone: "", targetAudience: "", targetWordCount: 0 }); setPlanError(null); }}
          onEditPlan={(updates) => setPartialPlan(p => ({ ...p, ...updates }))}
        />
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
          planning={planState === "planning"}
        />
      )}

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
