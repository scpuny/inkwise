import { useState, useEffect, useCallback } from "react";
import { Plus, FileText, FolderOpen, Trash2, Edit3, X, Check, SquarePen, Download, Clipboard } from "lucide-react";
import { useCollection } from "../../hooks/useCollection";
import { useCollectionCrud } from "./useCollectionCrud";
import type { Collection, Article } from "../../domain";
import { exportMarkdown, copyAsMarkdown, copyAsHtml, exportAsHtml } from "../../lib/editor/importExport";
import { ContextMenu, type ContextMenuItem } from "../common/ContextMenu";
import { ConfirmDialog } from "../common/ConfirmDialog";

export type DocPickerResult = {
  action: "open" | "create" | "plan";
  articleId?: string;
  collectionId?: string;
};

export function DocPicker({
  open,
  onClose,
  onResult,
  activeCollectionId,
}: {
  open: boolean;
  onClose: () => void;
  onResult: (result: DocPickerResult) => void;
  activeCollectionId?: string | null;
}) {
  const { collections, loadCols, handleAddCollection, handleRenameCollection, handleDeleteCollection } = useCollectionCrud();
  const { renameArticle, trashArticle, loadArticleContent } = useCollection();
  const [selectedColId, setSelectedColId] = useState<string>("");
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [newColName, setNewColName] = useState("");
  const [showNewColInput, setShowNewColInput] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ items: ContextMenuItem[]; x: number; y: number } | null>(null);
  const [articleStats, setArticleStats] = useState<Record<string, { words: number }>>({});

  // Load collections on open
  useEffect(() => {
    if (!open) return;
    loadCols().then((cols) => {
      setSelectedColId(activeCollectionId && cols.some((c) => c.id === activeCollectionId) ? activeCollectionId : cols[0]?.id || "");
    });
  }, [open, activeCollectionId]);

  // Get selected collection
  const selectedCol = collections.find((c) => c.id === selectedColId);

  // Load word counts for visible articles
  useEffect(() => {
    if (!selectedCol || !open) return;
    for (const art of selectedCol.articles) {
      if (!articleStats[art.id]) {
        loadArticleContent(art.id).then((content) => {
          if (content) {
            const cnChars = (content.match(/[\u4e00-\u9fff]/g) || []).length;
            const westernWords = content.replace(/[\u4e00-\u9fff]/g, " ").trim().split(/\s+/).filter(Boolean).length;
            const words = cnChars + westernWords;
            setArticleStats((prev) => ({ ...prev, [art.id]: { words } }));
          }
        });
      }
    }
  }, [selectedCol, open, articleStats, loadArticleContent]);

  // Create new collection
  const handleAddCollectionLocal = async () => {
    const col = await handleAddCollection(newColName);
    if (col) {
      setSelectedColId(col.id);
      setNewColName("");
      setShowNewColInput(false);
    }
  };

  // Rename collection
  const handleRename = async (colId: string) => {
    if (!editTitle.trim()) return;
    await handleRenameCollection(colId, editTitle);
    setEditingColId(null);
  };

  // Delete collection
  const handleDeleteCol = async () => {
    if (!deleteConfirmId) return;
    const prevId = selectedColId;
    await handleDeleteCollection(deleteConfirmId);
    const cols = await loadCols();
    if (prevId === deleteConfirmId) {
      setSelectedColId(cols[0]?.id || "");
    }
    setDeleteConfirmId(null);
  };

  // Open article
  const handleOpenArticle = (articleId: string) => {
    onResult({ action: "open", articleId, collectionId: selectedColId });
    onClose();
  };

  // Create new article in selected collection
  const handleNewArticle = async () => {
    onResult({ action: "create", collectionId: selectedColId });
    onClose();
  };

  // AI Plan from picker
  const handleAIPlan = () => {
    onResult({ action: "plan", collectionId: selectedColId });
    onClose();
  };

  // Rename article
  const handleRenameArticle = async (articleId: string, newTitle: string) => {
    if (!newTitle.trim() || !selectedColId) return;
    await renameArticle(selectedColId, articleId, newTitle.trim());
    await refreshCollections();
  };

  // Trash article
  const handleTrashArticle = async (articleId: string) => {
    if (!selectedColId) return;
    const art = selectedCol?.articles.find((a) => a.id === articleId);
    await trashArticle(selectedColId, articleId, art?.title || "");
    await refreshCollections();
  };

  const refreshCollections = async () => {
    const cols = await loadCols();
    if (selectedColId && !cols.some((c) => c.id === selectedColId)) {
      setSelectedColId(cols[0]?.id || "");
    }
  };

  const handleArticleCtx = (e: React.MouseEvent, article: Article) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({
      items: [
        { icon: <Edit3 size={13} />, label: "重命名", onClick: () => {
          const newTitle = prompt("重命名文章", article.title);
          if (newTitle) handleRenameArticle(article.id, newTitle);
        }},
        { icon: <Download size={13} />, label: "导出 Markdown", onClick: () => exportMarkdown(article.id, article.title) },
        { icon: <Clipboard size={13} />, label: "复制为 Markdown", onClick: () => copyAsMarkdown(article.id) },
        { icon: <FileText size={13} />, label: "复制为 HTML（含格式和图片）", onClick: () => copyAsHtml(article.id, article.title) },
        { icon: <FileText size={13} />, label: "导出为 HTML", onClick: () => exportAsHtml(article.id, article.title) },
        { icon: <Trash2 size={13} />, label: "移到回收站", danger: true, onClick: () => handleTrashArticle(article.id) },
      ],
      x: e.clientX,
      y: e.clientY,
    });
  };

  if (!open) return null;

  return (
    <div className="doc-picker-overlay" onClick={onClose}>
      <div className="doc-picker" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="doc-picker__header">
          <SquarePen size={16} />
          <span>选择或创建文档</span>
          <button className="doc-picker__close" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <div className="doc-picker__body">
          {/* Left: Collections */}
          <div className="doc-picker__collections">
            <div className="doc-picker__col-header">
              <FolderOpen size={14} />
              <span>合集</span>
              <button
                className="doc-picker__col-add-btn"
                onClick={() => setShowNewColInput(!showNewColInput)}
                title="新建合集"
              >
                <Plus size={12} />
              </button>
            </div>

            {/* New collection input */}
            {showNewColInput && (
              <div className="doc-picker__new-col">
                <input
                  type="text"
                  placeholder="合集名称…"
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddCollectionLocal();
                    if (e.key === "Escape") setShowNewColInput(false);
                  }}
                  autoFocus
                />
                <button onClick={handleAddCollectionLocal} disabled={!newColName.trim()}>
                  <Check size={12} />
                </button>
              </div>
            )}

            {/* Collection list */}
            <div className="doc-picker__col-list">
              {collections.length === 0 ? (
                <div className="doc-picker__empty">暂无合集</div>
              ) : (
                collections.map((col) => (
                  <div
                    key={col.id}
                    className={`doc-picker__col-item ${col.id === selectedColId ? "doc-picker__col-item--active" : ""}`}
                  >
                    {editingColId === col.id ? (
                      <div className="doc-picker__col-rename">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRename(col.id);
                            if (e.key === "Escape") setEditingColId(null);
                          }}
                          autoFocus
                        />
                        <button onClick={() => handleRename(col.id)}><Check size={10} /></button>
                        <button onClick={() => setEditingColId(null)}><X size={10} /></button>
                      </div>
                    ) : (
                      <>
                        <button
                          className="doc-picker__col-btn"
                          onClick={() => setSelectedColId(col.id)}
                        >
                          <span className="doc-picker__col-name">{col.title}</span>
                          <span className="doc-picker__col-count">{col.articles.length}</span>
                        </button>
                        <div className="doc-picker__col-actions">
                          <button
                            onClick={() => { onResult({ action: "create", collectionId: col.id }); onClose(); }}
                            title="新建文章"
                          >
                            <Plus size={10} />
                          </button>
                          <button
                            onClick={() => { setEditingColId(col.id); setEditTitle(col.title); }}
                            title="重命名"
                          >
                            <Edit3 size={10} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(col.id)}
                            title={col.articles.length > 0 ? "请先清空合集" : "删除合集"}
                            disabled={col.articles.length > 0}
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right: Articles */}
          <div className="doc-picker__articles">
            <div className="doc-picker__art-header">
              <FileText size={14} />
              <span>{selectedCol ? selectedCol.title : "文章"}</span>
              <div className="doc-picker__art-actions">
                <button className="doc-picker__action-btn doc-picker__action-btn--primary" onClick={handleNewArticle}>
                  <Plus size={12} />
                  新建
                </button>
                <button className="doc-picker__action-btn" onClick={handleAIPlan}>
                  <SquarePen size={12} />
                  AI 规划
                </button>
              </div>
            </div>

            <div className="doc-picker__art-list">
              {!selectedCol || selectedCol.articles.length === 0 ? (
                <div className="doc-picker__empty">
                  {selectedCol ? "该合集暂无文章" : "请选择一个合集"}
                </div>
              ) : (
                selectedCol.articles.map((article) => (
                  <div
                    key={article.id}
                    className="doc-picker__art-item-wrap"
                    onContextMenu={(e) => handleArticleCtx(e, article)}
                  >
                    <button
                      className="doc-picker__art-item"
                      onClick={() => handleOpenArticle(article.id)}
                    >
                      <FileText size={14} />
                      <div className="doc-picker__art-info">
                        <span className="doc-picker__art-title">{article.title || "无标题"}</span>
                        <span className="doc-picker__art-date">
                          {new Date(article.updatedAt).toLocaleDateString("zh-CN")}
                          {articleStats[article.id] && (
                            <> · {articleStats[article.id].words}字</>
                          )}
                        </span>
                      </div>
                    </button>
                    <div className="doc-picker__art-actions">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleTrashArticle(article.id); }}
                        title="移到回收站"
                        className="doc-picker__art-action-btn"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {ctxMenu && <ContextMenu items={ctxMenu.items} position={{ x: ctxMenu.x, y: ctxMenu.y }} onClose={() => setCtxMenu(null)} />}
      {/* Delete confirmation */}
        <ConfirmDialog
          open={deleteConfirmId !== null}
          title="删除合集"
          message={`确定要删除此合集吗？合集内的文章不会被删除，但会失去合集归属。`}
          confirmLabel="删除"
          onConfirm={handleDeleteCol}
          onCancel={() => setDeleteConfirmId(null)}
          danger
        />
      </div>
    </div>
  );
}

export default DocPicker;
