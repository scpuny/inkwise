// AppearanceSection.tsx — 外观设置：主题风格/模式/字号/字体
import { useState, useCallback } from "react";
import { Sun, Monitor, Check } from "lucide-react";
import type { ThemeStyle, Theme } from "../../lib/theme/theme";
import { THEME_STYLES } from "../../lib/theme/theme";
import type { TextSize } from "../../lib/theme/textSize";
import { TEXT_SIZES } from "../../lib/theme/textSize";
import type { FontFamily } from "../../lib/theme/fontFamily";
import { FONT_FAMILIES, applyFontFamily, getCustomFontName, setCustomFontName } from "../../lib/theme/fontFamily";
import { SettingsPage, SettingsSection, SettingsField } from "./SettingsPageLayout";
import {
  STYLE_LABELS, STYLE_COLORS,
  MoonIcon, textSizeLabel, fontFamilyLabel, themeStyleTag, themeStyleDesc,
} from "./settingsHelpers";

export function AppearanceSection({
  currentStyle, currentTheme, currentTextSize, currentFontFamily,
  onSelectStyle, onSelectTheme, onSelectTextSize, onSelectFontFamily,
}: {
  currentStyle: ThemeStyle; currentTheme: Theme;
  currentTextSize: TextSize; currentFontFamily: FontFamily;
  onSelectStyle: (s: ThemeStyle) => void; onSelectTheme: (t: Theme) => void;
  onSelectTextSize: (s: TextSize) => void; onSelectFontFamily: (f: FontFamily) => void;
}) {
  const [customFont, setCustomFont] = useState(getCustomFontName());
  const isCustom = currentFontFamily === "custom";

  const handleFontFamily = useCallback((f: FontFamily) => {
    onSelectFontFamily(f);
    if (f === "custom" && customFont.trim()) {
      setCustomFontName(customFont.trim());
      applyFontFamily("custom");
    }
  }, [onSelectFontFamily, customFont]);

  const handleCustomFontBlur = useCallback(() => {
    if (customFont.trim()) {
      setCustomFontName(customFont.trim());
      if (currentFontFamily === "custom") applyFontFamily("custom");
    }
  }, [customFont, currentFontFamily]);

  return (
    <SettingsPage title="外观" desc="自定义写作环境的视觉风格">
      {/* Theme Style */}
      <SettingsSection title="主题风格" desc="选择配色方向，同时支持深色/浅色模式">
        <div className="theme-card-grid">
          {THEME_STYLES.map((style) => {
            const selected = currentStyle === style;
            const tag = themeStyleTag(style);
            return (
              <button
                key={style}
                role="radio"
                aria-checked={selected}
                className={`theme-card${selected ? " theme-card--on" : ""}`}
                onClick={() => onSelectStyle(style)}
                data-theme-style={style}
              >
                <span className="theme-card__head">
                  <span className="theme-card__name">{STYLE_LABELS[style]}</span>
                  <span className="theme-card__tag">{tag}</span>
                </span>
                <span className="theme-card__swatches" data-theme-style-card={style}>
                  <span className="theme-card__swatch theme-card__swatch--bg" />
                  <span className="theme-card__swatch theme-card__swatch--surface" />
                  <span className="theme-card__swatch theme-card__swatch--accent" />
                </span>
                <span className="theme-card__desc">{themeStyleDesc(style)}</span>
                {selected && (
                  <span className="theme-card__check">
                    <Check size={13} strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </SettingsSection>

      {/* Theme Mode */}
      <SettingsSection title="主题模式" desc="跟随系统或手动选择">
        <div className="set-seg">
          {[
            { value: "auto" as Theme, icon: <Monitor size={14} />, label: "跟随系统" },
            { value: "dark" as Theme, icon: <MoonIcon size={14} />, label: "深色" },
            { value: "light" as Theme, icon: <Sun size={14} />, label: "浅色" },
          ].map((opt) => (
            <button
              key={opt.value}
              className={`set-seg__btn${currentTheme === opt.value ? " set-seg__btn--on" : ""}`}
              onClick={() => onSelectTheme(opt.value)}
            >{opt.icon}{opt.label}</button>
          ))}
        </div>
      </SettingsSection>

      {/* Text Size */}
      <SettingsSection title="字号" desc="控制界面文字大小">
        <div className="set-seg">
          {TEXT_SIZES.map((s) => (
            <button
              key={s}
              className={`set-seg__btn${currentTextSize === s ? " set-seg__btn--on" : ""}`}
              onClick={() => onSelectTextSize(s)}
            >{textSizeLabel(s)}</button>
          ))}
        </div>
      </SettingsSection>

      {/* Font Family */}
      <SettingsSection title="字体" desc="选择界面显示字体">
        <div className="set-seg">
          {FONT_FAMILIES.map((f) => (
            <button
              key={f}
              className={`set-seg__btn${currentFontFamily === f ? " set-seg__btn--on" : ""}`}
              onClick={() => handleFontFamily(f)}
            >{fontFamilyLabel(f)}</button>
          ))}
        </div>
        {isCustom && (
          <div className="custom-font-input" style={{ marginTop: 10 }}>
            <input
              className="settings-text-input"
              type="text"
              placeholder="输入自定义字体名称…"
              value={customFont}
              onChange={(e) => setCustomFont(e.target.value)}
              onBlur={handleCustomFontBlur}
            />
          </div>
        )}
      </SettingsSection>
    </SettingsPage>
  );
}
