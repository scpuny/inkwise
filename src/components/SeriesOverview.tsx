import { useState, useCallback, useEffect, useRef } from "react";
import { BookOpen, FileText, CheckCircle2, Clock, ArrowRight, Sparkles, ChevronRight, Loader2, MoreHorizontal, Pencil } from "lucide-react";
import type { SeriesPlan, SeriesArticle } from "../lib/collections";
import { saveSeriesPlan, loadSeriesPlan } from "../lib/collections";

interface SeriesOverviewProps {
  plan: SeriesPlan;
  collectionId: string;
  onOpenArticle?: (articleId: string) => void;
  onPlanArticle?: (article: SeriesArticle) => void;
  onEditPlan?: () => void;
  onDeletePlan?: () => void;
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  planned: <Clock size={12} style={{ opacity: 0.5 }} />,
  outlining: <Loader2 size={12} className="series-overview__spinner" />,
  writing: <Loader2 size={12} className="series-overview__spinner" />,
  complete: <CheckCircle2 size={12} className="series-overview__check" />,
};

const STATUS_LABELS: Record<string, string> = {
  planned: "待规划",
  outlining: "生成大纲中",
  writing: "写作中",
  complete: "已完成",
};

export function SeriesOverview({
  plan,
  collectionId,
  onOpenArticle,
  onPlanArticle,
  onEditPlan,
  onDeletePlan,
}: SeriesOverviewProps) {
  const [expanded, setExpanded] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(plan.title);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const completedCount = plan.articles.filter((a) => a.status === "complete").length;

  const handleSaveTitle = useCallback(async () => {
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === plan.title) {
      setEditingTitle(false);
      return;
    }
    try {
      const updated = { ...plan, title: trimmed };
      await saveSeriesPlan(collectionId, updated);
      window.dispatchEvent(new Event("collections-changed"));
    } catch {}
    setEditingTitle(false);
  }, [titleDraft, plan, collectionId]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingTitle) {
      setTimeout(() => titleInputRef.current?.focus(), 50);
    }
  }, [editingTitle]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = () => setMenuOpen(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [menuOpen]);

  return (
    <div className="series-overview">
      <div className="series-overview__header" onClick={() => setExpanded(!expanded)}>
        <ChevronRight size={11} className={`series-overview__chevron${expanded ? " series-overview__chevron--open" : ""}`} />
        <BookOpen size={13} className="series-overview__icon" />
        {editingTitle ? (
          <input ref={titleInputRef} className="series-overview__title-input" value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={handleSaveTitle}
            onKeyDown={(e) => { if (e.key === "Enter") handleSaveTitle(); if (e.key === "Escape") { setTitleDraft(plan.title); setEditingTitle(false); }}}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="series-overview__title" onDoubleClick={() => { setTitleDraft(plan.title); setEditingTitle(true); }}>{plan.title}</span>
        )}
        <span className="series-overview__count">{completedCount}/{plan.articles.length}</span>
        <div className="series-overview__menu-wrapper" onClick={(e) => e.stopPropagation()}>
          <button className="series-overview__menu-btn" onClick={() => setMenuOpen(!menuOpen)} title="系列管理">
            <MoreHorizontal size={12} />
          </button>
          {menuOpen && (
            <div className="series-overview__menu">
              <button className="series-overview__menu-item" onClick={() => { onEditPlan?.(); setMenuOpen(false); }}>
                编辑规划
              </button>
              <div className="series-overview__menu-divider" />
              <button className="series-overview__menu-item series-overview__menu-item--danger" onClick={() => { onDeletePlan?.(); setMenuOpen(false); }}>
                删除系列规划
              </button>
            </div>
          )}
        </div>
      </div>

      {expanded && (
        <div className="series-overview__list">
          {plan.articles.map((article, i) => (
            <div key={article.id} className="series-overview__article">
              <div className="series-overview__article-status">
                {STATUS_ICONS[article.status] || <Clock size={12} style={{ opacity: 0.3 }} />}
              </div>
              <div className="series-overview__article-body">
                <div className="series-overview__article-title">{article.title}</div>
                {article.description && (
                  <div className="series-overview__article-desc">{article.description}</div>
                )}
              </div>
              <div className="series-overview__article-actions">
                {article.status === "planned" && (
                  <button
                    className="series-overview__action-btn"
                    onClick={() => onPlanArticle?.(article)}
                    title="开始写作"
                  >
                    <Sparkles size={11} />
                  </button>
                )}
                {article.articleId && (
                  <button
                    className="series-overview__action-btn"
                    onClick={() => onOpenArticle?.(article.articleId!)}
                    title="打开文章"
                  >
                    <FileText size={11} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SeriesOverview;
