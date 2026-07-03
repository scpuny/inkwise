// TrashDialog.tsx — 回收站全局弹窗

import { useState, useEffect } from "react";
import { Trash2, RotateCcw, X, FileText } from "lucide-react";
import { loadTrash, restoreArticle, permanentlyDeleteArticle, emptyTrash, type TrashItem } from "../../lib/storage/collections";

export function TrashDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [trashItems, setTrashItems] = useState<TrashItem[]>([]);

  useEffect(() => {
    if (open) {
      loadTrash().then(setTrashItems);
    }
  }, [open]);

  const handleRestore = async (id: string) => {
    await restoreArticle(id);
    loadTrash().then(setTrashItems);
  };

  const handlePermanentDelete = async (id: string) => {
    if (!confirm("确定永久删除此文章？此操作不可撤销。")) return;
    await permanentlyDeleteArticle(id);
    loadTrash().then(setTrashItems);
  };

  const handleEmptyTrash = async () => {
    if (!confirm("确定清空回收站？此操作不可撤销。")) return;
    await emptyTrash();
    setTrashItems([]);
  };

  if (!open) return null;

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
