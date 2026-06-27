# 发布流程详解

> 版本: v1.0 | 关联: publishing/article-final-page-design.md

---

## 1. 发布流程总览

```
写作完成 (phase === "complete")
       │
       ▼
成品页面 (ArticleFinalPage)
  ├─ 点击 [发布] → PublishDialog 打开
  ├─ 选择平台 → 配置选项 → 执行发布
  │
  └─ 发布管线:
      1. 验证平台凭据（access_token）
      2. Markdown → 平台 HTML 转换
      3. 提取并上传图片到平台 CDN
      4. 创建草稿 (draft/add)
      5. [用户确认] → 正式发布 (draft/publish)
```

## 2. 发布对话框 (PublishDialog)

双列布局：

| 左侧 | 右侧 |
|------|------|
| 平台选择列表 | 发布选项 |
| 微信（配置状态） | 封面图上传 |
| 头条（待实现） | 正文选择 |
| | 更多字段（公众号专用） |

## 3. Markdown → HTML 转换

两条转换路径：

| 目标 | 函数 | 特点 |
|------|------|------|
| 微信草稿 | `compileToWechatHtml()` | 内联样式、剥离 class、兼容 `<strong>` / `<code>` |
| 复制/通用 | `compileToInlinedHtml()` | 解析 var(--accent) 和 color-mix() 为实色值 |

转换要点：

- 代码块：剥离 hljs class，保留基本样式
- 引用块：多行支持，空行自动跳过
- 标题：h1-h4 层级映射
- 外部链接：清理防止微信 64562 错误

## 4. 图片处理

```
文章 Markdown 中的图片引用
  │
  ├─ 本地相对路径 → 拼接文章目录 → 读文件
  ├─ 本地绝对路径 → 直接读取
  └─ 远程 URL → reqwest 下载
  │
  ▼
POST 微信素材接口 (add_material)
  │
  ▼
替换 Markdown 中图片路径为微信 CDN URL
```

## 5. 发布增强（v1.4.0）

| 功能 | 说明 |
|------|------|
| 发布历史展开详情 | 点击展开平台 ID、发布时间、错误信息 |
| 草稿链接 | 发布结果区域显示可点击的草稿链接 |
| 20000 字预警 | 文章超过 20000 字时发布前弹出预警 |
| 微信错误码中文描述 | 将微信 API 错误码映射为可读中文描述 |

## 6. 发布记录

```typescript
PublishRecord {
  id: string;
  articleId: string;
  platform: string;
  platformArticleId?: string;
  status: "draft" | "published" | "failed";
  errorMessage?: string;
  publishedAt: number;
  platformUrl?: string;
}
```

---

> 关联文档: [成品页面与发布设计](article-final-page-design.md) | [后端模块](../backend/backend-modules.md)
