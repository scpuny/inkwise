// VersionHistoryModal.tsx — 文章版本历史弹窗
// 展示快照列表：时间、摘要、字数，支持恢复

import { useState, useEffect } from "react";
import { Clock, RotateCcw, X, FileText } from "lucide-react";
import { useDocument } from "../../hooks/useDocument";
import type { VersionEntry } from "../../domain";
import { ConfirmDialog } from "../common/ConfirmDialog";

interface Props {
  articleId: string;
  articleTitle: string;
  open: boolean;
  onClose: () => void;
  onRestore: (content: string) => void;
}

export function VersionHistoryModal({ articleId, articleTitle, open, onClose, onRestore }: Props) {
  const { getVersionHistory, loadVersionContent, restoreVersion } = useDocument();
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [loadingContent, setLoadingContent] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (open && articleId) {
      getVersionHistory(articleId).then(setVersions);
    }
  }, [open, articleId]);

  const handlePreview = async (v: VersionEntry) => {
    setLoadingContent(v.id);
    const content = await loadVersionContent(articleId, v.id);
    setPreviewContent(content);
    setLoadingContent(null);
  };

  const handleRestore = async (versionId: string) => {
    const content = await restoreVersion(articleId, versionId);
    if (content !== null) {
      onRestore(content);
      onClose();
    }
    setShowRestoreConfirm(null);
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getFullYear()}/${(d.getMonth()+1).toString().padStart(2,"0")}/${d.getDate().toString().padStart(2,"0")} ${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}:${d.getSeconds().toString().padStart(2,"0")}`;
  };

  if (!open) return null;

  return (
    <div className="version-history-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="version-history-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="version-history__header">
          <div className="version-history__header-text">
            <Clock size={16} />
            <span>历史版本 — {articleTitle}</span>
          </div>
          <button className="version-history__close" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        {/* Body: split layout */}
        <div className="version-history__body">
          {/* Left: Version list */}
          <div className="version-history__list">
            <div className="version-history__list-header">
              <span>共 {versions.length} 个版本</span>
            </div>
            {versions.length === 0 ? (
              <div className="version-history__empty">
                <FileText size={24} />
                <p>暂无历史版本</p>
                <p className="version-history__empty-hint">编辑文章后自动保存快照</p>
              </div>
            ) : (
              <div className="version-history__items">
                {versions.map((v) => (
                  <div
                    key={v.id}
                    className={`version-history__item ${previewContent && loadingContent !== v.id ? "" : ""}`}
                    onClick={() => handlePreview(v)}
                  >
                    <div className="version-history__item-time">{formatTime(v.createdAt)}</div>
                    <div className="version-history__item-summary">{v.summary}</div>
                    <div className="version-history__item-meta">
                      <span>{v.charCount} 字符</span>
                    </div>
                    <div className="version-history__item-actions">
                      <button
                        className="version-history__restore-btn"
                        onClick={(e) => { e.stopPropagation(); setShowRestoreConfirm(v.id); }}
                        title="恢复到此版本"
                      >
                        <RotateCcw size={11} />
                        恢复
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Preview */}
          <div className="version-history__preview">
            {loadingContent ? (
              <div className="version-history__preview-loading">加载中…</div>
            ) : previewContent !== null ? (
              <div className="version-history__preview-content">
                <div className="version-history__preview-header">内容预览</div>
                <pre className="version-history__preview-text">{previewContent}</pre>
              </div>
            ) : (
              <div className="version-history__preview-empty">选择一个版本查看内容预览</div>
            )}
          </div>
        </div>

        {/* Restore confirm */}
        <ConfirmDialog
          open={showRestoreConfirm !== null}
          title="恢复版本"
          message="当前内容将被保存为新版本，然后恢复到选中版本。确定继续？"
          confirmLabel="恢复"
          onConfirm={() => { if (showRestoreConfirm) handleRestore(showRestoreConfirm); }}
          onCancel={() => setShowRestoreConfirm(null)}
          danger
        />
      </div>
    </div>
  );
}
