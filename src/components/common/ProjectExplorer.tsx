// ProjectExplorer.tsx — 关联项目浏览：左文件树 + 右 AI 扫描会话
import { useState, useEffect, useCallback } from "react";
import { FolderInput, MessageSquare, Loader2, RotateCw, X } from "lucide-react";
import { ProjectFileTree } from "./ProjectFileTree";
import { useAppStore } from "../../store/appStore";
import { getStoredProjectInsights } from "../../lib/storage/collections/projectContext";
import { loadCollections, rescanProjectFolder, type Collection } from "../../lib/storage/collections";
import { on } from "../../lib/events/eventBus";

export function ProjectExplorer() {
  const colId = useAppStore((s) => s.projectPanelColId);
  const setProjectPanelOpen = useAppStore((s) => s.setProjectPanelOpen);
  const [collection, setCollection] = useState<Collection | null>(null);
  const [insights, setInsights] = useState<string | null>(null);
  const [exploring, setExploring] = useState(false);

  useEffect(() => {
    if (!colId) return;
    loadCollections().then((cols) => {
      const col = cols.find((c) => c.id === colId) || null;
      setCollection(col);
    });
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
    await rescanProjectFolder(collection.linkedFolder);
    // Trigger re-exploration by calling linkCollectionFolder again
    const { linkCollectionFolder } = await import("../../lib/storage/collections");
    await linkCollectionFolder(colId, collection.linkedFolder);
    // Wait a bit then refresh
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
        <button className="project-explorer__action" onClick={handleRescan} title="重新扫描" disabled={exploring}>
          <RotateCw size={12} className={exploring ? "spin" : ""} />
        </button>
        <button className="project-explorer__close" onClick={() => setProjectPanelOpen(false)} title="关闭">
          <X size={12} />
        </button>
      </div>
      <div className="project-explorer__body">
        <div className="project-explorer__tree">
          <div className="project-explorer__section-title"><span>目录结构</span></div>
          {collection?.linkedFolder ? (
            <ProjectFileTreeWrapper path={collection.linkedFolder} />
          ) : (
            <div className="project-explorer__empty">未关联文件夹</div>
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

function ProjectFileTreeWrapper({ path }: { path: string }) {
  const [nodes, setNodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { getProjectContext } = await import("../../lib/storage/collections/projectContext");
      const ctx = await getProjectContext(path);
      if (!cancelled) {
        setNodes(ctx.structure || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [path]);

  if (loading) return <div className="project-explorer__loading"><Loader2 size={14} className="spin" /></div>;
  if (nodes.length === 0) return <div className="project-explorer__empty">无文件</div>;
  return <ProjectFileTree nodes={nodes} maxDepth={5} onSelect={() => {}} />;
}

export default ProjectExplorer;
