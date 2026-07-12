// PhaseGuideDialog.tsx — 首次阶段切换引导对话框
// 仅 showOnce：用户首次进入下一阶段时弹出，说明各阶段含义

import { useState } from "react";
import { X, ArrowRight, Lightbulb, FileText, Search, CheckCircle2 } from "lucide-react";
import type { ArticlePhase } from "../../domain";
import { getPhaseLabel } from "../../domain";

const GUIDE_KEY = "inkwise_phase_guide_shown";

/** 检查当前用户是否已看过引导 */
export function isPhaseGuideShown(): boolean {
  try {
    return localStorage.getItem(GUIDE_KEY) === "true";
  } catch {
    return false;
  }
}

/** 标记引导已展示 */
export function markPhaseGuideShown(): void {
  try {
    localStorage.setItem(GUIDE_KEY, "true");
  } catch { /* noop */ }
}

const PHASE_INFO: { phase: ArticlePhase; icon: React.ReactNode; tip: string }[] = [
  {
    phase: "planning",
    icon: <Lightbulb size={18} />,
    tip: "设定文章目标、大纲和写作风格，为创作打好基础",
  },
  {
    phase: "writing",
    icon: <FileText size={18} />,
    tip: "按大纲逐段写作，AI 助手可辅助扩写和润色",
  },
  {
    phase: "reviewing",
    icon: <Search size={18} />,
    tip: "AI 审阅文章质量，逐段检查并给出优化建议",
  },
  {
    phase: "complete",
    icon: <CheckCircle2 size={18} />,
    tip: "文章完成，可查看成品、导出或发布到各平台",
  },
];

interface PhaseGuideDialogProps {
  /** 当前所处阶段 */
  currentPhase: ArticlePhase;
  /** 下一阶段 */
  nextPhase: ArticlePhase | null;
  /** 用户确认后回调 */
  onConfirm: () => void;
  /** 关闭回调 */
  onClose: () => void;
}

export function PhaseGuideDialog({
  currentPhase,
  nextPhase,
  onConfirm,
  onClose,
}: PhaseGuideDialogProps) {
  if (!nextPhase) return null;

  return (
    <div className="phase-guide-overlay" onClick={onClose}>
      <div className="phase-guide" onClick={(e) => e.stopPropagation()}>
        <div className="phase-guide__header">
          <Lightbulb size={16} />
          <span>写作阶段引导</span>
          <button className="phase-guide__close" onClick={onClose}><X size={14} /></button>
        </div>

        <div className="phase-guide__body">
          <p className="phase-guide__intro">
            即将从 <strong>{getPhaseLabel(currentPhase)}</strong> 进入 <strong>{getPhaseLabel(nextPhase)}</strong>。
            了解各阶段的作用：
          </p>

          <div className="phase-guide__phases">
            {PHASE_INFO.map((p, i) => {
              const isCurrent = p.phase === currentPhase;
              const isNext = p.phase === nextPhase;
              const isPast = !isCurrent && !isNext && PHASE_INFO.findIndex((x) => x.phase === p.phase) < PHASE_INFO.findIndex((x) => x.phase === currentPhase);
              return (
                <div key={p.phase} className={`phase-guide__phase${isCurrent ? " phase-guide__phase--current" : ""}${isNext ? " phase-guide__phase--next" : ""}${isPast ? " phase-guide__phase--done" : ""}`}>
                  <div className="phase-guide__phase-icon">{p.icon}</div>
                  <div className="phase-guide__phase-info">
                    <span className="phase-guide__phase-label">
                      {getPhaseLabel(p.phase)}
                      {isNext && <span className="phase-guide__phase-badge">下一步</span>}
                    </span>
                    <span className="phase-guide__phase-tip">{p.tip}</span>
                  </div>
                  {i < PHASE_INFO.length - 1 && <ArrowRight size={12} className="phase-guide__arrow" />}
                </div>
              );
            })}
          </div>
        </div>

        <div className="phase-guide__footer">
          <button className="btn btn--plain" onClick={onClose}>稍后再说</button>
          <button className="btn btn--primary" onClick={onConfirm}>
            进入 {getPhaseLabel(nextPhase)}
          </button>
        </div>
      </div>
    </div>
  );
}
