// ShortcutsSection.tsx — 快捷键查阅面板
// 数据驱动渲染，内容静态不可编辑
import { SettingsPage } from "./SettingsPageLayout";

const SHORTCUT_GROUPS = [
  {
    title: "全局快捷键",
    items: [
      { label: "命令面板", keys: "Ctrl+K" },
      { label: "切换侧栏", keys: `Ctrl+\\` },
      { label: "切换 AI 面板", keys: "Ctrl+Shift+\\" },
      { label: "焦点模式", keys: "Ctrl+Shift+F" },
      { label: "打开设置", keys: "Ctrl+," },
      { label: "关闭面板/弹窗", keys: "Esc" },
    ],
  },
  {
    title: "编辑器",
    items: [
      { label: "新建文档", keys: "Ctrl+N" },
      { label: "保存", keys: "Ctrl+S" },
      { label: "查找替换", keys: "Ctrl+F" },
      { label: "撤销", keys: "Ctrl+Z" },
      { label: "重做", keys: "Ctrl+Shift+Z" },
      { label: "加粗", keys: "Ctrl+B" },
      { label: "斜体", keys: "Ctrl+I" },
    ],
  },
  {
    title: "AI 交互",
    items: [
      { label: "打开 AI 对话", keys: "Ctrl+K" },
      { label: "发送消息", keys: "Ctrl+Enter" },
      { label: "接受 AI 建议", keys: "Tab" },
      { label: "忽略 AI 建议", keys: "Esc" },
    ],
  },
  {
    title: "AI 技能",
    items: [
      { label: "润色", keys: "Alt+1" },
      { label: "改写", keys: "Alt+2" },
      { label: "翻译", keys: "Alt+3" },
      { label: "扩写", keys: "Alt+4" },
      { label: "分析", keys: "Alt+5" },
    ],
  },
];

export function ShortcutsSection() {
  return (
    <SettingsPage title="快捷键" desc="所有操作均可通过键盘完成">
      {SHORTCUT_GROUPS.map((group, gi) => (
        <div key={gi} style={{marginBottom: 16}}>
          <div style={{fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", padding: "8px 0 4px"}}>
            {group.title}
          </div>
          <div className="shortcuts-table">
            <div className="shortcuts-table__head"><span>操作</span><span>快捷键</span></div>
            {group.items.map((sc, i) => (
              <div key={i} className="shortcuts-table__row">
                <span>{sc.label}</span>
                <kbd className="shortcut-key">{sc.keys}</kbd>
              </div>
            ))}
          </div>
        </div>
      ))}
    </SettingsPage>
  );
}
