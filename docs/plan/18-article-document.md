# 18 — ArticleDocument：统一文章生命周期上下文

> 关联: 13-skill-business-redesign.md, 06-context-planner.md, 11-architecture-restructure.md
> 状态: 🆕 设计 | 版本: v2.1.0

---

## 一、问题

### 1.1 碎片化现状

当前一篇文章的"完整状态"散落在 7 个以上的独立类型/存储中：

| # | 数据块 | 文件 | 字段 | 存储方式 |
|---|--------|------|------|---------|
| 1 | `ArticleMeta` | `storage/articles.ts` | id, collectionId, title, timestamps | collections JSON 内嵌 |
| 2 | `ArticleBlueprint` | `ai/article/blueprint.ts` | phase, outline, styleId, actionId, tone | `{id}.blueprint.json` |
| 3 | 文章内容 | 独立文件 | markdown 文本 | `articles/{id}.md` |
| 4 | `SeriesPlan` | `collections/types.ts` | 系列级 tone, skillId, styleId, actionId | `series_plans.json` |
| 5 | `ArticleStyleConfig` | `article/ArticleContext.ts` | 字体/行高/主题/配色 | localStorage |
| 6 | 事件载荷 | `events.ts`, `plan.ts` | PlanInput, ArticleGenInput, AutoPlanArticleDetail | 内存，随事件传递 |
| 7 | 发布/版本/审阅 | 各自独立 | PublishRecord, VersionEntry, ReviewState | 各自独立存储 |

### 1.2 碎片化导致的 4 个断裂

**断裂 ① — SeriesPlanner 源头丢失：** `handleConfirm` 只存 tone/skillId，漏了 styleId/actionId，即便 `SeriesPlan` 类型已有这两个字段。

**断裂 ② — ArticleGenInput 残缺：** 规划完成后构造文章生成输入时，漏传 styleId/actionId，`generateFullArticleWithTools` 和 `generateFullArticleStream` 收到的参数不完整。

**断裂 ③ — buildBlueprintContext 不序列化 style/action：** 虽有 `blueprint` 对象兜底绕过了此问题（AgentProvider 能直接从对象解 styleId/actionId），但文本化表示中永久缺失。

**断裂 ④ — SectionWriteInput 同样残缺：** legacy 逐节写入路径同样缺少 styleId/actionId。

### 1.3 根本原因

**没有一个类型代表"文章的完整状态"。** 每个阶段各自定义自己的输入/输出类型，靠事件和手工拼凑传递，任何一处遗漏都会静默丢失数据。

---

## 二、方案：ArticleDocument

### 2.1 定义

引入 **`ArticleDocument`** 作为一篇文章的唯一数据载体。从文章创建到发布，所有操作都读写这一个对象。

```typescript
// src/lib/storage/articleDocument.ts — 新建

export type ArticlePhase = "planning" | "writing" | "reviewing" | "complete";

export interface OutlineSection {
  id: string;
  title: string;
  level: 1 | 2 | 3;
  description?: string;
  targetWordCount?: number;
  status: "pending" | "writing" | "complete" | "revised";
  notes?: string;
}

export interface ArticleDocument {
  // ─── 身份 ───
  id: string;
  collectionId?: string;
  seriesId?: string;

  // ─── 内容 ───
  title: string;
  content: string;              // Markdown 正文，嵌入存储

  // ─── 写作参数（v2.0.0 风格/动作分离后的核心字段） ───
  styleId: string;              // 如 "general" | "academic" | "creative"
  actionId: string;             // 如 "action-write" | "action-rewrite"
  tone?: string;                // 语气风格描述
  targetAudience?: string;      // 目标读者
  targetWordCount?: number;     // 目标字数

  // ─── 生命周期 ───
  phase: ArticlePhase;
  outline: OutlineSection[];
  tags: string[];

  // ─── 样式配置（从旧 ArticleStyleConfig 迁入） ───
  styleConfig: {
    editorStyleTemplateId: string;
    lineHeight: number;
    editorFontSize: number;
    editorMaxWidth: number;
    editorParagraphGap: number;
    editorFontFamily: string;
    codeThemeId: string;
    macosCodeBlock: boolean;
    firstLineIndent: boolean;
    justifyAlign: boolean;
    headingConfig: Record<string, any>;
    bgPattern: string;
    accentColor: string;
    captionFormat: string;
    customCSS: string;
    articleThemeId: string;
  };

  // ─── 项目上下文 ───
  linkedFolder?: string;        // 关联的项目目录
  projectContext?: string;      // 缓存的目录结构（规划阶段探索结果）
  seriesContext?: string;       // 系列上下文（系列位置/已有文章回顾）

  // ─── 发布 ───
  publishRecords: PublishRecord[];

  // ─── 审阅 ───
  reviewState?: ReviewState;

  // ─── 版本 ───
  version: number;              // 递增版本号
  createdAt: number;
  updatedAt: number;
}
```

### 2.2 设计原则

1. **单源头：** 任何时刻，读这一个对象就能获取文章的完整状态。不需要拼凑。
2. **原子写入：** `saveArticleDocument(doc)` 一次性写入，不 split。
3. **向前兼容：** 旧数据在首次读取时自动迁移为 ArticleDocument。
4. **层级清晰：** `styleConfig` 作为嵌套字段而不是平铺，避免顶层面板过载。
5. **惰性大字段：** 对于极长文章，`content` 可以未来拆出（用 `contentRef` 指针），但当前版本直接嵌入。

### 2.3 与现有 ArticleContext 的关系

现有 `ArticleContext` 类（`src/lib/article/ArticleContext.ts`）只管理样式配置（ArticleStyleConfig），不是用户所设想的全生命周期上下文。处理后：

| 旧 | 新 |
|---|-----|
| `ArticleContext` 类 | 降级为纯样式管理工具，操作 `doc.styleConfig` |
| `ArticleCtx` React Context | 保留，但读取 `ArticleDocument.styleConfig` |
| `ArticleStyleConfig` 类型 | 原样保留，嵌套进 ArticleDocument |

---

## 三、存储层

### 3.1 新文件结构

```
src/lib/storage/
├── articleDocument.ts    ← 新增：loadArticleDocument / saveArticleDocument
├── articles.ts           ← 保留：旧数据迁移桥接
├── collections.ts        ← 保留：合集索引仍需要（文章列表轻量信息）
└── ...
```

### 3.2 读写 API

```typescript
// articleDocument.ts

/** 读取文章完整文档。Tauri模式下从 JSON 文件读，浏览器模式从 localStorage。 */
export async function loadArticleDocument(id: string): Promise<ArticleDocument | null>;

/** 保存文章完整文档。原子写入。 */
export async function saveArticleDocument(doc: ArticleDocument): Promise<void>;

/** 从旧数据迁移得到 ArticleDocument（仅首次加载时调用） */
export async function migrateArticleDocument(id: string): Promise<ArticleDocument | null>;
```

### 3.3 Tauri 后端存储

**Rust 端新增 2 个 Tauri 命令：**

```
- load_article_document(id: String) -> Result<Option<ArticleDocument>, String>
- save_article_document(doc: ArticleDocument) -> Result<(), String>
```

**存储路径：** `{app_data_dir}/data/documents/{id}.json`

**旧文件退役：**
- `articles/{id}.md` → 不再使用，内容迁入 document
- `{id}.blueprint.json` → 不再使用，字段迁入 document
- `article-style-config:{id}` (localStorage) → 不再使用，迁入 document.styleConfig

### 3.4 浏览器模式降级

localStorage key: `inkwise-doc:{id}`，结构与 Tauri 版本完全一致。

### 3.5 数据迁移

`migrateArticleDocument(id)` 从旧来源重建：

```
1. 尝试从 Tauri 加载 {id}.doc.json → 如存在，直接返回（已迁移）
2. 从 collections JSON 找 ArticleMeta（id/title/collectionId/timestamps）
3. 加载 ArticleBlueprint（phase/outline/styleId/actionId/tone）
4. 加载文章内容（{id}.md）
5. 加载 localStorage 中的 ArticleStyleConfig
6. 加载发布记录
7. 合并为 ArticleDocument，写入新存储
```

迁移时机：**首次打开文章时惰性迁移**。不阻塞启动。

---

## 四、各阶段对 ArticleDocument 的读写

### 4.1 系列规划 → 创建文章

```
SeriesPlanner
  │ handleConfirm 保存 SeriesPlan
  │
  ├──→ 用户点"写文章"
  │
  ▼
  auto-plan-article 事件
  │ payload 不再逐个传字段，而是传：
  │   seriesId + styleId + actionId + tone + targetAudience
  │
  ▼
EditorPane.handleStartPlan
  │ 创建 ArticleDocument（初始）
  │   doc = {
  │     id: newId(),
  │     title: seriesTitle,
  │     styleId: seriesPlan.styleId || "general",
  │     actionId: seriesPlan.actionId || "action-write",
  │     tone: seriesPlan.tone,
  │     targetAudience: seriesPlan.targetAudience,
  │     collectionId: activeCollectionId,
  │     seriesId: seriesPlan.id,
  │     phase: "planning",
  │     ... (其余空值)
  │   }
  │ saveArticleDocument(doc)
  │
  ▼
  AI 规划阶段 → 更新 doc.outline / doc.tags / doc.description
  AI 写作阶段 → 更新 doc.content / doc.phase / doc.outline[].status
```

### 4.2 AI 文章生成

```
handlePlanConfirm → 构建 genInput
  │
  ├── 旧：ArticleGenInput（残缺，缺 styleId/actionId）
  └── 新：直接传 ArticleDocument
        │
        ▼
  generateFullArticleWithTools(doc, ...)
        │ buildSystemPrompt 从 doc 读取：
        │   - doc.styleId → 写作风格描述
        │   - doc.actionId → 当前动作
        │   - doc.tone → 语气
        │   - doc.outline → 大纲
        │   - doc.projectContext → 项目结构
        │   - doc.seriesContext → 系列上下文
        │
        ▼
  流式生成 → 逐 token 更新 doc.content
  完成后 → saveArticleDocument(doc)
```

### 4.3 编辑器 AI 调用

```
handleExecute(input)
  │ 从 activeDocRef 读取当前 ArticleDocument
  │
  ├── 构建 AI 上下文：
  │   - doc.outline + 当前 section
  │   - doc.styleId + doc.actionId → 风格/动作注入
  │   - doc.projectContext / doc.seriesContext
  │
  ▼
  AgentProvider.execute()
  │ 接收 ArticleDocument（或关键字段）
  │ 无需再拼凑 blueprint + style + action
  │
  ▼
  runSkillStream → AI 回复 → 更新 doc.content
  saveArticleDocument(doc)
```

### 4.4 打开已有文章（成品反编辑）

```
用户点击已完成文章
  │
  ▼
loadArticleDocument(articleId)
  │ 返回完整的 ArticleDocument
  │ 包含：content / styleConfig / styleId / actionId
  │        outline / phase / publishRecords / reviewState
  │
  ▼
编辑器初始化：
  - doc.content → 填入编辑器
  - doc.styleConfig → 应用样式
  - doc.styleId + doc.actionId → 设置 AIBar 状态
  - doc.outline → 展示大纲
  - doc.phase → 设置阶段
  - doc.publishRecords → 展示发布状态

用户修改后：
  - 编辑器 → update doc.content
  - AI 操作 → 使用 doc.styleId / doc.actionId
  - 全部统一
```

### 4.5 发布流程

```
PublishDialog
  │ 从 doc.publishRecords 读取已有发布记录
  │ 发布成功后追加新记录到 doc.publishRecords
  │ saveArticleDocument(doc)
  │ 不再需要独立存 publish records
```

### 4.6 审阅流程

```
ReviewPanel
  │ 从 doc.reviewState 读取审阅状态
  │ 审阅完成后更新 doc.reviewState
  │ saveArticleDocument(doc)
```

---

## 五、影响分析与迁移步骤

### 5.1 移除/废弃的类型

| 类型 | 文件 | 处理 |
|------|------|------|
| `ArticleMeta` | `storage/articles.ts` | 废弃，id/title/timestamps 并入 doc |
| `ArticleBlueprint` | `ai/article/blueprint.ts` | 废弃，所有字段并入 doc |
| `ArticleGenInput` | `ai/plan.ts` | 废弃，函数改为接收 doc |
| `SectionWriteInput` | `ai/plan.ts` | 废弃，改为接收 doc |
| `ArticleStyleConfig` (独立存) | `article/ArticleContext.ts` | 保留类型，嵌套进 doc |
| `AutoPlanArticleDetail` | `events.ts` | 保留（事件仍需传递），但简化 |

### 5.2 保留的类型

| 类型 | 原因 |
|------|------|
| `Collection` | 合集索引，仍需要轻量的文章列表 |
| `SeriesPlan` | 系列级数据，独立于单篇文章 |
| `PublishRecord` | 保留类型，嵌套进 doc.publishRecords |
| `OutlineSection` | 保留类型，嵌套进 doc.outline |
| `WritingStyle` / `WritingAction` | 全局定义，不属单篇文章 |

### 5.3 实施步骤

#### Step 1：定义 + 存储（纯新增，不影响运行）
1. 在 `src/lib/storage/articleDocument.ts` 定义 `ArticleDocument` 类型
2. 实现 `loadArticleDocument` / `saveArticleDocument`（Tauri + localStorage 双模式）
3. 实现 `migrateArticleDocument`（从旧数据重建）
4. Rust 端新增 `load_article_document` / `save_article_document` 命令
5. 在前端桥接 `tauri.ts` 注册新命令

#### Step 2：EditorPane 接入（逐步替换）
1. EditorPane 新增 `activeDocRef` / `activeDoc` 状态
2. 打开文章时，`loadArticleDocument` → 存到 `activeDoc` 
3. `handleStartPlan`：改为创建 ArticleDocument 而非 PlanInput 拼凑
4. `handlePlanConfirm`：改为更新 ArticleDocument，而非构建残缺的 genInput
5. `handleExecute`：改为从 activeDoc 读取全部参数

#### Step 3：AI 引擎改造
1. `generateFullArticleWithTools` 改为接收 `ArticleDocument`，废弃 `ArticleGenInput`
2. `generateFullArticleStream` 同样
3. `buildSystemPrompt` 从 doc 读取 styleId/actionId/tone/outline
4. `resolveSkill` → 改为 `resolveStyle(doc.styleId)` + `resolveAction(doc.actionId)`

#### Step 4：周边组件适配
1. `BlueprintEditor` → 读写 `doc.outline` 和 `doc.phase`
2. `PublishDialog` → 读写 `doc.publishRecords`
3. `ReviewPanel` → 读写 `doc.reviewState`
4. `ArticleContext` 类 → 简化，操作 `doc.styleConfig`

#### Step 5：SeriesPlanner 补全
1. SeriesPlanner UI 增加 styleId/actionId 选择器
2. `handleConfirm` 保存 styleId/actionId 到 SeriesPlan
3. 创建文章时完整继承

#### Step 6：清理
1. 移除 `ArticleMeta` 类型（引用替换为 doc 字段）
2. 移除 `ArticleBlueprint` 类型
3. 移除 `ArticleGenInput` / `SectionWriteInput`
4. 移除旧的 `{id}.blueprint.json` 和 `{id}.md` 读写
5. 移除旧的 Tauri 命令（`LoadArticleBlueprint`, `SaveArticleBlueprint` 等）

### 5.4 Sprint 5 工作分解

| # | 任务 | 域 | 预估 |
|---|------|----|------|
| 5.1 | 定义 ArticleDocument 类型 + 存储层 + 迁移 | 存储 | 1d |
| 5.2 | Rust 端新增 load/save 命令 | 后端 | 0.5d |
| 5.3 | EditorPane 接入 document（替换 activeBlueprint/activeArticle 状态） | 前端 | 2d |
| 5.4 | AI 引擎改造：接收 document 并利用 styleId/actionId | AI | 1.5d |
| 5.5 | BlueprintEditor / PublishDialog / ReviewPanel 适配 | 组件 | 1d |
| 5.6 | ArticleContext 样式管理降级 | 样式 | 0.5d |
| 5.7 | SeriesPlanner 补全 styleId/actionId | 系列 | 0.5d |
| 5.8 | 旧类型清理 + 旧命令移除 | 清理 | 0.5d |

**总计：约 7.5 天**

---

## 六、风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| 迁移后用户已有数据丢失 | 低 | 高 | Tauri JSON 保留旧文件，文档迁移原子化+校验 |
| content 嵌入后文件过大 | 中 | 低 | 先嵌入，后续可加 `contentRef` 指针模式 |
| 并行修改冲突 | 低 | 中 | Rust 后端做版本检查（version 字段） |
| 迁移期间旧代码和新代码混用 | 中 | 中 | Step 1-2 纯新增不破坏旧代码；Step 3 开始逐步替换 |
| EditorPane 状态变更影响面大 | 高 | 高 | 以 `activeDoc` 为核心，逐步替换 ref/state，每步 typecheck + 回归 |

---

## 七、验证标准

1. 已有文章打开后，所有内容/样式/风格/动作恢复正确
2. 系列规划创建的新文章，styleId/actionId 完整继承
3. AI 生成的初稿自动使用文章设定的风格和动作
4. 编辑器 AI 操作（润色/改写/翻译）感知当前风格
5. 成品文章重新打开编辑，所有参数一致
6. 原子写入：保存失败不回导致数据不一致
