import { useState, useCallback, useRef, useEffect } from "react";
import { FileText, FolderClosed, FolderOpen, Plus, Trash2, Pencil, RefreshCw, RotateCcw, X, ChevronRight, ListCollapse, ArrowUpDown, Type, AlignLeft } from "lucide-react";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";
import { PopoverMenu, type MenuItem } from "./PopoverMenu";
import type { Collection, Article, TrashItem } from "../lib/collections";
import {
  loadCollections, saveCollections, addCollection, renameCollection, removeCollection,
  addArticle, renameArticle, trashArticle,
  loadTrash, saveTrash, restoreArticle, permanentlyDeleteArticle, emptyTrash, genId,
} from "../lib/collections";
import { loadArticleContent } from "../lib/articles";

export function CollectionTree({ onSelectArticle, activeArticleId: externalActiveId }: { onSelectArticle?: (articleId: string) => void; activeArticleId?: string | null }) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [trash, setTrash] = useState<TrashItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showTrash, setShowTrash] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const [ctxMenu, setCtxMenu] = useState<{ items: ContextMenuItem[]; x: number; y: number } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "date" | "articleCount">("name");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortBtnRef = useRef<HTMLButtonElement>(null);

  // Article stats cache: { articleId: { words, chars, paragraphs } }
  const [statsCache, setStatsCache] = useState<Record<string, { words: number; chars: number; paragraphs: number }>>({});

  // Calculate stats from markdown text
  const calcStats = useCallback((text: string) => {
    const chars = text.length;
    const cnChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const westernWords = text.replace(/[\u4e00-\u9fff]/g, " ").trim().split(/\s+/).filter(Boolean).length;
    const words = cnChars + westernWords;
    // Count paragraphs by splitting on double newline
    const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0).length;
    return { words, chars, paragraphs };
  }, []);

  // Load stats for a specific article
  const loadStats = useCallback(async (articleId: string) => {
    if (statsCache[articleId]) return;
    const content = await loadArticleContent(articleId);
    if (content) {
      setStatsCache((prev) => ({ ...prev, [articleId]: calcStats(content) }));
    }
  }, [statsCache, calcStats]);

  // Load data
  const refresh = useCallback(async () => {
    const [cols, tr] = await Promise.all([loadCollections(), loadTrash()]);
    setCollections(cols);
    setTrash(tr);
    setLoaded(true);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // ── Collapse / Expand all ──
  const allExpanded = expanded.size === collections.length && collections.length > 0;
  const toggleCollapseAll = useCallback(() => {
    if (allExpanded) setExpanded(new Set());
    else setExpanded(new Set(collections.map((c) => c.id)));
  }, [allExpanded, collections]);

  // ── Collection ops ──

  const handleNewCollection = useCallback(async () => {
    const c = await addCollection("新建合集");
    setExpanded((prev) => new Set(prev).add(c.id));
    await refresh();
    setEditingId(`col:${c.id}`); setEditingDraft("新建合集");
  }, [refresh]);

  // Helper: ensure at least one collection exists; return its id
  const getOrCreateDefaultCollection = useCallback(async (): Promise<string> => {
    let cols = await loadCollections();
    if (cols.length > 0) return cols[0].id;
    // No collections — create default
    const c = await addCollection("默认合集");
    setExpanded((prev) => new Set(prev).add(c.id));
    await refresh();
    return c.id;
  }, [refresh]);

  const handleRenameCollection = useCallback((id: string, current: string) => {
    setEditingId(`col:${id}`); setEditingDraft(current);
  }, []);

  const handleCommitRename = useCallback(async (id: string, isCollection: boolean) => {
    const title = editingDraft.trim();
    if (!title) { setEditingId(null); return; }
    if (isCollection) await renameCollection(id, title);
    else {
      for (const c of collections) {
        if (c.articles.some((a) => a.id === id)) { await renameArticle(c.id, id, title); break; }
      }
    }
    setEditingId(null);
    await refresh();
  }, [editingDraft, collections, refresh]);

  const handleRemoveCollection = useCallback(async (id: string) => {
    if (confirmDeleteId !== id) { setConfirmDeleteId(id); return; }
    const c = collections.find((x) => x.id === id);
    if (c) {
      const currentTrash = await loadTrash();
      for (const a of c.articles) {
        currentTrash.push({ id: a.id, title: a.title, collectionId: id, collectionTitle: c.title, deletedAt: Date.now() });
      }
      await saveTrash(currentTrash);
      setTrash(currentTrash);
    }
    await removeCollection(id);
    setConfirmDeleteId(null);
    await refresh();
  }, [confirmDeleteId, collections, refresh]);

  // ── Article ops ──
  const handleNewArticle = useCallback(async (collectionId?: string) => {
    const targetId = collectionId ?? await getOrCreateDefaultCollection();
    const a = await addArticle(targetId, "新文章");
    if (a) {
      setExpanded((prev) => new Set(prev).add(targetId));
      onSelectArticle?.(a.id);
      setEditingId(`art:${a.id}`); setEditingDraft("新文章");
      await refresh();
    }
  }, [getOrCreateDefaultCollection, onSelectArticle, refresh]);

  const handleTrashArticle = useCallback(async (collectionId: string, articleId: string) => {
    if (confirmDeleteId !== articleId) { setConfirmDeleteId(articleId); return; }
    await trashArticle(collectionId, articleId);
    setConfirmDeleteId(null);
    if (externalActiveId === articleId) { /* no-op, controlled externally */ }
    await refresh();
  }, [confirmDeleteId, externalActiveId, refresh]);

  // ── Trash ops ──
  const handleRestore = useCallback(async (id: string) => { await restoreArticle(id); await refresh(); }, [refresh]);
  const handlePermanentDelete = useCallback(async (id: string) => { await permanentlyDeleteArticle(id); await refresh(); }, [refresh]);

  // ── Context menu ──
  const onCtx = useCallback((e: React.MouseEvent, items: ContextMenuItem[]) => {
    e.preventDefault(); e.stopPropagation();
    setCtxMenu({ items, x: e.clientX, y: e.clientY });
  }, []);

  useEffect(() => { if (editingId && editInputRef.current) { editInputRef.current.focus(); editInputRef.current.select(); } }, [editingId]);

  const toggleExpanded = useCallback((id: string) => {
    setExpanded((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }, []);

  const sortedCollections = [...collections].sort((a, b) => {
    if (sortBy === "name") return a.title.localeCompare(b.title, "zh");
    if (sortBy === "articleCount") return b.articles.length - a.articles.length;
    return b.createdAt - a.createdAt;
  });

  const sortItems: MenuItem[] = [
    { id: "name", label: "按名称", subtitle: "A → Z", checked: sortBy === "name", onClick: () => setSortBy("name") },
    { id: "date", label: "按时间", subtitle: "最新的在前", checked: sortBy === "date", onClick: () => setSortBy("date") },
    { id: "articleCount", label: "按文章数", subtitle: "从多到少", checked: sortBy === "articleCount", onClick: () => setSortBy("articleCount") },
  ];

  if (!loaded) return <div className="collection-tree__empty">加载中…</div>;

  return (
    <div className="collection-tree">
      {/* Header */}
      <div className="collection-tree__header">
        <span className="collection-tree__header-title">
          <FolderClosed size={13} />
          <span>合集</span>
          <span className="collection-tree__header-count">{collections.length}</span>
        </span>
        <div className="collection-tree__header-actions">
          <button className="collection-tree__action" onClick={toggleCollapseAll} title={allExpanded ? "全部收起" : "全部展开"}><ListCollapse size={12} /></button>
          <button ref={sortBtnRef} className={`collection-tree__action${sortBy !== "name" ? " collection-tree__action--active" : ""}`} onClick={() => setSortMenuOpen(!sortMenuOpen)} title="排序"><ArrowUpDown size={12} /></button>
          <PopoverMenu items={sortItems} anchorRef={sortBtnRef} open={sortMenuOpen} onClose={() => setSortMenuOpen(false)} />
          <button className="collection-tree__action" onClick={() => { void handleNewCollection(); }} title="新建合集"><Plus size={13} /></button>
        </div>
      </div>

      {/* Collections */}
      <div className="collection-tree__list">
        {sortedCollections.length === 0 && <div className="collection-tree__empty">暂无合集，点击 + 新建</div>}
        {sortedCollections.map((col) => {
          const isExpanded = expanded.has(col.id);
          const isEditing = editingId === `col:${col.id}`;
          return (
            <div key={col.id} className="collection-tree__item">
              <div className="collection-tree__row collection-tree__row--folder" onClick={() => toggleExpanded(col.id)} onContextMenu={(e) => onCtx(e, [
                { icon: <Plus size={13} />, label: "新建文章", onClick: () => { void handleNewArticle(col.id); } },
                { icon: <Pencil size={13} />, label: "重命名", onClick: () => handleRenameCollection(col.id, col.title) },
                { icon: <Trash2 size={13} />, label: confirmDeleteId === col.id ? "确认删除" : "删除合集", danger: true, onClick: () => handleRemoveCollection(col.id) },
              ])}>
                {isEditing ? (
                  <input ref={editInputRef} className="collection-tree__input" value={editingDraft} onChange={(e) => setEditingDraft(e.target.value)}
                    onBlur={() => handleCommitRename(col.id, true)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleCommitRename(col.id, true); if (e.key === "Escape") setEditingId(null); }}
                    onClick={(e) => e.stopPropagation()} />
                ) : (
                  <>
                    <span className="collection-tree__chevron"><ChevronRight size={12} className={isExpanded ? "collection-tree__chevron--open" : ""} /></span>
                    <span className="collection-tree__icon">{isExpanded ? <FolderOpen size={14} /> : <FolderClosed size={14} />}</span>
                    <span className="collection-tree__label">{col.title}</span>
                    <span className="collection-tree__count">{col.articles.length}</span>
                    <button
                      className="collection-tree__add-btn"
                      title="新建文章"
                      aria-label="新建文章"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleNewArticle(col.id);
                      }}
                    >
                      <Plus size={11} />
                    </button>
                  </>
                )}
              </div>
              {isExpanded && (
                <div className="collection-tree__children">
                  {col.articles.map((article) => {
                    const isActive = externalActiveId === article.id;
                    const isEditingArt = editingId === `art:${article.id}`;
                    return (
                      <div key={article.id} className={`collection-tree__leaf${isActive ? " collection-tree__leaf--active" : ""}`}
                        onClick={() => { onSelectArticle?.(article.id); }}
                        onContextMenu={(e) => onCtx(e, [
                          { icon: <Pencil size={13} />, label: "重命名", onClick: () => { setEditingId(`art:${article.id}`); setEditingDraft(article.title); } },
                          { icon: <Trash2 size={13} />, label: confirmDeleteId === article.id ? "确认删除" : "移到回收站", danger: true, onClick: () => handleTrashArticle(col.id, article.id) },
                        ])}>
                        {isEditingArt ? (
                          <input ref={editInputRef} className="collection-tree__input collection-tree__input--leaf" value={editingDraft}
                            onChange={(e) => setEditingDraft(e.target.value)}
                            onBlur={async () => { const t = editingDraft.trim(); if (t) await renameArticle(col.id, article.id, t); setEditingId(null); await refresh(); }}
                            onKeyDown={async (e) => { if (e.key === "Enter") { const t = editingDraft.trim(); if (t) await renameArticle(col.id, article.id, t); setEditingId(null); await refresh(); } if (e.key === "Escape") setEditingId(null); }}
                            onClick={(e) => e.stopPropagation()} />
                        ) : (
                          <><span className="collection-tree__leaf-icon-wrap"><FileText size={13} className="collection-tree__leaf-icon" /></span><span className="collection-tree__leaf-label">{article.title}</span></>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Trash */}
      <div className="collection-tree__trash-section">
        <button className="collection-tree__trash-toggle" onClick={() => setShowTrash(!showTrash)}>
          <ChevronRight size={11} className={showTrash ? "collection-tree__chevron--open" : ""} />
          <Trash2 size={12} /><span>回收站</span>
          {trash.length > 0 && <span className="collection-tree__trash-count">{trash.length}</span>}
        </button>
        {showTrash && (
          <div className="collection-tree__trash-list">
            {trash.length === 0 ? <div className="collection-tree__empty collection-tree__empty--trash">回收站为空</div> : trash.map((item) => (
              <div key={item.id} className="collection-tree__trash-item">
                <FileText size={11} className="collection-tree__leaf-icon" />
                <span className="collection-tree__trash-label">{item.title}</span>
                <span className="collection-tree__trash-source">{item.collectionTitle}</span>
                <button className="collection-tree__trash-action" title="恢复" onClick={() => handleRestore(item.id)}><RotateCcw size={10} /></button>
                <button className="collection-tree__trash-action collection-tree__trash-action--danger" title="永久删除" onClick={() => handlePermanentDelete(item.id)}><X size={10} /></button>
              </div>
            ))}
            {trash.length > 0 && <button className="collection-tree__trash-empty-all" onClick={async () => { await emptyTrash(); await refresh(); }}>清空回收站</button>}
          </div>
        )}
      </div>

      {ctxMenu && <ContextMenu items={ctxMenu.items} position={{ x: ctxMenu.x, y: ctxMenu.y }} onClose={() => setCtxMenu(null)} />}
    </div>
  );
}
