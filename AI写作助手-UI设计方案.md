# AI 写作助手 — UI 设计方案

> 参考 [Reasonix](https://github.com/yetone/reasonix) 桌面端 UI 风格，针对写作场景深度定制。
> 风格定位：**开发者风味 × 写作沉浸感** — 干净、专注、可定制。

---

## 目录

1. [设计哲学](#1-设计哲学)
2. [整体布局](#2-整体布局)
3. [色彩体系](#3-色彩体系)
4. [字体与排版](#4-字体与排版)
5. [组件体系](#5-组件体系)
6. [交互细节](#6-交互细节)
7. [响应式与自适应](#7-响应式与自适应)
8. [主题系统](#8-主题系统)
9. [CSS 变量清单](#9-css-变量清单)

---

## 1. 设计哲学

### 1.1 核心原则

| 原则 | 说明 |
|------|------|
| **沉浸写作** | 编辑器占据视觉中心，无干扰元素，UI 为内容让路 |
| **AI 融入而非悬浮** | AI 辅助面板、建议、改写结果以原生组件形式嵌入，而非弹窗/模态 |
| **键盘优先** | 所有操作可通过快捷键完成，减少鼠标依赖 |
| **离线优先** | 系统字体栈，无 web-font 加载，CSS 变量驱动，无运行时 CSS-in-JS |
| **桌面风味** | 参考 VSCode / Reasonix 的紧凑信息密度，非移动端风格 |

### 1.2 与 Reasonix 的异同

| 维度 | Reasonix | 本方案 |
|------|----------|--------|
| 核心场景 | AI 编程助手（对话+工具） | AI 写作助手（编辑+写作） |
| 主区域 | Transcript（聊天流） | 富文本/ Markdown 编辑器 |
| 输入方式 | Composer（命令行式输入框） | 编辑器内联 + 浮动指令条 |
| 侧栏 | 项目树+ IM+ 导航 | 文档树+ 大纲+ 素材库 |
| 右侧面板 | Workspace（文件/变更/上下文） | AI 建议、改写、文风分析 |
| 底部 | Composer + StatusBar | AI 指令输入条 + 状态栏 |
| 主题 | 6 种方向（graphite等） | 6 种方向（保留，调色板适配写作） |

---

## 2. 整体布局

### 2.1 栅格架构（CSS Grid）

```
┌────────────────────────────────────────────────────────────┐
│  .app (全屏容器, overflow: hidden)                          │
│  ┌────────────────────────────────────────────────────────┐│
│  │  .layout (CSS Grid, 4列)                               ││
│  │  ┌─────────┬───────────────────┬──┬────────────────┐  ││
│  │  │ sidebar │  .editor-pane     │R │ .ai-dock       │  ││
│  │  │ (col 1) │  (col 2)          │E │ (col 4)        │  ││
│  │  │         │  ├── .toolbar     │S │  ├─ .dock-tabs │  ││
│  │  │         │  ├── .editor-main │  │  ├─ .dock-panel│  ││
│  │  │         │  ├── .status-bar  │  │  │  (建议/改写/ │  ││
│  │  │         │  └── .ai-bar      │  │  │  文风/大纲)  │  ││
│  │  └─────────┴───────────────────┴──┴────────────────┘  ││
│  └────────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────┘
```

**关键尺寸**：

```
--sidebar-width:       264px (可拖拽 200-320px)
--editor-min-width:    480px
--ai-dock-width:       420px (可拖拽 320-660px)
--resizer-width:       8px
--toolbar-height:      42px
--ai-bar-height:       52px
--statusbar-height:    28px
--chrome-toggle-width: 42px
```

### 2.2 布局变体

```css
/* 基础 — 仅编辑区 */
.layout {
  grid-template-columns: 0px minmax(0, 1fr);
}

/* 侧栏展开 */
.layout--sidebar-open {
  grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
}

/* AI 侧栏展开 */
.layout--ai-open {
  grid-template-columns: var(--sidebar-width) minmax(0, 1fr) var(--resizer-width) minmax(0, var(--ai-dock-width));
}

/* 全屏写作（隐藏所有面板） */
.layout--zen {
  grid-template-columns: 0px minmax(0, 1fr) 0px 0px;
}
.layout--zen .toolbar,
.layout--zen .ai-bar,
.layout--zen .status-bar {
  opacity: 0;
  pointer-events: none;
}
```

### 2.3 侧栏（Sidebar）

**位置**：Grid 第 2 行第 1 列

**结构**（自上而下）：
```
┌─────────────────────┐
│  Brand / Logo       │  -- 写作助手的品牌标识
├─────────────────────┤
│  "新建文档" 按钮     │  -- 渐变背景 + shadow，同 Reasonix
├─────────────────────┤
│  搜索/过滤文档       │  -- 快速定位文档
├─────────────────────┤
│  文档树              │  -- 按文件夹/项目分组
│  ├─ 项目 A          │
│  │  ├─ chapter-1.md │
│  │  └─ chapter-2.md │
│  └─ 项目 B          │
├─────────────────────┤
│  素材库（折叠面板）   │  -- 图片、引用、模板
├─────────────────────┤
│  底部导航            │
│  📁 文件   📊 大纲   │
│  ⚙️ 设置   📖 帮助   │
└─────────────────────┘
```

**关键样式**：

```css
.sidebar {
  grid-row: 2;
  grid-column: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 12px 10px 12px;
  background: var(--sidebar-bg);
  border-right: 1px solid var(--border-soft);
  overflow: hidden;
  user-select: none;
}
```

### 2.4 编辑面板（Editor Pane）

**位置**：Grid 第 2 行第 2 列

**结构**：

```
┌──────────────────────────────────────────┐
│  .toolbar                                │
│  ┌──────────────────────────────────────┐│
│  │ H1 B I U  ···  |  💬  ✨  🔍  ⋮   ││
│  └──────────────────────────────────────┘│
├──────────────────────────────────────────┤
│  .editor-main                            │
│  ┌──────────────────────────────────────┐│
│  │                                      ││
│  │   富文本 / Markdown 编辑器            ││
│  │   居中最大宽 820px                    ││
│  │   两侧留白呼吸空间                     ││
│  │                                      ││
│  │   [--- AI 内联建议 ---]              ││
│  │   这里是 AI 建议的文本内容             ││
│  │   [Tab 接受] [Esc 忽略]              ││
│  │                                      ││
│  └──────────────────────────────────────┘│
├──────────────────────────────────────────┤
│  .status-bar (文档统计)                  │
│  字数: 2,340  字符: 3,120  段落: 12     │
├──────────────────────────────────────────┤
│  .ai-bar                                 │
│  ┌──────────────────────────────────────┐│
│  │ ✨ [继续写作] [改写] [润色] [翻译]  ││
│  │ ┌──────────────────────────────────┐ ││
│  │ │ 输入 AI 指令… (Ctrl+Enter 发送) │ ││
│  │ └──────────────────────────────────┘ ││
│  └──────────────────────────────────────┘│
└──────────────────────────────────────────┘
```

### 2.5 AI 侧栏（AI Dock）

**位置**：Grid 第 2 行第 4 列

```
┌──────────────────────┐
│  [概览] [建议] [改写]  │  选项卡
├──────────────────────┤
│                       │
│  ── 写作建议 ──       │
│  • 此处可增加过渡句    │
│  • 建议用更主动语态    │
│  • 段落有点长，可拆分  │
│                       │
│  ── 改写历史 ──       │
│  • 原文... → 改后...  │
│  • 原文... → 改后...  │
│                       │
│  ── 文风分析 ──       │
│  可读性: 72           │
│  句子长度: 中等        │
│  被动语态: 8%         │
└──────────────────────┘
```

---

## 3. 色彩体系

### 3.1 设计思路

完全沿用 Reasonix 的三层 CSS 变量覆盖机制，但针对**写作场景**调整主色（accent）和语义色。

### 3.2 主题方向（Theme Styles）

| 方向 | 主色 (`--accent`) | 情感 | 适用场景 |
|------|-------------------|------|----------|
| **paper** (默认) | `#d9802e` 暖橙棕 | 温暖、纸墨感 | 通用写作 |
| **ink** | `#4d6bfe` 深蓝 | 沉稳、专业 | 学术/商务 |
| **sage** | `#4a9e6b` 墨绿 | 安静、护眼 | 长时写作 |
| **rose** | `#d4547a` 玫瑰 | 柔和、优雅 | 创意写作 |
| **slate** | `#5b7fbf` 石板蓝 | 冷静、理性 | 技术文档 |
| **amber** | `#c98a2e` 琥珀 | 温暖、复古 | 随笔/博客 |

### 3.3 色彩令牌（以 paper 暗色为例）

```css
:root[data-theme-style="paper"] {
  /* 表面 */
  --stage: #0a0a09;
  --surface: #1a1815;
  --surface-2: #22201c;
  --surface-3: #141210;

  /* 背景 */
  --bg: #0f0e0c;
  --bg-soft: #141210;
  --bg-elev: #1a1815;
  --bg-elev-2: #22201c;

  /* 侧栏 */
  --sidebar-bg: #1a1815;
  --sidebar-hover: #25221d;
  --sidebar-active: rgba(217, 128, 46, 0.16);

  /* 边框 */
  --border: rgba(255, 255, 255, 0.09);
  --border-soft: rgba(255, 255, 255, 0.06);

  /* 文字 */
  --text: #f0ede7;
  --text-2: #b0a99d;
  --text-3: #767066;
  --fg: #f0ede7;
  --fg-dim: #b0a99d;
  --fg-faint: #767066;

  /* 品牌 */
  --accent: #d9802e;
  --accent-fg: #0f0e0c;
  --accent-soft: rgba(217, 128, 46, 0.14);
  --accent-strong: #e8994a;
  --grad: linear-gradient(120deg, #d9802e, #e8994a);

  /* 语义 */
  --ok: #5da573;
  --warn: #d4a24e;
  --err: #d96a5a;

  /* 编辑器专用 */
  --editor-cursor: #d9802e;
  --editor-selection: rgba(217, 128, 46, 0.25);
  --editor-line-highlight: rgba(255, 255, 255, 0.03);
  --editor-gutter: var(--text-3);
  --editor-gutter-bg: var(--bg);
}
```

### 3.4 浅色模式

沿用 Reasonix 模式：`@media (prefers-color-scheme: light)` + `[data-theme="light"]` 分别定义。

浅色 paper 示例片段：
```css
:root[data-theme="light"][data-theme-style="paper"] {
  --bg: #faf8f5;
  --bg-soft: #f5f2ed;
  --bg-elev: #ffffff;
  --text: #1c1a17;
  --accent: #c9742e;
  /* ... */
}
```

---

## 4. 字体与排版

### 4.1 字体栈

```css
:root {
  /* 英文等宽（代码块、统计数字） */
  --mono: ui-monospace, "SF Mono", "Cascadia Code", Consolas, monospace;

  /* 中英文正文字体 */
  --sans: "PingFang SC", "Noto Sans SC", "Microsoft YaHei",
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* 写作衬线体（可选） */
  --serif: "Noto Serif SC", "Source Han Serif SC", "STSong",
    Georgia, "Times New Roman", serif;

  /* 编辑器等宽体（可选） */
  --editor-mono: "JetBrains Mono", "Fira Code", "SF Mono", monospace;
}
```

### 4.2 尺寸体系

沿用 Reasonix 的 token 体系：

```css
:root {
  --font-scale: 1;

  --text-2xs: calc(10px * var(--font-scale));  /* 辅助信息 */
  --text-xs:  calc(11px * var(--font-scale));  /* 状态栏 */
  --text-sm:  calc(12px * var(--font-scale));  /* 侧栏、面板 */
  --text-md:  calc(13px * var(--font-scale));  /* UI 控件 */
  --text-base: calc(14px * var(--font-scale)); /* 默认正文 */
  --text-lg:  calc(15px * var(--font-scale));  /* 小标题 */
  --text-xl:  calc(18px * var(--font-scale));  /* 标题 */
  --text-2xl: calc(22px * var(--font-scale));  /* 大标题 */
  --text-3xl: calc(28px * var(--font-scale));  /* 文档标题 */
}
```

### 4.3 编辑器行高与间距

```css
.editor-content {
  --line-height-base: 1.75;      /* 中文舒适行高 */
  --line-height-heading: 1.4;    /* 标题行高 */
  --paragraph-gap: 1.25em;       /* 段间距 */
  --editor-padding-v: 48px;      /* 上下内边距 */
  --editor-padding-h: clamp(32px, 8vw, 96px); /* 左右适应 */
}
```

---

## 5. 组件体系

### 5.1 组件树

```
App
├── AppChrome (顶部标签栏)
├── Layout (CSS Grid)
│   ├── Sidebar
│   │   ├── BrandLogo
│   │   ├── NewDocButton
│   │   ├── DocSearch
│   │   ├── DocTree
│   │   │   ├── DocTreeNode (递归)
│   │   │   └── DocTreeFolder
│   │   ├── AssetPanel (折叠)
│   │   └── SidebarNav
│   │       ├── NavItem (Outline)
│   │       ├── NavItem (Settings)
│   │       └── NavItem (Help)
│   │
│   ├── SidebarResizer
│   │
│   ├── EditorPane
│   │   ├── Toolbar
│   │   │   ├── FormatButtons (H1/B/I/U/...)
│   │   │   ├── ToolbarDivider
│   │   │   ├── AIToolbarButton (✨)
│   │   │   ├── FindToolbarButton (🔍)
│   │   │   └── MoreMenu (⋮)
│   │   │
│   │   ├── EditorMain
│   │   │   ├── EditorContent (富文本/CodeMirror)
│   │   │   ├── AIInlineSuggestion
│   │   │   │   ├── SuggestedText
│   │   │   │   ├── AcceptButton
│   │   │   │   └── DismissButton
│   │   │   └── ScrollBar (自定义)
│   │   │
│   │   ├── StatusBar
│   │   │   ├── WordCount
│   │   │   ├── CharCount
│   │   │   ├── ReadabilityScore
│   │   │   └── DocFormat
│   │   │
│   │   └── AIBar
│   │       ├── QuickActions (继续/改写/润色/翻译)
│   │       ├── AIInput
│   │       └── SendButton
│   │
│   ├── DockResizer
│   │
│   └── AIDock
│       ├── DockTabs
│       │   ├── Tab (Suggestion)
│       │   ├── Tab (Rewrite)
│       │   └── Tab (Analysis)
│       └── DockPanel
│           ├── SuggestionPanel
│           │   ├── SuggestionItem
│           │   └── SuggestionItem
│           ├── RewriteHistory
│           │   ├── RewriteEntry (原文→改文)
│           │   └── RewriteEntry
│           └── AnalysisPanel
│               ├── ReadabilityGauge
│               ├── ToneIndicator
│               └── VocabStats
│
└── ChatPanel (浮层，按需)
    ├── ChatMessages
    ├── ChatInput
    └── ChatSettings
```

### 5.2 关键组件样式

#### 新建文档按钮（同 Reasonix `.sidebar__new`）

```css
.doc-new {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  height: 44px;
  padding: 0 12px;
  margin-bottom: 10px;
  background: var(--grad);
  border: 0;
  border-radius: 12px;
  color: var(--accent-text, var(--accent-fg));
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 6px 18px -6px var(--accent), var(--shadow-1);
  transition: color var(--dur-fast), background var(--dur-fast),
              box-shadow var(--dur-fast), transform var(--dur-fast);
}
.doc-new:hover {
  filter: saturate(1.08) brightness(1.03);
  transform: translateY(-1px);
}
.doc-new:active {
  transform: translateY(0) scale(0.99);
}
```

#### AI 指令输入条

```css
.ai-bar {
  flex: 0 0 auto;
  border-top: 1px solid var(--border-soft);
  background: var(--chat-bg);
  padding: 8px 32px 10px;
}

.ai-bar__inner {
  max-width: var(--maxw, 820px);
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

.ai-bar__quick-actions {
  display: flex;
  gap: 4px;
  flex: 0 0 auto;
}

.ai-bar__input-wrap {
  flex: 1 1 auto;
  position: relative;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-elev);
  transition: border-color var(--dur-fast), box-shadow var(--dur-fast);
}
.ai-bar__input-wrap:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-soft);
}

.ai-bar__input {
  width: 100%;
  padding: 9px 12px;
  border: none;
  background: transparent;
  color: var(--fg);
  font: inherit;
  font-size: var(--text-md);
  outline: none;
  resize: none;
}

.ai-bar__send {
  flex: 0 0 auto;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  border: none;
  background: var(--accent);
  color: var(--accent-fg);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: opacity var(--dur-fast), transform var(--dur-fast);
}
.ai-bar__send:disabled {
  opacity: 0.4;
  cursor: default;
}
.ai-bar__send:not(:disabled):hover {
  transform: scale(1.05);
}
```

#### AI 内联建议

```
┌─────────────────────────────────┐
│  这里是用户自己写的原文内容...   │
│  继续往下写，讲述故事的           │
│  [这里是 AI 建议的连续文本]      │
│  ──────── 灰色虚线 ────────     │
│  [Tab 接受]  [Esc 忽略]         │
│  后面又是用户写的内容...         │
└─────────────────────────────────┘
```

```css
.ai-inline-suggestion {
  position: relative;
  color: var(--text-3);
  pointer-events: none;
}

.ai-inline-suggestion__divider {
  border: none;
  border-top: 1px dashed var(--border);
  margin: 4px 0;
}

.ai-inline-suggestion__actions {
  display: flex;
  gap: 8px;
  padding: 4px 0;
  font-size: var(--text-xs);
  color: var(--fg-faint);
  pointer-events: auto;
}

.ai-inline-suggestion__key-hint {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border: 1px solid var(--border-soft);
  border-radius: 4px;
  background: var(--bg-elev);
  font-family: var(--mono);
  font-size: 10px;
  cursor: pointer;
  transition: border-color var(--dur-fast), color var(--dur-fast);
}
.ai-inline-suggestion__key-hint:hover {
  border-color: var(--accent);
  color: var(--accent);
}
```

#### AI 侧栏建议项

```css
.suggestion-item {
  padding: 10px 12px;
  border: 1px solid var(--border-soft);
  border-radius: 8px;
  background: var(--bg-elev);
  cursor: pointer;
  transition: border-color var(--dur-fast), background var(--dur-fast);
}
.suggestion-item:hover {
  border-color: var(--accent-soft);
  background: var(--accent-soft);
}

.suggestion-item__text {
  font-size: var(--text-sm);
  line-height: 1.55;
  color: var(--fg-dim);
  margin-bottom: 6px;
}

.suggestion-item__actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

.suggestion-item__btn {
  height: 26px;
  padding: 0 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--button-bg);
  color: var(--fg-dim);
  font: inherit;
  font-size: var(--text-xs);
  cursor: pointer;
  transition: color var(--dur-fast), border-color var(--dur-fast);
}
.suggestion-item__btn--apply {
  background: var(--accent-soft);
  border-color: transparent;
  color: var(--accent);
  font-weight: 600;
}
.suggestion-item__btn--apply:hover {
  background: var(--accent);
  color: var(--accent-fg);
}
```

### 5.3 按钮系统

沿用 Reasonix 的 `.btn` 体系：

```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: var(--button-height, 34px);
  padding: 0 var(--button-px, 12px);
  border: 1px solid var(--button-border);
  background: var(--button-bg);
  color: var(--button-fg);
  font: inherit;
  font-size: var(--font-control, 13px);
  font-weight: 500;
  border-radius: var(--button-radius, 8px);
  white-space: nowrap;
  cursor: pointer;
  transition: color 0.12s, border-color 0.12s, background 0.12s;
}
.btn:hover { background: var(--button-bg-hover); border-color: var(--button-border-hover); }
.btn:focus-visible { box-shadow: var(--focus-ring); outline: none; }
.btn:disabled { opacity: 0.52; cursor: default; }

.btn--primary {
  background: var(--control-primary-bg);
  border-color: var(--control-primary-bg);
  color: var(--control-primary-fg);
  font-weight: 600;
}
.btn--small { height: 30px; font-size: 12px; }
```

### 5.4 Toolbar 格式按钮

```css
.toolbar-btn {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--fg-dim);
  cursor: pointer;
  transition: background var(--dur-fast), color var(--dur-fast);
}
.toolbar-btn:hover {
  background: var(--sidebar-hover);
  color: var(--fg);
}
.toolbar-btn--active {
  background: var(--accent-soft);
  color: var(--accent);
}
```

---

## 6. 交互细节

### 6.1 动效体系

沿用 Reasonix 的时间曲线 token：

```css
:root {
  --dur-fast:   120ms;
  --dur-base:   180ms;
  --dur-slow:   340ms;
  --dur-slower: 420ms;

  --ease-out:       cubic-bezier(0.2, 0.72, 0.2, 1);
  --ease-decelerate: cubic-bezier(0.2, 0.7, 0.1, 1);
  --ease-standard:  cubic-bezier(0.25, 0.1, 0.25, 1);

  --motion-pop-scale: 0.98;
  --motion-rise: 4px;
}
```

### 6.2 快捷键体系

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+N` | 新建文档 |
| `Ctrl+W` | 关闭文档 |
| `Ctrl+Tab` | 切换文档标签 |
| `Ctrl+B` | 加粗 |
| `Ctrl+I` | 斜体 |
| `Ctrl+K` | AI 指令模式（聚焦 AI Bar） |
| `Ctrl+Enter` | 发送 AI 指令 |
| `Tab` | 接受 AI 内联建议 |
| `Esc` | 忽略 AI 内联建议 |
| `Ctrl+\` | 切换侧栏 |
| `Ctrl+Shift+\` | 切换 AI Dock |
| `Ctrl+Shift+Z` | 专注模式（Zen Mode） |

### 6.3 拖拽调整大小

完全参考 Reasonix 的实现：

- **侧栏**：`SidebarResizer`，绝对定位，`:hover` 时显示 accent 色竖线
- **AI Dock**：`DockResizer`，grid 列之间，同理
- 拖拽时添加 `.layout--resizing` class 禁用 `transition` 和 `user-select`
- macOS 上使用更平缓的 `cubic-bezier(0.2, 0.72, 0.2, 1)`

### 6.4 AI 交互模式

**内联建议模式**（默认）：
- 编辑器内以灰色文字显示 AI 续写
- `Tab` 接受 / `Esc` 忽略
- 继续打字自动忽略旧建议

**指令模式**：
- 聚焦 AI Bar（`Ctrl+K`）
- 输入指令如 "/润色" "/改写为学术风格" "/续写300字"
- `Ctrl+Enter` 发送
- 结果插入编辑器或显示在 AI Dock

**改写模式**：
- 选中文本 → AI Bar 自动出现改写选项
- 点击"改写" → AI Dock 显示多个改写版本
- 点击任一版本 → 替换原文

---

## 7. 响应式与自适应

### 7.1 断点

```css
/* 窄屏 < 820px — 隐藏侧栏，编辑器占满 */
@media (max-width: 820px) {
  .layout { grid-template-columns: minmax(0, 1fr); }
  .sidebar { display: none; }
  .sidebar-resizer { display: none; }
  .ai-dock { position: fixed; inset: 0; z-index: var(--z-dock); }
  /* ... */
}

/* 中屏 820-1200px — 侧栏折叠状态 + AI Dock 可展开 */
@media (max-width: 1200px) {
  .layout { --ai-dock-width: min(420px, 40vw); }
}

/* 宽屏 > 1600px — 所有面板展开 */
@media (min-width: 1600px) {
  :root { --sidebar-width: 300px; --ai-dock-width: 480px; }
}
```

### 7.2 容器查询

AI Dock 内的面板使用容器查询：

```css
.ai-dock-panel {
  container-type: inline-size;
}

@container (max-width: 320px) {
  .suggestion-item { padding: 8px; }
  .suggestion-item__text { font-size: 12px; }
}
```

---

## 8. 主题系统

### 8.1 数据属性

| 属性 | 值 | 说明 |
|------|----|------|
| `data-theme` | `"light"`, `"dark"` | 手动覆盖 OS 主题 |
| `data-theme-style` | `"paper"`, `"ink"`, `"sage"`, `"rose"`, `"slate"`, `"amber"` | 视觉方向 |
| `data-font-family` | `"system"`, `"serif"`, `"yahei"`, `"pingfang"`, `"noto"`, `"custom"` | 字体偏好 |
| `data-theme-mode` | — | 内部状态 |
| `data-theme-scheme` | — | 内部状态 |

### 8.2 持久化

```typescript
// 同 Reasonix 的 localStorage 策略
const THEME_KEY = "writer-theme";
const STYLE_KEY = "writer-theme-style";
const FONT_KEY = "writer-font-family";
```

### 8.3 设置面板

参考 Reasonix 的 SettingsPanel，提供：

1. **外观** → 主题（auto/light/dark）+ 风格方向 + 字体选择 + 字号缩放
2. **编辑器** → 行高、段间距、默认格式（Markdown / 富文本）
3. **AI** → 模型选择、温度、最大 token、快捷指令管理
4. **快捷键** → 全部快捷键自定义

---

## 9. CSS 变量清单

### 9.1 布局

```css
--sidebar-width
--editor-min-width
--ai-dock-width
--resizer-width
--toolbar-height
--ai-bar-height
--statusbar-height
--chrome-toggle-width
```

### 9.2 表面

```css
--stage, --surface, --surface-2, --surface-3
--bg, --bg-soft, --bg-elev, --bg-elev-2
--sidebar-bg, --sidebar-hover, --sidebar-active
--editor-bg
```

### 9.3 文字

```css
--text, --text-2, --text-3
--fg, --fg-dim, --fg-faint
--font-scale
--text-2xs ～ --text-3xl
```

### 9.4 品牌 / 语义

```css
--accent, --accent-fg, --accent-soft, --accent-strong
--grad
--ok, --warn, --err, --danger
```

### 9.5 边框

```css
--border, --border-2, --border-soft
```

### 9.6 编辑器

```css
--editor-cursor
--editor-selection
--editor-line-highlight
--editor-gutter, --editor-gutter-bg
```

### 9.7 动效

```css
--dur-fast, --dur-base, --dur-slow, --dur-slower
--ease-out, --ease-decelerate, --ease-standard
--motion-pop-scale, --motion-rise
```

### 9.8 z-index

```css
--z-local-raised: 2
--z-local-handle: 4
--z-layout-resizer: 12
--z-dock: 100
--z-floating-menu: 110
--z-modal: 1200
--z-popover: 1301
--z-toast: 1302
--z-tooltip: 1302
--z-onboarding: 9999
```

### 9.9 其他

```css
--radius (默认 8px)
--maxw (编辑器最大宽 820px)
--mono, --sans, --serif, --editor-mono
--focus-ring
--shadow-1, --shadow-2
--scrollbar-*
```

---

## 附录：与 Reasonix 的对比映射

| Reasonix | 写作助手 | 备注 |
|----------|----------|------|
| `.app` | `.app` | 全屏容器，不变 |
| `.layout` | `.layout` | CSS Grid 主容器，不变 |
| `.sidebar` | `.sidebar` | 侧栏，内容替换 |
| `.chat-pane` | `.editor-pane` | 核心区域从聊天流变为编辑器 |
| `.topicbar` | `.toolbar` | 顶部工具栏，功能不同但结构相似 |
| `.main` / `.transcript` | `.editor-main` | 消息列表 → 编辑器 |
| `.footer` / `.composer` | `.ai-bar` | Composer → AI 指令条 |
| `.statusbar` | `.statusbar` | 状态栏，数据改为文档统计 |
| `.workbench-dock` | `.ai-dock` | 右侧面板，内容不同 |
| `.composer__input` | `.ai-bar__input` | 输入组件，从命令式变为指令式 |
| `.transcript__message` | `.suggestion-item` | 消息气泡 → 建议卡片 |
| `data-theme-style="graphite"` | `data-theme-style="paper"` | 默认方向换为写作主题 |
| `--accent: #ff6a3d` (橙红) | `--accent: #d9802e` (暖橙棕) | 主色适应写作场景 |

---

> 本文案为 AI 写作助手的完整 UI 设计方案，参考了 Reasonix 的成熟体系（CSS 变量驱动主题、CSS Grid 三栏布局、BEM 命名、桌面级交互），并针对写作场景进行了深度定制。可直接作为前端实现的指导文档。
