// StorageSection.tsx — 存储管理：查看路径 / 导出备份 / 导入恢复
import { useState, useEffect } from "react";
import { Download, Upload, FolderOpen, Check, AlertTriangle } from "lucide-react";
import { isTauriEnv, tryInvoke, TauriCommands } from "../../lib/bridge/tauri";
import { SettingsPage, SettingsSection } from "./SettingsPageLayout";
import { loadCollections, forceSync } from "../../lib/storage/collections";
import { emit } from "../../lib/events/eventBus";

export function StorageSection() {
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
      // 先让用户选保存目录
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
      // 重新加载数据
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
    <SettingsPage title="存储管理" desc="查看数据位置、导出备份或恢复数据">
      <SettingsSection title="存储位置">
        <div className="storage-path">
          <FolderOpen size={14} />
          <code>{storagePath || "加载中…"}</code>
        </div>
      </SettingsSection>

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
