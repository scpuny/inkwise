import { ArrowLeft, Send, Monitor, Smartphone, Copy, Check, ChevronDown } from "lucide-react";
import { useState, useCallback, useRef, useEffect } from "react";

interface FinalTopBarProps {
  title: string;
  onBackToEdit: () => void;
  onPublish: () => void;
  onCopyHtml: () => Promise<boolean>;
  onCopyWechatHtml: () => Promise<boolean>;
  hasUnpublished: boolean;
  previewMode: "desktop" | "mobile";
  onPreviewModeChange: (mode: "desktop" | "mobile") => void;
}

type CopyMode = "wechat" | "html";

export function FinalTopBar({ title, onBackToEdit, onPublish, onCopyHtml, onCopyWechatHtml, hasUnpublished, previewMode, onPreviewModeChange }: FinalTopBarProps) {
  const [copied, setCopied] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copyMode, setCopyMode] = useState<CopyMode>("wechat");
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleCopy = useCallback(async () => {
    setCopied(true);
    setDropdownOpen(false);
    try {
      const ok = copyMode === "wechat" ? await onCopyWechatHtml() : await onCopyHtml();
      if (!ok) { setCopied(false); return; }
    } catch { setCopied(false); return; }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 3000);
  }, [copyMode, onCopyHtml, onCopyWechatHtml]);

  // 点击下拉外部区域关闭
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
    };
  }, [dropdownOpen]);

  const selectMode = useCallback((mode: CopyMode) => {
    setCopyMode(mode);
    setDropdownOpen(false);
  }, []);

  const modeLabel = copyMode === "wechat" ? "公众号格式" : "HTML 格式";

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
        <div className="final-topbar__copy-group" ref={dropdownRef}>
          <button
            type="button"
            className="btn btn--small final-topbar__copy-btn"
            onClick={handleCopy}
            title="复制"
            style={copied ? { color: "var(--green, #2da44e)" } : undefined}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? "已复制" : modeLabel}</span>
          </button>
          <button
            type="button"
            className="btn btn--small final-topbar__copy-arrow"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            title="选择复制格式"
          >
            <ChevronDown size={12} />
          </button>
          {dropdownOpen && (
            <div className="final-topbar__copy-dropdown">
              <button
                type="button"
                className={`final-topbar__copy-option${copyMode === "wechat" ? " final-topbar__copy-option--active" : ""}`}
                onClick={() => selectMode("wechat")}
              >
                公众号格式
              </button>
              <button
                type="button"
                className={`final-topbar__copy-option${copyMode === "html" ? " final-topbar__copy-option--active" : ""}`}
                onClick={() => selectMode("html")}
              >
                HTML 格式
              </button>
            </div>
          )}
        </div>
        <button type="button" className={`btn btn--small${hasUnpublished ? " btn--primary" : ""}`} onClick={onPublish}>
          <Send size={16} />
          <span>发布</span>
        </button>
      </div>
    </div>
  );
}
