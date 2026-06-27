# 主题与样式系统

> 版本: v1.0 | 技术: CSS 变量 + BEM 命名

---

## 1. CSS 变量三层覆盖

```
Layer 1: :root 默认暗色变量
Layer 2: @media (prefers-color-scheme: light) 系统浅色覆盖
Layer 3: [data-theme="light"] / [data-theme="dark"] 用户强制覆盖
```

用户强制模式优先级最高，系统模式次之。

## 2. 六种主题风格

| 标识 | 名称 | 色相 | 强调色 |
|------|------|------|--------|
| graphite | 石墨 | 暖橙 | #d97757 |
| aurora | 极光 | 紫蓝渐变 | 渐变 |
| slate | 石板 | 蓝色 | #4d8df6 |
| carbon | 碳灰 | 青色 | #2dd4bf |
| nocturne | 夜曲 | 紫色 | #818cf8 |
| amber | 琥珀 | 橙红 | #d4632f |

每种风格通过 CSS 变量覆盖实现：

```css
[data-style="graphite"] {
  --accent: #d97757;
  --accent-dim: color-mix(in srgb, #d97757 70%, black);
  --accent-bg: color-mix(in srgb, #d97757 15%, transparent);
}
```

## 3. 三种主题模式

| 模式 | 说明 |
|------|------|
| auto | 跟随系统 `prefers-color-scheme`（默认暗色） |
| dark | 强制深色模式 |
| light | 强制浅色模式 |

## 4. 样式管线

```
编辑器样式面板（StylePanel）
  │
  ├─ 修改字号/字体/行高 → ArticleContext.updateStyle()
  │   ├─ apply() → document.documentElement.style 设置 CSS 变量
  │   └─ save() → 持久化到 articles/{id}.styles.json
  │
  └─ 切换主题风格/模式
      ├─ 更新 data-style / data-theme 属性
      └─ emit('theme-changed') 事件通知全应用
```

### 4.1 文章级样式（ArticleContext）

v1.4.0 引入，每篇文章独立样式配置：

- 切换文章时自动恢复该文章样式
- 旧 context 自动 GC 回收
- 样式配置与文章内容独立存储

### 4.2 全局样式

- 主题风格和模式是全局设置（所有文章共享）
- 存储在 `localStorage` 或 Tauri store
- 启动时从持久层读取并 apply

## 5. 布局栅格

```css
.layout {
  display: grid;
  grid-template-columns:
    [sidebar]  var(--sidebar-width, 264px)
    [editor]   minmax(0, 1fr)
    [resizer]  var(--resizer-width, 8px)
    [ai-dock]  var(--ai-dock-width, 420px);
  grid-template-rows: 1fr auto;
}
```

三栏可调宽布局：侧边栏 | 编辑器 | AI 面板。

---

> 关联文档: [UI 设计方案](AI写作助手-UI设计方案.md) | [编辑器内核](editor-engine.md)
