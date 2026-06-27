# 状态管理

> 版本: v1.4 | 位置: `src/store/`, `src/lib/config/`, `src/hooks/`

---

## 概述

使用 Zustand 作为全局状态管理库，替代 React 组件内大量分散的 useState。核心 Store 分为三个：appStore（UI 状态）、editorStore（编辑器状态）、themeStore（主题状态）。

## Store 结构

### appStore

```
zustand store: AppState
├── 面板开关: settingsOpen, sidebarOpen, commandPaletteOpen, focusMode, manageOpen, seriesPlannerOpen
├── 布局: sidebarWidth, resizing
├── 文章关联: activeArticleId, activeCollectionId, hasActiveArticle
├── 大纲: outlineItems, activeOutlineId
├── 系列规划: seriesPlannerColId, seriesPlannerColTitle, seriesPlannerFolder
└── 操作: openSettings, closeSettings, setActiveArticle, toggleFocusMode, ...
```

### editorStore

```
zustand store: EditorStore
├── theme: editorTheme (vs-dark, vs-light, hc-black)
├── fontSize, fontFamily, lineHeight
├── wordWrap, minimap, tabSize
└── Actions: setEditorTheme, setFontSize, ...
```

### themeStore

```
zustand store: ThemeStore
├── mode: 'light' | 'dark' | 'follow-system'
├── themeId: 当前选中主题 ID
├── availableThemes: ThemeMeta[]
└── Actions: setMode, setTheme, ...
```

## 全局配置

- `useGlobalAIConfig()` hook 封装 AI 提供商配置的读写
- `lib/config/globalAIConfig.ts` 负责持久化
- 配置项通过事件总线通知各组件刷新
