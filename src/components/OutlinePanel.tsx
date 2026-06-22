import { CheckCircle2, Clock, Heading2, Heading3 } from "lucide-react";

export interface OutlineItem {
  id: string;
  text: string;
  level: number; // 1-6 for h1-h6
}

export interface BlueprintOutlineItem extends OutlineItem {
  status?: "pending" | "writing" | "complete" | "revised";
  description?: string;
}

export interface OutlinePanelProps {
  items: (OutlineItem | BlueprintOutlineItem)[];
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

const STATUS_LABELS: Record<string, string> = {
  pending: "待写",
  writing: "写作中",
  complete: "已完成",
  revised: "已修改",
};

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
        const bpItem = item as BlueprintOutlineItem;
        const icon = item.level === 2 ? <Heading2 size={12} /> : <Heading3 size={10} />;
        const isActive = activeId === item.id;
        const status = bpItem.status;
        return (
          <button
            key={item.id}
            className={`outline-panel__item outline-panel__item--level-${item.level}${isActive ? " outline-panel__item--active" : ""}${
              status === "writing" ? " outline-panel__item--writing" : ""
            }${status === "complete" ? " outline-panel__item--done" : ""}`}
            style={{ paddingLeft: `${(item.level - 1) * 14 + 8}px` }}
            onClick={() => onSelect(item.id)}
          >
            {status === "complete" ? (
              <CheckCircle2 size={11} className="outline-panel__icon-done" />
            ) : status === "writing" ? (
              <Clock size={11} className="outline-panel__icon-writing" />
            ) : (
              icon
            )}
            <span className="outline-panel__label">{item.text}</span>
            {status && status !== "pending" && (
              <span className={`outline-panel__status outline-panel__status--${status}`}>
                {STATUS_LABELS[status] || status}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
