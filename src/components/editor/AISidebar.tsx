// AISidebar — 右侧多功能侧栏
// 合并 AI 聊天 + 样式设置 + 审阅面板为一个 tab 切换侧栏
// Cmd+B 快速切换显隐，不固定占用编辑器空间

import { useState } from "react";
import { AgentPanel } from "../agent/AgentPanel";
import { StylePanel } from "../settings/StylePanel";

type SidebarTab = "ai" | "style" | "review";

interface AISidebarProps {
  open: boolean;
  defaultTab?: SidebarTab;
  onClose: () => void;

  // Style panel props (passed through)
  activeArticleId?: string | null;
  editorStyleTemplateId?: string;
  lineHeight?: number;
  editorFontSize?: number;
  editorMaxWidth?: number;
  editorFontFamily?: string;
  codeThemeId?: string;
  editorParagraphGap?: number;
  onSetEditorStyleTemplate?: (id: string) => void;
  onSetLineHeight?: (h: number) => void;
  onSetEditorFontSize?: (s: number) => void;
  onSetEditorMaxWidth?: (w: number) => void;
  onSetEditorFontFamily?: (f: string) => void;
  onSetCodeTheme?: (id: string) => void;
  onSetEditorParagraphGap?: (g: number) => void;
  onApplyHeadingNumbers?: () => void;
}

const TABS: { key: SidebarTab; label: string }[] = [
  { key: "ai", label: "AI" },
  { key: "style", label: "样式" },
  { key: "review", label: "审阅" },
];

export function AISidebar(props: AISidebarProps) {
  const [activeTab, setActiveTab] = useState<SidebarTab>(props.defaultTab || "ai");

  if (!props.open) return null;

  return (
    <div className="ai-sidebar">
      {/* Tab bar */}
      <div className="ai-sidebar__tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`ai-sidebar__tab ${activeTab === tab.key ? "ai-sidebar__tab--active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
        <button className="ai-sidebar__close" onClick={props.onClose} title="关闭侧栏 (Cmd+B)">
          ✕
        </button>
      </div>

      {/* Tab content */}
      <div className="ai-sidebar__content">
        {activeTab === "ai" && <AgentPanel />}
        {activeTab === "style" && (
          <StylePanel
            key={props.activeArticleId || "default"}
            open={true}
            onClose={props.onClose}
            editorStyleTemplateId={props.editorStyleTemplateId || "default"}
            lineHeight={props.lineHeight || 1.75}
            editorFontSize={props.editorFontSize || 15}
            editorMaxWidth={props.editorMaxWidth || 820}
            editorFontFamily={props.editorFontFamily || ""}
            codeThemeId={props.codeThemeId || "atom-one-light"}
            editorParagraphGap={props.editorParagraphGap || 1.25}
            onSetEditorStyleTemplate={props.onSetEditorStyleTemplate || (() => {})}
            onSetLineHeight={props.onSetLineHeight || (() => {})}
            onSetEditorFontSize={props.onSetEditorFontSize || (() => {})}
            onSetEditorMaxWidth={props.onSetEditorMaxWidth || (() => {})}
            onSetEditorFontFamily={props.onSetEditorFontFamily || (() => {})}
            onSetCodeTheme={props.onSetCodeTheme || (() => {})}
            onSetEditorParagraphGap={props.onSetEditorParagraphGap || (() => {})}
            onApplyHeadingNumbers={props.onApplyHeadingNumbers || (() => {})}
          />
        )}
        {activeTab === "review" && (
          <div className="ai-sidebar__placeholder">
            <p>审阅面板（开发中）</p>
          </div>
        )}
      </div>
    </div>
  );
}
