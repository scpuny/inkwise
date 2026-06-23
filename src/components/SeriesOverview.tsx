import { useState, useCallback, useEffect, useRef } from "react";
import { BookOpen, FileText, Pencil, Trash2, Clock, Sparkles, ChevronRight, Loader2, MoreHorizontal } from "lucide-react";
import type { SeriesPlan, SeriesArticle } from "../lib/collections";
import { saveSeriesPlan, loadSeriesPlan } from "../lib/collections";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";
import { loadArticleContent } from "../lib/articles";

interface SeriesOverviewProps {
  plan: SeriesPlan;
  collectionId: string;
  onOpenArticle?: (articleId: string) => void;
  onPlanArticle?: (article: SeriesArticle) => void;
  onEditPlan?: () => void;
  onDeletePlan?: () => void;
}

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
  const [editingArtId, setEditingArtId] = useState<string | null>(null);
  const [editingArtDraft, setEditingArtDraft] = useState("");
  const [ctxMenu, setCtxMenu] = useState<{ items: ContextMenuItem[]; x: number; y: number } | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const [titleDraft, setTitleDraft] = useState(plan.title);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const completedCount = plan.articles.filter((a) => a.status === "complete").length;
  const [statsCache, setStatsCache] = useState<Record<string, number>>({});
  
  const calcWords = useCallback((text: string) => {
    const cnChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const westernWords = text.replace(/[\u4e00-\u9fff]/g, " ").trim().split(/\s+/).filter(Boolean).length;
    return cnChars + westernWords;
  }, []);
  
  // Load stats for articles that have articleId
  useEffect(() => {
    plan.articles.forEach(a => {
      if (a.articleId && !statsCache[a.articleId]) {
        loadArticleContent(a.articleId).then(content => {
          if (content) setStatsCache(prev => ({ ...prev, [a.articleId!]: calcWords(content) }));
        });
      }
    });
  }, [plan.articles, statsCache, calcWords]);

  const handleRenameArticle = useCallback(async (articleId: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    const updated = {
      ...plan,
      articles: plan.articles.map(a => a.id === articleId ? { ...a, title: trimmed } : a)
    };
    await saveSeriesPlan(collectionId, updated);
    window.dispatchEvent(new Event("collections-changed"));
  }, [plan, collectionId]);

  const handleRemoveArticle = useCallback(async (articleId: string) => {
    const updated = {
      ...plan,
      articles: plan.articles.filter(a => a.id !== articleId)
    };
    await saveSeriesPlan(collectionId, updated);
    window.dispatchEvent(new Event("collections-changed"));
  }, [plan, collectionId]);

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
    if (editingArtId) {
      setTimeout(() => editInputRef.current?.focus(), 50);
    }
  }, [editingTitle, editingArtId]);

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
          {plan.articles.map((article, i) => {
            const isEditing = editingArtId === article.id;
            return (
            <div key={article.id} className="collection-tree__leaf" onClick={() => {
                if (article.status === "planned") return; // 未开始 — 仅 AI 图标可触发
                if (article.status === "complete" || article.status === "reviewing") {
                  onOpenArticle?.(article.articleId!);
                } else {
                  onPlanArticle?.(article); // writing/outlining → 进入规划页面
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault(); e.stopPropagation();
                setCtxMenu({
                  items: [
                    { icon: <Pencil size={13} />, label: "重命名", onClick: () => { setEditingArtId(article.id); setEditingArtDraft(article.title); } },
                    { icon: <Trash2 size={13} />, label: "从系列删除", danger: true, onClick: () => handleRemoveArticle(article.id) },
                  ],
                  x: e.clientX, y: e.clientY
                });
              }}>
              {isEditing ? (
                <input ref={editInputRef} className="collection-tree__input collection-tree__input--leaf" value={editingArtDraft}
                  onChange={(e) => setEditingArtDraft(e.target.value)}
                  onBlur={() => { handleRenameArticle(article.id, editingArtDraft); setEditingArtId(null); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { handleRenameArticle(article.id, editingArtDraft); setEditingArtId(null); } if (e.key === "Escape") setEditingArtId(null); }}
                  onClick={(e) => e.stopPropagation()} />
              ) : (
                <><span className="collection-tree__leaf-icon-wrap">
                  {article.status === "complete" || article.status === "reviewing" ? (
                    <FileText size={13} className="collection-tree__leaf-icon series-status-icon--complete" />
                  ) : article.status === "writing" ? (
                    <FileText size={13} className="collection-tree__leaf-icon series-status-icon--writing" />
                  ) : (
                    <FileText size={13} className="collection-tree__leaf-icon series-status-icon--planned" />
                  )}
                </span>
                <span className="collection-tree__leaf-label">{article.title}</span>
                {article.articleId && statsCache[article.articleId] ? (
                  <span className="collection-tree__leaf-stats">{statsCache[article.articleId]}字</span>
                ) : null}
                <div className="series-overview__article-actions">
                  {article.status === "planned" && (
                    <button className="series-overview__action-btn" onClick={(e) => { e.stopPropagation(); onPlanArticle?.(article); }} title="开始规划">
                      <Sparkles size={11} />
                    </button>
                  )}
                </div></>
              )}
            </div>
          )})}
        </div>
      )}
      {ctxMenu && <ContextMenu items={ctxMenu.items} position={{ x: ctxMenu.x, y: ctxMenu.y }} onClose={() => setCtxMenu(null)} />}
    </div>
  );
}

export default SeriesOverview;
