import { FolderInput, PanelRightOpen, Loader2 } from "lucide-react";
import { usePanelStore } from "../../store/panelStore";
import { getStoredProjectInsights } from "../../lib/storage/collections/projectContext";
import { useState, useEffect, useCallback } from "react";
import { on } from "../../lib/events/eventBus";
import { useCollection } from "../../hooks/useCollection";
import type { Collection } from "../../domain";

/**
 * ProjectPanel — 侧边栏"项目"tab 内容。
 * 展示当前关联项目的摘要卡片，提供"打开项目面板"入口。
 */
export function ProjectPanel({
  onOpenProject,
  onSelectArticle,
}: {
  onOpenProject?: () => void;
  onSelectArticle?: (articleId: string) => void;
}) {
  const colId = usePanelStore((s) => s.projectPanelColId);
  const setMainRoute = usePanelStore((s) => s.setMainRoute);
  const { loadCollections } = useCollection();
  const [col, setCol] = useState<Collection | null>(null);

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const unsub = on("collections-changed", () => setRefreshKey((k) => k + 1));
    return unsub;
  }, []);

  useEffect(() => {
    if (!colId) return;
    loadCollections().then((cols) => {
      const found = cols.find((c) => c.id === colId) || null;
      setCol(found);
    });
  }, [colId, refreshKey, loadCollections]);

  const handleOpenFull = () => {
    setMainRoute("scan");
    onOpenProject?.();
  };

  // No collection with a linked folder → show empty state
  if (!colId || !col?.linkedFolder) {
    return (
      <div className="sidebar__empty-hint">
        <FolderInput size={20} className="sidebar__empty-icon" />
        <p>暂无关联项目</p>
        <p className="sidebar__empty-sub">在合集设置中关联文件夹，<br />即可在此查看项目分析</p>
      </div>
    );
  }

  const hasInsights = !!getStoredProjectInsights(colId);

  return (
    <div className="sidebar-project">
      <div className="sidebar-project__card">
        <div className="sidebar-project__header">
          <FolderInput size={14} className="sidebar-project__icon" />
          <div className="sidebar-project__info">
            <span className="sidebar-project__name">{col.linkedFolder.split("/").pop()}</span>
            <span className="sidebar-project__collection">{col.title}</span>
          </div>
        </div>
        {hasInsights && (
          <div className="sidebar-project__status">
            <span className="sidebar-project__dot" />
            已分析
          </div>
        )}
        <button className="sidebar-project__open-btn" onClick={handleOpenFull}>
          <PanelRightOpen size={13} />
          打开项目面板
        </button>
      </div>
    </div>
  );
}
