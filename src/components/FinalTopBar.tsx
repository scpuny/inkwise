import { ArrowLeft, Send, Monitor, Smartphone, Copy } from "lucide-react";

interface FinalTopBarProps {
  title: string;
  onBackToEdit: () => void;
  onPublish: () => void;
  onCopyHtml: () => void;
  hasUnpublished: boolean;
  previewMode: "desktop" | "mobile";
  onPreviewModeChange: (mode: "desktop" | "mobile") => void;
}

export function FinalTopBar({ title, onBackToEdit, onPublish, onCopyHtml, hasUnpublished, previewMode, onPreviewModeChange }: FinalTopBarProps) {
  return (
    <div className="final-topbar">
      <div className="final-topbar__left">
        <button type="button" className="btn btn--small" onClick={onBackToEdit} title="返回编辑">
          <ArrowLeft size={16} />
          <span>返回编辑</span>
        </button>
        <span className="final-topbar__title">{title}</span>
      </div>
      <div className="final-topbar__right">
        <div className="final-topbar__preview-toggle" role="group" aria-label="预览模式">
          <button
            type="button"
            className={`final-topbar__mode-btn${previewMode === "desktop" ? " final-topbar__mode-btn--active" : ""}`}
            onClick={() => onPreviewModeChange("desktop")}
            title="桌面预览"
          >
            <Monitor size={14} />
          </button>
          <button
            type="button"
            className={`final-topbar__mode-btn${previewMode === "mobile" ? " final-topbar__mode-btn--active" : ""}`}
            onClick={() => onPreviewModeChange("mobile")}
            title="手机预览"
          >
            <Smartphone size={14} />
          </button>
        </div>
        <button type="button" className="btn btn--small" onClick={onCopyHtml} title="复制为HTML">
          <Copy size={14} />
          <span>复制HTML</span>
        </button>
        <button type="button" className={`btn btn--small${hasUnpublished ? " btn--primary" : ""}`} onClick={onPublish}>
          <Send size={16} />
          <span>发布</span>
        </button>
      </div>
    </div>
  );
}
