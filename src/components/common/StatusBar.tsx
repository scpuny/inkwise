import { useEffect, useState, useCallback, useRef } from "react";
import { on } from "../../lib/events/eventBus";
import {
  Brain, Gauge, FileText, Clock, Type, CheckCircle2, Loader2, Check, AlertCircle, ChevronUp, ChevronDown,
} from "lucide-react";

export type SaveState = "idle" | "saving" | "saved" | "error";

export function StatusBar({ saveState: _saveState, phase }: { saveState?: SaveState; phase?: string }) {
  const saveState = _saveState || "idle";
  const [visibleSave, setVisibleSave] = useState<SaveState>("idle");
  const fadeTimer = useRef<any>(undefined);
  const [expanded, setExpanded] = useState(false);
  const [isReady, setIsReady] = useState(false);

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
      if (visibleSave !== "saving" && visibleSave !== "saved") {
        setVisibleSave("idle");
      }
    }
    return () => { if (fadeTimer.current) clearTimeout(fadeTimer.current); };
  }, [_saveState, visibleSave]);

  const [wordCount, setWordCount] = useState(0);
  const [extraStats, setExtraStats] = useState({ charCount: 0, paragraphCount: 0, readTime: "0分钟" });
  const [modelName, setModelName] = useState("—");
  const [effort, setEffort] = useState("自动");
  const [targetWordCount, setTargetWordCount] = useState(0);
  const [exploringStatus, setExploringStatus] = useState<any>(null);

  const updateStats = useCallback(() => {
    const editor = (window as any).editorInstance?.editor;
    if (!editor) {
      setWordCount(0);
      setExtraStats({ charCount: 0, paragraphCount: 0, readTime: "0分钟" });
      setIsReady(false);
      return;
    }
    setIsReady(true);
    const text = editor.getText();
    const cnChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) || []).length;
    const westernWords = (text.match(/[a-zA-Z]+/g) || []).length;
    const words = cnChars + westernWords;
    setWordCount(words);
    setTargetWordCount((window as any).__blueprintTarget || 0);
    const html = editor.getHTML();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const paragraphs = doc.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li, blockquote");
    const readMinutes = Math.ceil(words / 300);
    setExtraStats({
      charCount: text.length,
      paragraphCount: paragraphs.length,
      readTime: readMinutes <= 0 ? "<1分钟" : `${readMinutes}分钟`,
    });
  }, []);

  // Sync model/effort from localStorage
  useEffect(() => {
    const updateModel = () => {
      const saved = typeof localStorage !== "undefined" ? localStorage.getItem("inkwise-default-model") : null;
      if (saved) { setModelName(saved); return; }
      try {
        const raw = localStorage.getItem("inkwise-providers");
        if (raw) {
          const providers = JSON.parse(raw);
          const enabled = providers.find((p: any) => p.enabled && p.models?.length > 0);
          setModelName(enabled?.models?.[0]?.id ?? "—");
        }
      } catch { setModelName("—"); }
      try {
        const savedEffort = localStorage.getItem("inkwise-effort");
        if (savedEffort) setEffort(savedEffort);
      } catch {}
    };
    updateModel();
    const off = on("providers-changed", updateModel);
    return off;
  }, []);

  // Listen for project exploration status
  useEffect(() => {
    const off = on("project-exploring" as any, (ev: any) => {
      setExploringStatus(ev);
      if (ev.status === "done" || ev.status === "error") {
        setTimeout(() => setExploringStatus(null), ev.status === "error" ? 8000 : 4000);
      }
    });
    return off;
  }, []);

  // Listen for editor content changes via MutationObserver
  useEffect(() => {
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

    if (!attachObserver()) {
      checkTimer = setInterval(() => {
        if (attachObserver()) {
          clearInterval(checkTimer);
          checkTimer = null;
        }
      }, 500);
    }

    const onReady = () => { updateStats(); };
    const disposeReady = on("editor-ready", onReady);

    const healthTimer = setInterval(() => {
      if (!(window as any).editorInstance?.editor) {
        setWordCount(0);
        setExtraStats({ charCount: 0, paragraphCount: 0, readTime: "0分钟" });
        setIsReady(false);
        setTargetWordCount(0);
      }
    }, 1000);

    return () => {
      if (observer) observer.disconnect();
      if (checkTimer) clearTimeout(checkTimer);
      clearInterval(healthTimer);
      disposeReady();
    };
  }, [updateStats]);

  const saveLabel =
    visibleSave === "saving" ? "保存中…" :
    visibleSave === "saved" ? "已保存" : "";

  return (
    <div className="statusbar">
      {/* Toggle expand/collapse button */}
      {isReady && (
        <button
          className="statusbar__toggle"
          onClick={() => setExpanded(!expanded)}
          title={expanded ? "收起详细统计" : "展开详细统计"}
          aria-label={expanded ? "收起详细统计" : "展开详细统计"}
        >
          {expanded ? <ChevronDown size={10} /> : <ChevronUp size={10} />}
        </button>
      )}

      {/* Always visible: word count */}
      {isReady && (
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
              </span>
            )}
          </span>
        </span>
      )}

      {/* Save state */}
      {(saveLabel || visibleSave !== "idle") && (
        <span className="statusbar__group">
          <span className="statusbar__item stat statusbar__save">
            <span className={`statusbar__save-dot statusbar__save-dot--${visibleSave}`} />
            <b>{saveLabel || "已保存"}</b>
          </span>
        </span>
      )}

      {/* Model name */}
      <span className="statusbar__group">
        <span className="statusbar__item stat">
          <Brain size={12} />
          <b className="statusbar__model">{modelName}</b>
        </span>
      </span>

      {/* ============ Expanded extra stats ============ */}
      {expanded && isReady && (
        <>
          <span className="statusbar__group">
            <span className="statusbar__item stat">
              <span className="stat__label">字符</span>
              <b>{extraStats.charCount.toLocaleString()}</b>
            </span>
            <span className="statusbar__item stat">
              <FileText size={11} />
              <span className="stat__label">段落</span>
              <b>{extraStats.paragraphCount}</b>
            </span>
            <span className="statusbar__item stat">
              <Clock size={11} />
              <span className="stat__label">阅读</span>
              <b>{extraStats.readTime}</b>
            </span>
          </span>

          {/* Effort */}
          <span className="statusbar__group">
            <span className="statusbar__item stat">
              <Gauge size={12} />
              <b>{effort}</b>
            </span>
          </span>

          {/* Phase */}
          {phase && (
            <span className="statusbar__group">
              <span className="statusbar__item stat">
                <CheckCircle2 size={12} />
                <span className="stat__label">{phase}</span>
              </span>
            </span>
          )}
        </>
      )}

      {/* Exploring status — always show when active */}
      {exploringStatus && (
        <span className="statusbar__group">
          {exploringStatus.status === "start" || exploringStatus.status === "progress" ? (
            <span className="statusbar__item stat">
              <Loader2 size={12} className="statusbar__spinner" />
              <b>分析中</b>
            </span>
          ) : exploringStatus.status === "done" ? (
            <span className="statusbar__item stat">
              <Check size={12} style={{color:"var(--ok)"}} />
              <b>已就绪</b>
            </span>
          ) : exploringStatus.status === "error" ? (
            <span className="statusbar__item stat">
              <AlertCircle size={12} style={{color:"var(--err)"}} />
              <b>错误</b>
            </span>
          ) : null}
        </span>
      )}

      {/* Spacer to push dot to right */}
      <span style={{ flex: 1, minWidth: 0 }} />

      {/* Status dot */}
      <span className="statusbar__group">
        <span
          className={
            "statusbar__item statusbar__dot" +
            (exploringStatus?.status === "start" || exploringStatus?.status === "progress"
              ? " statusbar__dot--busy" : "")
          }
        />
      </span>
    </div>
  );
}
