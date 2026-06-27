import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  FolderOpen,
  Trash2,
  Clock,
  Pin,
  FileText,
  Plus,
  X,
  List,
  LayoutGrid,
  Image,
} from "lucide-react";
import { CollectionFormModal } from "./CollectionFormModal";
import { loadCollections, saveCollections, loadAllSeriesPlans, type Collection, type Article, type SeriesPlan, genId } from "../../lib/storage/collections";
import { loadArticleContent } from "../../lib/storage/articles";
import { getWordCount } from "../../lib/utils/text";
import { isTauriEnv, tryInvoke, TauriCommands } from "../../lib/bridge/tauri";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { VersionHistoryModal } from "./VersionHistoryModal";
import { saveArticleContent } from "../../lib/storage/articles";

type SortField = "title" | "wordCount" | "updatedAt";
type SortDir = "asc" | "desc";

/* ─── 字数统计（去 HTML 标签，中文算字英文算词） ─── */
interface ArticleEntry {
  id: string;
  title: string;
  collectionId: string;
  collectionTitle: string;
  wordCount: number;
  phase: string;
  status: string;
  updatedAt: number;
  pinned?: boolean;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000 && d.getDate() === now.getDate()) {
    return `今天 ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  }
  if (diff < 172800000 && d.getDate() === now.getDate() - 1) {
    return `昨天 ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  }
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function getPhaseLabel(phase: string): string {
  const labels: Record<string, string> = { planning: "规划", writing: "写作中", revising: "修改中", completed: "完成", published: "已发布" };
  return labels[phase] || phase;
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = { draft: "草稿", published: "已发布", scheduled: "定时发布" };
  return labels[status] || status;
}

export function ArticleManager({
  open,
  onOpenArticle,
  onClose,
}: {
  open: boolean;
  onOpenArticle?: (articleId: string, collectionId: string) => void;
  onClose?: () => void;
}) {
  const [articles, setArticles] = useState<ArticleEntry[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCollection, setFilterCollection] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("updatedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [versionHistoryArticle, setVersionHistoryArticle] = useState<{ id: string; title: string } | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "list">("table");

  // Collection editing
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [showColForm, setShowColForm] = useState(false);
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [editColTitle, setEditColTitle] = useState("");
  const [newColName, setNewColName] = useState("");
  const [showNewColInput, setShowNewColInput] = useState(false);
  const [seriesPlansMap, setSeriesPlansMap] = useState<Record<string, SeriesPlan[]>>({});
  const [deleteColId, setDeleteColId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const cols = await loadCollections();
      setCollections(cols);

      // Load series plans
      const seriesPlans: Record<string, SeriesPlan[]> = {};
      for (const col of cols) {
        const plans = await loadAllSeriesPlans(col.id);
        if (plans.length > 0) seriesPlans[col.id] = plans;
      }
      setSeriesPlansMap(seriesPlans);

      const entries: ArticleEntry[] = [];
      for (const col of cols) {
        for (const art of col.articles) {
          const content = await loadArticleContent(art.id);
          entries.push({
            id: art.id,
            title: art.title,
            collectionId: col.id,
            collectionTitle: col.title,
            wordCount: getWordCount(content),
            phase: "writing",
            status: "draft",
            updatedAt: art.updatedAt,
            pinned: art.pinned,
          });
        }
      }

      // Add series article entries
      for (const [colId, plans] of Object.entries(seriesPlans)) {
        const col = cols.find(c => c.id === colId);
        if (!col) continue;
        for (const plan of plans) {
          for (const art of plan.articles) {
            const articleId = art.articleId || `series_${plan.id}_${art.id}`;
            let wordCount = 0;
            if (art.articleId) {
              const artContent = await loadArticleContent(art.articleId);
              if (artContent) wordCount = getWordCount(artContent);
            }
            entries.push({
              id: articleId,
              title: `[${plan.title}] ${art.title}`,
              collectionId: colId,
              collectionTitle: col.title,
              wordCount,
              phase: art.status === "planned" ? "planning" : art.status === "complete" ? "complete" : "writing",
              status: art.status === "planned" ? "draft" : art.status === "reviewing" ? "draft" : art.status === "writing" ? "draft" : "published",
              updatedAt: 0,
              pinned: false,
            });
          }
        }
      }
      setArticles(entries);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (open) loadData(); }, [open, loadData]);

  // Filter & sort
  const filtered = articles
    .filter((a) => {
      if (filterCollection !== "all" && a.collectionId !== filterCollection) return false;
      if (searchQuery.trim()) {
        if (!a.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      }
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortField === "title") cmp = a.title.localeCompare(b.title);
      else if (sortField === "wordCount") cmp = a.wordCount - b.wordCount;
      else if (sortField === "updatedAt") cmp = a.updatedAt - b.updatedAt;
      return sortDir === "asc" ? cmp : -cmp;
    });

  // Selection
  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const selectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((a) => a.id)));
  };

  // Delete articles
  const handleTogglePin = useCallback(async (articleId: string) => {
    const col = collections.find(c => c.articles.some(a => a.id === articleId));
    if (!col) return;
    const article = col.articles.find(a => a.id === articleId);
    if (!article) return;
    article.pinned = !article.pinned;
    // Move to top/bottom in list
    const idx = col.articles.indexOf(article);
    col.articles.splice(idx, 1);
    if (article.pinned) {
      col.articles.unshift(article);
    } else {
      col.articles.push(article);
    }
    await saveCollections(collections);
    await loadData();
  }, [collections, loadData]);

  const handleDeleteArticles = async () => {
    for (const id of selectedIds) {
      for (const col of collections) {
        col.articles = col.articles.filter((a) => a.id !== id);
      }
      if (isTauriEnv()) { try { await tryInvoke(TauriCommands.DeleteArticleDb, { id }); } catch {} }
    }
    await saveCollections(collections);
    setShowDeleteConfirm(false);
    setSelectedIds(new Set());
    await loadData();
  };

  // Move articles
  const handleMoveArticles = async (targetColId: string) => {
    for (const id of selectedIds) {
      const article = articles.find((a) => a.id === id);
      if (!article) continue;
      const srcCol = collections.find((c) => c.id === article.collectionId);
      const artMeta = srcCol?.articles.find((a) => a.id === id);
      if (!srcCol || !artMeta) continue;
      srcCol.articles = srcCol.articles.filter((a) => a.id !== id);
      const tgtCol = collections.find((c) => c.id === targetColId);
      if (tgtCol) tgtCol.articles.push(artMeta);
      if (isTauriEnv()) { try { await tryInvoke(TauriCommands.MoveArticleDb, { id, newCollectionId: targetColId }); } catch {} }
    }
    await saveCollections(collections);
    setSelectedIds(new Set());
    await loadData();
  };

  // Collection CRUD
  const handleOpenColForm = (col?: Collection) => {
    setEditingCollection(col || null);
    editingColIdRef.current = col?.id || null;
    setShowColForm(true);
  };

  // 用 ref 持久化正在编辑的合集 ID，避免闭包陷阱
  const editingColIdRef = useRef<string | null>(null);
  const handleSaveCollection = async (title: string, description: string, coverImage: string, linkedFolder?: string) => {
    console.log('[handleSaveCollection] title=%s editingColIdRef=%s', title, editingColIdRef.current);
    const editingId = editingColIdRef.current;
    if (editingId) {
      // 编辑已有合集：重新加载确保拿到最新数据
      const all = await loadCollections();
      const col = all.find((x) => x.id === editingId);
      if (col) {
        col.title = title;
        col.description = description || undefined;
        col.coverImage = coverImage || undefined;
        col.linkedFolder = linkedFolder || undefined;
      }
      await saveCollections(all);
      if (isTauriEnv()) { try { await tryInvoke(TauriCommands.RenameCollectionDb, { id: editingId, title }); } catch {} }
    } else {
      // 新建合集
      const all = await loadCollections();
      const col: Collection = { id: genId(), title, description: description || undefined, coverImage: coverImage || undefined, linkedFolder: linkedFolder || undefined, articles: [], createdAt: Date.now() };
      all.push(col);
      await saveCollections(all);
      if (isTauriEnv()) { try { await tryInvoke(TauriCommands.CreateCollectionDb, { title, linkedFolder: linkedFolder || null }); } catch {} }
    }
    setShowColForm(false);
    setEditingCollection(null);
    editingColIdRef.current = null;
    // 直接更新本地状态，确保 UI 立即反映改名结果
    if (editingId) {
      setCollections(prev => prev.map(c => c.id === editingId ? { ...c, title } : c));
    }
    await loadData();
  };

  const handleDeleteCollection = async (colId: string) => {
    const idx = collections.findIndex((c) => c.id === colId);
    if (idx >= 0) {
      collections.splice(idx, 1);
      await saveCollections(collections);
      if (isTauriEnv()) { try { await tryInvoke(TauriCommands.DeleteCollectionDb, { id: colId }); } catch {} }
      if (filterCollection === colId) setFilterCollection("all");
    }
    await loadData();
  };

  // Sort toggle
  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  if (!open) return null;

  return (
    <div className="article-manager-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="article-manager" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="article-manager__header">
          <h2 className="article-manager__title">
            <FileText size={18} />
            文章管理
          </h2>
          <div className="article-manager__header-actions">
            <button className="article-manager__btn" onClick={onClose}>
              ← 返回
            </button>
          </div>
        </div>

        {/* Body: split layout */}
        <div className="article-manager__body">
          {/* ─── Left: Collections ─── */}
          <div className="article-manager__col-panel">
            <div className="article-manager__col-panel-header">
              <span>合集</span>
              <button
                className="article-manager__col-add-toggle"
                onClick={() => handleOpenColForm()}
                title="新建合集"
              >
                <Plus size={12} />
              </button>
            </div>

            <div className="article-manager__col-list">
              <div
                className={`article-manager__col-item ${filterCollection === "all" ? "is-active" : ""}`}
                onClick={() => setFilterCollection("all")}
              >
                <FolderOpen size={14} />
                <span className="article-manager__col-item-name">全部文章</span>
                <span className="article-manager__col-item-count">{articles.length + Object.values(seriesPlansMap).flatMap(plans => plans.flatMap(p => p.articles)).length}</span>
              </div>

              {collections.map((col) => (
                <div
                  key={col.id}
                  className={`article-manager__col-item ${filterCollection === col.id ? "is-active" : ""}`}
                >
                  <div className="article-manager__col-item-main" onClick={() => setFilterCollection(col.id)}>
                    {col.coverImage ? (
                      <div className="article-manager__col-cover-thumb">
                        <img src={col.coverImage} alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      </div>
                    ) : (
                      <FolderOpen size={14} />
                    )}
                    <div className="article-manager__col-item-text">
                      <span className="article-manager__col-item-name">{col.title}</span>
                      {col.description && <span className="article-manager__col-item-desc">{col.description}</span>}
                    </div>
                    <span className="article-manager__col-item-count">{col.articles.length + (seriesPlansMap[col.id] || []).reduce((sum, p) => sum + p.articles.length, 0)}</span>
                  </div>
                  <div className="article-manager__col-item-actions">
                    <button onClick={(e) => { e.stopPropagation(); handleOpenColForm(col); }} title="编辑">
                      编辑
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteCollection(col.id); }} title="删除">
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ─── Right: Articles ─── */}
          <div className="article-manager__art-panel">
            {/* Search + view toggle */}
            <div className="article-manager__art-search">
              <Search size={14} />
              <input
                type="text"
                placeholder="搜索文章…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="article-manager__search-clear" onClick={() => setSearchQuery("")}>
                  <X size={12} />
                </button>
              )}
              <div className="article-manager__view-toggle">
                <button
                  className={`article-manager__view-btn ${viewMode === "table" ? "is-active" : ""}`}
                  onClick={() => setViewMode("table")}
                  title="表格视图"
                >
                  <LayoutGrid size={13} />
                </button>
                <button
                  className={`article-manager__view-btn ${viewMode === "list" ? "is-active" : ""}`}
                  onClick={() => setViewMode("list")}
                  title="列表视图"
                >
                  <List size={13} />
                </button>
              </div>
              <span className="article-manager__art-count-label">
                {filterCollection === "all" ? "全部" : collections.find((c) => c.id === filterCollection)?.title} · {filtered.length} 篇
              </span>
            </div>

            {/* Batch actions */}
            {selectedIds.size > 0 && (
              <div className="article-manager__batch-bar">
                <span>已选 {selectedIds.size} 篇</span>
                <select
                  onChange={(e) => { if (e.target.value) { handleMoveArticles(e.target.value); e.target.value = ""; }}}
                  defaultValue=""
                >
                  <option value="" disabled>移动到合集…</option>
                  {collections.filter((c) => filtered.some((a) => selectedIds.has(a.id) && a.collectionId !== c.id)).map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
                <button className="article-manager__btn--danger-text" onClick={() => setShowDeleteConfirm(true)}>
                  <Trash2 size={12} /> 删除
                </button>
              </div>
            )}

            {/* Content: Table or List */}
            <div className="article-manager__art-table-wrap">
              {loading ? (
                <div className="article-manager__loading">加载中…</div>
              ) : filtered.length === 0 ? (
                <div className="article-manager__empty">
                  {searchQuery ? "没有匹配的文章" : "暂无文章"}
                </div>
              ) : viewMode === "table" ? (
                <table className="article-manager__table">
                  <thead>
                    <tr>
                      <th className="article-manager__th--check">
                        <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={selectAll} />
                      </th>
                      <th className="article-manager__th--pin"></th>
                      <th className="article-manager__th--sortable" onClick={() => toggleSort("title")}>
                        标题 {sortField === "title" && (sortDir === "asc" ? "↑" : "↓")}
                      </th>
                      <th className="article-manager__th--sortable" onClick={() => toggleSort("wordCount")}>
                        字数 {sortField === "wordCount" && (sortDir === "asc" ? "↑" : "↓")}
                      </th>
                      <th>阶段</th>
                      <th>状态</th>
                      <th className="article-manager__th--sortable" onClick={() => toggleSort("updatedAt")}>
                        <Clock size={12} /> 更新 {sortField === "updatedAt" && (sortDir === "asc" ? "↑" : "↓")}
                      </th>
                      <th style={{ width: 40 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((article) => (
                      <tr
                        key={article.id}
                        className={`article-manager__row ${selectedIds.has(article.id) ? "is-selected" : ""}`}
                        onClick={() => onOpenArticle?.(article.id, article.collectionId)}
                      >
                        <td onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={selectedIds.has(article.id)} onChange={() => toggleSelect(article.id)} />
                        </td>
                        <td className="article-manager__cell-pin">
                          <button
                            className={`article-manager__pin-btn ${article.pinned ? "is-pinned" : ""}`}
                            onClick={(e) => { e.stopPropagation(); handleTogglePin(article.id); }}
                            title={article.pinned ? "取消置顶" : "置顶"}
                          >
                            <Pin size={12} />
                          </button>
                        </td>
                        <td className="article-manager__cell-title">{article.title || "无标题"}</td>
                        <td className="article-manager__cell-num">{article.wordCount.toLocaleString()}</td>
                        <td><span className={`article-manager__phase article-manager__phase--${article.phase}`}>{getPhaseLabel(article.phase)}</span></td>
                        <td>{getStatusLabel(article.status)}</td>
                        <td className="article-manager__cell-date">{formatDate(article.updatedAt)}</td>
                        <td className="article-manager__cell-actions">
                          <button
                            className="article-manager__version-btn"
                            onClick={(e) => { e.stopPropagation(); setVersionHistoryArticle({ id: article.id, title: article.title || "无标题" }); }}
                            title="历史版本"
                          >
                            <Clock size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                /* List / Single-column view */
                <div className="article-manager__list-view">
                  {filtered.map((article) => (
                    <div
                      key={article.id}
                      className={`article-manager__list-card ${selectedIds.has(article.id) ? "is-selected" : ""}`}
                      onClick={() => onOpenArticle?.(article.id, article.collectionId)}
                    >
                      <div className="article-manager__list-card-check" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedIds.has(article.id)} onChange={() => toggleSelect(article.id)} />
                      </div>
                      <div className="article-manager__list-card-body">
                        <div className="article-manager__list-card-title">{article.title || "无标题"}</div>
                        <div className="article-manager__list-card-meta">
                          <span>{article.collectionTitle}</span>
                          <span>·</span>
                          <span>{article.wordCount.toLocaleString()} 字</span>
                          <span>·</span>
                          <span className={`article-manager__phase article-manager__phase--${article.phase}`}>{getPhaseLabel(article.phase)}</span>
                          <span>·</span>
                          <span>{formatDate(article.updatedAt)}</span>
                        </div>
                      </div>
                      <button
                        className={`article-manager__pin-btn ${article.pinned ? "is-pinned" : ""}`}
                        onClick={(e) => { e.stopPropagation(); handleTogglePin(article.id); }}
                        title={article.pinned ? "取消置顶" : "置顶"}
                        style={{background:"none",border:"none",cursor:"pointer",padding:"4px",color: article.pinned ? "var(--accent)" : "var(--text-faint)"}}
                      >
                        <Pin size={11} />
                      </button>
                      <div className="article-manager__list-card-actions">
                        <button
                          className="article-manager__version-btn"
                          onClick={(e) => { e.stopPropagation(); setVersionHistoryArticle({ id: article.id, title: article.title || "无标题" }); }}
                          title="历史版本"
                        >
                          <Clock size={11} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Delete confirmation */}
        <ConfirmDialog open={showDeleteConfirm} title="删除文章" message={`确定删除选中的 ${selectedIds.size} 篇文章？`} confirmLabel="删除" onConfirm={handleDeleteArticles} onCancel={() => setShowDeleteConfirm(false)} danger />
        
        {/* Collection Form Modal */}
        {/* Version History Modal */}
        <VersionHistoryModal
          articleId={versionHistoryArticle?.id || ""}
          articleTitle={versionHistoryArticle?.title || ""}
          open={versionHistoryArticle !== null}
          onClose={() => setVersionHistoryArticle(null)}
          onRestore={async (content) => {
            if (versionHistoryArticle) {
              await saveArticleContent(versionHistoryArticle.id, content);
              setVersionHistoryArticle(null);
              await loadData();
            }
          }}
        />
        <CollectionFormModal
          collection={editingCollection}
          open={showColForm}
          onSave={handleSaveCollection}
          onClose={() => { setShowColForm(false); setEditingCollection(null); editingColIdRef.current = null; }}
        />
      </div>
    </div>
  );
}

export default ArticleManager;
