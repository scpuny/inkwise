# 编辑器内核

> 版本: v1.0 | 技术栈: TipTap 3 (ProseMirror) + Markdown

---

## 1. 技术选型

| 组件 | 版本 | 说明 |
|------|------|------|
| @tiptap/react | ^3.26 | React 绑定 |
| @tiptap/core | ^3.26 | 核心编辑器引擎 |
| @tiptap/starter-kit | ^3.26 | 基础扩展包 |
| @tiptap/extension-placeholder | ^3.26 | 占位符 |
| @tiptap/extension-underline | ^3.26 | 下划线 |
| @tiptap/pm | ^3.26 | ProseMirror 底层 |

## 2. 双模式编辑

### 富文本模式

TipTap 原生 WYSIWYG 编辑，支持：

- 标题层级（h1-h4，禁止 h1 混用）
- 粗体 / 斜体 / 删除线 / 下划线
- 有序列表 / 无序列表 / 任务列表
- 代码块（带语法高亮）
- 引用块（blockquote，多行支持）
- 表格
- 图片内联
- 链接

### Markdown 源码模式

通过 Textarea 实现，支持：

- 与富文本模式实时切换
- 自动同步到 ProseMirror 文档
- 实时字数统计

## 3. 编辑器配置

```typescript
const editor = useEditor({
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4] },
    }),
    Placeholder.configure({
      placeholder: '开始写作…',
    }),
    Underline,
  ],
});
```

## 4. 状态栏（StatusBar）

编辑器底栏实时显示：

| 项 | 说明 |
|----|------|
| 字数 | 中文字数统计 |
| 字符数 | 含标点的总字符数 |
| 行数 | 文档行数 |
| 编辑模式 | 富文本 / Markdown 切换 |

## 5. 编辑器样式

样式通过 `StylePanel` 控制，所有样式配置通过 ArticleContext 持久化：

| 配置 | 说明 |
|------|------|
| 字体 | 系统字体 / 衬线 / 等宽等预设 |
| 字号 | small / default / large / xlarge |
| 行高 | 1.5 — 2.0 |
| 段间距 | 控制段落间空白 |
| 主题色 | 强调色、标题装饰色 |
| 代码块主题 | 亮色/暗色代码块配色 |
| 引用样式 | 引用块左边框色 |

## 6. 成品页预览

文章完成（phase === "complete"）后进入 `ArticleFinalPage`，右侧面板使用 Markdown 渲染只读视图：

- 所有 Markdown 格式渲染为 HTML
- 代码块语法高亮（highlight.js，40+ 语言）
- 图片渲染为实际图片
- 链接可点击
- 支持 `compileToWechatHtml`（微信兼容 HTML）
- 支持 `compileToInlinedHtml`（内联样式，复制粘贴用）

---

> 关联文档: [UI 设计方案](AI写作助手-UI设计方案.md) | [主题系统](theme-system.md) | [快捷键](shortcuts.md)
