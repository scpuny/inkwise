// ProjectExplorer.tsx — 关联项目浏览：左文件树 + 右 AI 扫描会话
import { useState, useEffect, useCallback } from "react";
import { FolderInput, MessageSquare, Loader2, RotateCw, X, AlertTriangle } from "lucide-react";
import { ProjectFileTree } from "./ProjectFileTree";
import { useAppStore } from "../../store/appStore";
import {
  getStoredProjectInsights, getStoredProjectFileTree,
  storeProjectFileTree, getProjectContext,
} from "../../lib/storage/collections/projectContext";
import { loadCollections, type Collection } from "../../lib/storage/collections";
import { on } from "../../lib/events/eventBus";

export function ProjectExplorer() {
  const colId = useAppStore((s) => s.projectPanelColId);
  const setProjectPanelOpen = useAppStore((s) => s.setProjectPanelOpen);
  const [collection, setCollection] = useState<Collection | null>(null);
  const [fileTree, setFileTree] = useState<any[] | null>(null);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [treeLoading, setTreeLoading] = useState(false);
  const [insights, setInsights] = useState<string | null>(null);
  const [exploring, setExploring] = useState(false);

  // Load collection from storage
  useEffect(() => {
    if (!colId) return;
    loadCollections().then((cols) => {
      const col = cols.find((c) => c.id === colId) || null;
      setCollection(col);
    });
  }, [colId]);

  // Load file tree (from cache or Tauri) when collection is ready
  useEffect(() => {
    if (!colId || !collection?.linkedFolder) return;

    const cached = getStoredProjectFileTree(colId);
    setInsights(getStoredProjectInsights(colId));

    if (cached && cached.length > 0) {
      setFileTree(cached);
      return;
    }

    // No cache — try fetching from Tauri
    setTreeLoading(true);
    setTreeError(null);
    getProjectContext(collection.linkedFolder).then((ctx) => {
      if (ctx.structure && ctx.structure.length > 0) {
        storeProjectFileTree(colId, ctx.structure);
        setFileTree(ctx.structure);
      } else {
        setTreeError("项目扫描未返回目录数据，请点击 ⟳ 重新扫描");
      }
    }).catch((err) => {
      setTreeError("读取目录失败: " + (err.message || err));
    }).finally(() => setTreeLoading(false));
  }, [colId, collection?.linkedFolder]);

  // Listen for background exploration events
  useEffect(() => {
    if (!colId) return;
    setInsights(getStoredProjectInsights(colId));
    const unsub = on("project-exploring" as any, (ev: any) => {
      if (ev.collectionId !== colId) return;
      if (ev.status === "start") setExploring(true);
      else if (ev.status === "done" || ev.status === "error") {
        setExploring(false);
        setInsights(getStoredProjectInsights(colId));
      }
    });
    return () => unsub();
  }, [colId]);

  const handleRescan = useCallback(async () => {
    if (!collection?.linkedFolder || !colId) return;
    setExploring(true);
    setTreeLoading(true);
    setTreeError(null);
    try {
      const { linkCollectionFolder } = await import("../../lib/storage/collections");
      const ctx = await linkCollectionFolder(colId, collection.linkedFolder);
      if (ctx.structure && ctx.structure.length > 0) {
        setFileTree(ctx.structure);
      } else {
        setTreeError("项目扫描未返回目录数据");
      }
    } catch (err: any) {
      setTreeError("扫描失败: " + (err.message || err));
    } finally {
      setTreeLoading(false);
    }
    setTimeout(() => setInsights(getStoredProjectInsights(colId)), 500);
  }, [collection, colId]);

  if (!colId) return null;

  const projectName = collection?.linkedFolder
    ? collection.linkedFolder.split("/").pop() || collection.linkedFolder
    : "";

  return (
    <div className="project-explorer">
      <div className="project-explorer__header">
        <FolderInput size={14} />
        <span className="project-explorer__title">{projectName}</span>
        <button className="project-explorer__action" onClick={handleRescan} title="重新扫描" disabled={treeLoading || exploring}>
          <RotateCw size={12} className={treeLoading || exploring ? "spin" : ""} />
        </button>
        <button className="project-explorer__close" onClick={() => setProjectPanelOpen(false)} title="关闭">
          <X size={12} />
        </button>
      </div>
      <div className="project-explorer__body">
        <div className="project-explorer__tree">
          <div className="project-explorer__section-title"><span>目录结构</span></div>
          {treeLoading ? (
            <div className="project-explorer__loading"><Loader2 size={14} className="spin" /> 加载中…</div>
          ) : treeError ? (
            <div className="project-explorer__error">
              <AlertTriangle size={14} />
              <span>{treeError}</span>
            </div>
          ) : fileTree && fileTree.length > 0 ? (
            <ProjectFileTree nodes={fileTree} maxDepth={5} onSelect={() => {}} />
          ) : (
            <div className="project-explorer__empty">暂无目录数据</div>
          )}
        </div>
        <div className="project-explorer__chat">
          <div className="project-explorer__section-title">
            <MessageSquare size={13} />
            <span>AI 扫描分析</span>
          </div>
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
