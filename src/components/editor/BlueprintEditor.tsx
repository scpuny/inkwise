// BlueprintEditor.tsx — 文章蓝图编辑面板（弹窗）
// 标题、简介、大纲管理、语气、目标读者、配图

import { useState, useCallback, useEffect } from "react";
import {
  X, Plus, Trash2, GripVertical, ChevronUp, ChevronDown,
} from "lucide-react";
import type { ArticleBlueprint, OutlineSection, ArticlePhase } from "../../lib/ai/article/blueprint";
import { getPhaseLabel, getPhaseNext, createDefaultBlueprint } from "../../lib/ai/article/blueprint";
import { PhaseGuideDialog, isPhaseGuideShown, markPhaseGuideShown } from "./PhaseGuideDialog";

interface BlueprintEditorProps {
  blueprint: ArticleBlueprint;
  open: boolean;
  onClose: () => void;
  onSave: (bp: ArticleBlueprint) => void;
}

export function BlueprintEditor({ blueprint, open, onClose, onSave }: BlueprintEditorProps) {
  const [bp, setBp] = useState<ArticleBlueprint>(() => ({ ...blueprint, outline: blueprint.outline.map((s) => ({ ...s })) }));
  const [activeTab, setActiveTab] = useState<"basic" | "outline">("basic");
  const [showPhaseGuide, setShowPhaseGuide] = useState(false);
  const [pendingPhase, setPendingPhase] = useState<ArticlePhase | null>(null);

  // Sync local state when modal opens with fresh blueprint data
  useEffect(() => {
    if (open) {
      setBp({ ...blueprint, outline: blueprint.outline.map((s) => ({ ...s })) });
    }
  }, [open, blueprint]);

  const handleSave = useCallback(() => {
    onSave(bp);
    onClose();
  }, [bp, onSave, onClose]);

  if (!open) return null;

  return (
    <div className="blueprint-overlay" onClick={onClose}>
      <div className="blueprint-editor" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="blueprint-editor__header">
          <h3 className="blueprint-editor__title">文章信息</h3>
          <button className="blueprint-editor__close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="blueprint-editor__tabs">
          <button
            className={`blueprint-editor__tab${activeTab === "basic" ? " blueprint-editor__tab--active" : ""}`}
            onClick={() => setActiveTab("basic")}
          >
            基本信息
          </button>
          <button
            className={`blueprint-editor__tab${activeTab === "outline" ? " blueprint-editor__tab--active" : ""}`}
            onClick={() => setActiveTab("outline")}
          >
            大纲结构
          </button>
        </div>

        {/* Content */}
        <div className="blueprint-editor__body">
          {activeTab === "basic" && (
            <BasicTab bp={bp} onChange={setBp} />
          )}
          {activeTab === "outline" && (
            <OutlineTab bp={bp} onChange={setBp} />
          )}
        </div>

        {/* Footer */}
        <div className="blueprint-editor__footer">
          {showPhaseGuide && pendingPhase && (
            <PhaseGuideDialog
              currentPhase={bp.phase}
              nextPhase={pendingPhase}
              onConfirm={() => {
                setBp({ ...bp, phase: pendingPhase! });
                setShowPhaseGuide(false);
                setPendingPhase(null);
                markPhaseGuideShown();
              }}
              onClose={() => {
                setShowPhaseGuide(false);
                setPendingPhase(null);
              }}
            />
          )}
          {bp.phase !== "complete" && (
            <button
              className="blueprint-editor__phase-btn"
              onClick={() => {
                const next = getPhaseNext(bp.phase);
                if (!next) return;
                if (!isPhaseGuideShown()) {
                  setPendingPhase(next);
                  setShowPhaseGuide(true);
                } else {
                  setBp({ ...bp, phase: next });
                }
              }}
            >
              进入下一阶段: {getPhaseLabel(getPhaseNext(bp.phase) || bp.phase)}
            </button>
          )}
          <button className="btn btn--primary" onClick={handleSave}>保存</button>
        </div>
      </div>
    </div>
  );
}

/* ─── 基本信息 Tab ─── */
function BasicTab({ bp, onChange }: { bp: ArticleBlueprint; onChange: (bp: ArticleBlueprint) => void }) {
  return (
    <div className="blueprint-form">
      <div className="blueprint-form__field">
        <label className="blueprint-form__label">文章标题</label>
        <input
          className="blueprint-form__input"
          type="text"
          value={bp.workingTitle}
          onChange={(e) => onChange({ ...bp, workingTitle: e.target.value })}
          placeholder="输入文章标题"
        />
      </div>

      <div className="blueprint-form__field">
        <label className="blueprint-form__label">文章简介</label>
        <textarea
          className="blueprint-form__textarea"
          rows={3}
          value={bp.description}
          onChange={(e) => onChange({ ...bp, description: e.target.value })}
          placeholder="简要描述文章的主题和写作目的…"
        />
      </div>

      <div className="blueprint-form__row">
        <div className="blueprint-form__field">
          <label className="blueprint-form__label">目标字数</label>
          <input
            className="blueprint-form__input"
            type="number"
            value={bp.targetWordCount || ""}
            onChange={(e) => onChange({ ...bp, targetWordCount: e.target.value ? parseInt(e.target.value) : undefined })}
            placeholder="如: 2000"
          />
        </div>
        <div className="blueprint-form__field">
          <label className="blueprint-form__label">语气风格</label>
          <select
            className="blueprint-form__select"
            value={bp.tone || ""}
            onChange={(e) => onChange({ ...bp, tone: e.target.value || undefined })}
          >
            <option value="">未指定</option>
            <option value="正式">正式</option>
            <option value="口语化">口语化</option>
            <option value="学术">学术</option>
            <option value="文艺">文艺</option>
            <option value="幽默">幽默</option>
            <option value="叙事">叙事</option>
          </select>
        </div>
      </div>

      <div className="blueprint-form__field">
        <label className="blueprint-form__label">目标读者</label>
        <input
          className="blueprint-form__input"
          type="text"
          value={bp.targetAudience || ""}
          onChange={(e) => onChange({ ...bp, targetAudience: e.target.value || undefined })}
          placeholder="如: 技术从业者、文学爱好者"
        />
      </div>

      <div className="blueprint-form__field">
        <label className="blueprint-form__label">写作阶段</label>
        <div className="blueprint-form__phase-bar">
          {(["planning", "writing", "reviewing", "complete"] as const).map((p) => (
            <button
              key={p}
              className={`blueprint-form__phase${bp.phase === p ? " blueprint-form__phase--active" : ""}`}
              onClick={() => onChange({ ...bp, phase: p })}
            >
              {getPhaseLabel(p)}
            </button>
          ))}
        </div>
      </div>

      <div className="blueprint-form__field">
        <label className="blueprint-form__label">标签</label>
        <input
          className="blueprint-form__input"
          type="text"
          value={bp.tags.join(", ")}
          onChange={(e) => onChange({ ...bp, tags: e.target.value.split(/[,，]\s*/).filter(Boolean) })}
          placeholder="逗号分隔，如: 技术, React, 前端"
        />
      </div>
    </div>
  );
}

/* ─── 大纲 Tab ─── */
function OutlineTab({ bp, onChange }: { bp: ArticleBlueprint; onChange: (bp: ArticleBlueprint) => void }) {
  const addSection = useCallback(() => {
    const newSection: OutlineSection = {
      id: `sec_${Date.now()}`,
      title: "新章节",
      level: 1,
      status: "pending",
    };
    onChange({ ...bp, outline: [...bp.outline, newSection] });
  }, [bp, onChange]);

  const removeSection = useCallback((index: number) => {
    const newOutline = bp.outline.filter((_, i) => i !== index);
    onChange({ ...bp, outline: newOutline });
  }, [bp, onChange]);

  const moveSection = useCallback((index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= bp.outline.length) return;
    const newOutline = [...bp.outline];
    [newOutline[index], newOutline[newIndex]] = [newOutline[newIndex], newOutline[index]];
    onChange({ ...bp, outline: newOutline });
  }, [bp, onChange]);

  const updateSection = useCallback((index: number, updates: Partial<OutlineSection>) => {
    const newOutline = bp.outline.map((s, i) => i === index ? { ...s, ...updates } : s);
    onChange({ ...bp, outline: newOutline });
  }, [bp, onChange]);

  return (
    <div className="blueprint-outline">
      <div className="blueprint-outline__help">
        定义文章的结构。AI 将根据大纲了解每部分的写作目标。
      </div>

      {bp.outline.map((section, i) => (
        <div key={section.id} className="blueprint-outline__item">
          <div className="blueprint-outline__item-header">
            <div className="blueprint-outline__item-move">
              <button
                className="blueprint-outline__move-btn"
                disabled={i === 0}
                onClick={() => moveSection(i, -1)}
                title="上移"
              >
                <ChevronUp size={12} />
              </button>
              <button
                className="blueprint-outline__move-btn"
                disabled={i === bp.outline.length - 1}
                onClick={() => moveSection(i, 1)}
                title="下移"
              >
                <ChevronDown size={12} />
              </button>
            </div>
            <div className="blueprint-outline__item-fields">
              <div className="blueprint-outline__title-row">
                <input
                  className="blueprint-outline__title-input"
                  type="text"
                  value={section.title}
                  onChange={(e) => updateSection(i, { title: e.target.value })}
                  placeholder="章节标题"
                />
                <select
                  className="blueprint-outline__level-select"
                  value={section.level}
                  onChange={(e) => updateSection(i, { level: parseInt(e.target.value) as 1 | 2 | 3 })}
                >
                  <option value={1}>H1</option>
                  <option value={2}>H2</option>
                  <option value={3}>H3</option>
                </select>
                <select
                  className="blueprint-outline__status-select"
                  value={section.status}
                  onChange={(e) => updateSection(i, { status: e.target.value as any })}
                >
                  <option value="pending">待写</option>
                  <option value="writing">写作中</option>
                  <option value="complete">完成</option>
                  <option value="revised">已修改</option>
                </select>
                <button
                  className="blueprint-outline__remove-btn"
                  onClick={() => removeSection(i)}
                  title="删除章节"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <input
                className="blueprint-outline__desc-input"
                type="text"
                value={section.description || ""}
                onChange={(e) => updateSection(i, { description: e.target.value || undefined })}
                placeholder="章节描述（可选）— 告诉 AI 这章要写什么"
              />
              <input
                className="blueprint-outline__words-input"
                type="number"
                value={section.targetWordCount || ""}
                onChange={(e) => updateSection(i, { targetWordCount: e.target.value ? parseInt(e.target.value) : undefined })}
                placeholder="目标字数"
              />
            </div>
          </div>
        </div>
      ))}

      <button className="blueprint-outline__add-btn" onClick={addSection}>
        <Plus size={14} />
        <span>添加章节</span>
      </button>
    </div>
  );
}
