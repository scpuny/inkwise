// EditorSection.tsx — 编辑器偏好：格式/行间距/自动保存
import { useState, useEffect } from "react";
import { SettingsPage, SettingsSection, SettingsField } from "./SettingsPageLayout";

export function EditorSection({ currentFormat = "rich", currentLineHeight = 1.75, onSetFormat, onSetLineHeight }: {
  currentFormat: "rich" | "markdown";
  currentLineHeight: number;
  onSetFormat?: (f: "rich" | "markdown") => void;
  onSetLineHeight?: (h: number) => void;
}) {
  const [format, setFormat] = useState(currentFormat);
  const [lineHeight, setLineHeight] = useState(currentLineHeight);
  const [autoSave] = useState(true);

  useEffect(() => { setFormat(currentFormat); }, [currentFormat]);
  useEffect(() => { setLineHeight(currentLineHeight); }, [currentLineHeight]);

  return (
    <SettingsPage title="编辑器" desc="调整编辑体验和文档格式">
      <SettingsSection title="写作偏好">
        <SettingsField label="默认格式">
          <div className="set-seg">
            <button className={`set-seg__btn${format === "markdown" ? " set-seg__btn--on" : ""}`}
              onClick={() => { setFormat("markdown"); onSetFormat?.("markdown"); }}>Markdown</button>
            <button className={`set-seg__btn${format === "rich" ? " set-seg__btn--on" : ""}`}
              onClick={() => { setFormat("rich"); onSetFormat?.("rich"); }}>富文本</button>
          </div>
        </SettingsField>
        <SettingsField label="行间距" hint="正文行高">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="range" min="1.2" max="2.4" step="0.05"
              value={lineHeight}
              onChange={(e) => { const v = Number(e.target.value); setLineHeight(v); onSetLineHeight?.(v); }}
              className="range-input" />
            <span className="range-value">{lineHeight.toFixed(2)}</span>
          </div>
        </SettingsField>
        <SettingsField label="自动保存">
          <label className="toggle">
            <input type="checkbox" checked={autoSave} className="toggle__input" readOnly />
            <span className="toggle__slider" />
          </label>
        </SettingsField>
      </SettingsSection>
      <SettingsSection title="段间距" desc="段落之间的垂直间距">
        <SettingsField label="段间距">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="range" min="0.5" max="2.5" step="0.25" defaultValue={1.25} className="range-input" />
            <span className="range-value">1.25em</span>
          </div>
        </SettingsField>
      </SettingsSection>
    </SettingsPage>
  );
}
