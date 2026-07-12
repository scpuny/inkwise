// GeneralSection.tsx — 通用设置：主题外观 + 存储管理

import { useState, useEffect, useCallback } from "react";
import { Check, Monitor, Sun, Download, Upload, FolderOpen, AlertTriangle } from "lucide-react";
import type { FontFamily } from "../../lib/theme/fontFamily";
import { FONT_FAMILIES, applyFontFamily, getCustomFontName, setCustomFontName } from "../../lib/theme/fontFamily";
import type { TextSize } from "../../lib/theme/textSize";
import { TEXT_SIZES } from "../../lib/theme/textSize";
import type { Theme, ThemeStyle } from "../../lib/theme/theme";
import { THEME_STYLES } from "../../lib/theme/theme";
import { SettingsPage, SettingsSection } from "./SettingsPageLayout";
import {
  MoonIcon, STYLE_LABELS, fontFamilyLabel, textSizeLabel, themeStyleDesc, themeStyleTag
} from "./settingsHelpers";
import { isTauriEnv, tryInvoke, TauriCommands } from "../../lib/bridge/tauri";
import { forceSync } from "../../lib/storage/collections";
import { useCollection } from "../../hooks/useCollection";
import { emit } from "../../lib/events/eventBus";

export function GeneralSection({
  currentStyle, currentTheme, currentTextSize, currentFontFamily,
  onSelectStyle, onSelectTheme, onSelectTextSize, onSelectFontFamily,
}: {
  currentStyle: ThemeStyle; currentTheme: Theme;
  currentTextSize: TextSize; currentFontFamily: FontFamily;
  onSelectStyle: (s: ThemeStyle) => void; onSelectTheme: (t: Theme) => void;
  onSelectTextSize: (s: TextSize) => void; onSelectFontFamily: (f: FontFamily) => void;
}) {
  const { loadCollections } = useCollection();
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

  // ── 存储管理 ──
  const [storagePath, setStoragePath] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isTauriEnv()) return;
    tryInvoke<string>(TauriCommands.GetStoragePath).then(setStoragePath).catch(() => {});
  }, []);

  const showMsg = (type: "ok" | "err", text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  const handleExport = async () => {
    if (!isTauriEnv()) return;
    setBusy(true);
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const dest = await save({
        defaultPath: `inkwise-backup-${new Date().toISOString().slice(0, 10)}`,
        filters: [{ name: "备份文件夹", extensions: ["*"] }],
      });
      if (!dest) { setBusy(false); return; }
      await tryInvoke(TauriCommands.ExportData, { dest });
      showMsg("ok", `导出成功：${dest}`);
    } catch (e) {
      showMsg("err", `导出失败：${e}`);
    }
    setBusy(false);
  };

  const handleImport = async () => {
    if (!isTauriEnv()) return;
    const ok = confirm("导入将覆盖当前所有数据，确定继续？");
    if (!ok) return;
    setBusy(true);
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const src = await open({ directory: true, multiple: false, title: "选择备份文件夹" });
      if (!src) { setBusy(false); return; }
      await tryInvoke(TauriCommands.ImportData, { src });
      forceSync();
      await loadCollections();
      emit("collections-changed");
      showMsg("ok", "导入成功，数据已恢复");
    } catch (e) {
      showMsg("err", `导入失败：${e}`);
    }
    setBusy(false);
  };

  return (
    <SettingsPage title="通用" desc="界面外观与数据管理">
      {/* ── 主题风格 ── */}
      <SettingsSection title="主题风格" desc="选择配色方向，同时支持深色/浅色模式">
        <div className="theme-card-grid">
          {THEME_STYLES.map((style) => {
            const selected = currentStyle === style;
            const tag = themeStyleTag(style);
            return (
              <button key={style} role="radio" aria-checked={selected}
                className={`theme-card${selected ? " theme-card--on" : ""}`}
                onClick={() => onSelectStyle(style)} data-theme-style={style}
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
                {selected && <span className="theme-card__check"><Check size={13} strokeWidth={3} /></span>}
              </button>
            );
          })}
        </div>
      </SettingsSection>

      {/* ── 主题模式 ── */}
      <SettingsSection title="主题模式" desc="跟随系统或手动选择">
        <div className="set-seg">
          {[
            { value: "auto" as Theme, icon: <Monitor size={14} />, label: "跟随系统" },
            { value: "dark" as Theme, icon: <MoonIcon size={14} />, label: "深色" },
            { value: "light" as Theme, icon: <Sun size={14} />, label: "浅色" },
          ].map((opt) => (
            <button key={opt.value}
              className={`set-seg__btn${currentTheme === opt.value ? " set-seg__btn--on" : ""}`}
              onClick={() => onSelectTheme(opt.value)}
            >{opt.icon}{opt.label}</button>
          ))}
        </div>
      </SettingsSection>

      {/* ── 字号 ── */}
      <SettingsSection title="字号" desc="控制界面文字大小">
        <div className="set-seg">
          {TEXT_SIZES.map((s) => (
            <button key={s}
              className={`set-seg__btn${currentTextSize === s ? " set-seg__btn--on" : ""}`}
              onClick={() => onSelectTextSize(s)}
            >{textSizeLabel(s)}</button>
          ))}
        </div>
      </SettingsSection>

      {/* ── 字体 ── */}
      <SettingsSection title="字体" desc="选择界面显示字体">
        <div className="set-seg">
          {FONT_FAMILIES.map((f) => (
            <button key={f}
              className={`set-seg__btn${currentFontFamily === f ? " set-seg__btn--on" : ""}`}
              onClick={() => handleFontFamily(f)}
            >{fontFamilyLabel(f)}</button>
          ))}
        </div>
        {isCustom && (
          <div className="custom-font-input" style={{ marginTop: 10 }}>
            <input className="settings-text-input" type="text" placeholder="输入自定义字体名称…"
              value={customFont} onChange={(e) => setCustomFont(e.target.value)} onBlur={handleCustomFontBlur} />
          </div>
        )}
      </SettingsSection>

      {/* ── 存储位置 ── */}
      <SettingsSection title="存储位置">
        <div className="storage-path">
          <FolderOpen size={14} />
          <code>{storagePath || "加载中…"}</code>
        </div>
      </SettingsSection>

      {/* ── 备份与恢复 ── */}
      <SettingsSection title="备份与恢复">
        <div className="storage-actions">
          <button className="btn btn--primary" onClick={handleExport} disabled={busy}>
            <Download size={14} /> 导出备份
          </button>
          <button className="btn" onClick={handleImport} disabled={busy}>
            <Upload size={14} /> 导入恢复
          </button>
        </div>
        {msg && (
          <div className={`storage-msg storage-msg--${msg.type}`}>
            {msg.type === "ok" ? <Check size={14} /> : <AlertTriangle size={14} />}
            {msg.text}
          </div>
        )}
      </SettingsSection>

      <style>{`
        .storage-path {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 14px; background: var(--bg-surface);
          border-radius: 8px; font-size: 13px;
        }
        .storage-path code {
          word-break: break-all; color: var(--text-secondary);
        }
        .storage-actions {
          display: flex; gap: 10px; margin-top: 4px;
        }
        .storage-msg {
          display: flex; align-items: center; gap: 6px;
          margin-top: 10px; padding: 8px 12px; border-radius: 6px;
          font-size: 13px;
        }
        .storage-msg--ok { background: var(--accent-surface); color: var(--accent); }
        .storage-msg--err { background: var(--red-surface); color: var(--red); }
      `}</style>
    </SettingsPage>
  );
}
