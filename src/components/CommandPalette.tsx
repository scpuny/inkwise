// CommandPalette.tsx — ⌘K 命令面板，展示快捷键和快速操作

import { useEffect, useRef, useState } from "react";
import { Command, ArrowRight, PanelLeftClose, Settings, Sparkles, SquarePen } from "lucide-react";

export interface CommandAction {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
  icon?: React.ReactNode;
  action: () => void;
}

export function CommandPalette({
  open,
  onClose,
  extraCommands,
}: {
  open: boolean;
  onClose: () => void;
  extraCommands?: CommandAction[];
}) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const defaultCommands: CommandAction[] = [
    { id: "new-doc", label: "新建文档", icon: <SquarePen size={14} />, shortcut: "⌘N", action: () => {} },
    { id: "toggle-sidebar", label: "切换侧栏", icon: <PanelLeftClose size={14} />, shortcut: "⌘\\", action: () => {} },
    { id: "settings", label: "打开设置", icon: <Settings size={14} />, shortcut: "⌘,", action: () => {} },
    { id: "ai-plan", label: "AI 规划文章", icon: <Sparkles size={14} />, description: "从灵感生成完整文章规划", action: () => {} },
  ];

  const allCommands = [...defaultCommands, ...(extraCommands || [])];

  const filtered = query
    ? allCommands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()) || c.description?.toLowerCase().includes(query.toLowerCase()))
    : allCommands;

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, filtered.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
      if (e.key === "Enter" && filtered[selectedIndex]) {
        e.preventDefault();
        filtered[selectedIndex].action();
        onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, filtered, selectedIndex, onClose]);

  if (!open) return null;

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div className="command-palette" onClick={e => e.stopPropagation()}>
        <div className="command-palette__input-wrap">
          <Command size={14} />
          <input
            ref={inputRef}
            className="command-palette__input"
            placeholder="搜索命令或快捷键…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <div className="command-palette__list">
          {filtered.length === 0 && (
            <div className="command-palette__empty">没有匹配的命令</div>
          )}
          {filtered.map((cmd, i) => (
            <button
              key={cmd.id}
              className={`command-palette__item${i === selectedIndex ? " command-palette__item--selected" : ""}`}
              onClick={() => { cmd.action(); onClose(); }}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <span className="command-palette__item-icon">{cmd.icon}</span>
              <div className="command-palette__item-body">
                <span className="command-palette__item-label">{cmd.label}</span>
                {cmd.description && <span className="command-palette__item-desc">{cmd.description}</span>}
              </div>
              {cmd.shortcut && (
                <span className="command-palette__item-shortcut">
                  {cmd.shortcut.split("").map((k, j) => k === "⌘" ? <kbd key={j}>⌘</kbd> : <kbd key={j}>{k}</kbd>)}
                </span>
              )}
              <ArrowRight size={12} className="command-palette__item-arrow" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
