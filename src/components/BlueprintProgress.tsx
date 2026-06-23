import { CheckCircle2, Circle, Edit3, Eye } from "lucide-react";

interface BlueprintSection {
  id: string;
  title: string;
  status: string;
  level: number;
}

interface BlueprintProgressProps {
  sections: BlueprintSection[];
  phase: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "待开始",
  writing: "写作中",
  reviewing: "审核中",
  complete: "已完成",
};

const STATUS_ICON: Record<string, { icon: React.ReactNode; className: string }> = {
  pending:  { icon: <Circle size={12} />, className: "bp-icon--pending" },
  writing:  { icon: <Edit3 size={12} />, className: "bp-icon--writing" },
  reviewing: { icon: <Eye size={12} />, className: "bp-icon--reviewing" },
  complete: { icon: <CheckCircle2 size={12} />, className: "bp-icon--complete" },
};

export function BlueprintProgress({ sections, phase }: BlueprintProgressProps) {
  const total = sections.length;
  const done = sections.filter((s) => s.status === "complete").length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const phaseLabel: Record<string, string> = {
    planned: "已规划",
    outlining: "大纲中",
    writing: "写作中",
    reviewing: "审核中",
    complete: "已完成",
  };

  return (
    <div className="final-blueprint">
      <div className="final-blueprint__phase">
        状态: {phaseLabel[phase] || phase}
      </div>
      <div className="final-blueprint__bar">
        <div className="final-blueprint__bar-track">
          <div
            className="final-blueprint__bar-fill"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="final-blueprint__bar-label">{done}/{total}</span>
      </div>
      <div className="final-blueprint__list">
        {sections.map((s) => {
          const iconDef = STATUS_ICON[s.status] || STATUS_ICON.pending;
          return (
            <div key={s.id} className={`final-blueprint__item final-blueprint__item--${s.status}`}>
              <span className={`final-blueprint__item-icon ${iconDef.className}`}>
                {iconDef.icon}
              </span>
              <span className="final-blueprint__item-title">
                {s.level > 1 ? "  ".repeat(Math.min(s.level - 1, 3)) : ""}
                {s.title}
              </span>
              <span className="final-blueprint__item-status">
                {STATUS_LABELS[s.status] || s.status}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
