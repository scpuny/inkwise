// ProjectExplorer.tsx — 项目浏览：左文件树 + 右 AI 分析
import { useState, useEffect } from "react";
import { FolderInput, MessageSquare, Loader2, X } from "lucide-react";
import { ProjectFileTree } from "./ProjectFileTree";
import { useAppStore } from "../../store/appStore";
import {
  getStoredProjectFileTree, getStoredProjectInsights,
  storeProjectFileTree, exploreProjectForCollection,
} from "../../lib/storage/collections/projectContext";
import { getProjectContext } from "../../lib/storage/collections";
import { loadCollections, type Collection } from "../../lib/storage/collections";
import { on } from "../../lib/events/eventBus";

export function ProjectExplorer() {
  const colId = useAppStore((s) => s.projectPanelColId);
  const setProjectPanelOpen = useAppStore((s) => s.setProjectPanelOpen);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tree, setTree] = useState<any[] | null>(null);
  const [insights, setInsights] = useState<string | null>(null);
  const [exploring, setExploring] = useState(false);
  const [col, setCol] = useState<Collection | null>(null);

  // Load collection
  useEffect(() => {
    if (!colId) return;
    const cachedInsights = getStoredProjectInsights(colId);
    setInsights(cachedInsights);
    loadCollections().then((cols) => {
      const found = cols.find((c) => c.id === colId) || null;
      setCol(found);
      // Auto-trigger AI exploration if folder linked and no insights yet
      if (found?.linkedFolder && !cachedInsights) {
        exploreProjectForCollection(colId, found.linkedFolder);
      }
    });
  }, [colId]);

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
    const unsub = on("project-exploring" as any, (ev: any) => {
      if (ev.collectionId !== colId) return;
      if (ev.status === "start") {
        setExploring(true);
      } else if (ev.status === "done" || ev.status === "error") {
        setExploring(false);
        setInsights(getStoredProjectInsights(colId));
      }
    });
    return () => unsub();
  }, [colId]);

  if (!colId) return null;
  return (
    <div className="project-explorer">
      <div className="project-explorer__header">
        <FolderInput size={14} />
        <div className="project-explorer__title-wrap">
          <span className="project-explorer__title">{col?.title || "项目"}</span>
          {col?.linkedFolder && <span className="project-explorer__subtitle">{col.linkedFolder.split("/").pop()}</span>}
        </div>
        <button className="project-explorer__close" onClick={() => setProjectPanelOpen(false)} title="关闭"><X size={12} /></button>
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
          <div className="project-explorer__section-title"><MessageSquare size={13} /> AI 扫描分析</div>
          <div className="project-explorer__chat-body">
            {exploring ? (
              <div className="project-explorer__exploring">
                <Loader2 size={16} className="spin" />
                <span>正在分析项目结构…</span>
              </div>
            ) : insights ? (
              <div className="project-explorer__insights">{insights}</div>
            ) : (
              <div className="project-explorer__empty">等待扫描…</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
export default ProjectExplorer;
