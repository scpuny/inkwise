// ArticleHeader.tsx — 文章蓝图顶部栏
// 展示：文章标题、简介、写作阶段、大纲进度、目标字数

import { useState, useCallback, useRef, useEffect } from "react";
import {
  FileText, Target, ListTree, ImagePlus, CheckCircle2,
  Clock, Edit3, Trash2, Plus, GripVertical, ChevronDown, ChevronRight,
  Save,
} from "lucide-react";
import type { ArticleBlueprint, OutlineSection, ArticlePhase } from "../../lib/ai/article/blueprint";
import { getPhaseLabel } from "../../lib/ai/article/blueprint";

interface ArticleHeaderProps {
  blueprint: ArticleBlueprint;
  activeSectionId?: string | null;
  onUpdateBlueprint: (bp: ArticleBlueprint) => void;
  onSelectSection: (sectionId: string) => void;
  onOpenBlueprintEditor: () => void;
  onSave?: () => void;
}

export function ArticleHeader({
  blueprint, activeSectionId, onUpdateBlueprint, onSelectSection, onOpenBlueprintEditor, onSave,
}: ArticleHeaderProps) {
  const [expanded, setExpanded] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingTarget, setEditingTarget] = useState(false);

  return (
    <div className="article-header">
      {/* Top row: Title + Phase + Progress */}
      <div className="article-header__top">
        <div className="article-header__title-area">
          <button
            className="article-header__expand-btn"
            onClick={() => setExpanded(!expanded)}
            title={expanded ? "折叠大纲" : "展开大纲"}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {editingTitle ? (
            <input
              className="article-header__title-input"
              type="text"
              autoFocus
              defaultValue={blueprint.workingTitle || ""}
              onBlur={(e) => {
                const val = e.target.value.trim();
                if (val && val !== (blueprint.workingTitle || "")) {
                  onUpdateBlueprint({ ...blueprint, workingTitle: val });
                }
                setEditingTitle(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") { (e.target as HTMLInputElement).blur(); }
                if (e.key === "Escape") { setEditingTitle(false); }
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <h2
              className="article-header__title"
              onDoubleClick={() => setEditingTitle(true)}
              title="双击编辑标题"
            >{blueprint.workingTitle || "无标题"}</h2>
          )}
        </div>
        <div className="article-header__meta">
          <span className={`article-header__phase article-header__phase--${blueprint.phase}`}>
            {getPhaseLabel(blueprint.phase)}
          </span>
          {blueprint.targetWordCount ? (
            <span className="article-header__word-target article-header__word-target--set" onClick={() => setEditingTarget(true)} title="点击修改目标字数">
              <Target size={12} />
              <span>{blueprint.targetWordCount.toLocaleString()} 字</span>
            </span>
          ) : (
            <span className="article-header__word-target article-header__word-target--unset" onClick={() => setEditingTarget(true)} title="设定目标字数">
              <Target size={12} />
              <span>设目标</span>
            </span>
          )}
          {editingTarget && (
            <input
              className="article-header__target-input"
              type="number"
              autoFocus
              defaultValue={blueprint.targetWordCount || ''}
              min={0}
              step={100}
              onBlur={(e) => { setEditingTarget(false); const v = parseInt(e.target.value); if (v > 0) onUpdateBlueprint({ ...blueprint, targetWordCount: v }); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); } if (e.key === 'Escape') { setEditingTarget(false); } }}
              onClick={(e) => e.stopPropagation()}
            />
          )}
          {onSave && (
            <button className="article-header__save-btn" onClick={onSave} title="保存并进入成品页">
              <Save size={13} />
            </button>
          )}
          <button className="article-header__edit-btn" onClick={onOpenBlueprintEditor} title="编辑文章信息">
            <Edit3 size={13} />
          </button>
        </div>
      </div>

      {/* Description */}
      {blueprint.description && (
        <div className="article-header__description">
          {blueprint.description}
        </div>
      )}

      {/* Outline (collapsible) */}
      {expanded && blueprint.outline.length > 0 && (
        <div className="article-header__outline">
          {blueprint.outline.map((section) => (
            <div
              key={section.id}
              className={`article-header__section${
                section.id === activeSectionId ? " article-header__section--active" : ""
              }${
                section.status === "complete" ? " article-header__section--done" : ""
              }`}
              onClick={() => onSelectSection(section.id)}
            >
              <div className="article-header__section-indent" style={{ width: `${(section.level - 1) * 16}px` }} />
              <span className="article-header__section-icon">
                {section.status === "complete" ? (
                  <CheckCircle2 size={12} className="article-header__icon-done" />
                ) : section.status === "writing" ? (
                  <Clock size={12} className="article-header__icon-writing" />
                ) : (
                  <span className="article-header__icon-pending">{section.level === 1 ? "H" : "h"}</span>
                )}
              </span>
              <span className="article-header__section-title">{section.title}</span>
              {section.description && (
                <span className="article-header__section-desc">{section.description}</span>
              )}
              {section.targetWordCount && (
                <span className="article-header__section-words">{section.targetWordCount}字</span>
              )}
              <span className="article-header__section-status">
                {section.status === "complete" ? "完成" : section.status === "writing" ? "进行中" : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
