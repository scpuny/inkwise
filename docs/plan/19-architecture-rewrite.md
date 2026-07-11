# 19 — InkWise v3.0 全量重构方案

> 版本: v3.0 | 状态: 设计方案 | 最后更新: 2026-07-11

---

## 第一章：现状审计

### 1.1 代码规模

| 层 | 文件数 | 代码行数 | 
|----|--------|---------|
| Rust 后端 | 26 个 .rs | 10,464 行 |
| 前端 TypeScript/TSX | 60+ 文件 | 31,730+ 行 |
| CSS | 1 文件 | 26,949 行 |
| **总计** | **~90+ 文件** | **~69,000+ 行** |

### 1.2 全局问题诊断

| # | 问题 | 具体表现 | 影响 |
|---|------|---------|------|
| 1 | **存储碎片化** | 4 个后端 × 17+ 文件，同篇文章内容存 5 份 | 数据不一致，改一个地方要同步 5 处 |
| 2 | **单文件过载** | lib.rs 2139 行，EditorPane 1910 行，plan.ts 999 行，ai.rs 822 行 | 改一个需求要读完整文件，不敢改 |
| 3 | **分层缺失** | UI 组件直接调 tryInvoke，Service 函数里调 sendChatStream | 不可测试、不可 mock、改不动 |
| 4 | **职责混叠** | Skill 结构体嵌 systemPrompt，类型定义和存储逻辑写在一起 | 加新技能要改 5 个文件 |
| 5 | **事件耦合** | 22 个全局事件，emit/listen 散在各处 | 数据流靠猜，改一个事件怕 break 别处 |
| 6 | **CSS 单文件 27k 行** | 所有样式在一个文件，BEM 命名但无模块边界 | 改样式怕影响不相关组件 |

---

## 第二章：功能清单与重写决策

### 2.1 完整清单

#### Rust 后端（10,464 行）

| 文件 | 行数 | 决策 | 理由 |
|------|------|------|------|
| `lib.rs` | 2139 | 🔴 **重写** | 80 命令 + AppState + 所有业务逻辑混在一个文件 |
| `store.rs` | 753 | 🔴 **重写** | JSON 读写废弃，类型定义剥离到 domain/ |
| `db.rs` | 844 | 🔴 **重写** | 拆为 storage/sqlite.rs + storage/migration.rs |
| `ai.rs` | 822 | 🔴 **重写** | 拆为 ai/mod.rs + openai.rs + anthropic.rs + streaming.rs |
| `skill/` 全部 | 494 | 🟡 **适配** | domain/types 剥离出来，builtins 逻辑保留 |
| `vector/` 全部 | 490 | 🟢 **保留** | 结构好，search.rs 改为 ndarray 矩阵乘 |
| `agent/` 全部 | 421 | 🟢 **保留** | 引擎逻辑独立，只改存储依赖 |
| `platform/wechat.rs` | 801 | 🟡 **适配** | 发布逻辑保留，配置读 storage trait |
| `project_indexer/` | 1765 | 🟢 **保留** | 独立模块，不动 |
| `image_gen.rs` | 300 | 🟢 **保留** | 独立模块，不动 |

#### 前端核心（31,730+ 行）

| 文件 | 行数 | 决策 | 理由 |
|------|------|------|------|
| `EditorPane.tsx` | 1910 | 🔴 **重写** | 拆为 EditorPage + PlanPanel + EditorCanvas + AIActionBar |
| `plan.ts` | 999 | 🔴 **重写** | 拆为 PlanService + PhaseEngine + 输出解析器 |
| `crud.ts` | 591 | 🔴 **重写** | 存储层统一调 SQLite |
| `articleDocument.ts` | 332 | 🔴 **重写** | 合并到 DocumentService |
| `articles.ts` | ~100 | 🔴 **重写** | 废弃，内容在 documents 表 |
| `providerModels.ts` | 262 | 🟡 **适配** | 改为调 SQLite providers 表 |
| `platforms.ts` | 196 | 🟡 **适配** | 改为调 SQLite 表 |
| `review.ts` | 529 | 🟡 **适配** | 适配新 Document 接口 |
| `blueprint.ts` | 184 | 🟡 **适配** | 精简，部分字段合并到 Document |
| `styles.ts` | 168 | 🟢 **保留** | 风格/动作分离的设计保留 |
| `events.ts` | 162 | 🟢 **保留** | 事件定义保留，可能减量 |
| `editorStyles.ts` | 720 | 🟡 **适配** | 逻辑保留，存储方式改 |
| `contextPlanner.ts` | 378 | 🟢 **保留** | 独立模块 |
| `vectorSearch.ts` | 237 | 🟡 **适配** | 调新 search 接口 |

#### UI 组件（~50 个组件）

| 组件 | 决策 | 策略 |
|------|------|------|
| StartupSplash | 🔴 重写 | 合并到 PlanPanel |
| AgentPanel | 🟡 适配 | UI 保留，调 Service |
| AIBar/AICommandBar | 🟡 适配 | 只改 store 依赖 |
| ReviewPanel | 🟡 适配 | 改 Document 接口 |
| ArticleManager | 🟡 适配 | 调 CollectionService |
| SeriesPlanner | 🟡 适配 | 调 SeriesService |
| 全部 Settings 组件 | 🟢 保留 | UI 不动，改设置存储方式 |
| 全部 Sidebar 组件 | 🟢 保留 | 调新 crud 接口 |
| Toolbar/InlineToolbar | 🟢 保留 | UI 不动 |
| ArticleFinalPage | 🟡 适配 | 改为从 Document 读数据 |
| BlueprintEditor | 🔴 重写 | 从 Document 直接读写 outline |

### 2.2 规模估算

| 分类 | 文件数 | 行数 | 说明 |
|------|--------|------|------|
| 🔴 **重写** | ~20 文件 | ~12,000 行 | 核心重构目标 |
| 🟡 **适配** | ~30 文件 | ~15,000 行 | 改接口不改逻辑 |
| 🟢 **保留** | ~40 文件 | ~42,000 行 | 不动，含 CSS 27k |
| **总计** | ~90+ | ~69,000 | |

---

## 第三章：目标架构

### 3.1 四层架构总览

```
┌─────────────────────────────────────────────────────────────────────┐
│  UI LAYER (React) — 50 个组件 → 精简为 ~40 个                       │
│                                                                     │
│  原则：只做渲染 + 事件绑定，不包含业务逻辑                            │
│  组件通过 hook 调 Service，不直接 import 基础设施（sendChat/Tauri）   │
│                                                                     │
│  EditorPage  PlanPanel  EditorCanvas  AIActionBar  AISidebar         │
│  CollectionTree  ArticleManager  SettingsPage  SeriesPlanner         │
├─────────────────────────────────────────────────────────────────────┤
│  SERVICE LAYER (TypeScript) — 10 个 Service                             │
│                                                                     │
│  原则：编排多步流程，不直接调 IO                                      │
│  依赖 Domain 层接口 + Infrastructure 层接口                           │
│                                                                     │
│  PlanService      DocumentService   CollectionService                 │
│  WriteService     PublishService    ReviewService                    │
│  SettingsService  ThemeService      TrashService                     │
│  SeriesService    SkillService      AIService                        │
│  PackageService   MarketplaceService  TemplateService                │
├─────────────────────────────────────────────────────────────────────┤
│  DOMAIN LAYER (TypeScript) — 纯数据 + 纯函数                          │
│                                                                     │
│  原则：不 import 任何外部依赖，可被任何层引用                          │
│                                                                     │
│  Document  Skill  PhaseConfig  Collection  SeriesPlan                 │
│  Provider  PlatformConfig  PublishRecord  Theme                      │
├─────────────────────────────────────────────────────────────────────┤
│  INFRASTRUCTURE LAYER (Rust + TS 桥接)                                │
│                                                                     │
│  原则：实现接口，可替换，所有 IO 在此层                                │
│                                                                     │
│  ┌─── Rust 端 ─────────────────────────────────────────────────┐    │
│  │  commands/    薄命令层（8 文件，~100 行/个）                  │    │
│  │  storage/     Storage trait + SQLite 实现                    │    │
│  │  domain/      Rust 类型定义（6 文件）                        │    │
│  │  ai/          AI 提供商实现（4 文件）                        │    │
│  │  vector/      向量搜索（5 文件，保留）                       │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌─── TS 桥接 ───────────────────────────────────────────────┐    │
│  │  AIProvider 接口（OpenAIAdapter / AnthropicAdapter）         │    │
│  │  DocumentStore 接口（调 Tauri commands）                     │    │
│  │  EventBus（mitt 实例，事件精简到 ~12 个）                    │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Rust 后端目录结构

```
src-tauri/src/
├── main.rs                          # 入口（保留，6 行）
│
├── lib.rs (~80 行)                  # 只做两件事
│   ├── AppState                      # 应用状态
│   └── invoke_handler!()              # 注册命令（一行/个）
│
├── commands/                        # 薄命令层，每个文件 ~100 行
│   ├── mod.rs                       # 重新导出
│   ├── document_cmds.rs             # load/save/delete/query document
│   ├── collection_cmds.rs           # CRUD collection + series
│   ├── ai_cmds.rs                   # chat / chat_stream / chat_tool
│   ├── publish_cmds.rs              # 平台发布
│   ├── settings_cmds.rs             # 设置读写
│   ├── search_cmds.rs               # FTS + 向量搜索
│   └── export_cmds.rs               # 导入导出
│
├── storage/                         # 存储层 — 通过 trait 接口
│   ├── mod.rs                       # Storage trait 定义
│   ├── sqlite.rs                    # SQLite 实现（增删改查 + FTS5）
│   └── migration.rs                 # Schema 版本管理 + 数据迁移
│
├── domain/                          # 纯类型定义 — 无 IO
│   ├── mod.rs
│   ├── document.rs                  # ArticleDocument, OutlineSection
│   ├── collection.rs                # Collection, SeriesPlan
│   ├── skill.rs                     # Skill, PhaseConfig
│   ├── provider.rs                  # Provider, ModelEntry
│   ├── publish.rs                   # PlatformConfig, PublishRecord
│   └── settings.rs                  # AppSettings, AiConfig
│
├── ai/                              # AI 层 — 按提供商分文件
│   ├── mod.rs                       # 统一接口 + 路由
│   ├── openai.rs                    # OpenAI 兼容 API
│   ├── anthropic.rs                 # Anthropic API
│   ├── streaming.rs                 # SSE 解析 + 事件分发
│   └── chat_tool.rs                 # 工具调用
│
├── vector/                          # 向量搜索（保留现有结构）
│   ├── mod.rs
│   ├── embedder.rs
│   ├── chunk.rs
│   ├── indexer.rs
│   └── search.rs                    # 改为 ndarray 矩阵乘
│
├── agent/                           # Agent 引擎（保留）
├── platform/                        # 平台发布（保留配置读法）
├── project_indexer/                 # 项目索引（保留）
└── image_gen.rs                     # 图片生成（保留）
```

### 3.3 前端目录结构

```
src/
├── domain/                          # 纯类型（从各文件剥离）
│   ├── Document.ts
│   ├── Collection.ts
│   ├── Skill.ts
│   ├── PhaseConfig.ts
│   └── index.ts
│
├── service/                         # 业务编排
│   ├── PlanService.ts
│   ├── DocumentService.ts
│   ├── CollectionService.ts
│   ├── PublishService.ts
│   ├── ReviewService.ts
│   ├── SeriesService.ts
│   ├── SettingsService.ts
│   └── SkillService.ts
│
├── infrastructure/                  # 基础设施接口 + 实现
│   ├── AIProvider.ts                # 接口定义
│   ├── DocumentStore.ts             # 接口定义
│   ├── openai/                      # OpenAI 适配
│   ├── anthropic/                   # Anthropic 适配
│   └── EventBus.ts                  # 事件总线
│
├── bridge/                          # Tauri 桥接（保留，精简）
│   └── tauri.ts                     # 只保留 tryInvoke + 命令枚举
│
├── components/                      # UI 组件
│   ├── editor/                      # 重写 EditorPane  拆
│   │   ├── EditorPage.tsx           # 布局容器（~80行）
│   │   ├── PlanPanel/               # 规划 UI
│   │   │   ├── index.tsx
│   │   │   ├── PlanInputSection.tsx
│   │   │   ├── PlanProgress.tsx
│   │   │   ├── PlanReview.tsx
│   │   │   └── PlanActions.tsx
│   │   ├── EditorCanvas.tsx         # TipTap 封装（~400行）
│   │   ├── AIActionBar.tsx          # AI 指令输入（~100行）
│   │   ├── AISidebar.tsx            # AI/样式/审阅 tab 侧栏
│   │   ├── Toolbar.tsx              # 保留
│   │   └── InlineToolbar.tsx        # 保留
│   │
│   ├── collections/                 # 合集（适配新接口）
│   ├── series/                      # 系列（适配新接口）
│   ├── settings/                    # 设置（保留 UI）
│   ├── sidebar/                     # 侧栏（保留）
│   ├── agent/                       # Agent UI（适配）
│   └── common/                      # 通用组件（保留）
│
├── hooks/                           # hook 胶水层
│   ├── useDocument.ts               # 文档 CRUD hook
│   ├── usePlan.ts                   # 规划流程 hook
│   ├── useAI.ts                     # AI 调用 hook
│   └── useCollection.ts             # 合集 hook
│
├── lib/                             # 保留现有工具库，逐步清理
│   ├── events/                      # 精简到 ~12 个事件
│   ├── theme/                       # 保留
│   └── editor/                      # 保留
│
├── store/                           # Zustand（保留，精简）
│   └── themeStore.ts                # 只保留 UI 状态
│
└── styles.css                       # 保留（27k 行，不重构）
```

### 3.4 存储层设计

#### SQLite 完整 Schema（15 张表）

详见上一版方案 12 张基础表（collections, documents, series_plans, publish_records, providers, platform_configs, settings, article_images, documents_search, documents_fts, vector_chunks, skills, phase_configs）+ 新增 3 张市场相关表（见 3.6.2 节）。

#### 文件系统存什么

| 内容 | 存储位置 | 原因 |
|------|---------|------|
| 文章图片 | `assets/{document_id}/` | 二进制大文件 |
| 项目关联 .md | 项目原目录 | 用户需要在 Finder 中编辑 |
| 系统主题偏好 | localStorage | 非业务数据 |

#### 什么被删除

| 删除项 | 原因 |
|--------|------|
| 全部 `data/*.json`（8 个文件） | SQLite 替代 |
| `articles/{id}.md` | 内容在 documents.content |
| `articles/{id}.meta.json` | 合并到 documents 表字段 |
| `articles/{id}.blueprint.json` | 合并到 documents.outline |
| `documents/{id}.json` | 合并到 documents 表 |
| `series_{collection_id}.json` | 合并到 series_plans 表 |
| `articleVersions.ts` | 版本在 documents.version |
| `articleDocument.ts` | 合并到 DocumentService |
| `articles.ts` | 合并到 DocumentService |
| `StorageEngine` | 不需要缓存层 |

### 3.5 事件总线精简

```
当前 22 个事件 → 精简为 ~12 个

保留：
  collections-changed      合集/文档变更
  article-document-changed  文档更新
  editor-ready             编辑器就绪
  outline-navigate         大纲导航
  ai-config-changed        AI 配置变更
  providers-changed        提供商变更
  article-theme-changed    文章主题变更
  image-gen-*              （3 个保持）

移除（用 Service 返回值替代）：
  blueprint-changed          → DocumentService.save() 后无此事件
  content-saved              → 由 hook useDocument 统一管理保存状态
  auto-plan-article          → 由 PlanService 直接调用
  plan-series-*              → 由 SeriesService 直接调
  reset-plan                 → 由 PlanPanel 内部状态
  writing-skill-changed      → 由 SkillService 内部管理
  project-exploring          → 由 ProjectService 内部返回 progress
```

---

### 3.6 市场与插件系统（为未来设计）

> 虽然 v3.0 不实现市场 UI，但 **架构层面必须预留**。否则后期加市场等于在错误的地基上搭新楼。

#### 核心原则

```
所有可安装的内容都是「Package」，Skill 和 Template 是 Package 的两种类型。
一套接口管所有，不为每种可安装内容单独造轮子。
```

#### 3.6.1 Domain 层新增类型

```typescript
// ─── PackageType — 包类型 ───
type PackageType = "skill" | "template";

// ─── PackageManifest — 包元数据（和文件系统中的 manifest.json 一致） ───
interface PackageManifest {
  formatVersion: number;           // 清单格式版本（当前为 1）
  type: PackageType;
  id: string;                      // 唯一 ID，如 "com.inkwise.skill.essay"
  name: string;
  version: string;                 // semver "1.0.0"
  minAppVersion: string;           // 最低兼容应用版本 "3.0.0"
  author: {
    name: string;
    email?: string;
    website?: string;
  };
  description: string;
  icon?: string;                   // 包内图标路径
  thumbnail?: string;              // 包内预览图路径
  license?: string;                // "MIT" | "GPL-3.0" | "Proprietary"
  tags: string[];
  keywords: string[];

  // Skill 专用
  styles?: StyleDef[];             // 该技能可用的写作风格
  actions?: ActionDef[];           // 该技能可用的写作动作
  phases: Record<string, PhaseConfigDef>;  // 阶段提示词

  // Template 专用
  template?: {
    defaultTitle?: string;
    defaultTone?: string;
    defaultAudience?: string;
    defaultOutline?: OutlineSection[];
    defaultStyleId?: string;
    defaultActionId?: string;
    sampleContent?: string;         // 示例内容（可选）
    requiredSkill?: string;         // 关联技能 ID
  };
}

// ─── InstalledPackage — 已安装包（数据库记录） ───
interface InstalledPackage {
  id: string;
  type: PackageType;
  name: string;
  version: string;
  author?: string;
  description?: string;
  source: "marketplace" | "file" | "builtin";
  sourceUrl?: string;              // 市场 URL（检查更新用）
  manifestJson: string;            // 完整 manifest 快照
  installPath?: string;            // 本地包文件路径
  installedAt: number;
  updatedAt: number;
  isEnabled: boolean;
}

// ─── Template — 文章模板 ───
interface Template {
  id: string;
  name: string;
  description?: string;
  packageId?: string;              // 来自哪个包（null = 用户自建）
  presetData: {
    defaultTitle?: string;
    tone?: string;
    targetAudience?: string;
    targetWordCount?: number;
    outline: OutlineSection[];
    styleId: string;
    actionId: string;
    tags: string[];
    inspiration?: string;
  };
  thumbnailPath?: string;
  isUserCreated: boolean;
  createdAt: number;
  updatedAt: number;
}
```

#### 3.6.2 SQLite 新增 3 张表

```sql
-- ─── 已安装包注册表 ───
CREATE TABLE installed_packages (
  id              TEXT PRIMARY KEY,         -- "com.inkwise.skill.essay"
  type            TEXT NOT NULL,            -- "skill" | "template"
  name            TEXT NOT NULL,
  version         TEXT NOT NULL,
  author          TEXT,
  description     TEXT,
  source          TEXT NOT NULL DEFAULT 'file',  -- marketplace / file / builtin
  source_url      TEXT,                     -- 市场 URL，用于检查更新
  manifest_json   TEXT NOT NULL,            -- 完整 manifest 快照（恢复用）
  install_path    TEXT,                     -- packages/{id}/ 目录
  is_enabled      INTEGER NOT NULL DEFAULT 1,
  installed_at    INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

-- ─── 文章模板 ───
CREATE TABLE templates (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT,
  package_id      TEXT REFERENCES installed_packages(id) ON DELETE SET NULL,
  preset_data     TEXT NOT NULL,            -- JSON（完整的 Template.presetData）
  thumbnail_path  TEXT,
  is_user_created INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

-- ─── 模板 ↔ 技能关联 ───
CREATE TABLE template_skills (
  template_id     TEXT REFERENCES templates(id) ON DELETE CASCADE,
  skill_id        TEXT NOT NULL,
  PRIMARY KEY (template_id, skill_id)
);
```

#### 3.6.3 Service 层新增

```typescript
// ─── PackageService — 包生命周期管理 ───
class PackageService {
  async install(path: string): Promise<InstalledPackage>;
    // 读取 .inkwise-package → 解包 → 校验 manifest
    // → 存入 installed_packages → 如果是 skill 注册到 SkillService
    // → 如果是 template 注册到 TemplateService

  async uninstall(id: string): Promise<void>;
    // 从 installed_packages 删除 → 清理文件 → 注销 Service 注册

  async list(type?: PackageType): Promise<InstalledPackage[]>;
  async get(id: string): Promise<InstalledPackage | null>;

  async checkUpdate(id: string): Promise<string | null>;
    // 读取 source_url → 远程比较 version

  async update(id: string): Promise<InstalledPackage>;
    // 下载新版 → 安装 → 保留用户配置

  async export(id: string, targetPath: string): Promise<void>;
    // 将已安装包导出为 .inkwise-package 文件
}

// ─── MarketplaceService — 市场通讯 ───
class MarketplaceService {
  private baseUrl: string;          // 可配置的市场 API 地址

  async browse(type?: PackageType, category?: string): Promise<PackageListing[]>;
  async search(query: string): Promise<PackageListing[]>;
  async getDetail(packageId: string): Promise<PackageDetail>;

  async download(packageId: string, version?: string): Promise<string>;
    // 下载到临时目录 → 返回路径 → PackageService.install 接手
}

// ─── TemplateService — 模板管理 ───
class TemplateService {
  async list(): Promise<Template[]>;
  async get(id: string): Promise<Template | null>;

  async apply(templateId: string, collectionId?: string): Promise<ArticleDocument>;
    // 用 presetData 创建 ArticleDocument → 保存 → 返回

  async createFromDocument(documentId: string, name: string): Promise<Template>;
    // 从已有文章提取 outline/styleId/actionId 保存为模板

  async export(templateId: string): Promise<string>;
    // 导出为 .inkwise-package 文件（可分享到市场）

  async delete(id: string): Promise<void>;
}
```

#### 3.6.4 Package 文件格式 `.inkwise-package`

```text
# 物理格式：tar.gz（或 zip）
# 必须包含 manifest.json

my-skill-1.0.0.inkwise-package
├── manifest.json              # 【必须】包元数据
├── icon.svg                   # 图标（可选）
├── screenshot.png             # 市场预览图（可选）
├── preview.mp4                # 演示视频（可选）
└── prompts/                   # 提示词文件（可选，manifest 可引用）
    ├── title.md
    └── outline.md
```

#### 3.6.5 文件系统存储

```text
{app_data}/
├── packages/                  # 已安装包的文件
│   └── com.inkwise.skill.essay/
│       ├── manifest.json
│       ├── icon.svg
│       └── prompts/
├── assets/                    # 文章图片
└── inkwise.db                 # SQLite（含 installed_packages 表）
```

#### 3.6.6 加一个新 Skill 的市场化路径

```
开发者侧                             用户侧
─────────                           ──────
1. 写 manifest.json               1. 打开市场浏览
2. 写 prompts/*.md                2. 点击安装
3. 打包 .inkwise-package          3. PackageService.install()
4. 上传到市场                     4. SkillService 自动注册
5. 审核通过上线                   5. PlanService 自动可用
```

#### 3.6.7 为什么现在就要设计

| 如果现在不预留 | v3.1 加市场时会 |
|---------------|-----------------|
| `installed_packages` 表不存在 | 要么改 schema migration，要么创建平行存储 |
| `PackageManifest` 类型不存在 | 临时拼凑，不一致 |
| `PackageService` 不设计 | 安装逻辑散落在各组件中 |
| 文件格式无规范 | 每个包作者各写各的 |
| `minAppVersion` 不存在 | 安装了不兼容的包，应用崩溃 |

**这 3 张表 + 3 个 Service + 1 个文件格式的代码投入不超过 2 天，但为未来的市场省下至少 2 周的改造成本。**

---

## 第四章：实施路线 — 分 3 个 Sprint

### Sprint 6（2 周）：存储统一 + Rust 模块拆分

**目标**：SQLite 成为唯一事实源，Rust 后端按职责拆分

| 周 | 日 | 任务 | 产出 | 可运行？ |
|---|----|------|------|---------|
| W1 | D1 | 创建分支 `codex/v3.0-s6`，定义 domain/ 类型 | 6 个 Rust 类型文件 | ✅ main 分支可用 |
| W1 | D2 | 实现 storage/ 目录（Storage trait + sqlite.rs） | storage/mod.rs + sqlite.rs | ✅ |
| W1 | D3 | 编写 migration.rs（JSON → SQLite 迁移） | 迁移脚本 | ✅ |
| W1 | D4 | 创建 commands/ 目录，逐个迁移命令 | document_cmds + collection_cmds | ⚠️ 边迁移边测 |
| W1 | D5 | 创建 ai/ 目录，拆 ai.rs | openai.rs + anthropic.rs + streaming.rs | ✅ |
| W2 | D1-D2 | 前端存储层重写 + 删除旧文件 | 前端 crud 改调 SQLite | ⚠️ 此时前端可能 break |
| W2 | D3 | 集成测试 + 修复 | 全流程可用 | ✅ **v3.0-s6 可合并** |
| W2 | D4-D5 | 端到端测试，修 bug | 稳定版本 | ✅ |

**主线分支保持可用**：Sprint 6 期间 main 分支不动，用户继续用 v2.1.0。s6 开发在独立分支完成。

### Sprint 7（2 周）：分层拆分 + Service 提取

**目标**：前后端都按 UI/Service/Domain/Infrastructure 四层组织

| 周 | 日 | 任务 | 产出 |
|---|----|------|------|
| W1 | D1-D2 | 前端 domain/ 目录剥离类型定义 | 纯类型文件 |
| W1 | D3-D5 | Infrastructure 接口 + 实现 | AIProvider/DocumentStore/EventBus 接口 |
| W2 | D1-D3 | Service 层提取 | PlanService/DocumentService/CollectionService 等 |
| W2 | D4-D5 | hooks 胶水层 | useDocument/usePlan/useCollection |

**s6 完成后合并到 main → 然后开 s7 分支**

### Sprint 8（2 周）：UI 组件拆分 + 能力增强

**目标**：EditorPane 拆分 + Skill 净化 + 向量加速

| 周 | 日 | 任务 | 产出 |
|---|----|------|------|
| W1 | D1-D2 | EditorPane → EditorPage + PlanPanel + EditorCanvas | 5 个独立组件 |
| W1 | D3-D4 | PlanPanel 内部 UI 拆分 | 5 个子组件 |
| W2 | D1 | AISidebar（AI/样式/审阅 tab 侧栏） | 合并右侧面板 |
| W2 | D2 | Skill 纯净分离 | 去掉 systemPrompt |
| W2 | D3 | vector/search.rs ndarray 矩阵乘 | 搜索加速 |
| W2 | D4-D5 | 全量回归测试 + 发布 v3.0 | v3.0 正式版 |

---

## 第五章：风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 数据迁移过程中数据丢失 | 低 | 高 | 迁移前全量备份 JSON 文件；迁移脚本逐条验证 |
| 前端改存储层后大面积 break | 中 | 高 | 保持 Tauri 命令名不变，前端只改内部实现不改调用签名 |
| Skill 系统净化后旧技能不兼容 | 低 | 中 | PhaseConfig 迁移脚本自动处理 |
| 重构周期过长导致 main 分支严重落后 | 中 | 中 | 每个 Sprint 完成后合并回 main，不超过 2 周 |
| CSS 27k 单文件改不动 | 低 | 低 | CSS 不重构，只加不改 |

### 回滚策略

1. **数据层**：迁移前全量备份 `data/` 目录，迁移失败可还原
2. **代码层**：每个 Sprint 独立分支，合并前全量测试
3. **用户数据**：旧 JSON 文件在确认 SQLite 稳定前不删除

---

## 第六章：开发者指南

### 加一个新 Skill 的步骤（重构后）

#### 方式 A：作为内置技能（代码内注册）

```typescript
// 1. 注册技能元数据
SkillService.register({
  id: "write-resume",
  name: "写简历",
  icon: "📄",
  inputSchema: { jobDesc: "string", experience: "string" }
});

// 2. 按需写阶段模板
PhaseConfigService.set("resume-title", {
  skillId: "write-resume",
  phase: "title",
  systemPrompt: "你是一位简历专家..."
});

// ✅ 完成！PlanService 自动适配
```

#### 方式 B：作为可安装包（市场/文件分发）

```bash
# 1. 创建包目录
mkdir my-skill && cd my-skill

# 2. 写 manifest.json
cat > manifest.json <<EOF
{
  "formatVersion": 1,
  "type": "skill",
  "id": "com.example.write-resume",
  "name": "简历大师",
  "version": "1.0.0",
  "minAppVersion": "3.0.0",
  "author": { "name": "张三" },
  "description": "一键生成专业求职简历",
  "tags": ["简历", "求职"],
  "phases": {
    "title": {
      "systemPrompt": "你是简历专家，根据以下信息生成标题...",
      "temperature": 0.7
    },
    "writing": {
      "systemPrompt": "根据大纲撰写简历正文...",
      "temperature": 0.8
    }
  }
}
EOF

# 3. 打包
tar -czf ../com.example.write-resume-1.0.0.inkwise-package .

# 4. 分发（上传到市场 / 发给用户）
# 用户侧：双击 .inkwise-package → PackageService.install() → 自动可用
```

### 加一个新 Template 的步骤（重构后）

```typescript
// 从已有文章创建模板
const template = await TemplateService.createFromDocument(
  documentId: "doc_xxx",
  name: "技术博客模板"
);

// 应用模板到新文章
const doc = await TemplateService.apply(
  templateId: "tpl_xxx",
  collectionId: "col_xxx"
);
// doc 已包含预设的 title/tone/outline/styleId/actionId

// 导出模板为可分享包
await TemplateService.export("tpl_xxx");
// → 生成 .inkwise-package 文件，可上传市场或分享
```

### 加一个新 AI 提供商的步骤（重构后）

```rust
// 1. 新建 ai/myprovider.rs
pub async fn chat(...) -> Result<String, String> { ... }
pub async fn chat_stream(...) -> Result<String, String> { ... }

// 2. ai/mod.rs 加一行
match config.kind.as_str() {
    "openai" => openai::chat(...),
    "myprovider" => myprovider::chat(...),  // ← 这一行
}
```
