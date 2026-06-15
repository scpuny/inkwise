import { Heading2, Heading3 } from "lucide-react";

export interface OutlineItem {
  id: string;
  text: string;
  level: number; // 1-6 for h1-h6
}

export interface OutlinePanelProps {
  items: OutlineItem[];
  activeId: string | null | undefined;
  onSelect: (id: string) => void;
}

/**
 * Parse markdown content and extract headings as outline items.
 */
export function parseOutlineFromMarkdown(content: string): OutlineItem[] {
  const lines = content.split("\n");
  const outline: OutlineItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      // Generate anchor id
      const id = text.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-+|-+$/g, "") || `heading-${i}`;
      outline.push({ id, text, level });
    }
  }

  return outline;
}

export function OutlinePanel({ items, activeId, onSelect }: OutlinePanelProps) {
  if (items.length === 0) {
    return (
      <div className="outline-panel">
        <div className="outline-panel__empty">暂无大纲</div>
      </div>
    );
  }

  return (
    <div className="outline-panel">
      {items.map((item) => {
        const icon = item.level === 2 ? <Heading2 size={12} /> : <Heading3 size={10} />;
        const isActive = activeId === item.id;
        return (
          <button
            key={item.id}
            className={`outline-panel__item outline-panel__item--level-${item.level}${isActive ? " outline-panel__item--active" : ""}`}
            style={{ paddingLeft: `${(item.level - 1) * 14 + 8}px` }}
            onClick={() => onSelect(item.id)}
          >
            {icon}
            <span>{item.text}</span>
          </button>
        );
      })}
    </div>
  );
}
