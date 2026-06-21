import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  FolderOpen,
  Trash2,
  Clock,
  FileText,
  Plus,
  X,
  ChevronDown,
  MoreHorizontal,
} from "lucide-react";
import { loadCollections, saveCollections, type Collection, type Article } from "../lib/collections";
import { loadArticleContent } from "../lib/articles";
import { isTauriEnv, tryInvoke, invokeOrFallback } from "../lib/tauri";
import { ConfirmDialog } from "./ConfirmDialog";

// ─── Types ───

type SortField = "title" | "collection" | "wordCount" | "updatedAt";
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
  createdAt: number;
}

// ─── Helpers ───

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
  const labels: Record<string, string> = {
    planning: "规划",
    writing: "写作中",
    revising: "修改中",
    completed: "完成",
    published: "已发布",
  };
  return labels[phase] || phase;
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: "草稿",
    published: "已发布",
    scheduled: "定时发布",
  };
  return labels[status] || status;
}

// ─── Component ───

export function ArticleManager({
  onOpenArticle,
  onClose,
  open,
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
  const [showCollectionManager, setShowCollectionManager] = useState(false);
  const [newCollectionTitle, setNewCollectionTitle] = useState("");
  const [renameCollectionId, setRenameCollectionId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null);

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const cols = await loadCollections();
      setCollections(cols);

      if (isTauriEnv()) {
        // Try SQLite first
        try {
          const dbArticles = await tryInvoke<ArticleEntry[]>("list_all_articles_db");
          if (dbArticles && dbArticles.length > 0) {
            setArticles(dbArticles);
            setLoading(false);
            return;
          }
        } catch { /* fallback to collections */ }
      }

      // Fallback: build from collections
      const entries: ArticleEntry[] = [];
      for (const col of cols) {
        for (const art of col.articles) {
          const content = await loadArticleContent(art.id);
          const wordCount = content ? content.length : 0;
          entries.push({
            id: art.id,
            title: art.title,
            collectionId: col.id,
            collectionTitle: col.title,
            wordCount,
            phase: "writing",
            status: "draft",
            updatedAt: art.updatedAt,
            createdAt: art.createdAt,
          });
        }
      }
      setArticles(entries);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Filter and sort
  const filtered = articles
    .filter((a) => {
      if (filterCollection !== "all" && a.collectionId !== filterCollection) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!a.title.toLowerCase().includes(q)) {
          // Try FTS5 if in Tauri
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortField === "title") cmp = a.title.localeCompare(b.title);
      else if (sortField === "collection") cmp = a.collectionTitle.localeCompare(b.collectionTitle);
      else if (sortField === "wordCount") cmp = a.wordCount - b.wordCount;
      else if (sortField === "updatedAt") cmp = a.updatedAt - b.updatedAt;
      return sortDir === "asc" ? cmp : -cmp;
    });

  // Selection
  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((a) => a.id)));
    }
  };

  // Delete
  const handleDelete = async () => {
    for (const id of selectedIds) {
      if (isTauriEnv()) {
        try { await tryInvoke("delete_article_db", { id }); } catch {}
      }
      // Remove from collections
      for (const col of collections) {
        col.articles = col.articles.filter((a) => a.id !== id);
      }
    }
    await saveCollections(collections);
    setShowDeleteConfirm(false);
    setSelectedIds(new Set());
    await loadData();
  };

  // Move
  const moveToCollection = async (targetColId: string) => {
    for (const id of selectedIds) {
      const article = articles.find((a) => a.id === id);
      if (!article) continue;
      // Find the source collection
      const srcCol = collections.find((c) => c.id === article.collectionId);
      if (!srcCol) continue;
      const artMeta = srcCol.articles.find((a) => a.id === id);
      if (!artMeta) continue;
      // Remove from source
      srcCol.articles = srcCol.articles.filter((a) => a.id !== id);
      // Add to target
      const tgtCol = collections.find((c) => c.id === targetColId);
      if (tgtCol) {
        tgtCol.articles.push(artMeta);
        if (isTauriEnv()) {
          try { await tryInvoke("move_article_db", { id, newCollectionId: targetColId }); } catch {}
        }
      }
    }
    await saveCollections(collections);
    setSelectedIds(new Set());
    await loadData();
  };

  // Collection management
  const addCollection = async () => {
    if (!newCollectionTitle.trim()) return;
    const col: Collection = {
      id: `col_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: newCollectionTitle.trim(),
      articles: [],
      createdAt: Date.now(),
    };
    if (isTauriEnv()) {
      try {
        await tryInvoke("create_collection_db", { title: col.title, linkedFolder: null });
      } catch {}
    }
    collections.push(col);
    await saveCollections(collections);
    setNewCollectionTitle("");
    await loadData();
  };

  const renameCollection = async (colId: string) => {
    if (!renameTitle.trim()) return;
    const col = collections.find((c) => c.id === colId);
    if (col) {
      col.title = renameTitle.trim();
      if (isTauriEnv()) {
        try { await tryInvoke("rename_collection_db", { id: colId, title: renameTitle.trim() }); } catch {}
      }
      await saveCollections(collections);
    }
    setRenameCollectionId(null);
    setEditingCollectionId(null);
    await loadData();
  };

  const deleteCollection = async (colId: string) => {
    const col = collections.find((c) => c.id === colId);
    if (!col || col.articles.length > 0) {
      // Don't delete non-empty collections (for safety)
      return;
    }
    if (isTauriEnv()) {
      try { await tryInvoke("delete_collection_db", { id: colId }); } catch {}
    }
    const idx = collections.findIndex((c) => c.id === colId);
    if (idx >= 0) collections.splice(idx, 1);
    await saveCollections(collections);
    await loadData();
  };

  // Sort toggle
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
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
          <span className="article-manager__subtitle">点击文章即可打开编辑</span>
        </h2>
        <div className="article-manager__header-actions">
          <button
            className="article-manager__btn"
            onClick={() => setShowCollectionManager(!showCollectionManager)}
          >
            <FolderOpen size={14} />
            合集管理
          </button>
          {selectedIds.size > 0 && (
            <>
              <span className="article-manager__selected-count">
                已选 {selectedIds.size} 篇
              </span>
              {/* Move dropdown */}
              <div className="article-manager__dropdown-group">
                <select
                  className="article-manager__select"
                  onChange={(e) => {
                    if (e.target.value) {
                      moveToCollection(e.target.value);
                      e.target.value = "";
                    }
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>移动到合集…</option>
                  {collections.filter((c) =>
                    filtered.some((a) => selectedIds.has(a.id) && a.collectionId !== c.id)
                  ).map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>
              <button
                className="article-manager__btn article-manager__btn--danger"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 size={14} />
                删除
              </button>
            </>
          )}
        </div>
      </div>

      {/* Back to editor */}
      <div className="article-manager__back-bar">
        <button
          className="article-manager__back-btn"
          onClick={() => onClose?.()}
        >
          ← 返回编辑器
        </button>
        <span className="article-manager__hint">管理所有文章和合集，点击文章标题打开编辑</span>
      </div>

      {/* Search & Filter Bar */}
      <div className="article-manager__toolbar">
        <div className="article-manager__search">
          <Search size={14} />
          <input
            type="text"
            placeholder="搜索文章标题…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="article-manager__search-clear" onClick={() => setSearchQuery("")}>
              <X size={12} />
            </button>
          )}
        </div>
        <select
          className="article-manager__select"
          value={filterCollection}
          onChange={(e) => setFilterCollection(e.target.value)}
        >
          <option value="all">全部合集</option>
          {collections.map((c) => (
            <option key={c.id} value={c.id}>{c.title} ({c.articles.length})</option>
          ))}
        </select>
      </div>

      {/* Collection Manager Panel */}
      {showCollectionManager && (
        <div className="article-manager__collection-panel">
          <div className="article-manager__collection-panel-header">
            <span>合集管理</span>
            <button onClick={() => setShowCollectionManager(false)}><X size={12} /></button>
          </div>
          <div className="article-manager__collection-add">
            <input
              type="text"
              placeholder="新合集名称…"
              value={newCollectionTitle}
              onChange={(e) => setNewCollectionTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addCollection(); }}
            />
            <button onClick={addCollection} disabled={!newCollectionTitle.trim()}>
              <Plus size={12} />
            </button>
          </div>
          <div className="article-manager__collection-list">
            {collections.map((c) => (
              <div key={c.id} className="article-manager__collection-item">
                {editingCollectionId === c.id ? (
                  <input
                    type="text"
                    value={renameTitle}
                    onChange={(e) => setRenameTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") renameCollection(c.id);
                      if (e.key === "Escape") setEditingCollectionId(null);
                    }}
                    autoFocus
                  />
                ) : (
                  <>
                    <span className="article-manager__collection-name">{c.title}</span>
                    <span className="article-manager__collection-count">{c.articles.length} 篇</span>
                    <div className="article-manager__collection-actions">
                      <button
                        onClick={() => {
                          setEditingCollectionId(c.id);
                          setRenameTitle(c.title);
                        }}
                        title="重命名"
                      >
                        重命名
                      </button>
                      <button
                        onClick={() => deleteCollection(c.id)}
                        disabled={c.articles.length > 0}
                        title={c.articles.length > 0 ? "请先清空合集" : "删除合集"}
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
      )}

      {/* Table */}
      {loading ? (
        <div className="article-manager__loading">
          <div className="article-manager__spinner" />
          加载中…
        </div>
      ) : filtered.length === 0 ? (
        <div className="article-manager__empty">
          {searchQuery ? "没有匹配的文章" : "还没有文章，快去创作吧"}
        </div>
      ) : (
        <div className="article-manager__table-wrapper">
          <table className="article-manager__table">
            <thead>
              <tr>
                <th className="article-manager__th--check">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filtered.length && filtered.length > 0}
                    onChange={selectAll}
                  />
                </th>
                <th
                  className="article-manager__th--sortable"
                  onClick={() => toggleSort("title")}
                >
                  标题 {sortField === "title" && (sortDir === "asc" ? "↑" : "↓")}
                </th>
                <th
                  className="article-manager__th--sortable"
                  onClick={() => toggleSort("collection")}
                >
                  合集 {sortField === "collection" && (sortDir === "asc" ? "↑" : "↓")}
                </th>
                <th
                  className="article-manager__th--sortable"
                  onClick={() => toggleSort("wordCount")}
                >
                  字数 {sortField === "wordCount" && (sortDir === "asc" ? "↑" : "↓")}
                </th>
                <th>阶段</th>
                <th>状态</th>
                <th
                  className="article-manager__th--sortable"
                  onClick={() => toggleSort("updatedAt")}
                >
                  <Clock size={12} />
                  更新 {sortField === "updatedAt" && (sortDir === "asc" ? "↑" : "↓")}
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((article) => (
                <tr
                  key={article.id}
                  className={`article-manager__row ${selectedIds.has(article.id) ? "article-manager__row--selected" : ""}`}
                  onClick={() => onOpenArticle?.(article.id, article.collectionId)}
                >
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(article.id)}
                      onChange={() => toggleSelect(article.id)}
                    />
                  </td>
                  <td className="article-manager__cell-title">{article.title || "无标题"}</td>
                  <td>{article.collectionTitle}</td>
                  <td className="article-manager__cell-num">{article.wordCount.toLocaleString()}</td>
                  <td><span className={`article-manager__phase article-manager__phase--${article.phase}`}>{getPhaseLabel(article.phase)}</span></td>
                  <td>{getStatusLabel(article.status)}</td>
                  <td className="article-manager__cell-date">{formatDate(article.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
          open={showDeleteConfirm}
          title="删除文章"
          message={`确定要删除选中的 ${selectedIds.size} 篇文章吗？此操作不可恢复。`}
          confirmLabel="删除"
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
          danger
        />
    </div>
    </div>
  );
}

export default ArticleManager;
