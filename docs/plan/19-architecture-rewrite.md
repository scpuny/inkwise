# 19 — InkWise 架构重构方案 v3.0

> 版本: v3.0 | 状态: 设计方案 | 最后更新: 2026-07-10

## 一、现状诊断

### 1.1 存储碎片化（最严重的问题）

当前数据散落在 **4 个存储后端、17+ 个文件**中：

| 存储后端 | 数据 | 问题 |
|----------|------|------|
| JSON 文件 (data/*.json) × 8 | collections, trash, providers, settings, platforms, publish_records, writing_skills, ai_config | 无事务，无并发控制，手动原子写入 |
| JSON 每文单文件 × 3 | articles/{id}.md, articles/{id}.meta.json, articles/{id}.blueprint.json | 读一篇文章要读 3 个文件 |
| SQLite (inkwise.db) | collections, articles, fts5, vector_chunks | 和 JSON 文件数据重复，互为备份但无同步保证 |
| localStorage × N | 各种缓存、版本历史、project insights | Tauri 模式下 localStorage 不可靠（可能被清） |

**最恶劣的情况**：一篇文章的内容同时存在 5 个地方：
1. `articles/{id}.md`（文件系统）
2. `articles` 表的 `content` 列（SQLite）
3. `documents/{id}.json`（ArticleDocument）
4. `articles_search` 表的 `content_snippet`（FTS 索引缓存）
5. `articles/{id}.meta.json`（元数据）

写操作要同步 5 处，一旦某一步失败，数据就不一致。

### 1.2 层混叠

现状：**UI ↔ Service ↔ Domain ↔ AI 互相混调**

| 坏的例子 | 问题 |
|----------|------|
| `generateTitle()` 里调 `askAI()` 再调 `sendChatStream()` | 业务+AI+IO 写在一起 |
| `WritingSkill` 结构体包含 `systemPrompt` | 技能配置和 AI 提示词混为一谈 |
| `EditorPane.tsx` 1700 行 | 渲染、编排、存储、事件全在一个组件 |
| `plan.ts` 同时做类型定义、AI 调用、输出解析、流程编排 | 职责严重超载 |

### 1.3 域边界模糊

| 概念 | 现在 | 应该 |
|------|------|------|
| Skill | 包含 id + name + systemPrompt + configs + ... | 只含元数据（id, name, desc, icon），不含 AI 配置 |
| PhaseConfig | 嵌在 skill.configs 里 | 独立注册，可复用 |
| Document | 和 ArticleMeta + Blueprint + 内容文件并存 | 唯一聚合根 |
| Collection | 简陋的 `{articles: []}` | 纯粹容器，不存业务逻辑 |
| Trash | 独立的 `trash.json` + 级联删除 | Document 的一个字段 `deletedAt` |

---

## 二、重构目标

### 2.1 存储统一

```
重构前                              重构后
─────────────────                  ─────────────────
JSON 文件 × 8                       SQLite（单一事实源）
每文 JSON 文件 × 3                   ├── 所有结构化数据
localStorage × N                    ├── FTS5 全文搜索
SQLite（部分数据）                    ├── 向量 embedding
                                     └── 设置键值对
                                     │
                                     文件系统（仅大文件/用户可见文件）
                                      ├── 文章图片
                                      └── 项目关联的 .md 文件（可选）
```

### 2.2 分层清晰

```
UI Layer       React 组件 — 只做渲染 + 事件绑定，不包含业务逻辑
                     ↓ 调用 Service
Service Layer  纯 TypeScript 类 — 编排业务流程，不直接调 IO
                     ↓ 调用 Domain
Domain Layer   纯数据 + 纯函数 — Document/Skill/PhaseConfig 定义
                     ↓ 依赖接口
Infrastructure 接口实现 — AIProvider/DocumentStore/EventBus
```

### 2.3 方便扩展

加一个新 Skill（写简历、写周报、写文案）：

```
现在：写 1 个 skill 注册 + 写 N 个 generateXxx 函数 + 改 plan.ts + 改 EditorPane
                                    ↓
重构后：写 1 个 skill 注册（JSON）+ 按需写 phase config（可选）
         PlanService 自动适配，无需改代码
```

---

## 三、详细设计

### 3.1 存储层：SQLite 成为唯一事实源

#### 3.1.1 完整 Schema

```sql
-- ─── 核心 —— 文章文档（唯一聚合根） ───
CREATE TABLE documents (
    id              TEXT PRIMARY KEY,
    collection_id   TEXT,
    series_id       TEXT,
    
    -- 内容
    title           TEXT NOT NULL DEFAULT '',
    content         TEXT NOT NULL DEFAULT '',
    
    -- 来源
    source          TEXT NOT NULL DEFAULT 'new',     -- 'new' | 'series' | 'quick'
    inspiration     TEXT DEFAULT '',
    
    -- 写作参数
    style_id        TEXT NOT NULL DEFAULT 'general',
    action_id       TEXT NOT NULL DEFAULT 'action-write',
    tone            TEXT DEFAULT '',
    target_audience TEXT DEFAULT '',
    target_word_count INTEGER DEFAULT 0,
    
    -- 生命周期
    phase           TEXT NOT NULL DEFAULT 'planning', -- 'planning' | 'writing' | 'reviewing' | 'complete'
    outline         TEXT NOT NULL DEFAULT '[]',       -- JSON array
    tags            TEXT NOT NULL DEFAULT '[]',       -- JSON array
    
    -- 样式配置
    style_config    TEXT NOT NULL DEFAULT '{}',       -- JSON (ArticleStyleConfig)
    
    -- 上下文
    linked_folder   TEXT DEFAULT '',
    project_context TEXT DEFAULT '',
    series_context  TEXT DEFAULT '',
    
    -- 审阅
    review_state    TEXT DEFAULT '{}',                -- JSON
    review_extra    TEXT DEFAULT '',
    
    -- 回收站
    deleted_at      INTEGER,                         -- NULL = 未删除，有值 = 在回收站
    restore_data    TEXT DEFAULT '{}',                -- JSON: 删除前所在集合信息
    
    -- 版本
    version         INTEGER NOT NULL DEFAULT 1,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL
);
CREATE INDEX idx_documents_collection ON documents(collection_id);
CREATE INDEX idx_documents_phase ON documents(phase);
CREATE INDEX idx_documents_deleted ON documents(deleted_at);
CREATE INDEX idx_documents_updated ON documents(updated_at DESC);

-- ─── 合集（纯粹容器） ───
CREATE TABLE collections (
    id              TEXT PRIMARY KEY,
    title           TEXT NOT NULL DEFAULT '',
    description     TEXT DEFAULT '',
    linked_folder   TEXT DEFAULT '',                 -- 关联本地项目路径
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL
);

-- ─── 系列文章计划（合集的可选扩展） ───
CREATE TABLE series_plans (
    id              TEXT PRIMARY KEY,
    collection_id   TEXT NOT NULL REFERENCES collections(id),
    title           TEXT NOT NULL DEFAULT '',
    tone            TEXT DEFAULT '',
    target_audience TEXT DEFAULT '',
    skill_id        TEXT DEFAULT '',
    style_id        TEXT DEFAULT '',
    action_id       TEXT DEFAULT '',
    articles        TEXT NOT NULL DEFAULT '[]',       -- JSON: 有序文章列表
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL
);
CREATE INDEX idx_series_collection ON series_plans(collection_id);

-- ─── 发布记录 ───
CREATE TABLE publish_records (
    id              TEXT PRIMARY KEY,
    document_id     TEXT NOT NULL REFERENCES documents(id),
    platform        TEXT NOT NULL,
    platform_name   TEXT DEFAULT '',
    platform_article_id TEXT DEFAULT '',
    status          TEXT NOT NULL DEFAULT 'draft',   -- 'draft' | 'published' | 'failed'
    platform_url    TEXT DEFAULT '',
    error_message   TEXT DEFAULT '',
    published_at    INTEGER,
    created_at      INTEGER NOT NULL
);
CREATE INDEX idx_publish_document ON publish_records(document_id);

-- ─── AI 提供商配置 ───
CREATE TABLE providers (
    id              TEXT PRIMARY KEY,
    label           TEXT NOT NULL,
    kind            TEXT NOT NULL,                   -- 'openai' | 'anthropic' | 'deepseek' | 'custom'
    base_url        TEXT NOT NULL,
    api_key         TEXT NOT NULL,
    models          TEXT NOT NULL DEFAULT '[]',       -- JSON array of ModelEntry
    enabled         INTEGER NOT NULL DEFAULT 1,
    builtin         INTEGER NOT NULL DEFAULT 0,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL
);

-- ─── 发布平台配置 ───
CREATE TABLE platform_configs (
    id              TEXT PRIMARY KEY,
    platform        TEXT NOT NULL,                   -- 'wechat' | 'zhihu' | etc.
    label           TEXT NOT NULL,
    app_id          TEXT DEFAULT '',
    app_secret      TEXT DEFAULT '',
    token           TEXT DEFAULT '',
    enabled         INTEGER NOT NULL DEFAULT 1,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL
);

-- ─── 应用设置（键值对） ───
CREATE TABLE settings (
    key             TEXT PRIMARY KEY,
    value           TEXT NOT NULL
);

-- ─── 文章图片 ───
CREATE TABLE article_images (
    id              TEXT PRIMARY KEY,
    document_id     TEXT NOT NULL REFERENCES documents(id),
    local_path      TEXT NOT NULL,
    alt_text        TEXT NOT NULL DEFAULT '',
    revised_prompt  TEXT DEFAULT '',
    section_index   INTEGER,
    created_at      INTEGER NOT NULL
);
CREATE INDEX idx_images_document ON article_images(document_id);

-- ─── FTS5 全文搜索 ───
CREATE TABLE documents_search (
    id              TEXT PRIMARY KEY,
    title           TEXT NOT NULL DEFAULT '',
    content_snippet TEXT NOT NULL DEFAULT '',
    tags            TEXT NOT NULL DEFAULT '[]',
    collection_id   TEXT,
    created_at      INTEGER NOT NULL DEFAULT 0,
    updated_at      INTEGER NOT NULL DEFAULT 0
);
CREATE VIRTUAL TABLE documents_fts USING fts5(
    title, content_snippet, tags,
    tokenize='unicode61',
    content='documents_search',
    content_rowid=rowid
);
-- 3 个触发器：documents_search_ai, _ad, _au (同现有的 articles_search 模式)

-- ─── 向量分块 ───
-- 存储策略：Base64(float32[]) 存 TEXT 列。
-- 查询策略：全量加载 → ndarray 矩阵乘法一次算全部余弦相似度 → Top-K。
-- 说明见 3.1.3 节「向量存储策略」
CREATE TABLE vector_chunks (
    id              TEXT PRIMARY KEY,
    document_id     TEXT NOT NULL,
    chunk_index     INTEGER NOT NULL,
    content         TEXT NOT NULL,
    content_hash    TEXT NOT NULL,
    embedding       TEXT,                            -- Base64(float32[384])
    created_at      INTEGER NOT NULL
);
CREATE INDEX idx_vector_document ON vector_chunks(document_id);

-- ─── 写作技能（纯元数据） ───
CREATE TABLE skills (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    description     TEXT DEFAULT '',
    icon            TEXT DEFAULT '',
    builtin         INTEGER NOT NULL DEFAULT 0,
    enabled         INTEGER NOT NULL DEFAULT 1,
    input_schema    TEXT DEFAULT '{}',               -- JSON: 用户需要提供的字段
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL
);

-- ─── 阶段配置（提示词模板，独立于 skill） ───
CREATE TABLE phase_configs (
    id              TEXT PRIMARY KEY,
    skill_id        TEXT,                            -- NULL = 通用配置
    phase           TEXT NOT NULL,                   -- 'title' | 'description' | 'outline' | 'tags' | 'writing'
    system_prompt   TEXT NOT NULL,
    temperature     REAL NOT NULL DEFAULT 0.7,
    model           TEXT DEFAULT '',
    max_tokens      INTEGER NOT NULL DEFAULT 1024,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL
);
CREATE INDEX idx_phase_skill ON phase_configs(skill_id, phase);

-- ─── 系统主题（非业务，仍可放 SQLite 但 localStorage 兜底也行） ───
-- 存储在 settings 表中：key='system_theme', value='{...}'
```

#### 3.1.3 向量存储策略

**本地模型**：bge-small-zh-v1.5（384 维，~1.5KB/向量）
**推理引擎**：tract-onnx（纯 Rust，已在项目中）
**索引兜底**：tree-sitter AST + FTS5（向量不可用时回退）

**为什么选方案 3（ndarray 矩阵运算）而不是 sqlite-vec：**

| 方案 | 实现 | 优缺点 |
|------|------|--------|
| 1. BLOB 存 + 逐条算 | 当前方案 | 万条以内够用，逐条循环慢 |
| 2. sqlite-vec 扩展 | 编译 .dylib 随 Tauri 打包 | 需额外依赖，打包复杂，项目规模不需要 |
| **3. ndarray 矩阵算** | **全量加载 → 矩阵乘法一次算所有** | **零额外依赖，性能提升 10-100x** |

**方案 3 的查询流程：**

```
用户搜索 "如何优化 Rust 编译速度"
  │
  ├── embedder.embed("如何优化...") 
  │   └── 返回 [0.12, -0.34, ..., 0.67]  (384维)
  │
  ├── SQLite: SELECT id, content, embedding FROM vector_chunks
  │   └── Rust 端解码: Base64 → Vec<Vec<f32>>
  │
  ├── ndarray::stack(all_embeddings)  // shape: (N, 384)
  ├── scores = embeddings.dot(&query)  // 一次矩阵乘，shape: (N,)
  │   └── 比逐条 for 循环快 10-100 倍（SIMD 自动向量化）
  │
  ├── top_k_indices(scores, 5)         // 取前 5
  │
  └── 返回 VectorSearchResult[]
```

**性能估算（以 5,000 条 chunk, 384 维为例）：**

| 步骤 | 方案 1（逐条循环） | 方案 3（矩阵乘） |
|------|-------------------|-----------------|
| Base64 解码 | ~30ms | ~30ms |
| 余弦相似度计算 | ~80ms | ~1-3ms |
| 排序 Top-5 | ~2ms | ~2ms |
| **总计** | **~112ms** | **~33-35ms** |

**索引增量更新**：

```
写文章 → 分块(chunk.rs) → 对比 content_hash 找出变化块
  └── 变化的块 → embedder.embed() → Base64 编码 → UPSERT vector_chunks
  └── 未变化的块 → 跳过（content_hash 相同）
```

**回退策略（降级链）**：

```
语义搜索 → 向量模型就绪？ → YES → ndarray 矩阵乘 → 返回
                      ↓ NO
                  tree-sitter / FTS5 精确匹配 → 返回
                      ↓ NO
                  内存关键词搜索 → 返回
```

#### 3.1.2 迁移路径

```
阶段 1（数据迁移）：
  JSON → SQLite：
    collections.json       → collections 表
    trash.json             → documents.deleted_at
    providers.json         → providers 表
    platforms.json         → platform_configs 表
    publish_records.json   → publish_records 表
    writing_skills.json    → skills 表 + phase_configs 表
    settings.json          → settings 表
    ai_config.json         → settings 表
    custom_themes.json     → settings 表
    series_{id}.json       → series_plans 表
    articles/{id}.md       → documents.content
    articles/{id}.meta.json→ documents 表字段
    articles/{id}.blueprint.json→ documents.outline + phase + styleId
    documents/{id}.json    → documents 表

阶段 2（代码迁移）：
    所有 Tauri 命令从读写 JSON 改为读写 SQLite
    移除 read_json / write_json 通用方法
    移除 StorageEngine 的 localStorage 写缓存（保持读缓存加速）
    移除 articleDocument.ts 中的 Tauri invoke（改用 SQLite 命令）

阶段 3（清理）：
    删除 store.rs 中的 JSON 读写方法
    删除旧的 JSON 文件
    重命名 db.rs → store.rs（SQLite 成为唯一存储层）
```

#### 3.1.3 前端存储层变化

```
重构前                                              重构后
─────────────────                                  ─────────────────
articleDocument.ts (Tauri invoke + LS)             删除，合并到 DocumentService
articles.ts (Tauri invoke + LS)                     删除，内容在 documents 表
articleVersions.ts (纯 LS)                          删除，版本由 SQLite 管理
providerModels.ts (StorageEngine)                   改为调 SQLite providers 表
platforms.ts (Tauri invoke + LS)                    改为调 SQLite platform_configs 表
collections/crud.ts (Tauri invoke + LS)             改为调 SQLite collections + documents 表
collections/search.ts (FTS + 内存搜索)               统一为调 SQLite search
theme/theme.ts (纯 LS)                              保留 localStorage（非业务数据）
config/globalAIConfig.ts (StorageEngine)             改为调 SQLite settings 表
```

### 3.2 分层架构

#### 3.2.1 分层结构

```
┌─────────────────────────────────────────────────────────────────┐
│                    UI Layer (React 组件)                         │
│                                                                 │
│  PlanPanel        Editor          CollectionTree                │
│  StartupSplash    ArticleManager   SettingsPanel                │
│  AgentPanel       PublishDialog    SeriesPlanner                │
│                                                                 │
│  规则：                                                          │
│  - 不直接 import 基础设施（不 import sendChat / tryInvoke）      │
│  - 不包含业务逻辑，只调 Service 方法                             │
│  - 状态通过 Context 或 Service 返回的 observable 获取            │
├─────────────────────────────────────────────────────────────────┤
│                  Service Layer (编排)                            │
│                                                                 │
│  PlanService         DocumentService     CollectionService      │
│  WriteService        PublishService      ReviewService          │
│  SettingsService     ThemeService        TrashService           │
│  SkillService        AIService           SeriesService          │
│                                                                 │
│  规则：                                                          │
│  - 编排多步流程（如 创建文档 → 生成标题 → 生成描述 → ...）      │
│  - 只调 Domain 层的接口（不直接调 AI 或存储）                    │
│  - 可被 UI 或另一个 Service 调用                                │
├─────────────────────────────────────────────────────────────────┤
│                  Domain Layer (纯定义)                           │
│                                                                 │
│  Document.ts         Skill.ts            PhaseConfig.ts         │
│  Collection.ts       SeriesPlan.ts       Provider.ts            │
│  PublishRecord.ts    TrashItem.ts        Theme.ts               │
│                                                                 │
│  规则：                                                          │
│  - 纯 TypeScript 类型 + 纯函数                                   │
│  - 不 import 任何外部依赖（不调 AI、不调存储、不调 Tauri）       │
│  - 可被任何层 import，无副作用                                   │
├─────────────────────────────────────────────────────────────────┤
│              Infrastructure Layer (接口实现)                     │
│                                                                 │
│  AIProvider         DocumentStore        EventBus               │
│  ├─ OpenAIAdapter   ├─ SQLiteStore       ├─ mitt 实现            │
│  ├─ AnthropicAdapter├─ LocalStorageStore │                       │
│  └─ DeepSeekAdapter └─ FallbackStore                             │
│                                                                 │
│  规则：                                                          │
│  - 实现接口，不包含业务逻辑                                      │
│  - 可替换（测试时用 MockStore / MockAIProvider）                 │
│  - 所有 IO 操作（Tauri invoke / localStorage / SQLite）在此层   │
└─────────────────────────────────────────────────────────────────┘

### 3.6 UI 层重构

#### 3.6.1 当前 UI 问题

| 问题 | 严重度 | 说明 |
|------|--------|------|
| EditorPane 1700+ 行 | P0 | 规划 + 编辑器 + 蓝图同步 + AI 执行 + 状态机混在一个组件 |
| planState 5 种状态（idle/planning/review/review-title-desc/writing/article-review） | P1 | 状态太多，分支难以穷举 |
| StartupSplash 和 EditorPane 的规划逻辑强耦合 | P1 | 改规划流程要在两个组件同时改 |
| AI 面板/样式面板/编辑器三个面板挤压空间 | P2 | 已识别（doc 14）|
| collections-changed 事件泛滥 | P2 | 多处 emit，各处 listen，很难追踪数据流 |

#### 3.6.2 组件拆分方案

```
重构前（1910 行）        重构后
────────────────────     ────────────────────
EditorPane.tsx           EditorPage.tsx（布局容器，~80 行）
  ├── 文章加载             ├── ArticleLoader（加载/切换文章）
  ├── 规划逻辑             ├── PlanPanel（规划 UI + 状态）
  ├── 编辑器渲染           ├── EditorCanvas（TipTap 封装）
  ├── AI 执行             ├── AIActionBar（AI 指令输入）
  ├── 蓝图同步             └── useEditorService（hook）
  ├── 大纲同步
  ├── 状态管理
  └── 事件监听
```

**具体职责：**

| 组件 | 职责 | 行数预估 |
|------|------|---------|
| `EditorPage.tsx` | 布局容器，组合子组件 | ~80 |
| `ArticleLoader.tsx` | 加载/保存 ArticleDocument，管理加载态 | ~150 |
| `PlanPanel.tsx` | 规划 UI（整合现在的 StartupSplash 逻辑），调 PlanService | ~300 |
| `EditorCanvas.tsx` | TipTap 编辑器封装 | ~400 |
| `AIActionBar.tsx` | AI 指令输入 + 幽灵文本/流式显示 | ~100 |
| `useEditorService.ts` | hook 胶水层，连接 Service 和 UI 状态 | ~200 |

**PlanPanel 内部：**

```
PlanPanel
├── PlanInputSection（灵感输入 + 选项）
├── PlanProgress（流式生成进度展示）
├── PlanReviewTitleDesc（标题+描述审阅）
├── PlanReviewFull（完整规划审阅）
└── PlanActions（确认/取消/重试按钮）
```

每个子组件只负责一块 UI，状态由 PlanService 管理，PlanPanel 只做数据映射。

#### 3.6.3 布局调整

```
重构前（三栏并列）                重构后（紧凑侧栏）
────────────────────             ────────────────────
┌───┬──────────┬──────┐          ┌───┬──────────┬────┐
│ S │          │ AI   │          │ S │          │ AI │
│ i │  Editor  │ Panel│          │ i │  Editor  │/Sty│
│ d │          │      │          │ d │          │/Rev│
│ e │          │  +   │          │ e │          │    │
│ b │          │ Style│          │ b │          │    │
│ a │          │ Panel│          │ a │          │    │
│ r │          │      │          │ r │          │    │
│   │          │      │          │   │          │    │
└───┴──────────┴──────┘          └───┴──────────┴────┘
```

**变化**：
- 右侧面板**保持固定侧栏**，不浮动遮挡内容
- AI 面板 + 样式面板 + 审阅面板**合并为一个侧栏**，通过 tab 切换（当前右侧两个面板压缩为一个）
- 侧栏宽度可拖拽调整，默认 360px（比当前 420px 窄）
- 支持快捷键 `Cmd+B` 快速切换侧栏显隐，隐藏时编辑器全宽
- 编辑器获得更多宽度，但不丢失侧栏的随时可达性

#### 3.6.4 状态管理简化

```
当前 planState（5 种）：   简化为（3 种）：
  idle                      idle
  planning                  loading (含 planning 和 writing)
  review-title-desc         review (含标题+描述审阅和大纲审阅，用子状态区分)
  review
  writing
  article-review
```

**关键变化**：
- 移除 `review-title-desc` 作为独立的 planState——改为 PlanPanel 内部通过 `reviewPhase` 子状态区分
- `planning` 和 `writing` 合并为 `loading`——Service 侧知道自己在做什么阶段，UI 只显示"加载中"
- 错误状态通过 `error` 字段表达，不通过 planState

#### 3.6.5 一致性原则

| 原则 | 说明 | 示例 |
|------|------|------|
| 状态可见 | 每个操作有 loading/error/success | 发送 AI 指令时显示进度，完成时反馈 |
| 就近操作 | 哪里看到数据，就在哪里操作 | 大纲旁直接编辑，不用跳转页面 |
| 渐进披露 | 不一次性展示所有功能 | 新建文档先显示标题+描述，再展开大纲 |
| 撤销优先 | 能恢复的绝不永久删除 | 删除进回收站，清回收站才不可逆 |
| 一致性 | 相同模式在不同页面表现一致 | 所有删除操作都是"移入回收站→确认清空" |
| 侧栏即用 | 右侧面板固定不遮挡，随时可达 | AI/样式/审阅合并为一个侧栏 tab，`Cmd+B` 切换 |
```

#### 3.2.2 关键接口定义

```typescript
// ── 基础设施接口 ──

interface DocumentStore {
  load(id: string): Promise<Document | null>;
  save(doc: Document): Promise<void>;
  query(filter: DocumentFilter): Promise<Document[]>;
  hardDelete(id: string): Promise<void>;
}

interface AIProvider {
  chat(messages: Message[], opts?: ChatOpts): Promise<string>;
  stream(messages: Message[], opts?: ChatOpts, onToken?: (t: string) => void): Promise<string>;
  chatWithTools(messages: Message[], tools: Tool[], opts?: ChatToolOpts): Promise<ChatToolResponse>;
}

// ── Service 对外接口 ──

class PlanService {
  constructor(
    private store: DocumentStore,
    private ai: AIProvider,
    private skills: SkillService,
  ) {}
  
  /** 执行计划的单个阶段（如 title / description / outline） */
  async executePhase(doc: Document, phaseId: string, skillId?: string): Promise<string>;
  
  /** 完整规划流程（title → desc → outline → tags），支持中途暂停 */
  async *plan(doc: Document, skillId?: string): AsyncGenerator<PlanProgress>;
}
```

### 3.3 域模型细化

#### 3.3.1 Document — 唯一聚合根

```typescript
class Document {
  // 身份
  id: string;
  collectionId?: string;
  seriesId?: string;

  // 内容
  title: string;
  content: string;           // Markdown 正文

  // 来源
  source: 'new' | 'series' | 'quick';
  inspiration?: string;      // AI 规划时的原始灵感

  // 写作参数
  styleId: string;
  actionId: string;
  tone?: string;
  targetAudience?: string;
  targetWordCount: number;

  // 生命周期
  phase: 'planning' | 'writing' | 'reviewing' | 'complete';
  outline: OutlineSection[];
  tags: string[];

  // 样式
  styleConfig: ArticleStyleConfig;

  // 上下文
  linkedFolder?: string;
  projectContext?: string;
  seriesContext?: string;

  // 审阅
  reviewState?: ReviewState;

  // 回收站
  deletedAt?: number;        // null = 正常，有值 = 回收站
  restoreData?: {            // 恢复用
    collectionId?: string;
    collectionTitle?: string;
  };

  // 版本
  version: number;
  createdAt: number;
  updatedAt: number;

  // 发布（一对多关联，通过 publish_records 表）
  // 不直接存储 publishRecords，按需查询
}
```

**删除/恢复/清空的流向：**
```
删除操作 → DocumentService.trash(id)
  ├── 设置 doc.deletedAt = Date.now()
  ├── 设置 doc.restoreData = { collectionId, collectionTitle }
  └── 保存（写入 documents 表，不需要独立的 trash 表）

恢复操作 → DocumentService.restore(id)
  ├── 从 doc.restoreData 读取原集合信息
  ├── 设置 doc.deletedAt = null
  └── 保存

永久删除 → DocumentService.hardDelete(id)
  ├── 清理 publish_records
  ├── 清理 article_images
  ├── 清理 vector_chunks
  └── 删除 documents 行

清空回收站 → TrashService.empty()
  ├── 查询 documents WHERE deleted_at IS NOT NULL
  └── 每条调 hardDelete
```

#### 3.3.2 Skill — 纯元数据

```typescript
class Skill {
  id: string;                // "write-essay" | "write-resume"
  name: string;              // "写散文" | "写简历"
  description: string;
  icon: string;
  builtin: boolean;
  enabled: boolean;
  inputSchema: Record<string, FieldDef>;  // 用户需要提供的字段
}

// Skill 没有 systemPrompt！没有 temperature！没有 configs！
// 这些在 PhaseConfig 里
```

#### 3.3.3 PhaseConfig — 提示词模板

```typescript
class PhaseConfig {
  id: string;                // "essay-title" | "resume-writing"
  skillId?: string;          // 关联 skill，null 表示通用
  phase: string;             // "title" | "description" | "outline" | "tags" | "writing"
  systemPrompt: string;
  temperature: number;
  model?: string;            // 可选覆盖模型
  maxTokens: number;
}

// PhaseConfig 和 Skill 关联但不绑定：
// - 一个 skill 可以引用多个 phase config
// - 一个 phase config 可以被多个 skill 共享
// - 不配置 skillId 的 phase config 是通用模板
```

#### 3.3.4 Service 编排示例

```typescript
class PlanService {
  async *plan(doc: Document, skillId?: string): AsyncGenerator<PlanProgress> {
    // 1. 确定需要执行的阶段
    const phases = this.getPhases(doc, skillId);
    // phases = ['title', 'description', 'outline', 'tags']
    // 如果 doc.source === 'series'，跳过 title, description

    // 2. 逐个阶段执行
    for (const phaseId of phases) {
      if (this.shouldSkip(doc, phaseId)) continue;

      const config = this.phaseConfigs.get(skillId, phaseId);
      const context = this.buildContext(doc, phaseId);
      
      // 调 AI（对 Service 来说就是一行）
      const result = await this.ai.chat([
        { role: 'system', content: config.systemPrompt },
        { role: 'user', content: context },
      ], { temperature: config.temperature, maxTokens: config.maxTokens });

      // 应用到文档（纯函数）
      doc = this.applyPhaseResult(doc, phaseId, result);
      
      // 持久化（对 Service 来说就是一行）
      await this.store.save(doc);

      yield { phase: phaseId, document: doc };
    }
  }
}
```

### 3.4 各域职责清单

| 域 | 职责 | 不负责 |
|----|------|--------|
| **Document** | 文章完整生命周期 | 不关心 AI、不关心合集层级 |
| **Collection** | 文件夹容器、关联项目目录 | 不存文章内容、不做系列编排 |
| **Series** | 有序写作计划、统一参数传递 | 不感知 AI、不存文章内容 |
| **Trash** | 回收站查询/恢复/清空 | 不单独存储（用 Document.deletedAt） |
| **Skill** | 技能注册、元数据查询 | 不含提示词、不含 AI 配置 |
| **PhaseConfig** | 提示词模板管理 | 不含业务逻辑 |
| **Theme** | 系统主题 + 文章样式 | theme: localStorage, 文章样式: Document |
| **AI** | 聊天/流式/工具调用 | 不含业务逻辑、不含提示词构建 |
| **Publishing** | 多平台发布 | 不含内容生成 |
| **Settings** | 键值对设置 | 不含业务逻辑 |

### 3.5 界面原则

1. **状态可见**：每个操作都有 loading/error/success 反馈
2. **就近操作**：在哪看到数据，就在哪操作（如大纲旁直接编辑）
3. **渐进式披露**：不一次性展示所有功能，按需展开
4. **撤销优先**：删除进回收站，可恢复；清空回收站才不可逆
5. **一致性**：同样的操作在不同页面表现一致（删除都是移回收站）

---

## 四、实施路线

### S1: 存储统一（核心迁移）

| # | 任务 | 工作量 |
|---|------|--------|
| 1.1 | 定义完整 SQLite schema（含 migrations） | 2d |
| 1.2 | 编写 JSON → SQLite 迁移脚本 | 3d |
| 1.3 | 重写所有 Tauri 存储命令（去掉 JSON 读写） | 3d |
| 1.4 | 重写前端存储层（去掉 localStorage 业务缓存） | 2d |
| 1.5 | 端到端测试：创建/编辑/删除/搜索/发布全流程 | 2d |

### S2: 分层拆分

| # | 任务 | 工作量 |
|---|------|--------|
| 2.1 | 定义 Infrastructure 接口 + 实现 | 2d |
| 2.2 | 提取 Domain 类型定义到独立文件 | 1d |
| 2.3 | PlanService 提取 + 通用化 | 2d |
| 2.4 | DocumentService / CollectionService 等提取 | 2d |
| 2.5 | EditorPane 拆分（规划/编辑器/审阅分组件） | 3d |

### S3: 功能增强

| # | 任务 | 工作量 |
|---|------|--------|
| 3.1 | SQLite 替换废纸篓（Document.deletedAt） | 1d |
| 3.2 | Skill 纯净分离（去掉 systemPrompt） | 2d |
| 3.3 | PhaseConfig 独立注册 | 1d |
| 3.4 | 发布记录统一到 SQLite publish_records | 1d |
| 3.5 | 向量搜索性能优化 | 2d |

---

## 五、被清除的旧代码

重构完成后可以安全删除的代码：

| 文件 | 原因 |
|------|------|
| `src-tauri/src/store.rs` 中的 `read_json`/`write_json` | SQLite 替代 |
| `src/lib/storage/articleDocument.ts` | 合并到 DocumentService |
| `src/lib/storage/articles.ts` | 内容在 documents 表 |
| `src/lib/storage/articleVersions.ts` | 版本在 documents 表 |
| `src/lib/storage/collections/crud.ts` 中所有 `browserLoad`/`browserSave` | 缓存统一 |
| `src/lib/storage/providerModels.ts` 中的 `StorageEngine` | 改用 SQLite |
| `src/lib/storage/platforms.ts` 中的独立 publish history | 改用 publish_records 表 |
| `src-tauri/src/store.rs` 中全部 JSON 读写方法 | 迁移到 db.rs |
| `articles/{id}.meta.json`、`articles/{id}.blueprint.json` | 数据在 documents 表 |
| `data/collections.json`、`data/trash.json` 等 JSON 文件 | 数据在 SQLite |

---

## 六、关键决策记录

| 决策 | 选择 | 原因 |
|------|------|------|
| 主存储 | SQLite | 单一文件、事务、FTS5 内置、向量可存 BLOB、无需额外服务 |
| 文件系统存什么 | 仅图片 + 项目关联 .md | 大文件不适合 SQLite；用户可见文件存文件系统更自然 |
| localStorage 存什么 | 仅系统主题偏好 | 非业务数据，不涉及一致性 |
| 回收站实现 | Document.deletedAt | 不需要独立存储，查询快，恢复简单 |
| Skill 和 PhaseConfig 关系 | 多对多 | 通用 phase config 可被多个 skill 复用 |
| Service 构造方式 | 依赖注入（构造函数） | 可测试、可替换、边界清晰 |
| AI 调用方式 | AIProvider 接口 | 可 mock、可切换提供商、不影响业务层 |
