// ProjectExplorer.tsx — 项目浏览：左文件树 + 右 AI 分析
import { useState, useEffect, useCallback } from "react";
import { FolderInput, MessageSquare, Loader2, RotateCw, X } from "lucide-react";
import { ProjectFileTree } from "./ProjectFileTree";
import { useAppStore } from "../../store/appStore";
import { getStoredProjectFileTree, getStoredProjectInsights, storeProjectFileTree } from "../../lib/storage/collections/projectContext";
import { getProjectContext } from "../../lib/storage/collections";
import { loadCollections, type Collection } from "../../lib/storage/collections";

export function ProjectExplorer() {
  const colId = useAppStore((s) => s.projectPanelColId);
  const setProjectPanelOpen = useAppStore((s) => s.setProjectPanelOpen);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tree, setTree] = useState<any[] | null>(null);
  const [insights, setInsights] = useState<string | null>(null);
  const [col, setCol] = useState<Collection | null>(null);

  useEffect(() => {
    if (!colId) return;
    loadCollections().then((cols) => setCol(cols.find((c) => c.id === colId) || null));
  }, [colId]);

  useEffect(() => {
    if (!colId || !col?.linkedFolder) return;
    setInsights(getStoredProjectInsights(colId));
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

  if (!colId) return null;
  return (
    <div className="project-explorer">
      <div className="project-explorer__header">
        <FolderInput size={14} />
        <span className="project-explorer__title">{col?.linkedFolder?.split("/").pop() || "项目目录"}</span>
        <button className="project-explorer__close" onClick={() => setProjectPanelOpen(false)}><X size={12} /></button>
      </div>
      <div className="project-explorer__body">
        <div className="project-explorer__tree">
          <div className="project-explorer__section-title">目录结构</div>
          {loading ? <div className="project-explorer__loading"><Loader2 size={14} className="spin" /></div>
          : error ? <div className="project-explorer__error">{error}</div>
          : tree && tree.length > 0 ? <ProjectFileTree nodes={tree} maxDepth={5} onSelect={() => {}} />
          : <div className="project-explorer__empty">暂无数据</div>}
        </div>
        <div className="project-explorer__chat">
          <div className="project-explorer__section-title"><MessageSquare size={13} /> AI 扫描分析</div>
          <div className="project-explorer__chat-body">
            {insights ? <div className="project-explorer__insights">{insights}</div>
            : <div className="project-explorer__empty">等待扫描…</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
export default ProjectExplorer;
