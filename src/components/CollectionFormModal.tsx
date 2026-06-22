import { useState, useEffect, useCallback } from "react";
import { X, FolderOpen, Save, FolderInput, RefreshCw, Unlink, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import type { Collection, ProjectContext } from "../lib/collections";
import { linkCollectionFolder, rescanProjectFolder } from "../lib/collections";
import { isTauriEnv, tryInvoke } from "../lib/tauri";
import { buildProjectLabel } from "../lib/projectContext";

export function CollectionFormModal({
  collection,
  open,
  onSave,
  onClose,
}: {
  collection: Collection | null;
  open: boolean;
  onSave: (title: string, description: string, coverImage: string, linkedFolder?: string) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [linkedFolder, setLinkedFolder] = useState<string | undefined>(undefined);
  const [projectCtx, setProjectCtx] = useState<ProjectContext | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  useEffect(() => {
    if (collection && open) {
      setTitle(collection.title || "");
      setDescription(collection.description || "");
      setCoverImage(collection.coverImage || "");
      setLinkedFolder(collection.linkedFolder || undefined);
      setProjectCtx(null);
      setScanError(null);
    } else if (!open) {
      setTitle("");
      setDescription("");
      setCoverImage("");
      setLinkedFolder(undefined);
      setProjectCtx(null);
      setScanning(false);
      setScanError(null);
    }
  }, [collection, open]);

  const handleSave = () => {
    if (!title.trim()) return;
    onSave(title.trim(), description.trim(), coverImage.trim(), linkedFolder);
  };

  // 选择目录
  const handlePickFolder = useCallback(async () => {
    if (!isTauriEnv()) {
      setScanError("浏览器环境下不支持目录选择");
      return;
    }
    try {
      const path = await tryInvoke<string | null>("pick_folder", {});
      if (path) {
        setLinkedFolder(path);
        setScanning(true);
        setScanError(null);
        setProjectCtx(null);
        try {
          const ctx = await linkCollectionFolder(collection?.id || "", path);
          setProjectCtx(ctx);
        } catch (e: any) {
          setScanError(e?.message || "扫描失败");
        } finally {
          setScanning(false);
        }
      }
    } catch (e: any) {
      setScanError(e?.message || "选择目录失败");
    }
  }, [collection?.id]);

  // 重新扫描
  const handleRescan = useCallback(async () => {
    if (!linkedFolder) return;
    setScanning(true);
    setScanError(null);
    try {
      const ctx = await rescanProjectFolder(linkedFolder);
      setProjectCtx(ctx);
    } catch (e: any) {
      setScanError(e?.message || "重新扫描失败");
    } finally {
      setScanning(false);
    }
  }, [linkedFolder]);

  // 取消关联
  const handleUnlink = useCallback(() => {
    setLinkedFolder(undefined);
    setProjectCtx(null);
    setScanError(null);
  }, []);

  if (!open) return null;

  return (
    <div className="collection-form-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="collection-form" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="collection-form__header">
          <FolderOpen size={16} />
          <span>{collection ? "编辑合集" : "新建合集"}</span>
          <button className="collection-form__close" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        {/* Cover image preview */}
        {coverImage && (
          <div className="collection-form__cover-preview">
            <img src={coverImage} alt="封面预览" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          </div>
        )}

        {/* Form */}
        <div className="collection-form__body">
          <div className="collection-form__field">
            <label>合集名称</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入合集名称"
              autoFocus
            />
          </div>

          <div className="collection-form__field">
            <label>合集简介</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="简要描述这个合集的主题和内容"
              rows={3}
            />
          </div>

          <div className="collection-form__field">
            <label>封面图链接</label>
            <div className="collection-form__cover-input">
              <input
                type="text"
                value={coverImage}
                onChange={(e) => setCoverImage(e.target.value)}
                placeholder="输入图片 URL，或留空使用默认"
              />
              {coverImage && (
                <button className="collection-form__cover-clear" onClick={() => setCoverImage("")}>
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* ─── 关联本地目录 ─── */}
          <div className="collection-form__field collection-form__folder-section">
            <label>
              <FolderInput size={13} />
              <span>关联本地目录</span>
            </label>

            {!linkedFolder ? (
              <button className="collection-form__folder-btn" onClick={handlePickFolder}>
                <FolderInput size={14} />
                选择目录…
              </button>
            ) : (
              <div className="collection-form__folder-info">
                <div className="collection-form__folder-path">
                  <span className="collection-form__folder-icon-wrap"><FolderOpen size={13} /></span>
                  <code>{linkedFolder}</code>
                  <button className="collection-form__folder-unlink" onClick={handleUnlink} title="取消关联">
                    <Unlink size={12} />
                  </button>
                </div>

                {/* 扫描状态 */}
                {scanning && (
                  <div className="collection-form__scan-status collection-form__scan-status--scanning">
                    <Loader2 size={13} className="collection-form__spinner" />
                    <span>正在扫描项目结构…</span>
                  </div>
                )}

                {scanError && (
                  <div className="collection-form__scan-status collection-form__scan-status--error">
                    <AlertCircle size={13} />
                    <span>{scanError}</span>
                    <button className="collection-form__scan-retry" onClick={handleRescan}>
                      重试
                    </button>
                  </div>
                )}

                {projectCtx && !scanning && !scanError && (
                  <>
                    <div className="collection-form__scan-status collection-form__scan-status--done">
                      <CheckCircle size={13} />
                      <span>扫描完成 — {buildProjectLabel(projectCtx)}</span>
                      <button className="collection-form__scan-retry" onClick={handleRescan} title="重新扫描">
                        <RefreshCw size={11} />
                      </button>
                    </div>
                    <div className="collection-form__project-langs">
                      {projectCtx.summary.languages.slice(0, 5).map((lang) => (
                        <span key={lang.language} className="collection-form__lang-tag">
                          {lang.language} ({lang.count})
                        </span>
                      ))}
                      {projectCtx.codegraphAvailable && (
                        <span className="collection-form__lang-tag collection-form__lang-tag--codegraph">
                          CodeGraph
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="collection-form__actions">
          <button className="collection-form__btn collection-form__btn--cancel" onClick={onClose}>
            取消
          </button>
          <button
            className="collection-form__btn collection-form__btn--save"
            onClick={handleSave}
            disabled={!title.trim()}
          >
            <Save size={14} />
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

export default CollectionFormModal;
