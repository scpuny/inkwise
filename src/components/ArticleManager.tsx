import { useState, useEffect, useCallback } from "react";
import {
  Search,
  FolderOpen,
  Trash2,
  Clock,
  FileText,
  Plus,
  X,
} from "lucide-react";
import { loadCollections, saveCollections, type Collection, type Article, genId } from "../lib/collections";
import { loadArticleContent } from "../lib/articles";
import { isTauriEnv, tryInvoke } from "../lib/tauri";
import { ConfirmDialog } from "./ConfirmDialog";

type SortField = "title" | "wordCount" | "updatedAt";
type SortDir = "asc" | "desc";

interface ArticleEntry {
  id: string;
  title: string;
  collectionId: string;
  collectionTitle: string;
  wordCount: number;
  phase: string;
  status: string;
  updatedAt: number;
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

  // Collection editing
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [editColTitle, setEditColTitle] = useState("");
  const [newColName, setNewColName] = useState("");
  const [showNewColInput, setShowNewColInput] = useState(false);
  const [deleteColId, setDeleteColId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const cols = await loadCollections();
      setCollections(cols);

      const entries: ArticleEntry[] = [];
      for (const col of cols) {
        for (const art of col.articles) {
          const content = await loadArticleContent(art.id);
          entries.push({
            id: art.id,
            title: art.title,
            collectionId: col.id,
            collectionTitle: col.title,
            wordCount: content ? content.length : 0,
            phase: "writing",
            status: "draft",
            updatedAt: art.updatedAt,
          });
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
  const handleDeleteArticles = async () => {
    for (const id of selectedIds) {
      for (const col of collections) {
        col.articles = col.articles.filter((a) => a.id !== id);
      }
      if (isTauriEnv()) { try { await tryInvoke("delete_article_db", { id }); } catch {} }
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
      if (isTauriEnv()) { try { await tryInvoke("move_article_db", { id, newCollectionId: targetColId }); } catch {} }
    }
    await saveCollections(collections);
    setSelectedIds(new Set());
    await loadData();
  };

  // Collection CRUD
  const handleAddCollection = async () => {
    if (!newColName.trim()) return;
    const col: Collection = { id: genId(), title: newColName.trim(), articles: [], createdAt: Date.now() };
    collections.push(col);
    await saveCollections(collections);
    if (isTauriEnv()) { try { await tryInvoke("create_collection_db", { title: col.title, linkedFolder: null }); } catch {} }
    setNewColName("");
    setShowNewColInput(false);
    await loadData();
  };

  const handleRenameCollection = async (colId: string) => {
    if (!editColTitle.trim()) return;
    const col = collections.find((c) => c.id === colId);
    if (col) {
      col.title = editColTitle.trim();
      await saveCollections(collections);
      if (isTauriEnv()) { try { await tryInvoke("rename_collection_db", { id: colId, title: editColTitle.trim() }); } catch {} }
    }
    setEditingColId(null);
    await loadData();
  };

  const handleDeleteCollection = async () => {
    if (!deleteColId) return;
    const idx = collections.findIndex((c) => c.id === deleteColId);
    if (idx >= 0) {
      collections.splice(idx, 1);
      await saveCollections(collections);
      if (isTauriEnv()) { try { await tryInvoke("delete_collection_db", { id: deleteColId }); } catch {} }
      if (filterCollection === deleteColId) setFilterCollection("all");
    }
    setDeleteColId(null);
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
                onClick={() => setShowNewColInput(!showNewColInput)}
                title="新建合集"
              >
                <Plus size={12} />
              </button>
            </div>

            {showNewColInput && (
              <div className="article-manager__col-new-form">
                <input
                  type="text"
                  placeholder="合集名称…"
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddCollection(); if (e.key === "Escape") setShowNewColInput(false); }}
                  autoFocus
                />
                <div className="article-manager__col-new-actions">
                  <button onClick={handleAddCollection} disabled={!newColName.trim()}>创建</button>
                  <button onClick={() => { setShowNewColInput(false); setNewColName(""); }}>取消</button>
                </div>
              </div>
            )}

            <div className="article-manager__col-list">
              <div
                className={`article-manager__col-item ${filterCollection === "all" ? "is-active" : ""}`}
                onClick={() => setFilterCollection("all")}
              >
                <FolderOpen size={14} />
                <span className="article-manager__col-item-name">全部文章</span>
                <span className="article-manager__col-item-count">{articles.length}</span>
              </div>

              {collections.map((col) => (
                <div
                  key={col.id}
                  className={`article-manager__col-item ${filterCollection === col.id ? "is-active" : ""}`}
                >
                  {editingColId === col.id ? (
                    <div className="article-manager__col-edit-form">
                      <input
                        type="text"
                        value={editColTitle}
                        onChange={(e) => setEditColTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRenameCollection(col.id);
                          if (e.key === "Escape") setEditingColId(null);
                        }}
                        autoFocus
                      />
                      <div className="article-manager__col-edit-actions">
                        <button onClick={() => handleRenameCollection(col.id)}>保存</button>
                        <button onClick={() => setEditingColId(null)}>取消</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="article-manager__col-item-main" onClick={() => setFilterCollection(col.id)}>
                        <FolderOpen size={14} />
                        <span className="article-manager__col-item-name">{col.title}</span>
                        <span className="article-manager__col-item-count">{col.articles.length}</span>
                      </div>
                      <div className="article-manager__col-item-actions">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingColId(col.id); setEditColTitle(col.title); }}
                          title="编辑"
                        >
                          编辑
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteColId(col.id); }}
                          title="删除"
                        >
                          删除
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ─── Right: Articles ─── */}
          <div className="article-manager__art-panel">
            {/* Search */}
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

            {/* Table */}
            <div className="article-manager__art-table-wrap">
              {loading ? (
                <div className="article-manager__loading">加载中…</div>
              ) : filtered.length === 0 ? (
                <div className="article-manager__empty">
                  {searchQuery ? "没有匹配的文章" : "暂无文章"}
                </div>
              ) : (
                <table className="article-manager__table">
                  <thead>
                    <tr>
                      <th className="article-manager__th--check">
                        <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={selectAll} />
                      </th>
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
                        <td className="article-manager__cell-title">{article.title || "无标题"}</td>
                        <td className="article-manager__cell-num">{article.wordCount.toLocaleString()}</td>
                        <td><span className={`article-manager__phase article-manager__phase--${article.phase}`}>{getPhaseLabel(article.phase)}</span></td>
                        <td>{getStatusLabel(article.status)}</td>
                        <td className="article-manager__cell-date">{formatDate(article.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Delete confirmation */}
        <ConfirmDialog open={showDeleteConfirm} title="删除文章" message={`确定删除选中的 ${selectedIds.size} 篇文章？`} confirmLabel="删除" onConfirm={handleDeleteArticles} onCancel={() => setShowDeleteConfirm(false)} danger />
        <ConfirmDialog open={deleteColId !== null} title="删除合集" message="确定删除此合集？文章不会被删除。" confirmLabel="删除" onConfirm={handleDeleteCollection} onCancel={() => setDeleteColId(null)} danger />
      </div>
    </div>
  );
}

export default ArticleManager;
