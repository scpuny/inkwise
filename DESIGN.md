# InkWise 墨智 — 设计文档

> 项目版本: 1.2.0 | 技术栈: React 19 + TypeScript + Tauri 2 + Rust

---

## 1. 项目概览

InkWise 墨智是一款面向中文写作者的桌面端应用，提供沉浸式编辑体验与 AI 辅助写作能力。支持富文本与 Markdown 双模编辑，可接入多种 AI 提供商（OpenAI / Anthropic / DeepSeek），通过 Skill 系统实现续写、改写、润色、翻译、摘要等写作增强功能。内置专栏规划、多平台发布（微信、头条）、项目上下文索引与 SQLite FTS5 全文检索。

---

## 2. 技术选型

| 层 | 技术 | 说明 |
|---|---|---|
| 前端框架 | React 19 + TypeScript 6 | 使用 Vite 6 构建 |
| 编辑内核 | TipTap 3 (ProseMirror) | 富文本 + Markdown 双模式 |
| 桌面壳 | Tauri 2 (Rust) | 跨平台桌面应用 |
| 后端语言 | Rust (edition 2021) | Tauri 命令处理 |
| HTTP 客户端 | reqwest 0.12 | AI API + 发布平台 API 调用 |
| 数据库 | rusqlite 0.32 (bundled) | SQLite 持久层 + FTS5 全文检索 |
| 图标 | lucide-react | 统一图标体系 |
| 样式 | 单文件 CSS (styles.css) | CSS 变量驱动，BEM 命名 |

### Tauri 插件

| 插件 | 用途 |
|---|---|
| tauri-plugin-dialog | 系统对话框（打开/保存文件） |
| tauri-plugin-fs | 文件系统读写 |
| tauri-plugin-clipboard-manager | 剪贴板读写 |
| tauri-plugin-global-shortcut | 全局快捷键 |
| tauri-plugin-window-state | 窗口位置/大小持久化 |
| tauri-plugin-log | 日志记录 |

---

## 3. 系统架构

### 3.1 三层架构

```
+---------------------------------------------------+
|              Presentation Layer (React)             |
|  +---------+----------------+------------+         |
|  | Sidebar |  EditorPane    | AIDock     |         |
|  | 文档树   |  编辑器        | AI 面板    |         |
|  | 大纲    |  状态栏        | 建议/改写  |         |
|  | 设置    |  AI 指令条     | 文风分析   |         |
|  +---------+----------------+------------+         |
+---------------------------------------------------+
|            Data Layer (lib/)                        |
|  +------+-------+------+----------+-------+------+ |
|  |theme |collec |arti  |provider  |skill  |editor| |
|  |.ts   |tions  |cles  |Models    |.ts    |Styles| |
|  |      |.ts    |.ts   |.ts       |       |.ts   | |
|  +------+-------+------+----------+-------+------+ |
|            tauri.ts (IPC 桥接层)                    |
+---------------------------------------------------+
|           Backend Layer (Rust/Tauri)                |
|  +--------+-------+---------+----------+----------+|
|  | store  | ai.rs | skill   | agent    | db.rs    ||
|  | .rs    | AI 聊 | .rs     | .rs      | SQLite   ||
|  | 数据   | 天    | Skill   | Agent    | FTS5     ||
|  | 持久化 | 调用   | 管理     | 执行     | 持久化   ||
|  +--------+-------+---------+----------+----------+|
|  +-------------+------------------+                |
|  | publisher   | project_indexer  |                |
|  | .rs         | .rs              |                |
|  | 多平台发布   | 项目上下文索引    |                |
|  +-------------+------------------+                |
+---------------------------------------------------+
```

### 3.2 数据流

```
用户操作 → React State → Tauri IPC (invoke)
  +- 浏览器回退: localStorage 替代
  +- Tauri 环境: Rust 命令处理
       +- 旧路径: DataStore JSON 文件 (store.rs)
       +- 新路径: SQLite (db.rs)

AI 请求路径:
  AIBar/EditorPane → lib/ai.ts → Rust ai.rs → HTTP API → AI 提供商
  +- 返回流式/完整响应 → 内联插入或 AI Dock 展示

发布路径:
  文章 → Rust publisher.rs → 微信/头条 API → 发布结果持久化

项目索引路径:
  本地目录 → Rust project_indexer.rs → 目录结构/符号/导入分析 → 注入 AI 上下文
```

### 3.3 Tauri ↔ 浏览器双模式

应用可在浏览器 (`npm run dev`) 和 Tauri (`npm run tauri:dev`) 两种环境下运行：

- **浏览器模式**: 所有数据通过 `localStorage` 持久化，AI 功能不可用（返回提示信息）
- **Tauri 模式**: 通过 `@tauri-apps/api/core` 的 `invoke` 调用 Rust 后端，SQLite 持久化

`src/lib/tauri.ts` 提供了 `isTauriEnv()`、`tryInvoke()`、`invokeOrFallback()` 等桥接函数，前端代码通过 `invokeOrFallback` 模式透明地适应两种环境。

---

## 4. 前端子架构

### 4.1 目录结构

```
src/
+-- main.tsx                     # 入口：初始化主题、seed 数据、挂载 React
+-- App.tsx                      # 根组件：布局管理、响应式面板、快捷键
+-- styles.css                   # 单文件 CSS (~6000 行, CSS 变量 + BEM)
+-- components/
|   +-- Sidebar.tsx              # 侧栏容器（品牌、新建文档、搜索、导航）
|   +-- CollectionTree.tsx       # 合集/文章树形结构、回收站管理
|   +-- OutlinePanel.tsx         # 大纲面板（从 Markdown 解析标题）
|   +-- EditorPane.tsx           # 编辑面板容器（工具栏 + 编辑器 + AI 条）
|   +-- EditorContent.tsx        # TipTap 富文本编辑器 + Markdown 源码模式
|   +-- Toolbar.tsx              # 格式工具栏（标题、加粗、链接、查找替换等）
|   +-- AIBar.tsx                # AI 指令输入条（模型选择、意图选择、Token 设置）
|   +-- AIDock.tsx               # AI 侧栏（建议、改写、文风分析）
|   +-- SettingsPanel.tsx        # 设置面板（外观、编辑器、模型、Skills、模板、快捷键）
|   +-- ThemePicker.tsx          # 主题风格/模式选择器
|   +-- StatusBar.tsx            # 状态栏（字数、模式、同步状态）
|   +-- StartupSplash.tsx        # 启动封面
|   +-- ContextMenu.tsx          # 右键菜单
|   +-- PopoverMenu.tsx          # 弹出菜单
|   +-- IntentMenu.tsx           # AI 意图选择菜单
|   +-- InlineConfirmButton.tsx  # 内联确认按钮
|   +-- InlineToolbar.tsx        # 内联格式工具栏
|   +-- InlineGhostText.tsx      # 内联 AI 建议预览
|   +-- StylePanel.tsx           # 编辑器样式模板面板
|   +-- ArticleHeader.tsx        # 文章元数据头部（描述、标签、语气、受众）
|   +-- ArticleInfoPanel.tsx     # 文章信息面板
|   +-- ArticlePreview.tsx       # 文章预览
|   +-- ArticleManager.tsx       # 文章管理器
|   +-- ArticleFinalPage.tsx     # 终稿页面
|   +-- SeriesPlanner.tsx        # 专栏规划器
|   +-- SeriesOverview.tsx       # 专栏概览
|   +-- BlueprintEditor.tsx      # 蓝图编辑器（写作阶段）
|   +-- BlueprintProgress.tsx    # 蓝图进度
|   +-- PlanReview.tsx           # 规划评审
|   +-- PublishDialog.tsx        # 发布对话框
|   +-- PublishStatusPanel.tsx   # 发布状态面板
|   +-- SearchPanel.tsx          # 全文搜索面板
|   +-- CommandPalette.tsx       # 命令面板
|   +-- CollectionFormModal.tsx  # 合集表单弹窗
|   +-- DocPicker.tsx            # 文档选择器
|   +-- ProjectFileTree.tsx      # 项目文件树
|   +-- AgentPanel.tsx           # Agent 执行面板
|   +-- AgentProvider.tsx        # Agent 提供商配置
|   +-- FinalSidePanel.tsx       # 终稿侧栏
|   +-- FinalTopBar.tsx          # 终稿顶栏
|   +-- AICommandBar.tsx         # AI 命令条
|   +-- ConfirmDialog.tsx        # 确认对话框
|   +-- CustomSelect.tsx         # 自定义下拉选择
|   +-- ErrorBoundary.tsx        # 错误边界
|   +-- VersionHistoryModal.tsx  # 版本历史弹窗
+-- lib/                     # 工具库
    +-- types.ts
    +-- tauri.ts             # Tauri IPC 桥接
    +-- theme.ts             # 主题系统
    +-- textSize.ts          # 字号预设
    +-- fontFamily.ts        # 字体预设
    +-- collections.ts       # 合集/文章 CRUD
    +-- articles.ts          # 文章内容持久化
    +-- ai.ts                # AI 聊天 API
    +-- providerModels.ts    # AI 提供商模型管理
    +-- skill.ts             # Skill 系统
    +-- editorStyles.ts      # 编辑器样式模板
```

### 4.2 组件说明

#### 编辑器相关
- **EditorContent.tsx**: 核心编辑器组件，封装 TipTap，支持富文本和 Markdown 源码模式切换，注册所有扩展（链接、图片、代码块高亮、任务列表、文字对齐、颜色、删除线、下划线等），管理光标位置和选中文本。
- **InlineToolbar.tsx**: 选中文本后弹出的浮动工具栏，提供格式刷、链接、AI 快捷操作，失焦后保持不关闭。
- **InlineGhostText.tsx**: AI 流式生成时以灰色幽灵文本形式内联显示建议内容，用户可一键接受或拒绝。

#### 文章与写作流
- **ArticleHeader.tsx**: 文章头部元数据编辑区，包含描述、标签（多选）、语气（正式/幽默/批判等）、目标受众。
- **ArticleInfoPanel.tsx**: 展示文章字数统计、阅读时间、目标字数进度、阶段状态等。
- **SeriesPlanner.tsx / SeriesOverview.tsx**: 专栏规划功能，支持创建系列文章计划，设定每篇的目标字数和状态追踪。
- **BlueprintEditor.tsx / BlueprintProgress.tsx**: 基于写作阶段（初稿/修改/润色/终稿）的蓝图式写作流程管理。
- **PlanReview.tsx**: 规划评审界面，汇总专栏/蓝图执行情况。
- **ArticleFinalPage.tsx**: 文章终稿预览页，展示格式化后的完整文章，可导出为 HTML。

#### 发布系统
- **PublishDialog.tsx**: 多平台发布对话框，配置封面图、摘要、原创声明、转载权限等。
- **PublishStatusPanel.tsx**: 各平台发布状态追踪，显示成功/失败/草稿状态及平台链接。

#### AI 与搜索
- **AIBar.tsx**: 底部 AI 指令输入条，支持多轮对话，显示 token 用量，可通过意图按钮或快捷键（Alt+1~5）快速执行 Skill。
- **AICommandBar.tsx**: 精简版 AI 命令条，用于快速执行预定义命令。
- **AgentPanel.tsx / AgentProvider.tsx**: Agent 执行面板，展示 Agent 执行的思考步骤和中间结果。
- **SearchPanel.tsx**: 基于 SQLite FTS5 的全文搜索面板，支持实时搜索和结果高亮。
- **CommandPalette.tsx**: 命令面板（Cmd+K），快速访问应用功能和设置。

---

## 5. 后端子架构

### 5.1 Rust 模块总览

```rust
mod store;            // JSON 文件持久化（旧路径）
mod ai;               // AI API 通信
mod skill;            // Skill 管理
mod agent;            // Agent 执行
mod db;               // SQLite 持久层 + FTS5 全文检索（新路径）
mod project_indexer;  // 项目上下文索引
mod publisher;        // 多平台发布（微信、头条）
```

### 5.2 模块详解

#### store.rs (JSON 文件持久化)
- 基于 JSON 文件的持久化方案，将合集、文章元数据、提供商配置、应用设置等写入 `app_data_dir/data/`
- 提供 `DataStore` 作为统一数据访问入口
- 以 `Mutex<DataStore>` 方式在 `AppState` 中共享
- 包含完整的应用数据模型（见第 6 节）

#### ai.rs (AI 通信)
- 支持 OpenAI 兼容协议（`/v1/chat/completions`）和 Anthropic 协议（`/v1/messages`）
- DeepSeek 和自定义提供商走 OpenAI 兼容协议
- 支持从 `/v1/models` 端点获取可用模型列表
- 120 秒超时配置

#### skill.rs (Skill 系统)
Skill 是定义写作行为的「技能」文件，以 Markdown 格式存储：

- **发现顺序**: 全局 skills 目录 → 项目 skills 目录 → 内置技能
- **Frontmatter 解析**: 从 Markdown 文件头部 `---` 块提取 name、description、runAs、allowed-tools 等元数据
- **作用域**: Builtin（内置）、Global（全局）、Project（项目）、Custom（自定义）

内置技能：continue-writing、rewrite、polish、translate、academic、creative、summary

#### agent.rs (Agent 执行)
- 根据 Skill 定义构建 System Prompt
- 注入文档上下文（文档内容、选中文本、用户输入）
- 支持注入项目上下文（project_indexer 扫描结果）
- 调用 AI API 执行写作任务
- 返回结构化 `AgentResult`（content + steps）

#### db.rs (SQLite 持久层)
基于 rusqlite 的 SQLite 持久化方案，约 400 行：

- **表结构**: articles（文章完整内容）、collections（合集）、providers（AI 提供商）、settings（应用设置）、skills（技能定义）、publish_records（发布记录）
- **全文检索**: SQLite FTS5 全文索引，支持中文分词，提供 `search_articles()` 实时搜索
- **迁移机制**: 内置 schema 版本管理，自动执行增量迁移
- **双轨并行**: 与 store.rs JSON 方案并存，逐步迁移

#### project_indexer.rs (项目上下文索引)
扫描本地目录，提取项目结构信息供 AI 上下文注入：

- 遍历目录结构，生成文件树（`FileNode`）
- 按语言统计文件分布（`LanguageStat`）
- 提取项目配置信息（package.json、Cargo.toml 等）
- 基础符号（函数/类定义）和导入关系扫描
- 检测代码图谱（Codegraph）可用性
- 生成结构化文本上下文，注入 Agent System Prompt

#### publisher.rs (多平台发布)
支持将文章发布到微信公众号和今日头条等平台：

- **平台配置**: 通过 `PlatformConfig` 管理各平台的 app_id、app_secret 和 access_token
- **微信发布**: 支持草稿创建、发布、图片上传（media_id），分两步（先草稿后发布）
- **发布选项**: 封面图、摘要、原创声明、转载权限、付费设置、自定义作者
- **发布记录**: 记录 `PublishRecord`，追踪每篇文章在各平台的发布状态

---

## 6. 数据模型

### 6.1 合集 (Collection)

```typescript
Collection {
  id: string            # 唯一标识
  title: string         # 名称
  createdAt: number     # 创建时间戳
  linkedFolder?: string # 关联本地文件夹路径
  articles: Article[]   # 文章列表（内联存储）
}
```

### 6.2 文章 (Article)

```typescript
ArticleMeta {
  id: string            # 唯一标识
  collectionId: string  # 所属合集 ID
  title: string         # 标题
  createdAt: number     # 创建时间戳
  updatedAt: number     # 最后修改时间戳
}
```

- **内容存储**: `articles/{id}.md`（独立 Markdown 文件，便于版本控制和全文索引）
- **元数据**: `articles/{id}.meta.json`（独立文件，便于快速扫描）
- **SQLite**: 文章内容和元数据同步写入 `articles` 表，启用 FTS5 全文索引

### 6.3 AI 提供商 (Provider)

```typescript
Provider {
  id: string            # 唯一标识
  label: string         # 显示名称
  kind: string          # openai | anthropic | deepseek | custom
  baseUrl?: string      # API 基础 URL
  apiKey?: string       # API 密钥
  models: string[]      # 可用模型列表
  enabled: boolean      # 是否启用
  builtin: boolean      # 是否内置提供商
}
```

### 6.4 Skill 定义

```typescript
Skill {
  name: string           # 技能名称
  description: string    # 描述
  body: string           # 技能定义正文（Markdown）
  scope: SkillScope      # Builtin | Global | Custom | Project
  path: string           # 文件路径
  runAs: RunAs           # Inline | Subagent
  allowedTools: string[] # 允许的工具列表
  model?: string         # 指定模型
  effort?: string        # 思考努力度
  enabled: boolean       # 是否启用
}
```

### 6.5 专栏 (SeriesPlan)

```typescript
SeriesPlan {
  id: string             # 唯一标识
  title: string          # 专栏名称
  createdAt: number      # 创建时间戳
  tone?: string          # 语气风格
  targetAudience?: string # 目标受众
  articles: SeriesArticle[]  # 专栏文章列表
}

SeriesArticle {
  id: string             # 唯一标识
  title: string          # 文章标题
  description: string    # 描述
  targetWordCount?: number  # 目标字数
  status: string         # planned | writing | completed
  articleId?: string     # 关联文章 ID（完成后）
}
```

### 6.6 蓝图 (ArticleBlueprint)

```typescript
ArticleBlueprint {
  id: string             # 唯一标识
  articleId: string      # 关联文章 ID
  phases: PhaseConfig[]  # 写作阶段配置
  currentPhase: number   # 当前阶段索引
  createdAt: number      # 创建时间戳
  updatedAt: number      # 更新时间戳
}

PhaseConfig {
  id: string             # 阶段标识（draft | revision | polish | final）
  label: string          # 显示名称
  completed: boolean     # 是否完成
  completedAt?: number   # 完成时间
}
```

### 6.7 发布平台配置

```typescript
PlatformConfig {
  id: string             # 唯一标识
  platform: string       # wechat | toutiao
  label: string          # 显示名称
  appId: string          # 应用 ID
  appSecret: string      # 应用密钥
  accessToken?: string   # OAuth 访问令牌
  tokenExpiresAt?: number # 令牌过期时间
  enabled: boolean       # 是否启用
}

PublishRecord {
  id: string             # 唯一标识
  articleId: string      # 关联文章 ID
  platform: string       # 发布平台
  platformArticleId?: string  # 平台侧文章 ID
  status: string         # draft | published | failed
  errorMessage?: string  # 错误信息
  publishedAt: number    # 发布时间
  platformUrl?: string   # 平台链接
}
```

### 6.8 应用设置 (AppSettings)

```typescript
AppSettings {
  themeStyle: string     # 主题风格
  themeMode: string      # auto | dark | light
  textSize: string       # small | default | large | xlarge
  fontFamily: string     # 字体预设
  editorWidth: string    # 编辑器宽度
  showLineNumbers: boolean
  autoSave: boolean
  autoSaveInterval: number  # 秒
  language: string       # 界面语言
  writingSkills: WritingSkill[]  # 写作技能配置
}
```

### 6.9 写作技能 (WritingSkill)

```typescript
WritingSkill {
  id: string             # 唯一标识
  name: string           # 技能名称
  description: string    # 描述
  enabled: boolean       # 是否启用
  keyBind: string        # 快捷键绑定
  contextSources: ContextSource[]  # 上下文注入源
}

ContextSource {
  id: string             # 源标识
  label: string          # 显示名称
  enabled: boolean       # 是否注入
  maxTokens: number      # 最大 token 数
  content: string        # 实际上下文内容（动态填充）
}

StyleDimension {
  id: string             # 维度标识
  label: string          # 显示名称
  enabled: boolean       # 是否启用
  weight: number         # 权重（1-5）
}
```

---

## 7. 样式体系

### 7.1 CSS 变量三层覆盖（参考 Reasonix）

```
Layer 1: :root 默认暗色变量
Layer 2: @media (prefers-color-scheme: light) 系统浅色覆盖
Layer 3: [data-theme="light"] / [data-theme="dark"] 用户强制覆盖
```

### 7.2 主题风格（6 种）

| 标识 | 名称 | 色相 |
|---|---|---|
| graphite | 石墨 | 暖橙 (#d97757) |
| aurora | 极光 | 紫蓝渐变 |
| slate | 石板 | 蓝色 (#4d8df6) |
| carbon | 碳灰 | 青色 (#2dd4bf) |
| nocturne | 夜曲 | 紫色 (#818cf8) |
| amber | 琥珀 | 橙红 (#d4632f) |

### 7.3 主题模式（3 种）

- `auto`: 跟随系统（默认暗色）
- `dark`: 强制深色
- `light`: 强制浅色

### 7.4 布局栅格

```css
.layout {
  display: grid;
  grid-template-columns:
    [sidebar]  var(--sidebar-width, 264px)
    [editor]   minmax(0, 1fr)
    [resizer]  var(--resizer-width, 8px)
    [ai-dock]  var(--ai-dock-width, 420px);
  grid-template-rows: 1fr auto;
}
```

---

## 8. AI 集成

### 8.1 多提供商架构

```
用户配置
  +- OpenAI:    gpt-4o, gpt-4o-mini, gpt-4-turbo
  +- Anthropic: claude-3.5-sonnet, claude-3-haiku
  +- DeepSeek:  deepseek-chat, deepseek-coder
  +- 自定义:    任意 OpenAI 兼容 API
```

### 8.2 三种 AI 交互模式

| 模式 | 路径 | 触发方式 |
|---|---|---|
| AI Dock（侧栏） | AIDock.tsx → 静态规则分析 | 自动 |
| AI Bar（底部指令条） | AIBar.tsx → lib/ai.ts → Rust ai.rs → HTTP | 用户输入 |
| Skill Agent | EditorPane → lib/skill.ts → Rust skill.rs + agent.rs | 意图选择 / 快捷键 |

### 8.3 Skill 执行流程

```
用户选择意图（如"润色"）
  → AIBar 识别意图名称
  → 调用 runSkill(name, userInput, documentContent, selectedText)
  → Rust skill.rs 查找 Skill 定义
  → agent.rs 构建结构化 Prompt（Skill body + 文档上下文 + 项目上下文）
  → ai.rs 调用 AI API（流式或完整响应）
  → 返回 AgentResult { content, steps }
  → 前端展示内联幽灵文本或 AI Dock 输出
  → 用户一键接受（Tab）或拒绝（Esc）
```

---

## 9. 构建与运行

```bash
# 开发（浏览器模式）
npm run dev

# 开发（Tauri 桌面模式）
npm run tauri:dev

# 生产构建
npm run tauri:build

# 类型检查
npm run typecheck
```

### 环境要求

- Node.js ≥ 18
- Rust ≥ 1.77.2
- Tauri CLI 2.x (`cargo install tauri-cli --version "^2"`)

### 依赖说明

**前端 (package.json)**
```
react 19, typescript 6, vite 6
@tauri-apps/api ^2.11
@tiptap/react ^3.26
lucide-react ^1.17
```

**后端 (Cargo.toml)**
```
tauri 2.11, reqwest 0.12, tokio 1
rusqlite 0.32 (bundled, features: FTS5)
serde 1.0, serde_json 1.0
tauri-plugin-dialog, tauri-plugin-fs
tauri-plugin-clipboard-manager
tauri-plugin-global-shortcut
tauri-plugin-window-state
```

---

## 10. 未来规划

- [x] **SQLite 持久化**: rusqlite + FTS5 全文检索（已完成）
- [x] **多平台发布**: 微信/头条 API 集成（已完成）
- [x] **项目上下文索引**: 本地目录扫描 + AI 上下文注入（已完成）
- [ ] **流式 AI 响应**: SSE/流式 API 支持，实时输出 AI 生成内容
- [ ] **全文搜索增强**: 搜索结果高亮、搜索建议、高级筛选
- [ ] **图片处理**: 拖拽上传、粘贴图片、本地存储
- [ ] **模板市场**: 编辑器样式模板的社区分享
- [ ] **本地知识库**: RAG 增强，基于个人文档的 AI 问答
- [ ] **导出增强**: PDF、DOCX 格式导出
- [ ] **协作编辑**: 基于 CRDT 的多人协作
- [ ] **移动端适配**: PWA 或 React Native

---

> 本设计文档反映了项目当前状态（v1.2.0），会随项目演进持续更新。
