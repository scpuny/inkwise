# 事件总线

> 版本: v1.4 | 位置: `src/lib/events/`

---

## 概述

轻量级事件总线，用于组件间解耦通信。所有自定义事件名和 payload 类型在 `events.ts` 集中定义，通过 `eventBus.ts` 的 `emit/on/off` API 进行发布订阅。

## 模块结构

```
events/
├── eventBus.ts    # 事件总线核心（emit / on / off）
└── events.ts      # 事件类型定义
```

## 核心 API

- `emit(name, payload)` — 发布事件
- `on(name, handler)` — 订阅事件，返回取消订阅函数
- `off(name, handler)` — 取消订阅

## 主要事件

| 事件名 | Payload | 用途 |
|--------|---------|------|
| `outline-navigate` | `{ headingText }` | 大纲点击跳转 |
| `auto-plan-article` | `{ collectionId, title, description, tone, skillId }` | AI 自动规划文章 |
| `plan-series-article` | `{ collectionId, seriesId, article }` | 系列文章规划 |
| `plan-series-saved` | `{ collectionId, seriesId }` | 系列计划保存 |
| `article-style-changed` | `{ articleId }` | 文章样式变更 |
| `writing-skill-changed` | `{ skillId }` | 写作技能切换 |
| `ai-config-changed` | `{ provider, model }` | AI 配置变更通知 |
| `collections-changed` | 无 | 合集数据变更通知（蓝图阶段变更、文章增删、合集更新时触发，CollectionTree 自动刷新） |

## 使用示例

```typescript
import { emit, on } from "../lib/events/eventBus";

// 发布
emit("outline-navigate", { headingText: "简介" });

// 订阅（返回取消函数）
const unsub = on("auto-plan-article", (detail) => {
  console.log(detail.collectionId);
});

// 清理
unsub();
```
