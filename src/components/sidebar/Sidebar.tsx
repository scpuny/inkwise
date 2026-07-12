import { useState, useEffect } from "react";
import { List, Settings, SquarePen, FolderTree, FolderInput, Trash2, GalleryThumbnails, Search } from "lucide-react";
import { CollectionTree } from "./CollectionTree";
import { SearchPanel } from "./SearchPanel";
import { OutlinePanel, type OutlineItem } from "./OutlinePanel";
import { ProjectPanel } from "./ProjectPanel";
import { useCollection } from "../../hooks/useCollection";

type SidebarTab = "collections" | "outline" | "project";

export function Sidebar({
  onOpenSettings,
  onOpenProject,
  onSelectArticle,
  onNewArticle,
  onNewArticleInCollection,
  activeArticleId,
  outlineItems,
  activeOutlineId,
  onOutlineSelect,
  onManageArticles,
  onProjectArticleSelect,
  onOpenTrash,
  seriesRefreshKey,
}: {
  onOpenSettings: () => void;
  onOpenProject?: () => void;
  onSelectArticle?: (articleId: string) => void;
  onNewArticle?: () => Promise<void>;
  onNewArticleInCollection?: (collectionId: string) => void;
  activeArticleId?: string | null;
  outlineItems?: OutlineItem[];
  activeOutlineId?: string | null | undefined;
  onOutlineSelect?: (id: string) => void;
  onManageArticles?: () => void;
  onProjectArticleSelect?: (articleId: string) => void;
  onOpenTrash?: () => void;
  seriesRefreshKey?: number | undefined;
}) {
  const [internalTab, setInternalTab] = useState<SidebarTab>("collections");
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { trash, loadTrash } = useCollection();

  // 回收站计数（挂载时 + collections-changed 事件触发时更新）
  useEffect(() => {
    loadTrash();
  }, [loadTrash]);


  return (
    <aside className="sidebar" aria-label="导航">
      <div className="sidebar__brand">
        <img className="sidebar__brand-logo" src="/inkwise-icon.svg" width="36" height="36" alt="InkWise" />
        <span>InkWise · 墨智</span>
      </div>

      <button className="doc-new" aria-label="新建文档" onClick={() => onNewArticle?.()}>
        <SquarePen size={18} />
        <span>新建文档</span>
      </button>

      <div className="sidebar__search">
        <Search size={14} className="sidebar__search-icon" />
        <input
          type="text"
          placeholder="搜索文档…"
          aria-label="搜索文档"
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setShowSearch(!!e.target.value); }}
          onFocus={() => { if (searchQuery) setShowSearch(true); }}
        />
      </div>

      {/* Tab bar: 目录 / 大纲 / 项目 */}
      <div className="sidebar__tabs">
        <button className={"sidebar__tab" + (internalTab === "collections" ? " sidebar__tab--active" : "")} onClick={() => setInternalTab("collections")}>
          <FolderTree size={13} /><span>目录</span>
        </button>
        <button className={"sidebar__tab" + (internalTab === "outline" ? " sidebar__tab--active" : "")} onClick={() => setInternalTab("outline")}>
          <List size={13} /><span>大纲</span>
        </button>
        <button className={"sidebar__tab" + (internalTab === "project" ? " sidebar__tab--active" : "")} onClick={() => setInternalTab("project")}>
          <FolderInput size={13} /><span>项目</span>
        </button>
      </div>

      <section className="sidebar__section sidebar__section--docs">
        {showSearch ? (
          <SearchPanel onSelectArticle={(id) => { onSelectArticle?.(id); setShowSearch(false); setSearchQuery(""); }} onClose={() => { setShowSearch(false); setSearchQuery(""); }} />
        ) : internalTab === "collections" ? (
          <CollectionTree key={seriesRefreshKey} onSelectArticle={onSelectArticle} activeArticleId={activeArticleId ?? null} onNewArticleInCollection={onNewArticleInCollection} seriesRefreshKey={seriesRefreshKey} />
        ) : internalTab === "outline" ? (
          <OutlinePanel items={outlineItems ?? []} activeId={activeOutlineId} onSelect={(id) => onOutlineSelect?.(id)} />
        ) : (
          <ProjectPanel onOpenProject={onOpenProject} onSelectArticle={onProjectArticleSelect} />
        )}
      </section>

      {/* Bottom actions — labeled icon buttons */}
      <div className="sidebar__actions">
        <button className="sidebar__action-btn" onClick={() => onManageArticles?.()} title="管理合集">
          <GalleryThumbnails size={15} />
          <span className="sidebar__action-label">管理</span>
        </button>
        <div className="sidebar__action-sep" />
        <button className="sidebar__action-btn" onClick={() => onOpenTrash?.()} title="回收站">
          <Trash2 size={15} />
          <span className="sidebar__action-label">回收站</span>
          {trash.length > 0 && <span className="sidebar__trash-badge">{trash.length}</span>}
        </button>
        <div className="sidebar__action-spacer" />
        <button className="sidebar__action-btn" onClick={onOpenSettings} title="设置">
          <Settings size={15} />
          <span className="sidebar__action-label">设置</span>
        </button>
      </div>

    </aside>
  );
}
