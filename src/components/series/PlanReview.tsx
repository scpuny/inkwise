// PlanReview.tsx — 分步展示 AI 规划结果
// 每个步骤生成后立即显示，用户可以实时看到进度

import { useState, useCallback } from "react";
import {
  Sparkles, Check, RefreshCw, Edit3, X, Plus, Trash2, ChevronUp, ChevronDown, Loader2,
} from "lucide-react";
import type { OutlineSection } from "../../lib/ai/articleBlueprint";
import type { PlanStep, PartialPlan } from "../../lib/ai/plan";

interface PlanReviewProps {
  inspiration: string;
  tone?: string;
  audience?: string;
  wordCount?: number;
  /** 当前进度 */
  currentStep: PlanStep;
  /** 部分结果，逐步填充 */
  plan: PartialPlan;
  /** 上一步出错的信息 */
  error: string | null;
  onRetryStep: () => void;
  onConfirm: (plan: PartialPlan) => void;
  onCancel: () => void;
  onEditPlan: (updates: Partial<PartialPlan>) => void;
}

export function PlanReview({
  inspiration, tone, audience, wordCount,
  currentStep, plan, error,
  onRetryStep, onConfirm, onCancel, onEditPlan,
}: PlanReviewProps) {
  const [editingOutline, setEditingOutline] = useState(false);
  const [editOutline, setEditOutline] = useState<OutlineSection[]>(() =>
    plan.outline.length > 0 ? [...plan.outline] : []
  );

  const isStepActive = (step: PlanStep) => {
    const order: PlanStep[] = ["title", "description", "outline", "tags", "done"];
    const currentIdx = order.indexOf(currentStep);
    const stepIdx = order.indexOf(step);
    return stepIdx <= currentIdx;
  };

  const isStepLoading = (step: PlanStep) => currentStep === step;

  return (
    <div className="plan-review">
      <div className="plan-review__card">
        {/* Header */}
        <div className="plan-review__header">
          <div className="plan-review__header-left">
            <Sparkles size={18} className="plan-review__icon" />
            <h2 className="plan-review__title">AI 正在规划</h2>
          </div>
        </div>

        {/* Inspiration */}
        <div className="plan-review__inspiration">
          <span className="plan-review__label">灵感</span>
          <span className="plan-review__value">{inspiration}</span>
        </div>

        {/* Optional prefs */}
        {(tone || audience || wordCount) && (
          <div className="plan-review__prefs">
            {tone && <span className="plan-review__pref-tag">风格: {tone}</span>}
            {audience && <span className="plan-review__pref-tag">读者: {audience}</span>}
            {wordCount && <span className="plan-review__pref-tag">字数: ~{wordCount}</span>}
          </div>
        )}

        {/* Step 1: Title */}
        <PlanStepRow
          label="标题"
          step="title"
          isActive={isStepActive("title")}
          isLoading={isStepLoading("title")}
          isEmpty={!plan.title}
          error={error}
          
        >
          {plan.title && (
            <input
              className="plan-review__input plan-review__input--title"
              value={plan.title}
              onChange={(e) => onEditPlan({ title: e.target.value })}
            />
          )}
        </PlanStepRow>

        {/* Step 2: Description */}
        <PlanStepRow
          label="简介"
          step="description"
          isActive={isStepActive("description")}
          isLoading={isStepLoading("description")}
          isEmpty={!plan.description}
          error={error}
          
        >
          {plan.description && (
            <textarea
              className="plan-review__textarea"
              rows={2}
              value={plan.description}
              onChange={(e) => onEditPlan({ description: e.target.value })}
            />
          )}
        </PlanStepRow>

        {/* Step 3: Outline */}
        <PlanStepRow
          label="大纲"
          step="outline"
          isActive={isStepActive("outline")}
          isLoading={isStepLoading("outline")}
          isEmpty={plan.outline.length === 0}
          error={error}
          
          actions={
            plan.outline.length > 0 ? (
              <button
                className="plan-review__btn plan-review__btn--mini"
                onClick={() => {
                  if (editingOutline) {
                    onEditPlan({ outline: editOutline });
                  } else {
                    setEditOutline([...plan.outline]);
                  }
                  setEditingOutline(!editingOutline);
                }}
              >
                {editingOutline ? <Check size={11} /> : <Edit3 size={11} />}
                {editingOutline ? "完成" : "编辑"}
              </button>
            ) : undefined
          }
        >
          {plan.outline.length > 0 && (
            <div className="plan-review__outline-list">
              {(editingOutline ? editOutline : plan.outline).map((section, i) => (
                editingOutline ? (
                  <div key={section.id || i} className="plan-review__outline-item plan-review__outline-item--editing">
                    <div className="plan-review__outline-move">
                      <button className="plan-review__move-btn" onClick={() => {
                        const newO = [...editOutline];
                        if (i > 0) { [newO[i-1], newO[i]] = [newO[i], newO[i-1]]; setEditOutline(newO); }
                      }}><ChevronUp size={10} /></button>
                      <button className="plan-review__move-btn" onClick={() => {
                        const newO = [...editOutline];
                        if (i < newO.length-1) { [newO[i], newO[i+1]] = [newO[i+1], newO[i]]; setEditOutline(newO); }
                      }}><ChevronDown size={10} /></button>
                    </div>
                    <div className="plan-review__outline-fields">
                      <div className="plan-review__outline-row">
                        <input className="plan-review__outline-input" value={section.title}
                          onChange={(e) => { const n = [...editOutline]; n[i] = {...n[i], title: e.target.value}; setEditOutline(n); }} />
                        <select className="plan-review__outline-level" value={section.level}
                          onChange={(e) => { const n = [...editOutline]; n[i] = {...n[i], level: parseInt(e.target.value) as 1|2|3}; setEditOutline(n); }}>
                          <option value={1}>H1</option><option value={2}>H2</option><option value={3}>H3</option>
                        </select>
                        <button className="plan-review__remove-btn" onClick={() => setEditOutline(editOutline.filter((_, idx) => idx !== i))}>
                          <Trash2 size={11} />
                        </button>
                      </div>
                      <input className="plan-review__outline-desc" value={section.description || ""}
                        onChange={(e) => { const n = [...editOutline]; n[i] = {...n[i], description: e.target.value || undefined}; setEditOutline(n); }}
                        placeholder="章节描述（可选）" />
                    </div>
                  </div>
                ) : (
                  <div key={section.id || i} className="plan-review__outline-item"
                    style={{ marginLeft: `${(section.level - 1) * 20}px` }}>
                    <span className="plan-review__outline-num">{i + 1}.</span>
                    <span className="plan-review__outline-title">{section.title}</span>
                    {section.description && <span className="plan-review__outline-desc-text">— {section.description}</span>}
                  </div>
                )
              ))}
              {editingOutline && (
                <button className="plan-review__add-section" onClick={() => {
                  setEditOutline([...editOutline, { id: `sec_${Date.now()}`, title: "新章节", level: 1, status: "pending" }]);
                }}>
                  <Plus size={13} /> 添加章节
                </button>
              )}
            </div>
          )}
        </PlanStepRow>

        {/* Step 4: Tags */}
        <PlanStepRow
          label="标签"
          step="tags"
          isActive={isStepActive("tags")}
          isLoading={isStepLoading("tags")}
          isEmpty={plan.tags.length === 0}
          error={error}
          
        >
          {plan.tags.length > 0 && (
            <div className="plan-review__tags">
              {plan.tags.map((tag, i) => (
                <span key={i} className="plan-review__tag">{tag}</span>
              ))}
            </div>
          )}
        </PlanStepRow>

        {/* Error */}
        {error && (
          <div className="plan-review__error">
            <span>{error}</span>
            <button className="plan-review__btn plan-review__btn--mini" onClick={onRetryStep}>
              <RefreshCw size={11} /> 重试
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="plan-review__actions">
          <button className="plan-review__btn" onClick={onCancel}>
            <X size={13} /> 取消
          </button>
          {currentStep === "done" && (
            <button className="plan-review__btn plan-review__btn--confirm" onClick={() => onConfirm(plan)}>
              <Sparkles size={13} /> 确认并开始写作
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── 每一步的容器 ─── */
function PlanStepRow({
  label, step, isActive, isLoading, isEmpty, error, children, actions,
}: {
  label: string;
  step: PlanStep;
  isActive: boolean;
  isLoading: boolean;
  isEmpty: boolean;
  error: string | null;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const visible = isActive || !isEmpty;

  if (!visible) return null;

  return (
    <div className="plan-review__field">
      <span className="plan-review__label">{label}</span>
      <div className="plan-review__field-content">
        {isLoading && !isEmpty ? (
          <div className="plan-review__step-done">
            <Check size={13} className="plan-review__step-icon" />
            {children}
            {actions}
          </div>
        ) : isLoading ? (
          <div className="plan-review__step-loading">
            <Loader2 size={13} className="plan-review__spinner" />
            <span>正在生成{label}…</span>
          </div>
        ) : (
          <div className="plan-review__step-done">
            {children && <div className="plan-review__step-content">{children}</div>}
            {actions && <div className="plan-review__step-actions">{actions}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
