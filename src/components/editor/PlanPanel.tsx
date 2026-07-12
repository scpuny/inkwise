// PlanPanel — 规划面板
// 管理三个状态：欢迎页（规划前）/ 规划中 / 规划审阅
// 替代 EditorPane 中直接渲染 StartupSplash 的三处代码

import { StartupSplash } from "../common/StartupSplash";
import { LoadingSpinner } from "../common/LoadingSpinner";
import type { ArticleBlueprint, OutlineSection } from "../../domain";
import type { PlanInput, PartialPlan, PlanStep } from "../../lib/ai/plan";
import type { FileNode } from "../../domain";
import type { ToolEvent } from "../../lib/ai/agent/engine";

type PlanState = "idle" | "planning" | "review" | "review-title-desc" | "writing" | "article-review";

interface PlanPanelProps {
  // Active state
  hasActiveArticle: boolean;
  activeArticleId: string | null;
  activeCollectionId?: string | null;
  blueprint: ArticleBlueprint | null;
  blueprintLoaded: boolean;

  // Plan state
  planState: PlanState;
  planStep: PlanStep;
  partialPlan: PartialPlan;
  planError: string | null;
  lastPlanInput: PlanInput | null;
  writingOutline: OutlineSection[];
  writingSectionId: string | null;
  streamingContent?: string;
  toolEvents?: ToolEvent[];

  // Callbacks
  onQuickStart: () => void;
  onAIPlan: (input: PlanInput) => void;
  onContinueToOutline: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  onCancelPlan: () => void;
  onEditTitle: (title: string) => void;
  onEditDescription: (desc: string) => void;
  onEditOutline: (outline: OutlineSection[]) => void;
  onRetry: () => void;
  onEnterEditor: () => void;

  // Project context
  projectName?: string;
  projectReady?: boolean;
  projectFiles?: string[];
  projectStructure?: FileNode[];

  // Phase change
  onPhaseChange?: (phase: string) => void;
}

export function PlanPanel(props: PlanPanelProps) {
  const {
    hasActiveArticle, activeArticleId, blueprint, blueprintLoaded,
    planState, planStep, partialPlan, planError, lastPlanInput,
    writingOutline, writingSectionId, streamingContent = "", toolEvents = [],
    onQuickStart, onAIPlan, onContinueToOutline, onConfirm, onCancel, onCancelPlan,
    onEditTitle, onEditDescription, onEditOutline, onRetry, onEnterEditor,
    projectName, projectReady, projectFiles, projectStructure, onPhaseChange,
  } = props;

  // ─── Case 1: Welcome page (no active article) ───
  if (!hasActiveArticle || !activeArticleId) {
    return (
      <StartupSplash
        onQuickStart={onQuickStart}
        onAIPlan={onAIPlan}
        onContinueToOutline={onContinueToOutline}
        planState={planState}
        planStep={planStep}
        streamingContent={streamingContent}
        partialPlan={partialPlan}
        planError={planError}
        lastPlanInput={lastPlanInput}
        writingOutline={writingOutline}
        writingSectionId={writingSectionId}
        onConfirm={onConfirm}
        onCancel={onCancel}
        onCancelPlan={onCancelPlan}
        onEditTitle={onEditTitle}
        onEditDescription={onEditDescription}
        onEditOutline={onEditOutline}
        onRetry={onRetry}
        onEnterEditor={onEnterEditor}
        projectName={projectName}
        projectReady={projectReady}
        projectFiles={projectFiles}
        projectStructure={projectStructure}
        toolEvents={toolEvents}
      />
    );
  }

  // ─── Case 2: Loading ───
  if (!blueprintLoaded) {
    return <LoadingSpinner message="加载中…" />;
  }

  // ─── Case 3: Planning phase review ───
  if (blueprint && blueprint.phase === "planning") {
    return (
      <StartupSplash
        onQuickStart={() => {
          // Planning article: quick start → skip to writing phase
          if (activeArticleId && blueprint) {
            const updatedBp = { ...blueprint, phase: "writing" as const };
            // Parent will handle save via callback
            onQuickStart();
            onPhaseChange?.("writing");
          }
        }}
        onAIPlan={onAIPlan}
        onContinueToOutline={onContinueToOutline}
        planState={planState}
        planStep={planStep}
        partialPlan={partialPlan}
        planError={planError}
        lastPlanInput={lastPlanInput}
        writingOutline={writingOutline}
        writingSectionId={writingSectionId}
        onConfirm={onConfirm}
        onCancel={onCancel}
        onCancelPlan={onCancelPlan}
        onEditTitle={onEditTitle}
        onEditDescription={onEditDescription}
        onEditOutline={onEditOutline}
        onRetry={onRetry}
        onEnterEditor={onEnterEditor}
        streamingContent={streamingContent}
        projectName={projectName}
        projectReady={projectReady}
        projectFiles={projectFiles}
        toolEvents={toolEvents}
      />
    );
  }

  // ─── Case 4: Article is in writing phase — render nothing (EditorCanvas handles this) ───
  return null;
}
