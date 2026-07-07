# 15 — 未来功能扩展规划

> 关联: 12-feature-map.md, 06-context-planner.md, 07-new-skills.md

---

## 一、扩展全景图

```
当前 InkWise 聚焦「写」的阶段
                             未来扩展方向
    ┌─────────────────┐
    │  热点发现       │  ← 多平台热点追踪 + 趋势分析
    └────────┬────────┘
             ▼
    ┌─────────────────┐
    │  选题策划       │  ← 热点 → 选题建议 + 角度挖掘
    └────────┬────────┘
             ▼
    ┌─────────────────┐
    │  素材收集       │  ← 视频/音频提取 → 文字素材
    └────────┬────────┘
             ▼
    ┌─────────────────┐
    │  内容创作       │  ← InkWise 当前核心
    └────────┬────────┘
             ▼
    ┌─────────────────┐
    │  改写发布       │  ← AI 改写 → 多平台适配
    └────────┬────────┘
             ▼
    ┌─────────────────┐
    │  效果追踪       │  ← 阅读量分析 → 写作优化
    └─────────────────┘
```

---

## 二、功能详述

### 2.1 多平台热点追踪

**目标**：自动抓取各大平台的热门话题/文章，供用户选题参考。

#### 数据源

| 平台 | 获取方式 | 数据形式 | 频率 |
|------|---------|---------|------|
| 微信公众号 | 搜狗微信搜索 / 第三方API | 标题+摘要+阅读量 | 每日 |
| 知乎 | 知乎热榜 API | 问题+回答数+热度 | 实时 |
| 今日头条 | 头条热搜 API | 标题+阅读量+评论 | 实时 |
| 微博 | 微博热搜 API | 话题+讨论量 | 实时 |
| 百度 | 百度热搜 API | 关键词+搜索指数 | 实时 |
| 抖音/小红书 | 公开数据抓取 | 话题标签+播放量 | 每日 |

#### 架构

```
src/lib/hot-topics/
├── types.ts              // HotTopic, HotSource, TrendData
├── fetcher.ts            // 统一获取调度器
├── sources/
│   ├── wechat.ts         // 微信热点
│   ├── zhihu.ts          // 知乎热榜
│   ├── toutiao.ts        // 头条热搜
│   ├── weibo.ts          // 微博热搜
│   └── baidu.ts          // 百度热搜
├── analyzer.ts           // 热点分析：趋势、关联话题、热度变化
├── matcher.ts            // 热点 → 用户已写文章的关联度匹配
└── index.ts
```

#### 存储

```sql
CREATE TABLE hot_topics (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,            -- 'wechat' | 'zhihu' | 'toutiao' | ...
    title TEXT NOT NULL,
    url TEXT,
    summary TEXT,
    heat_index INTEGER,
    trend TEXT,                      -- 'rising' | 'falling' | 'stable'
    category TEXT,
    tags TEXT,
    fetched_at INTEGER NOT NULL,
    expires_at INTEGER
);

CREATE INDEX idx_hot_topics_source ON hot_topics(source, fetched_at);
```

### 2.2 基于热点创作

**流程**：

```
用户选择一个热点话题
    ↓
Hot Topic Matcher：
  1. 向量检索用户已有文章（是否写过类似主题？）
  2. 分析热点的角度和切入点
  3. 建议文章差异化方向
    ↓
Context Planner 生成写作计划：
  - 热点原文摘要
  - 竞品角度分析
  - 推荐写作风格（根据热点类型）
  - 推荐文章主题
    ↓
用户确认 → Agent 按 Style 分阶段生成
```

### 2.3 AI 改写文章

**场景**：
- 改写同一篇文章适配不同平台风格
- 同一内容换角度重写
- 长文 ↔ 短文互转

```
src/lib/ai/rewrite/
├── types.ts              // RewriteOptions, RewriteTarget
├── platform-presets.ts   // 各平台改写模板
├── rewriter.ts           // 核心改写引擎
└── index.ts
```

**改写预设**：

| 平台 | 风格 | 字数 | 特点 |
|------|------|------|------|
| 微信公众号 | 叙事引导 | 1500-3000 | 开头钩子、故事化 |
| 知乎 | 专业深度 | 2000-5000 | 引用+数据、逻辑链 |
| 今日头条 | 标题党 | 800-1500 | 强标题、短段落 |
| 微博 | 极短 | 140-500 | 观点性、金句 |
| 小红书 | 种草 | 300-800 | 情绪化、emoji |
| 博客 | 个人风格 | 1000-3000 | 自由叙述 |

### 2.4 视频/音频提取创作

**目标**：从视频/音频中提取文字 → 整理 → 创作。

#### 处理流程

```
视频/音频文件
    ↓
① 音轨提取（ffmpeg）
    ↓
② 语音转文字（Whisper / 本地模型）
    ↓
③ 智能分段（Speaker Diarization / 语义分段）
    ↓
④ 内容结构化（AI 整理）
    │
    ├── → 生成文章草稿
    ├── → 提取金句列表
    └── → 生成摘要 / 目录
```

#### 技术选型

| 阶段 | 方案 | 说明 |
|------|------|------|
| 音轨提取 | `ffmpeg` CLI | 成熟稳定，跨平台 |
| 语音转文字 | Whisper.cpp / OpenAI Whisper API | 本地/云端双模式 |
| 说话人分离 | pyannote-audio (Python) / 简化版 | 可选 |
| 内容结构化 | LLM 处理 | 复用 InkWise AI 引擎 |

#### Rust 端架构

```
src-tauri/src/media/
├── mod.rs                // 导出
├── extractor.rs          // ffmpeg 音轨提取
├── transcriber.rs        // Whisper 转写
└── structurer.rs         // 结构化处理
```

### 2.5 效果追踪

**远期**：接入各平台阅读量 API，追踪发布效果。

```
发布文章 → 追踪阅读量/点赞/评论
    ↓
效果分析 → 哪些标题更好？哪些话题更热？
    ↓
写作建议 → AI 根据数据给出优化方向
```

---

## 三、扩展对现有架构的影响

### 新的领域模块

```
src/lib/
├── hot-topics/          ← 新
├── rewrite/             ← 新
├── media/               ← 新
└── analytics/           ← 未来

src-tauri/src/
├── media/               ← 新
├── hot_topics.rs        ← 新
└── analytics.rs         ← 未来
```

### 现有模块的影响

| 现有模块 | 影响 | 说明 |
|---------|------|------|
| 06-context-planner | 增加新的 intent 类型 | hot_topic_creation / rewrite / media_to_text |
| 07-new-skills | 增加新 builtin skill | 热点创作、改写适配、视频转文章 |
| 05-vector-embedding | project_chunks 可扩展为 media_chunks | 视频转写文本也可向量化 |
| 11-architecture | 模块目录自然扩展 | 按领域分包 |

### Context Planner 新增意图

```typescript
{
  keywords: ['热点', '热榜', '热门', '趋势', '热搜', 'trending'],
  plan: {
    intent: 'hot_topic_creation',
    requiredContexts: [
      { source: 'vector_search', scope: 'related_only', maxTokens: 2000, priority: 5 },
      { source: 'article_series', scope: 'related_only', maxTokens: 500, priority: 3 },
    ],
    suggestedTools: ['read_document', 'write_document', 'call_web_search'],
    skipSections: ['git_diff', 'ast_symbols'],
  },
},
{
  keywords: ['改写', '适配', '重写', 'rewrite', 'repurpose'],
  plan: {
    intent: 'rewrite_article',
    requiredContexts: [
      { source: 'vector_search', scope: 'related_only', maxTokens: 1500, priority: 4 },
    ],
    suggestedTools: ['read_document', 'write_document'],
    skipSections: ['git_diff', 'ast_symbols', 'full_project_tree'],
  },
},
{
  keywords: ['视频', '音频', '播客', '转文字', '转录', 'whisper'],
  plan: {
    intent: 'media_to_text',
    requiredContexts: [],
    suggestedTools: ['read_document', 'write_document', 'extract_media'],
    skipSections: ['git_diff', 'ast_symbols', 'full_project_tree', 'vector_search'],
  },
},
```

---

## 四、实施优先级

| 优先级 | 功能 | 条件 | 估算 |
|--------|------|------|------|
| P1 | 改写适配（AI Rewrite） | 复用现有 Plan+Agent 引擎 | 1-2 周 |
| P1 | 视频/音频提取（Media → Text） | 需要 Whisper 集成 + ffmpeg | 2-3 周 |
| P2 | 多平台热点追踪 | 需要外部数据源爬取/API | 3-4 周 |
| P2 | 效果追踪 | 需要发布平台 API 配合 | 2-3 周 |
| P3 | 热点 → 自动选题 | 依赖 P2 热点 | 2 周 |
| P3 | 多平台一键改写发布 | 依赖 P1 改写 + 发布模块 | 2 周 |
| P3 | 写作效果分析 → AI 优化 | 依赖 P2 效果数据 | 2 周 |

---

## 五、与 CodeGraph 的关系

CodeGraph 对热榜/改写/音视频无直接帮助，但向量层的 `media_chunks` 可用于语义检索视频内容。CodeGraph 作为可选的代码分析加速器独自存在。
