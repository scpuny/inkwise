// ProjectExplorer.tsx — 项目浏览：左文件树 + 右 AI 分析（含实时扫描经过）
import { useState, useEffect, useRef, useCallback } from "react";
import { FolderInput, MessageSquare, Loader2, X, RotateCw, Square, FileText, List, Search } from "lucide-react";
import { ProjectFileTree } from "./ProjectFileTree";
import { usePanelStore } from "../../store/panelStore";
import {
  getStoredProjectFileTree, getStoredProjectInsights,
  storeProjectFileTree, exploreProjectForCollection,
  clearProjectFileTree, clearProjectInsights,
} from "../../lib/storage/collections/projectContext";
import { getProjectContext } from "../../lib/storage/collections";
import { loadCollections, type Collection } from "../../lib/storage/collections";
import { on, emit } from "../../lib/events/eventBus";
import type { EventBusMap } from "../../lib/events/events";
import { marked } from "marked";
import type { ToolEvent as AgentToolEvent } from "../../lib/ai/agentEngine";

// ─── 扫描进度日志条目 ───
interface LogEntry {
  id: number;
  icon: string;
  text: string;
  detail?: string;
  time: string;
}

let logId = 0;
function nextId() { return ++logId; }

function formatTime() {
  const d = new Date();
  return d.getHours().toString().padStart(2, "0") + ":" + d.getMinutes().toString().padStart(2, "0") + ":" + d.getSeconds().toString().padStart(2, "0");
}

function toolEventToLogEntries(ev: AgentToolEvent): LogEntry[] {
  const t = formatTime();
  const entries: LogEntry[] = [];

  switch (ev.type) {
    case "thinking":
      // Show AI's thinking as a collapsible thought
      const thought = ev.arguments || ev.summary || "";
      if (thought) {
        entries.push({ id: nextId(), icon: "🧠", text: "AI 正在分析…", detail: thought.slice(0, 500), time: t });
      }
      break;
    case "thinking_done":
      break; // skip — we already have the thinking entry
    case "tool_start": {
      let icon = "🔧";
      let text = "执行: " + ev.toolName;
      if (ev.toolName === "read_project_files") {
        icon = "📖";
        try {
          const args = JSON.parse(ev.arguments);
          const paths = args.paths || [];
          text = "读取 " + paths.length + " 个文件: " + paths.join(", ");
        } catch { text = "读取文件"; }
      } else if (ev.toolName === "list_project_files") {
        icon = "📂";
        try {
          const args = JSON.parse(ev.arguments);
          text = "列出目录: " + (args.path || "根目录");
        } catch { text = "列出目录"; }
      } else if (ev.toolName === "search_project_files") {
        icon = "🔍";
        try {
          const args = JSON.parse(ev.arguments);
          text = "搜索文件: " + args.query;
        } catch { text = "搜索文件"; }
      }
      entries.push({ id: nextId(), icon, text, time: t });
      break;
    }
    case "tool_end": {
      const icon = ev.result && ev.result.startsWith("错误") ? "⚠️" : "✅";
      entries.push({ id: nextId(), icon, text: ev.summary || "完成", time: t });
      break;
    }
    case "error":
      entries.push({ id: nextId(), icon: "❌", text: ev.summary || "扫描出错", detail: ev.result, time: t });
      break;
  }
  return entries;
}

export function ProjectExplorer() {
  const colId = usePanelStore((s) => s.projectPanelColId);
  const setProjectPanelOpen = usePanelStore((s) => s.setProjectPanelOpen);
  const setSeriesPlannerOpen = usePanelStore((s) => s.setSeriesPlannerOpen);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tree, setTree] = useState<any[] | null>(null);
  const [insights, setInsights] = useState<string | null>(null);
  const [exploring, setExploring] = useState(false);
  const [col, setCol] = useState<Collection | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logCollapsed, setLogCollapsed] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll log to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Reset states when col changes, then load collection
  useEffect(() => {
    if (!colId) return;
    setExploring(false);
    setInsights(null);
    setLogs([]);
    setError(null);
    const cachedInsights = getStoredProjectInsights(colId);
    setInsights(cachedInsights);
    loadCollections().then((cols) => {
      const found = cols.find((c) => c.id === colId) || null;
      setCol(found);
      // Auto-trigger AI exploration if folder linked and no insights yet
      if (found?.linkedFolder && !cachedInsights) {
        startScan(colId, found.linkedFolder);
      }
    });
  }, [colId]);

  // 监听 rescanned 事件 → 清缓存 + 重新加载文件树
  useEffect(() => {
    if (!colId) return;
    const unsub = on("collections-changed", () => {
      clearProjectFileTree(colId);
      if (col?.linkedFolder) {
        setLoading(true);
        getProjectContext(col.linkedFolder)
          .then((ctx) => {
            if (ctx.structure && ctx.structure.length > 0) {
              storeProjectFileTree(colId, ctx.structure);
              setTree(ctx.structure);
            }
          })
          .catch(() => {})
          .finally(() => setLoading(false));
      }
    });
    return unsub;
  }, [colId, col?.linkedFolder]);

  // Load file tree
  useEffect(() => {
    if (!colId || !col?.linkedFolder) return;
    const cached = getStoredProjectFileTree(colId);
    if (cached && cached.length > 0) { setTree(cached); setLoading(false); return; }
    getProjectContext(col.linkedFolder)
      .then((ctx) => {
        if (ctx.structure && ctx.structure.length > 0) {
          storeProjectFileTree(colId, ctx.structure);
          setTree(ctx.structure);
        } else {
          setError("扫描未返回数据");
        }
      })
      .catch((e) => setError(e.message || String(e)))
      .finally(() => setLoading(false));
  }, [colId, col?.linkedFolder]);

  // Listen for AI exploration events
  useEffect(() => {
    if (!colId) return;
    const unsub = on("project-exploring", (detail) => {
      if (!detail || detail.collectionId !== colId) return;
      if (detail.status === "start") {
        setExploring(true);
        setLogs([{ id: nextId(), icon: "🚀", text: "开始 AI 扫描分析…", time: formatTime() }]);
        setInsights(null);
      } else if (detail.status === "progress") {
        setLogs((prev) => [...prev, ...toolEventToLogEntries(detail.toolEvent)]);
      } else if (detail.status === "done") {
        setExploring(false);
        abortRef.current = null;
        setLogs((prev) => [...prev, { id: nextId(), icon: "🎉", text: "扫描分析完成", time: formatTime() }]);
        setInsights(getStoredProjectInsights(colId));
        setLogCollapsed(true);
      } else if (detail.status === "error") {
        setExploring(false);
        abortRef.current = null;
        setLogs((prev) => [...prev, { id: nextId(), icon: "❌", text: "扫描失败: " + (detail.message || "未知错误"), time: formatTime() }]);
      }
    });
    return () => unsub();
  }, [colId]);

  const startScan = useCallback(async (id: string, folder: string) => {
    // Cancel previous scan if still running
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;
    exploreProjectForCollection(id, folder, controller.signal).catch(() => {});
  }, []);

  const handleRescan = useCallback(() => {
    if (!colId || !col?.linkedFolder) return;
    setLogs([]);
    setLogCollapsed(false);
    clearProjectInsights(colId);
    startScan(colId, col.linkedFolder);
  }, [colId, col, startScan]);

  const handleStop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setExploring(false);
    setLogs((prev) => [...prev, { id: nextId(), icon: "⏹️", text: "扫描已停止", time: formatTime() }]);
  }, []);

  const handlePlanSeries = useCallback(() => {
    if (colId) {
      emit("plan-series", { collectionId: colId });
      setSeriesPlannerOpen(true);
    }
  }, [colId, setSeriesPlannerOpen]);

  const getToolIcon = (icon: string) => {
    switch (icon) {
      case "📖": return <FileText size={11} />;
      case "📂": return <List size={11} />;
      case "🔍": return <Search size={11} />;
      default: return null;
    }
  };

  if (!colId) return null;
  return (
    <div className="project-explorer">
      <div className="project-explorer__header">
        <FolderInput size={14} className="project-explorer__header-icon" />
        <div className="project-explorer__title-wrap">
          <span className="project-explorer__title">{col?.title || "项目"}</span>
          {col?.linkedFolder && <span className="project-explorer__subtitle">{col.linkedFolder.split("/").pop()}</span>}
        </div>
        <button className="project-explorer__close" onClick={() => setProjectPanelOpen(false)} title="关闭"><X size={12} /></button>
      </div>
      {/* ── Toolbar ── */}
      <div className="project-explorer__toolbar">
        <button className="project-explorer__toolbar-btn" onClick={handleRescan} disabled={exploring} title="重新扫描">
          <RotateCw size={12} className={exploring ? "" : ""} />
          重新扫描
        </button>
        <button className="project-explorer__toolbar-btn project-explorer__toolbar-btn--stop" onClick={handleStop} disabled={!exploring} title="停止扫描">
          <Square size={10} />
          停止
        </button>
        <button className="project-explorer__toolbar-btn" onClick={handlePlanSeries} title="规划系列文章">
          <FileText size={11} />
          规划系列
        </button>
      </div>
      <div className="project-explorer__body">
        <div className="project-explorer__tree">
          <div className="project-explorer__section-title">目录结构</div>
          {loading ? <div className="project-explorer__loading"><Loader2 size={14} className="spin" /> 加载中…</div>
          : error ? <div className="project-explorer__error">{error}</div>
          : tree && tree.length > 0 ? <ProjectFileTree nodes={tree} maxDepth={5} onSelect={() => {}} />
          : <div className="project-explorer__empty">暂无目录数据</div>}
        </div>
        <div className="project-explorer__chat">
          <div className="project-explorer__section-title">
            <MessageSquare size={13} />
            {exploring ? "AI 扫描分析中…" : insights ? "AI 扫描分析" : "扫描结果"}
            {exploring && <Loader2 size={11} className="spin" style={{ marginLeft: 6 }} />}
          </div>
          <div className="project-explorer__chat-body">
            {/* ── Progress log (collapsible) ── */}
            {logs.length > 0 && (
              <div className="project-explorer__log-wrap">
                <button className="project-explorer__log-toggle" onClick={() => setLogCollapsed(!logCollapsed)}>
                  <span className={"project-explorer__log-toggle-arrow" + (logCollapsed ? "" : " project-explorer__log-toggle-arrow--open")}>{">"}</span>
                  <span>扫描经过 ({logs.length})</span>
                </button>
                {!logCollapsed && (
                  <div className="project-explorer__log">
                    {logs.map((entry) => (
                      <div key={entry.id} className="project-explorer__log-entry" title={entry.detail || entry.text}>
                        <span className="project-explorer__log-icon">{entry.icon}</span>
                        <span className="project-explorer__log-text">{entry.text}</span>
                        <span className="project-explorer__log-time">{entry.time}</span>
                      </div>
                    ))}
                    <div ref={logEndRef} />
                  </div>
                )}
              </div>
            )}
            {/* ── Insights (when scan done) ── */}
            {!exploring && insights && (
              <div className="project-explorer__insights" dangerouslySetInnerHTML={{ __html: marked.parse(insights) as string }} />
            )}
            {/* ── Empty / idle state ── */}
            {!exploring && !insights && logs.length === 0 && (
              <div className="project-explorer__empty">等待扫描…</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
export default ProjectExplorer;
