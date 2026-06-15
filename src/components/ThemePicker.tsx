import { X } from "lucide-react";
import type { ThemeStyle } from "../lib/theme";
import { THEME_STYLES } from "../lib/theme";

type ThemeMode = "auto" | "light" | "dark";

const styleLabels: Record<ThemeStyle, string> = {
  graphite: "石墨",
  aurora: "极光",
  slate: "石板",
  carbon: "碳灰",
  nocturne: "夜曲",
  amber: "琥珀",
};

const styleColors: Record<ThemeStyle, string> = {
  graphite: "linear-gradient(120deg,#ff6a3d,#ff9a52)",
  aurora: "linear-gradient(120deg,#8b7cff,#b07cff 42%,#38d6e6)",
  slate: "linear-gradient(120deg,#4d8df6,#3b82f6)",
  carbon: "linear-gradient(120deg,#2dd4bf,#22d3ee)",
  nocturne: "linear-gradient(120deg,#818cf8,#a78bfa)",
  amber: "linear-gradient(120deg,#d4632f,#de7a4b)",
};

const modes: { value: ThemeMode; label: string }[] = [
  { value: "auto", label: "自动" },
  { value: "dark", label: "深色" },
  { value: "light", label: "浅色" },
];

export function ThemePicker({
  currentStyle,
  currentMode,
  open,
  onClose,
  onSelectStyle,
  onSelectMode,
}: {
  currentStyle: ThemeStyle;
  currentMode: ThemeMode;
  open: boolean;
  onClose: () => void;
  onSelectStyle: (style: ThemeStyle) => void;
  onSelectMode: (mode: ThemeMode) => void;
}) {
  if (!open) return null;

  return (
    <div className="theme-picker-overlay" onClick={onClose}>
      <div className="theme-picker" onClick={(e) => e.stopPropagation()}>
        <div className="theme-picker__head">
          <span>选择主题风格</span>
          <button className="theme-picker__close" onClick={onClose} aria-label="关闭">
            <X size={16} />
          </button>
        </div>

        <div className="theme-picker__grid">
          {THEME_STYLES.map((style) => (
            <button
              key={style}
              className={`theme-card${currentStyle === style ? " theme-card--active" : ""}`}
              onClick={() => onSelectStyle(style)}
              data-theme-style={style}
            >
              <span className="theme-card__swatch" style={{ background: styleColors[style] }} />
              <span className="theme-card__name">{styleLabels[style]}</span>
            </button>
          ))}
        </div>

        <div className="theme-picker__mode">
          <span>主题模式</span>
          <div className="theme-mode-switch">
            {modes.map((m) => (
              <button
                key={m.value}
                className={`theme-mode-btn${currentMode === m.value ? " theme-mode-btn--active" : ""}`}
                onClick={() => onSelectMode(m.value)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
