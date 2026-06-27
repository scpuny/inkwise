# 快捷键系统

> 版本: v1.0 | 关联: overview.md

---

## 1. 全局快捷键（Tauri）

| 快捷键 | 动作 |
|--------|------|
| `CmdOrCtrl+Shift+H` | 显示/隐藏窗口（Tauri 全局热键） |

## 2. 应用级快捷键

| 快捷键 | 动作 |
|--------|------|
| `Cmd+K` | 命令面板 |
| `Cmd+\` | 切换侧边栏 |
| `Cmd+B` | 切换 AI 面板 |
| `Alt+1` | 执行技能 1（润色） |
| `Alt+2` | 执行技能 2（改写） |
| `Alt+3` | 执行技能 3（翻译） |
| `Alt+4` | 执行技能 4（扩写） |
| `Alt+5` | 执行技能 5（续写） |
| `Escape` | 关闭面板 / 从成品页返回 |

## 3. 编辑器快捷键（ProseMirror）

| 快捷键 | 动作 |
|--------|------|
| `Cmd+B` | 粗体 |
| `Cmd+I` | 斜体 |
| `Cmd+U` | 下划线 |
| `Cmd+Shift+S` | 删除线 |
| `Cmd+Shift+7` | 有序列表 |
| `Cmd+Shift+8` | 无序列表 |
| `Cmd+Shift+9` | 任务列表 |
| `Tab` | AI 建议接受（内联幽灵文本） |
| `Escape` | AI 建议拒绝 |
| `Cmd+Z` | 撤销 |
| `Cmd+Shift+Z` | 重做 |
| `Cmd+S` | 保存（Tauri 模式下） |

## 4. 配置方式

快捷键在 `src/App.tsx` 中通过 `useEffect` 注册全局 keyboard event listener，编辑器内快捷键由 TipTap 的 `StarterKit` 和自定义扩展管理。

---

> 关联文档: [编辑器内核](editor-engine.md) | [UI 设计方案](AI写作助手-UI设计方案.md)
