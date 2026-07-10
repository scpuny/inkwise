// TrashDialog.tsx — 回收站（弹窗 / 页面路由双模式）

import { useState, useEffect } from "react";
import { Trash2, RotateCcw, X, FileText, ArrowLeft } from "lucide-react";
import { loadTrash, restoreArticle, permanentlyDeleteArticle, emptyTrash, type TrashItem } from "../../lib/storage/collections";
import { on } from "../../lib/events/eventBus";
import { isTauriEnv } from "../../lib/bridge/tauri";

interface TrashDialogProps {
  open: boolean;
  onClose: () => void;
  /** 作为路由页面使用时为 true，隐藏遮罩层 */
  pageMode?: boolean;
}

export function TrashDialog({ open, onClose, pageMode }: TrashDialogProps) {
  const [trashItems, setTrashItems] = useState<TrashItem[]>([]);

  useEffect(() => {
    if (open) {
      loadTrash().then(setTrashItems);
    }
    const unsub = on("collections-changed", () => {
      if (open) loadTrash().then(setTrashItems);
    });
    return () => unsub();
  }, [open]);

  const handleRestore = async (id: string) => {
    console.log("[TrashDialog] handleRestore called, id:", id);
    try {
      await restoreArticle(id);
      loadTrash().then(setTrashItems);
    } catch (e) { console.error("[TrashDialog] restore failed:", e); }
  };

  /** Tauri 原生 confirm 对话框（带浏览器降级） */
  async function tauriConfirm(message: string, title: string): Promise<boolean> {
    if (isTauriEnv()) {
      try {
        const { confirm } = await import("@tauri-apps/plugin-dialog");
        return await confirm(message, { title, kind: "warning" });
      } catch { /* fall through */ }
    }
    return window.confirm(title + "\n" + message);
  }

  const handlePermanentDelete = async (id: string) => {
    console.log("[TrashDialog] handlePermanentDelete called, id:", id);
    const ok = await tauriConfirm("此操作不可撤销。", "确定永久删除此文章？");
    if (!ok) return;
    console.log("[TrashDialog] confirm OK, proceeding...");
    try {
      await permanentlyDeleteArticle(id);
      loadTrash().then(setTrashItems);
    } catch (e) { console.error("[TrashDialog] permanent delete failed:", e); }
  };

  const handleEmptyTrash = async () => {
    console.log("[TrashDialog] handleEmptyTrash called");
    const ok = await tauriConfirm("此操作不可撤销。", "确定清空回收站？");
    if (!ok) return;
    console.log("[TrashDialog] confirm OK, proceeding...");
    try {
      await emptyTrash();
      setTrashItems([]);
    } catch (e) { console.error("[TrashDialog] empty trash failed:", e); }
  };

  if (!open) return null;

  // 页面模式：无遮罩，填满主区域
  if (pageMode) {
    return (
      <div className="project-explorer" style={{ display: "flex", flexDirection: "column" }}>
        <div className="project-explorer__header">
          <Trash2 size={14} className="project-explorer__header-icon" />
          <div className="project-explorer__title-wrap">
            <span className="project-explorer__title">回收站</span>
            <span className="project-explorer__subtitle">{trashItems.length} 篇文章</span>
          </div>
          <button className="project-explorer__close" onClick={onClose} title="关闭"><ArrowLeft size={14} /></button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
          {trashItems.length === 0 ? (
            <div style={{ padding: "48px 0", textAlign: "center", fontSize: 13, color: "var(--fg-faint)" }}>回收站为空</div>
          ) : (
            trashItems.map((item) => (
              <div key={item.id} className="trash-dialog-item">
                <FileText size={12} className="trash-dialog-item__icon" />
                <span className="trash-dialog-item__label">{item.title}</span>
                <span className="trash-dialog-item__source">{item.collectionTitle}</span>
                <button className="trash-dialog-item__action" title="恢复" onClick={() => handleRestore(item.id)}><RotateCcw size={12} /></button>
                <button className="trash-dialog-item__action trash-dialog-item__action--danger" title="永久删除" onClick={() => handlePermanentDelete(item.id)}><X size={12} /></button>
              </div>
            ))
          )}
        </div>
        {trashItems.length > 0 && (
          <div style={{ padding: "8px 24px 12px", borderTop: "1px solid var(--border-soft)" }}>
            <button className="btn btn--danger btn--small" onClick={handleEmptyTrash}>清空回收站</button>
          </div>
        )}
      </div>
    );
  }

  // 弹窗模式：带遮罩
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460, maxHeight: 480, display: "flex", flexDirection: "column" }}>
        <div className="dialog__head">
          <Trash2 size={14} /><span style={{ marginLeft: 6 }}>回收站</span>
          {trashItems.length > 0 && <span className="dialog__badge">{trashItems.length}</span>}
          <button className="dialog__close" onClick={onClose} aria-label="关闭" style={{ marginLeft: "auto" }}>
            <X size={14} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px 12px" }}>
          {trashItems.length === 0 ? (
            <div style={{ padding: "32px 0", textAlign: "center", fontSize: 13, color: "var(--fg-faint)" }}>回收站为空</div>
          ) : (
            trashItems.map((item) => (
              <div key={item.id} className="trash-dialog-item">
                <FileText size={12} className="trash-dialog-item__icon" />
                <span className="trash-dialog-item__label">{item.title}</span>
                <span className="trash-dialog-item__source">{item.collectionTitle}</span>
                <button className="trash-dialog-item__action" title="恢复" onClick={() => handleRestore(item.id)}><RotateCcw size={12} /></button>
                <button className="trash-dialog-item__action trash-dialog-item__action--danger" title="永久删除" onClick={() => handlePermanentDelete(item.id)}><X size={12} /></button>
              </div>
            ))
          )}
        </div>
        {trashItems.length > 0 && (
          <div className="dialog__footer">
            <button className="btn btn--danger btn--small" onClick={handleEmptyTrash}>清空回收站</button>
          </div>
        )}
      </div>
    </div>
  );
}
