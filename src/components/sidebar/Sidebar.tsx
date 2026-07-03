import { useState, useEffect } from "react";
import { List, Settings, SquarePen, FolderTree, FolderInput, Trash2, GalleryThumbnails } from "lucide-react";
import { CollectionTree } from "./CollectionTree";
import { SearchPanel } from "./SearchPanel";
import { OutlinePanel, type OutlineItem } from "./OutlinePanel";
import { ProjectPanel } from "./ProjectPanel";
import { loadTrash } from "../../lib/storage/collections";
import { on } from "../../lib/events/eventBus";

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
  const [trashCount, setTrashCount] = useState(0);

  // 回收站计数（挂载时 + collections-changed 事件触发时更新）
  useEffect(() => {
    loadTrash().then((items) => setTrashCount(items.length)).catch(() => {});
    const unsub = on("collections-changed", () => {
      loadTrash().then((items) => setTrashCount(items.length)).catch(() => {});
    });
    return unsub;
  }, []);


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
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
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

      {/* Bottom actions */}
      <div className="sidebar__actions">
        <button className="sidebar__action-btn" onClick={() => onManageArticles?.()} title="管理合集">
          <GalleryThumbnails size={14} />
        </button>
        <button className="sidebar__action-btn" onClick={() => onOpenTrash?.()} title="回收站">
          <Trash2 size={14} />
          {trashCount > 0 && <span className="sidebar__trash-badge">{trashCount}</span>}
        </button>
        <button className="sidebar__action-btn" onClick={onOpenSettings} title="设置">
          <Settings size={14} />
        </button>
      </div>

    </aside>
  );
}
