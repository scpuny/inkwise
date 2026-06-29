import { useState, useCallback, useRef, useEffect } from "react";
import { FileText, FolderClosed, FolderOpen, Plus, Trash2, Pencil, RefreshCw, RotateCcw, X, ChevronRight, ListCollapse, ArrowUpDown, Type, AlignLeft, FolderInput, BookOpen, Loader2 } from "lucide-react";
import { ContextMenu, type ContextMenuItem } from "../common/ContextMenu";
import { PopoverMenu, type MenuItem } from "../common/PopoverMenu";
import type { Collection, TrashItem } from "../../lib/storage/collections";
import {
  loadCollections, saveCollections, addCollection, renameCollection, removeCollection,
  addArticle, renameArticle, trashArticle,
  loadTrash, saveTrash, restoreArticle, permanentlyDeleteArticle, emptyTrash,
  linkCollectionFolder, rescanProjectFolder, unlinkCollectionFolder,
  loadAllSeriesPlans, deleteSeriesPlan,
  type SeriesPlan,
} from "../../lib/storage/collections";
import { browserLoad } from "../../lib/storage/collections";
import { isTauriEnv, tryInvoke, TauriCommands } from "../../lib/bridge/tauri";
import { usePanelStore } from "../../store/panelStore";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { SeriesOverview } from "../series/SeriesOverview";
import { loadArticleContent } from "../../lib/storage/articles";
import { loadBlueprint } from "../../lib/ai/articleBlueprint";
import { emit, on } from "../../lib/events/eventBus";
import type { PlanSeriesSavedDetail } from "../../lib/events/events";
import { getWordCount } from "../../lib/utils/text";

export function CollectionTree({ onSelectArticle, activeArticleId: externalActiveId, onNewArticleInCollection, seriesRefreshKey }: { onSelectArticle?: (articleId: string) => void; activeArticleId?: string | null; onNewArticleInCollection?: (collectionId: string) => void; seriesRefreshKey?: number; }) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [trash, setTrash] = useState<TrashItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showTrash, setShowTrash] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const [ctxMenu, setCtxMenu] = useState<{ items: ContextMenuItem[]; x: number; y: number } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ type: "collection" | "article"; id: string; collectionId?: string; title: string } | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "date" | "articleCount">("name");
  const [articleSortBy, setArticleSortBy] = useState<Record<string, "name" | "created" | "words">>({});
  const [seriesPlansList, setSeriesPlansList] = useState<Record<string, SeriesPlan[]>>({});
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const [folderScanning, setFolderScanning] = useState<Record<string, boolean>>({});

  const handleArticleSort = useCallback((colId: string, mode: "name" | "created" | "words") => {
    setArticleSortBy((prev) => ({ ...prev, [colId]: mode }));
  }, []);
  const sortBtnRef = useRef<HTMLButtonElement>(null);

  // Article stats cache: { articleId: { words, chars, paragraphs } }
  const [statsCache, setStatsCache] = useState<Record<string, { words: number; chars: number; paragraphs: number }>>({});
  const [phaseCache, setPhaseCache] = useState<Record<string, string>>({});

  // Calculate stats from markdown text
  const calcStats = useCallback((text: string) => {
    const words = getWordCount(text);
    const chars = text.length;
    const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0).length;
    return { words, chars, paragraphs };
  }, []);

  const loadPhase = useCallback(async (articleId: string) => {
    if (phaseCache[articleId]) return;
    const bp = await loadBlueprint(articleId);
    if (bp) {
      setPhaseCache((prev) => ({ ...prev, [articleId]: bp.phase }));
    }
  }, [phaseCache]);

  // Load data
  const refresh = useCallback(async () => {
    const [cols, tr] = await Promise.all([loadCollections(), loadTrash()]);
    setCollections(cols);
    setTrash(tr);
    setLoaded(true);
    // Load series plans
    const plansMap: Record<string, SeriesPlan[]> = {};
    for (const col of cols) {
      const colPlans = await loadAllSeriesPlans(col.id);
      if (colPlans.length > 0) plansMap[col.id] = colPlans;
    }
    setSeriesPlansList(plansMap);
    // Reload phases for all articles
    const phaseMap: Record<string, string> = {};
    const phasePromises: Promise<void>[] = [];
    for (const col of cols) {
      for (const article of col.articles) {
        phasePromises.push(
          loadBlueprint(article.id).then(bp => {
            if (bp) phaseMap[article.id] = bp.phase;
          }).catch(() => console.warn("[CollectionTree] loadBlueprint failed"))
        );
      }
    }
    if (phasePromises.length > 0) {
      await Promise.all(phasePromises);
      setPhaseCache(prev => ({ ...prev, ...phaseMap }));
    }
    // Auto-expand collections that have series plans
    setExpanded(prev => {
      const next = new Set(prev);
      let changed = false;
      for (const colId of Object.keys(plansMap)) {
        if (!next.has(colId)) {
          next.add(colId);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [seriesRefreshKey]);

  useEffect(() => { refresh(); }, [refresh]);

  // ── Folder linking ──

  const handleLinkFolder = useCallback(async (colId: string) => {
    let folderPath: string | null = null;
    // Tauri mode
    if (isTauriEnv()) {
      try {
        folderPath = await tryInvoke<string | null>(TauriCommands.PickFolder, {});
      } catch { console.warn("[CollectionTree] PickFolder failed (non-critical)"); }
    }
    // Browser fallback
    if (!folderPath) {
      folderPath = await new Promise<string | null>((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        (input as any).webkitdirectory = true;
        (input as any).directory = true;
        input.style.display = "none";
        document.body.appendChild(input);
        input.addEventListener("change", () => {
          const file = input.files?.[0];
          if (file) {
            resolve(file.webkitRelativePath.split("/")[0]);
          } else {
            resolve(null);
          }
          document.body.removeChild(input);
        });
        input.addEventListener("cancel", () => {
          document.body.removeChild(input);
          resolve(null);
        });
        input.click();
      });
    }
    if (folderPath) {
      // Save linked folder
      const all = await loadCollections();
      const col = all.find(x => x.id === colId);
      if (!col) return;
      col.linkedFolder = folderPath;
      await saveCollections(all);
      await refresh();
      setFolderScanning((prev) => ({ ...prev, [colId]: true }));
      await new Promise(r => setTimeout(r, 50));
      try {
        await linkCollectionFolder(colId, folderPath);
      } catch { console.warn("[CollectionTree] linkCollectionFolder failed (non-critical)"); }
      setFolderScanning((prev) => ({ ...prev, [colId]: false }));
      await refresh();
    }
  }, [refresh]);

  const handleUnlinkFolder = useCallback(async (colId: string) => {
    // Clear linkedFolder from collection
    const all = await loadCollections();
    const col = all.find(x => x.id === colId);
    if (col) {
      col.linkedFolder = undefined;
      await saveCollections(all);
    }
    await unlinkCollectionFolder(colId);
    await refresh();
  }, [refresh]);

  const handleRescanFolder = useCallback(async (colId: string) => {
    const col = collections.find((c) => c.id === colId);
    if (!col?.linkedFolder) return;
    setFolderScanning((prev) => ({ ...prev, [colId]: true }));
    try {
      await rescanProjectFolder(col.linkedFolder);
    } finally {
      setFolderScanning((prev) => ({ ...prev, [colId]: false }));
    }
  }, [collections, refresh]);

  // ── Series planning ──

  const handlePlanSeries = useCallback(async (colId: string) => {
    emit("plan-series", { collectionId: colId });
  }, []);

  // 监听外部变更（改名只写 localStorage，从 localStorage 读，不从 Tauri 拿旧数据）
  useEffect(() => {
    const handler = () => {
      const cols = browserLoad<Collection[]>('inkwise-collections', []);
      setCollections(cols);
      refresh();
    };
    return on("collections-changed", handler);
  }, [refresh]);

  // Listen for plan-series-saved to force expand and refresh
  useEffect(() => {
    const handler = (detail?: PlanSeriesSavedDetail) => {
      const { collectionId } = detail || {};
      if (collectionId) {
        setExpanded(prev => new Set(prev).add(collectionId));
      }
      refresh();
    };
    return on("plan-series-saved", handler);
  }, [refresh]);

  // Load word counts for articles in expanded collections
  useEffect(() => {
    for (const col of collections) {
      if (expanded.has(col.id)) {
        for (const article of col.articles) {
          if (!statsCache[article.id]) {
            loadArticleContent(article.id).then((content) => {
              if (content) {
                const words = getWordCount(content);
                setStatsCache((prev) => ({ ...prev, [article.id]: { words, chars: content.length, paragraphs: 0 } }));
              }
            });
          }
        }
      }
    }
    // Load phases for all articles (load blueprint phase)
    for (const col of collections) {
      for (const article of col.articles) {
        if (!phaseCache[article.id]) {
          loadBlueprint(article.id).then((bp) => {
            if (bp) {
              setPhaseCache((prev) => ({ ...prev, [article.id]: bp.phase }));
            }
          });
        }
      }
    }
  }, [collections, expanded]);

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
    setEditingId(`col:${c.id}`); setEditingDraft(c.title);
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


  const handleRemoveCollection = useCallback((id: string) => {
    const c = collections.find((x) => x.id === id);
    setConfirmDelete(c ? { type: "collection", id, title: c.title } : null);
  }, [collections]);

  // ── Article ops ──
  const handleNewArticle = useCallback(async (collectionId?: string) => {
    if (!collectionId) {
      // Top-level new doc: create directly in default collection
      const targetId = await getOrCreateDefaultCollection();
      const a = await addArticle(targetId, "新文章");
      if (a) {
        setExpanded((prev) => new Set(prev).add(targetId));
        onSelectArticle?.(a.id);
        setEditingId(`art:${a.id}`); setEditingDraft("新文章");
        await refresh();
      }
      return;
    }
    // Collection-specific + button: go to StartupSplash with collection context
    onNewArticleInCollection?.(collectionId);
  }, [getOrCreateDefaultCollection, onSelectArticle, refresh, onNewArticleInCollection]);

  const handleTrashArticle = useCallback((collectionId: string, articleId: string, articleTitle: string) => {
    setConfirmDelete({ type: "article", id: articleId, collectionId, title: articleTitle });
  }, []);

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
    if (sortBy === "articleCount") {
        const countA = a.articles.length + (seriesPlansList[a.id] || []).reduce((sum, p) => sum + p.articles.length, 0);
        const countB = b.articles.length + (seriesPlansList[b.id] || []).reduce((sum, p) => sum + p.articles.length, 0);
        return countB - countA;
      }
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
          <button ref={addBtnRef} className="collection-tree__action" onClick={() => setAddMenuOpen(!addMenuOpen)} title="新建">
            <Plus size={13} />
          </button>
          {addMenuOpen && (
            <PopoverMenu
              anchorRef={addBtnRef}
              open={addMenuOpen}
              onClose={() => setAddMenuOpen(false)}
              placement="bottom"
              align="end"
              items={[
                { id: "new-collection", label: "新建合集", icon: <FolderClosed size={13} />, onClick: () => { void handleNewCollection(); } },
                { id: "plan-series", label: "规划系列文章", icon: <BookOpen size={13} />, subtitle: "规划当前集合的文章系列", onClick: () => { if (collections.length > 0) handlePlanSeries(collections[0].id); } },
              ]}
            />
          )}
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
                ...(isTauriEnv()
                  ? [
                      { icon: <BookOpen size={13} />, label: "规划系列文章", onClick: () => { void handlePlanSeries(col.id); } },
                      ...(col.linkedFolder
                        ? [
                            { icon: <RefreshCw size={13} />, label: "重新扫描目录", onClick: () => { void handleRescanFolder(col.id); } },
                            { icon: <FolderInput size={13} />, label: "取消关联目录", onClick: () => { void handleUnlinkFolder(col.id); } },
                          ]
                        : [{ icon: <FolderInput size={13} />, label: "关联本地目录…", onClick: () => { void handleLinkFolder(col.id); } }]),
                    ]
                  : []),
                { icon: <Trash2 size={13} />, label: "删除合集", danger: true, onClick: () => handleRemoveCollection(col.id) },
                { icon: <ArrowUpDown size={13} />, label: "文章排序", children: [
                  { icon: <Type size={12} />, label: `按名称${(articleSortBy[col.id] || "created") === "name" ? "  ✓" : ""}`, onClick: () => handleArticleSort(col.id, "name") },
                  { icon: <FileText size={12} />, label: `按时间${(articleSortBy[col.id] || "created") === "created" ? "  ✓" : ""}`, onClick: () => handleArticleSort(col.id, "created") },
                  { icon: <AlignLeft size={12} />, label: `按字数${(articleSortBy[col.id] || "created") === "words" ? "  ✓" : ""}`, onClick: () => handleArticleSort(col.id, "words") },
                ] },
              ])}>
                {isEditing ? (
                  <input ref={editInputRef} className="collection-tree__input" value={editingDraft} onChange={(e) => setEditingDraft(e.target.value)}
                    onBlur={async () => { const t = editingDraft.trim(); if (t) { const updated = [...collections]; const idx = updated.findIndex(x => x.id === col.id); if (idx >= 0) updated[idx] = { ...updated[idx], title: t }; setCollections(updated); await renameCollection(col.id, t); emit("collections-changed"); } setEditingId(null); }}
                    onKeyDown={async (e) => { if (e.key === "Enter") { const t = editingDraft.trim(); if (t) { const updated = [...collections]; const idx = updated.findIndex(x => x.id === col.id); if (idx >= 0) updated[idx] = { ...updated[idx], title: t }; setCollections(updated); await renameCollection(col.id, t); emit("collections-changed"); } setEditingId(null); } if (e.key === "Escape") setEditingId(null); }}
                    onClick={(e) => e.stopPropagation()} />
                ) : (
                  <>
                    <span className="collection-tree__chevron"><ChevronRight size={12} className={isExpanded ? "collection-tree__chevron--open" : ""} /></span>
                    <span className="collection-tree__icon">{isExpanded ? <FolderOpen size={14} /> : (col.linkedFolder ? <FolderInput size={14} style={{color: "var(--accent)"}} /> : <FolderClosed size={14} />)}</span>
                    <span className="collection-tree__label">
                          {col.title}
                          {col.linkedFolder && <span className="collection-tree__folder-badge" title={folderScanning[col.id] ? "正在扫描项目结构…" : col.linkedFolder}
                            onClick={(e) => { e.stopPropagation(); usePanelStore.getState().setProjectPanelColId(col.id); usePanelStore.getState().setProjectPanelOpen(true); }}
                            style={{cursor: "pointer"}}>
                            {folderScanning[col.id] ? <Loader2 size={10} className="collection-tree__spinner" /> : <FolderInput size={10} />}
                          </span>}
                        </span>
                    <span className="collection-tree__count">{col.articles.length + (seriesPlansList[col.id] || []).reduce((sum, p) => sum + p.articles.length, 0)}</span>
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
                  {(col.articles.slice().sort((a, b) => {
            const sortMode = articleSortBy[col.id] || "created";
            if (sortMode === "name") return a.title.localeCompare(b.title, "zh");
            if (sortMode === "words") return (statsCache[b.id]?.words || 0) - (statsCache[a.id]?.words || 0);
            return b.createdAt - a.createdAt;
          })).map((article) => {
                    const isActive = externalActiveId === article.id;
                    const isEditingArt = editingId === `art:${article.id}`;
                    return (
                      <div key={article.id} className={`collection-tree__leaf${isActive ? " collection-tree__leaf--active" : ""}`}
                        onClick={() => { onSelectArticle?.(article.id); }}
                        onContextMenu={(e) => onCtx(e, [
                          { icon: <Pencil size={13} />, label: "重命名", onClick: () => { setEditingId(`art:${article.id}`); setEditingDraft(article.title); } },
                          { icon: <Trash2 size={13} />, label: "移到回收站", danger: true, onClick: () => handleTrashArticle(col.id, article.id, article.title) },
                        ])}>
                        {isEditingArt ? (
                          <input ref={editInputRef} className="collection-tree__input collection-tree__input--leaf" value={editingDraft}
                            onChange={(e) => setEditingDraft(e.target.value)}
                            onBlur={async () => { const t = editingDraft.trim(); if (t) await renameArticle(col.id, article.id, t); setEditingId(null); await refresh(); }}
                            onKeyDown={async (e) => { if (e.key === "Enter") { const t = editingDraft.trim(); if (t) await renameArticle(col.id, article.id, t); setEditingId(null); await refresh(); } if (e.key === "Escape") setEditingId(null); }}
                            onClick={(e) => e.stopPropagation()} />
                        ) : (
                          <><span className="collection-tree__leaf-icon-wrap"><FileText size={13} className={"collection-tree__leaf-icon" + (phaseCache[article.id] ? " series-status-icon--" + phaseCache[article.id] : "")} /></span><span className="collection-tree__leaf-label">{article.title}</span>
                            {statsCache[article.id] && <span className="collection-tree__leaf-stats">{statsCache[article.id].words}字</span>}</>
                        )}
                      </div>
                    );
                  })}
                {seriesPlansList[col.id] && seriesPlansList[col.id].length > 0 && (
                  <div className="collection-tree__series-divider" />
                )}
                {seriesPlansList[col.id] && seriesPlansList[col.id].map((plan) => (
                  <SeriesOverview
                  key={plan.id}
                  plan={plan}
                  collectionId={col.id}
                  activeArticleId={externalActiveId}
                  onOpenArticle={(articleId) => onSelectArticle?.(articleId)}
                  onPlanArticle={(article) => {
                    emit("plan-series-article", { collectionId: col.id, seriesId: plan.id, article });
                  }}
                  onEditPlan={() => {
                    emit("edit-series-plan", { collectionId: col.id, seriesId: plan.id });
                  }}
                  onDeletePlan={async () => {
                    await deleteSeriesPlan(col.id, plan.id);
                    const updatedPlans = await loadAllSeriesPlans(col.id);
                    setSeriesPlansList(prev => {
                      const next = { ...prev };
                      if (updatedPlans.length > 0) {
                        next[col.id] = updatedPlans;
                      } else {
                        delete next[col.id];
                      }
                      return next;
                    });
                    await refresh();
                  }}
                />
              ))}
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
                <FileText size={11} className={"collection-tree__leaf-icon" + (phaseCache[item.id] ? " series-status-icon--" + phaseCache[item.id] : "")} />
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
      {confirmDelete && (
        <ConfirmDialog
          open={true}
          title={confirmDelete.type === "collection" ? "删除合集" : "移到回收站"}
          message={confirmDelete.type === "collection"
            ? `确定要删除合集「${confirmDelete.title}」吗？合集内的所有文章将移入回收站。`
            : `确定将文章「${confirmDelete.title}」移到回收站吗？`}
          confirmLabel={confirmDelete.type === "collection" ? "删除" : "移入回收站"}
          danger
          onConfirm={async () => {
            if (confirmDelete.type === "collection") {
              const c = collections.find((x) => x.id === confirmDelete.id);
              if (c) {
                const currentTrash = await loadTrash();
                for (const a of c.articles) {
                  currentTrash.push({ id: a.id, title: a.title, collectionId: confirmDelete.id, collectionTitle: c.title, deletedAt: Date.now() });
                }
                await saveTrash(currentTrash);
                setTrash(currentTrash);
              }
              await removeCollection(confirmDelete.id);
            } else {
              await trashArticle(confirmDelete.collectionId!, confirmDelete.id);
              if (externalActiveId === confirmDelete.id) { /* no-op */ }
            }
            setConfirmDelete(null);
            await refresh();
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
