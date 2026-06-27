# 导出系统

> 版本: v1.4 | 位置: `src/lib/export/`

---

## 概述

提供文章导出为多种格式的能力，当前支持 HTML（通用内联样式版）和微信公众号排版格式。

## 模块结构

```
export/
├── html.ts       # HTML 导出（内联样式，通用格式）
├── wechat.ts     # 微信公众号排版导出
├── types.ts      # 公共类型定义
└── index.ts      # 模块导出
```

## 导出方式

### HTML（通用内联样式）

- `compileToInlinedHtml(content)` — 将文章正文编译为带内联样式的 HTML
- 适合复制到各类富文本编辑器、邮件、博客平台
- 所有样式内联到每个元素，不依赖外部 CSS

### 微信公众平台

- `compileToWechatHtml(content)` — 编译为微信公众号兼容的 HTML
- `renderWechatHtml(html)` — 渲染预览
- `addStyledClasses(html)` — 为微信编辑器添加样式类
- 使用 section 标签布局，兼容微信编辑器
- 图片使用 data-src 适配微信

## 类型

```typescript
interface ExportResult {
  html: string;
  title?: string;
}

interface ImageItem {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
}
```
