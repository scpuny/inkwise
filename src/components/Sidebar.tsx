import { useState } from "react";
import { FileText, List, Settings, SquarePen, Library } from "lucide-react";
import { CollectionTree } from "./CollectionTree";
import { SearchPanel } from "./SearchPanel";
import { OutlinePanel, type OutlineItem } from "./OutlinePanel";

type SidebarTab = "files" | "outline";

export function Sidebar({
  onOpenSettings,
  onSelectArticle,
  onNewArticle,
  onNewArticleInCollection,
  activeArticleId,
  outlineItems,
  activeOutlineId,
  onOutlineSelect,
  activeCollectionId,
  onLinkFolder,
  onUnlinkFolder,
  onManageArticles,
  seriesRefreshKey,
}: {
  onOpenSettings: () => void;
  onSelectArticle?: (articleId: string) => void;
  onNewArticle?: () => Promise<void>;
  onNewArticleInCollection?: (collectionId: string) => void;
  activeArticleId?: string | null;
  outlineItems?: OutlineItem[];
  activeOutlineId?: string | null | undefined;
  onOutlineSelect?: (id: string) => void;
  activeCollectionId?: string | null;
  onLinkFolder?: (collectionId: string) => void;
  onUnlinkFolder?: (collectionId: string) => void;
  onManageArticles?: () => void;
  seriesRefreshKey?: number | undefined;
}) {
  const [internalTab, setInternalTab] = useState<SidebarTab>("files");
  const activeTab = internalTab;
  const setActiveTab = (tab: SidebarTab) => {
    setInternalTab(tab);
  };
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <aside className="sidebar" aria-label="导航">
      {/* Brand */}
      <div className="sidebar__brand">
        <svg className="sidebar__brand-logo" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
        <span>AI 写作助手</span>
      </div>

      {/* New Doc CTA */}
      <button
        className="doc-new"
        aria-label="新建文档"
        onClick={() => onNewArticle?.()}
      >
        <SquarePen size={18} />
        <span>新建文档</span>
      </button>

      {/* Search */}
      <div className="sidebar__search">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          placeholder="搜索文档…"
          aria-label="搜索文档"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (e.target.value) setShowSearch(true);
            else setShowSearch(false);
          }}
          onFocus={() => { if (searchQuery) setShowSearch(true); }}
        />
      </div>

      {/* Content area */}
      <section className="sidebar__section sidebar__section--docs">
        {showSearch ? (
          <SearchPanel
            onSelectArticle={(id) => { onSelectArticle?.(id); setShowSearch(false); setSearchQuery(""); }}
            onClose={() => { setShowSearch(false); setSearchQuery(""); }}
          />
        ) : activeTab === "files" ? (
          <CollectionTree key={seriesRefreshKey}
            onSelectArticle={onSelectArticle}
            activeArticleId={activeArticleId ?? null}
            onNewArticleInCollection={onNewArticleInCollection}
            seriesRefreshKey={seriesRefreshKey}
          />
        ) : (
          <OutlinePanel
            items={outlineItems ?? []}
            activeId={activeOutlineId}
            onSelect={(id) => onOutlineSelect?.(id)}
          />
        )}
      </section>

      {/* Nav */}
      <nav className="sidebar__nav">
        <SidebarNavItem icon={<FileText size={15} />} label="文件" active={activeTab === "files"} onClick={() => setActiveTab("files")} />
        <SidebarNavItem icon={<List size={15} />} label="大纲" active={activeTab === "outline"} onClick={() => setActiveTab("outline")} />
        <SidebarNavItem icon={<Library size={15} />} label="管理" onClick={() => onManageArticles?.()} />
        <SidebarNavItem icon={<Settings size={15} />} label="设置" onClick={onOpenSettings} />
      </nav>
    </aside>
  );
}

export function SidebarNavItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className={`sidebar__navitem${active ? " sidebar__navitem--active" : ""}`}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
