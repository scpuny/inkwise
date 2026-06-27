# ArticleContext — 文章级独立上下文

> 版本: v1.4 | 位置: `src/lib/article/ArticleContext.ts`, `src/lib/editor/editorStyles.ts`

---

## 概述

ArticleContext 是 v1.4 引入的文章级独立上下文管理方案。每篇文章拥有独立的样式配置、蓝图信息，切换文章时自动加载/保存，互不干扰。

## 解决的问题

- 切换文章时样式配置互相覆盖
- 文章样式、蓝图等状态散落在多个 useState 中
- 临时切换文章再切回时，原文章的编辑状态丢失

## 核心设计

```typescript
class ArticleContext {
  readonly articleId: string;
  private _styleConfig: ArticleStyleConfig;
  private _blueprint: Blueprint | null;

  // 样式的读写
  getStyleConfig(): ArticleStyleConfig;
  updateStyleConfig(partial: Partial<ArticleStyleConfig>): void;

  // 蓝图的读写
  getBlueprint(): Blueprint | null;
  setBlueprint(bp: Blueprint): void;
}
```

- 切换文章时：旧实例回收，新实例从存储加载
- 样式变更时自动持久化到 localStorage（通过 `saveArticleStyleConfig`）
- 通过 React Context (`createContext`) 注入到组件树

## 样式配置

```typescript
interface ArticleStyleConfig {
  editorStyleTemplateId: string;  // 样式模板
  lineHeight: number;             // 行高
  editorFontSize: number;         // 字号
  editorMaxWidth: number;         // 最大宽度
  editorFontFamily: string;       // 字体
  codeThemeId: string;            // 代码主题
  firstLineIndent: boolean;       // 首行缩进
  justifyAlign: boolean;          // 两端对齐
  articleThemeId: string;         // 文章主题
  customCSS: string;              // 自定义 CSS
  // ...
}
```

## 与样式引擎的协作

- `editorStyles.ts` 提供 `loadArticleStyleConfig` / `saveArticleStyleConfig` 进行持久化
- `applyArticleStyleConfig(config)` 将样式配置应用到编辑器实例
- 事件 `article-style-changed` 在样式变更时通知其他组件同步
