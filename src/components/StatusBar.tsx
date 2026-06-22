import { useEffect, useState, useCallback, useRef } from "react";
import {
  Brain, Gauge, CircleDollarSign, FileText, Clock, Type, CheckCircle2,
} from "lucide-react";
import { getProvidersSync } from "../lib/providerModels";
import { getPhaseLabel } from "../lib/articleBlueprint";

export type SaveState = "idle" | "saving" | "saved";

export function StatusBar({ saveState: _saveState, phase }: { saveState?: SaveState; phase?: string }) {
  const saveState = _saveState || "idle";
  const [visibleSave, setVisibleSave] = useState<SaveState>("idle");
  const fadeTimer = useRef<any>(undefined);

  // Keep "saved" visible for longer, with fade
  useEffect(() => {
    if (_saveState === "saving") {
      setVisibleSave("saving");
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    } else if (_saveState === "saved") {
      setVisibleSave("saved");
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
      fadeTimer.current = setTimeout(() => setVisibleSave("idle"), 3000);
    } else if (_saveState === "idle") {
      // Only transition to idle if not currently saving/saved
      if (visibleSave !== "saving" && visibleSave !== "saved") {
        setVisibleSave("idle");
      }
    }
    return () => { if (fadeTimer.current) clearTimeout(fadeTimer.current); };
  }, [_saveState, visibleSave]);
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [paragraphCount, setParagraphCount] = useState(0);
  const [readTime, setReadTime] = useState("0分钟");
  const [modelName, setModelName] = useState("—");
  const [effort, setEffort] = useState("自动");
  const [hasDocs, setHasDocs] = useState(false);

  const updateStats = useCallback(() => {
    const editor = (window as any).editorInstance?.editor;
    if (!editor) {
      setWordCount(0); setCharCount(0); setParagraphCount(0);
      setReadTime("0分钟"); setHasDocs(false);
      return;
    }
    setHasDocs(true);
    const text = editor.getText();
    setCharCount(text.length);
    const cnChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const westernWords = text.replace(/[\u4e00-\u9fff]/g, " ").trim().split(/\s+/).filter(Boolean).length;
    const words = cnChars + westernWords;
    setWordCount(words);
    const html = editor.getHTML();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const paragraphs = doc.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li, blockquote");
    setParagraphCount(paragraphs.length);
    const readMinutes = Math.ceil(words / 300);
    setReadTime(readMinutes <= 0 ? "<1分钟" : `${readMinutes}分钟`);
  }, []);

  // Sync model/effort from AIBar via localStorage
  useEffect(() => {
    const updateModel = () => {
      const saved = typeof localStorage !== "undefined" ? localStorage.getItem("aiwriter-default-model") : null;
      if (saved) setModelName(saved);
      else {
        const providers = getProvidersSync();
        const enabled = providers.find((p) => p.enabled && p.models.length > 0);
        setModelName(enabled && enabled.models.length > 0 ? enabled.models[0] : "—");
      }
      try {
        const savedEffort = localStorage.getItem("aiwriter-effort");
        if (savedEffort) setEffort(savedEffort);
      } catch {}
    };
    updateModel();
    window.addEventListener("providers-changed", updateModel);
    return () => window.removeEventListener("providers-changed", updateModel);
  }, []);

  // Listen for editor content changes
  useEffect(() => {
    const editorEl = document.getElementById("editorMain");
    if (!editorEl) return;
    // Call once immediately (editor may already be ready)
    updateStats();
    const observer = new MutationObserver(() => updateStats());
    observer.observe(editorEl, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [updateStats]);

  const saveLabel = visibleSave === "saving" ? "保存中…" : visibleSave === "saved" ? "已保存" : "";

  return (
    <div className="statusbar">
      {/* Document stats — only show when article is open */}
      {hasDocs && (
        <span className="statusbar__group">
          <span className="statusbar__item stat">
            <Type size={11} />
            <span className="stat__label">字数</span>
            <b>{wordCount.toLocaleString()}</b>
          </span>
          <span className="statusbar__item stat">
            <span className="stat__label">字符</span>
            <b>{charCount.toLocaleString()}</b>
          </span>
          <span className="statusbar__item stat">
            <FileText size={11} />
            <span className="stat__label">段落</span>
            <b>{paragraphCount}</b>
          </span>
          <span className="statusbar__item stat">
            <Clock size={11} />
            <span className="stat__label">阅读</span>
            <b>{readTime}</b>
          </span>
        </span>
      )}

      {/* Save state */}
      {saveLabel && (
        <span className="statusbar__group">
          <span className="statusbar__item stat statusbar__save">
            <span className={`statusbar__save-dot statusbar__save-dot--${visibleSave}`} />
            <b>{saveLabel}</b>
          </span>
        </span>
      )}

      {/* Phase */}
      {phase && (
        <span className="statusbar__group">
          <span className="statusbar__item stat">
            <CheckCircle2 size={12} />
            <span className="stat__label">阶段</span>
            <b>{getPhaseLabel(phase as any) || phase}</b>
          </span>
        </span>
      )}

      {/* Model info */}
      <span className="statusbar__group">
        <span className="statusbar__item stat">
          <Brain size={12} />
          <span className="stat__label">模型</span>
          <b className="statusbar__model">{modelName}</b>
        </span>
        <span className="statusbar__item stat">
          <Gauge size={12} />
          <b>{effort}</b>
        </span>
      </span>

      {/* Status dot */}
      <span className="statusbar__group">
        <span className="statusbar__item statusbar__dot" />
        <span className="statusbar__item stat">
          <span className="stat__label">{hasDocs ? "就绪" : "空闲"}</span>
        </span>
      </span>
    </div>
  );
}
