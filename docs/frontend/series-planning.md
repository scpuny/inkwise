# 专栏系列规划

> 版本: v1.4 | 位置: `src/components/series/`

---

## 概述

系列规划模块提供 AI 辅助的专栏文章规划能力。用户可以描述一个系列主题，AI 自动生成多篇文章大纲，然后逐篇确认和细化，最终生成完整的系列计划。

## 组件结构

```
series/
├── SeriesPlanner.tsx   # 规划主面板（AI 生成提纲）
├── PlanReview.tsx      # 计划审阅与逐篇编辑
├── SeriesOverview.tsx  # 系列概览卡片
└── index.ts            # 模块导出
```

## 工作流

1. **输入阶段** — 用户输入系列主题、目标读者、风格要求
2. **AI 生成** — 调用 AI API 生成 5-10 篇文章提纲
3. **审阅阶段** — 用户逐篇审阅、修改标题和描述
4. **定稿保存** — 生成 `SeriesPlan` 持久化到存储层

## 数据结构

```typescript
interface SeriesPlan {
  id: string;
  collectionId: string;
  title: string;
  description: string;
  tone?: string;
  targetAudience?: string;
  articles: SeriesArticle[];
  createdAt: number;
}

interface SeriesArticle {
  id: string;
  title: string;
  description?: string;
  targetWordCount?: number;
  status: "planned" | "generating" | "draft" | "done";
}
```

## 与存储层集成

- `SeriesPlan` 存储在 `collections` 的 SQLite/JSON 层
- 系列文章通过 `collectionId` 关联到合集
- 生成单篇文章时通过事件总线触发 `plan-series-article` 事件

## 与文章规划管线集成（v1.7）

系列规划与文章生成管线通过 `prefilledTitle` / `prefilledDescription` 机制深度集成：

1. **系列规划阶段**：用户审阅并确认系列中每篇文章的标题和简介
2. **生成单篇文章时**：将预填的 title/description 通过 `PlanInput.prefilledTitle` 和 `PlanInput.prefilledDescription` 传入
3. **规划管线**：`generateTitle()` 和 `generateDescription()` 检测到预填值时跳过 AI 调用，直接返回已有值
4. **效果**：系列文章的标题保持一致，不受 AI 生成随机性影响；用户保留对每篇文章标题的完全控制

### 数据流

```
SeriesPlanner → 用户确认 n 篇文章标题/简介
  → 点击"开始写作"（某篇文章）
  → EditorPane 构造 PlanInput 含 prefilledTitle/Description
  → plan.ts generateTitle() / generateDescription() 跳过 AI 步骤
  → 后续 outline/writing 阶段正常执行
```
