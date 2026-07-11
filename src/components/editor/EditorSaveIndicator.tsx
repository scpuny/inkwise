// EditorSaveIndicator — 保存状态指示器
// 纯展示组件，根据 saveState 显示对应图标和文案

export type SaveState = "idle" | "saving" | "saved" | "error";

interface EditorSaveIndicatorProps {
  saveState: SaveState;
}

export function EditorSaveIndicator({ saveState }: EditorSaveIndicatorProps) {
  if (saveState === "idle") return null;

  const label =
    saveState === "saving" ? "保存中…" :
    saveState === "saved" ? "已保存" :
    "保存失败";

  return (
    <div className="editor-save-indicator" title={label}>
      {saveState === "saving" ? (
        <svg className="editor-save-indicator__spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12a9 9 0 11-6.219-8.56" />
        </svg>
      ) : saveState === "saved" ? (
        <span className="editor-save-indicator__dot editor-save-indicator__dot--saved" />
      ) : (
        <span className="editor-save-indicator__dot editor-save-indicator__dot--error" />
      )}
      <span className="editor-save-indicator__label">{label}</span>
    </div>
  );
}
