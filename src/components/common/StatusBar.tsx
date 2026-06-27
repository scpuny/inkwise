import { useEffect, useState, useCallback, useRef } from "react";
import { on } from "../../lib/events/eventBus";
import {
  Brain, Gauge, CircleDollarSign, FileText, Clock, Type, CheckCircle2, Loader2, Check, AlertCircle,
} from "lucide-react";
import { getProvidersSync } from "../../lib/storage/providerModels";
import { getPhaseLabel } from "../../lib/ai/articleBlueprint";

export type SaveState = "idle" | "saving" | "saved" | "error";

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
  const [targetWordCount, setTargetWordCount] = useState(0);
  const [exploringStatus, setExploringStatus] = useState<any>(null);

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
    // 统一字数统计逻辑 (与 text.ts 保持一致)
    const cnChars = (text.match(/[一-鿿㐀-䶿豈-﫿]/g) || []).length;
    const westernWords = (text.match(/[a-zA-Z]+/g) || []).length;
    const words = cnChars + westernWords;
    setWordCount(words);
    setTargetWordCount((window as any).__blueprintTarget || 0);
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
      const saved = typeof localStorage !== "undefined" ? localStorage.getItem("inkwise-default-model") : null;
      if (saved) setModelName(saved);
      else {
        const providers = getProvidersSync();
        const enabled = providers.find((p) => p.enabled && p.models.length > 0);
        setModelName(enabled && enabled.models.length > 0 ? enabled.models[0] : "—");
      }
      try {
        const savedEffort = localStorage.getItem("inkwise-effort");
        if (savedEffort) setEffort(savedEffort);
      } catch {}
    };
    updateModel();
    return on("providers-changed", updateModel);
  }, []);

  // Listen for project exploration status (from linkCollectionFolder background analysis)
  useEffect(() => {
    const dispose = on("project-exploring" as any, (ev: any) => {
      if (ev.status === "done" || ev.status === "error") {
        // Clear after a delay
        setTimeout(() => setExploringStatus(null), ev.status === "error" ? 8000 : 4000);
      }
      setExploringStatus(ev);
    });
    return dispose;
  }, []);

  // Listen for editor content changes
  useEffect(() => {
    // Try to attach observer to editor element immediately
    let observer: MutationObserver | null = null;
    let checkTimer: any = null;
    
    const attachObserver = () => {
      const editorEl = document.getElementById("editorMain");
      if (!editorEl) return false;
      updateStats();
      observer = new MutationObserver(() => updateStats());
      observer.observe(editorEl, { childList: true, subtree: true, characterData: true });
      return true;
    };
    
    // Try immediately
    if (!attachObserver()) {
      // Editor not mounted yet — poll until it appears
      checkTimer = setInterval(() => {
        if (attachObserver()) {
          clearInterval(checkTimer);
          checkTimer = null;
        }
      }, 500);
    }
    
    // Also listen for editor-ready event
    const onReady = () => { updateStats(); };
    const disposeReady = on("editor-ready", onReady);
    
    // Periodic check: editor might have been closed — reset stats
    const healthTimer = setInterval(() => {
      if (!(window as any).editorInstance?.editor) {
        setWordCount(0); setCharCount(0); setParagraphCount(0);
        setReadTime("0分钟"); setHasDocs(false);
        setTargetWordCount(0);
      }
    }, 1000);
    
    return () => {
      if (observer) observer.disconnect();
      if (checkTimer) clearInterval(checkTimer);
      clearInterval(healthTimer);
      disposeReady();
    };
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
            {targetWordCount > 0 && (
              <span className="stat__progress">
                <span className="stat__progress-bar">
                  <span className="stat__progress-fill" style={{ width: Math.min(100, (wordCount / targetWordCount) * 100) + '%' }} />
                </span>
                <span className="stat__progress-text">{Math.min(100, Math.round((wordCount / targetWordCount) * 100))}%</span>
              </span>
            )}
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

      {/* Project exploration status */}
      {exploringStatus && exploringStatus.status === "start" && (
        <span className="statusbar__group">
          <span className="statusbar__item stat">
            <Loader2 size={12} className="statusbar__spinner" />
            <b>正在分析项目结构…</b>
          </span>
        </span>
      )}
      {exploringStatus && exploringStatus.status === "progress" && (
        <span className="statusbar__group">
          <span className="statusbar__item stat">
            <Loader2 size={12} className="statusbar__spinner" />
            <b>{exploringStatus.toolEvent?.summary ? "分析中: " + exploringStatus.toolEvent.summary.slice(0, 40) : "正在分析项目结构…"}</b>
          </span>
        </span>
      )}
      {exploringStatus && exploringStatus.status === "done" && (
        <span className="statusbar__group">
          <span className="statusbar__item stat">
            <Check size={12} style={{color:"var(--ok)"}} />
            <b>项目分析完成</b>
          </span>
        </span>
      )}
      {exploringStatus && exploringStatus.status === "error" && (
        <span className="statusbar__group">
          <span className="statusbar__item stat">
            <AlertCircle size={12} style={{color:"var(--err)"}} />
            <b>项目分析失败: {exploringStatus.message || "未知错误"}</b>
          </span>
        </span>
      )}

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
