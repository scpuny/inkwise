import { ArrowLeft, Send, Monitor, Smartphone, Copy, Check } from "lucide-react";
import { useState, useCallback, useRef } from "react";

interface FinalTopBarProps {
  title: string;
  onBackToEdit: () => void;
  onPublish: () => void;
  onCopyHtml: () => Promise<boolean>;
  hasUnpublished: boolean;
  previewMode: "desktop" | "mobile";
  onPreviewModeChange: (mode: "desktop" | "mobile") => void;
}

export function FinalTopBar({ title, onBackToEdit, onPublish, onCopyHtml, hasUnpublished, previewMode, onPreviewModeChange }: FinalTopBarProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleCopy = useCallback(async () => {
    setCopied(true);
    try {
      const ok = await onCopyHtml();
      if (!ok) {
        setCopied(false);
        return;
      }
    } catch {
      setCopied(false);
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 3000);
  }, [onCopyHtml]);

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
        <button
          type="button"
          className="btn btn--small"
          onClick={handleCopy}
          title="复制"
          style={copied ? { color: "var(--green, #2da44e)" } : undefined}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          <span>复制</span>
        </button>
        <button type="button" className={`btn btn--small${hasUnpublished ? " btn--primary" : ""}`} onClick={onPublish}>
          <Send size={16} />
          <span>发布</span>
        </button>
      </div>
    </div>
  );
}
