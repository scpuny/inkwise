import { useState, useEffect } from "react";
import { X, FolderOpen, Save } from "lucide-react";
import type { Collection } from "../lib/collections";

export function CollectionFormModal({
  collection,
  open,
  onSave,
  onClose,
}: {
  collection: Collection | null;
  open: boolean;
  onSave: (title: string, description: string, coverImage: string) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverImage, setCoverImage] = useState("");

  useEffect(() => {
    if (collection && open) {
      setTitle(collection.title || "");
      setDescription(collection.description || "");
      setCoverImage(collection.coverImage || "");
    } else if (!open) {
      setTitle("");
      setDescription("");
      setCoverImage("");
    }
  }, [collection, open]);

  const handleSave = () => {
    if (!title.trim()) return;
    onSave(title.trim(), description.trim(), coverImage.trim());
  };

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
