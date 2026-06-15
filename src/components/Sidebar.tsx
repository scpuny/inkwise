import { useState, useCallback } from "react";
import { FileText, List, Settings, SquarePen } from "lucide-react";
import { CollectionTree } from "./CollectionTree";
import { OutlinePanel, type OutlineItem } from "./OutlinePanel";

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

type SidebarTab = "files" | "outline";

export function Sidebar({
  onOpenSettings,
  onSelectArticle,
  onNewDoc,
  activeArticleId,
  onNewArticle,
  outlineItems,
  activeOutlineId,
  onOutlineSelect,
}: {
  onOpenSettings: () => void;
  onSelectArticle?: (articleId: string) => void;
  onNewDoc?: () => void;
  activeArticleId?: string | null;
  onNewArticle?: () => Promise<void>;
  outlineItems?: OutlineItem[];
  activeOutlineId?: string | null | undefined;
  onOutlineSelect?: (id: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<SidebarTab>("files");

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
        onClick={async () => {
          if (onNewArticle) {
            await onNewArticle();
          } else if (onNewDoc) {
            onNewDoc();
          }
        }}
      >
        <SquarePen size={18} />
        <span>新建文档</span>
      </button>

      {/* Search */}
      <div className="sidebar__search">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input type="text" placeholder="搜索文档…" aria-label="搜索文档" />
      </div>

      {/* Collection tree / Outline (toggleable) */}
      <section className="sidebar__section sidebar__section--docs">
        {activeTab === "files" && (
          <CollectionTree onSelectArticle={onSelectArticle} activeArticleId={activeArticleId ?? null} />
        )}
        {activeTab === "outline" && (
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
        <SidebarNavItem icon={<Settings size={15} />} label="设置" onClick={onOpenSettings} />
      </nav>
    </aside>
  );
}
