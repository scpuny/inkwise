# AI 写作助手 — 设计文档

> 项目版本: 0.1.0 | 技术栈: React 19 + TypeScript + Tauri 2 + Rust

---

## 1. 项目概览

AI 写作助手是一款面向中文写作者的桌面端应用，提供沉浸式编辑体验与 AI 辅助写作能力。支持富文本与 Markdown 双模编辑，可接入多种 AI 提供商（OpenAI / Anthropic / DeepSeek），通过 Skill 系统实现续写、改写、润色、翻译、摘要等写作增强功能。

---

## 2. 技术选型

| 层 | 技术 | 说明 |
|---|---|---|
| 前端框架 | React 19 + TypeScript 6 | 使用 Vite 6 构建 |
| 编辑内核 | TipTap 3 (ProseMirror) | 富文本 + Markdown 双模式 |
| 桌面壳 | Tauri 2 (Rust) | 跨平台桌面应用 |
| 后端语言 | Rust (edition 2021) | Tauri 命令处理 |
| HTTP 客户端 | reqwest 0.12 | AI API 调用 |
| 图标 | lucide-react | 统一图标体系 |
| 样式 | 单文件 CSS (styles.css) | CSS 变量驱动，BEM 命名 |

---

## 3. 系统架构

### 3.1 三层架构

```
┌─────────────────────────────────────────────────┐
│              Presentation Layer (React)           │
│  ┌─────────┬──────────────┬──────────┐           │
│  │ Sidebar │  EditorPane  │ AIDock   │           │
│  │ 文档树   │  编辑器      │ AI 面板  │           │
│  │ 大纲    │  状态栏      │ 建议/改写│           │
│  │ 设置    │  AI 指令条   │ 文风分析 │           │
│  └─────────┴──────────────┴──────────┘           │
├─────────────────────────────────────────────────┤
│            Data Layer (lib/)                      │
│  ┌──────┬──────┬────┬────────┬──────┬──────┐    │
│  │theme │collec│arti│provider│skill │editor│    │
│  │.ts   │tions │cles│Models  │.ts   │Style │    │
│  │      │.ts   │.ts │.ts     │      │s.ts  │    │
│  └──────┴──────┴────┴────────┴──────┴──────┘    │
│            tauri.ts (IPC 桥接层)                  │
├─────────────────────────────────────────────────┤
│           Backend Layer (Rust/Tauri)              │
│  ┌──────────┬────────┬────────┬────────┐        │
│  │ store.rs │ ai.rs  │ skill  │ agent  │        │
│  │ 数据持久 │ AI 聊天│ .rs    │ .rs    │        │
│  │ 化       │ 调用    │ Skill  │ Agent  │        │
│  │          │        │ 管理    │ 执行   │        │
│  └──────────┴────────┴────────┴────────┘        │
└─────────────────────────────────────────────────┘
```

### 3.2 数据流

```
用户操作 → React State → Tauri IPC (invoke)
  └─ 浏览器回退: localStorage 替代
  └─ Tauri 环境: Rust 命令处理 → 文件系统

AI 请求路径:
  AIBar/EditorPane → lib/ai.ts → Rust ai.rs → HTTP API → AI 提供商
  └─ 返回流式/完整响应 → 内联插入或 AI Dock 展示
```

### 3.3 Tauri ↔ 浏览器双模式

应用可在浏览器 (`npm run dev`) 和 Tauri (`npm run tauri:dev`) 两种环境下运行：

- **浏览器模式**: 所有数据通过 `localStorage` 持久化，AI 功能不可用（返回提示信息）
- **Tauri 模式**: 通过 `@tauri-apps/api/core` 的 `invoke` 调用 Rust 后端，文件系统存储

`src/lib/tauri.ts` 提供了 `isTauriEnv()`、`tryInvoke()`、`invokeOrFallback()` 等桥接函数，前端代码通过 `invokeOrFallback` 模式透明地适应两种环境。

---

## 4. 前端子架构

### 4.1 目录结构

```
src/
├── main.tsx                     # 入口：初始化主题、seed 数据、挂载 React
├── App.tsx                      # 根组件：布局管理、响应式面板、快捷键
├── styles.css                   # 单文件 CSS (~6000 行, CSS 变量 + BEM)
├── components/
│   ├── Sidebar.tsx              # 侧栏容器（品牌、新建文档、搜索、导航）
│   ├── CollectionTree.tsx       # 合集/文章树形结构、回收站管理
│   ├── OutlinePanel.tsx         # 大纲面板（从 Markdown 解析标题）
│   ├── EditorPane.tsx           # 编辑面板容器（工具栏 + 编辑器 + AI 条）
│   ├── EditorContent.tsx        # TipTap 富文本编辑器 + Markdown 源码模式
│   ├── Toolbar.tsx              # 格式工具栏（标题、加粗、链接、查找替换等）
│   ├── AIBar.tsx                # AI 指令输入条（模型选择、意图选择、Token 设置）
│   ├── AIDock.tsx               # AI 侧栏（建议、改写、文风分析）
│   ├── SettingsPanel.tsx        # 设置面板（外观、编辑器、模型、Skills、模板、快捷键）
│   ├── ThemePicker.tsx          # 主题风格快速选择器
│   ├── StatusBar.tsx            # 状态栏（字数统计、模型信息、就绪状态）
│   ├── StartupSplash.tsx        # 空白状态引导页
│   ├── ContextMenu.tsx          # 右键上下文菜单
│   ├── PopoverMenu.tsx          # 浮动弹出菜单
│   ├── IntentMenu.tsx           # AI 意图选择菜单（技能切换）
│   └── InlineConfirmButton.tsx  # 内联确认按钮（二次确认）
└── lib/
    ├── types.ts                 # 共享类型定义
    ├── tauri.ts                 # Tauri IPC 桥接层
    ├── theme.ts                 # 主题管理（6 种风格 × 3 种模式）
    ├── textSize.ts              # 字号管理（small/default/large/xlarge）
    ├── fontFamily.ts            # 字体管理（6 种预设 + 自定义）
    ├── collections.ts           # 合集/文章 CRUD（含回收站）
    ├── articles.ts              # 文章内容持久化（Tauri + localStorage）
    ├── ai.ts                    # AI 聊天 API 调用
    ├── providerModels.ts        # AI 提供商配置管理
    ├── skill.ts                 # Skill 系统（写作技能列表、安装、执行）
    └── editorStyles.ts          # 编辑器样式模板（Markdown 渲染 CSS）
```

### 4.2 核心组件职责

#### App.tsx (布局根组件)
- 管理三栏布局状态（sidebar / editor / ai-dock）
- 实现面板拖拽 resize（200-320px 侧栏, 320-660px AI 面板）
- 注册全局键盘快捷键（`Cmd+K` 聚焦输入, `Cmd+\` 切换侧栏, `Cmd+Shift+\` 切换 AI 面板）
- 协调主题、字号、字体的全局应用

#### EditorContent.tsx (编辑器核心里)
- 基于 TipTap 3 的 `useEditor` 构建
- 插件：StarterKit、Underline、Placeholder、Markdown、Link、TaskList、Highlight、TextAlign
- 支持富文本 ↔ Markdown 源码模式切换（`EditorMode`）
- AI 响应内联建议（底部卡片式 + 插入/忽略操作）
- 大纲解析（从 Markdown 标题自动提取）
- 样式模板注入（将选中的 CSS 模板 scope 到 `.tiptap`）

#### AIBar.tsx (AI 指令条)
- 底部固定输入栏，支持多行输入（auto-resize）
- 意图选择：通用/续写/改写/润色/翻译/学术/创意/摘要
- 模型选择：从已配置的提供商中动态获取模型列表
- 参数控制：Max Tokens、Effort（思考努力度）
- 快捷键 `Ctrl+Enter` 发送

#### CollectionTree.tsx (文档管理)
- 树形结构展示合集 → 文章的层级关系
- 支持右键菜单重命名、删除、新建
- 回收站功能：移入、恢复、永久删除、清空
- 文章统计缓存（字数、段落数）
- 排序：按名称/日期/文章数

### 4.3 键盘快捷键

| 快捷键 | 操作 |
|---|---|
| `Cmd+K` | 聚焦 AI 输入栏 |
| `Cmd+\` | 切换侧栏 |
| `Cmd+Shift+\` | 切换 AI 面板 |
| `Cmd+,` | 打开设置 |
| `Escape` | 关闭弹窗/设置 |
| `Ctrl+Enter` | 发送 AI 指令 |

---

## 5. 后端子架构

### 5.1 目录结构

```
src-tauri/
├── Cargo.toml                # Rust 依赖配置
├── tauri.conf.json           # Tauri 应用配置
├── build.rs                  # Tauri 构建脚本
├── capabilities/default.json # Tauri 权限配置
├── src/
│   ├── main.rs               # 入口
│   ├── lib.rs                # Tauri 命令注册、AppState 管理
│   ├── store.rs              # 数据持久化（文件系统 JSON）
│   ├── ai.rs                 # AI 聊天（OpenAI/Anthropic API）
│   ├── skill.rs              # Skill 发现、解析、安装
│   └── agent.rs              # Agent 执行引擎
└── icons/                    # 应用图标
```

### 5.2 Rust 后端模块

#### lib.rs (命令注册)
管理全局 `AppState`（包含 `Mutex<DataStore>`），注册所有 Tauri 命令：

- **合集管理**: `get_collections`, `set_collections`
- **回收站管理**: `get_trash`, `set_trash`
- **AI 提供商**: `get_providers`, `set_providers`, `fetch_models`, `get_all_models`
- **设置管理**: `get_settings`, `set_settings`
- **文章操作**: `save_article`, `load_article`, `delete_article`, `save_article_meta`, `load_article_meta`
- **Skill 系统**: `list_skills`, `read_skill`, `run_skill`, `install_skill`, `generate_skill`, `delete_skill`, `set_skill_enabled`, `list_disabled_skills`
- **AI 聊天**: `chat`（根据 provider kind 路由到 OpenAI/Anthropic API）

#### store.rs (数据层)
纯文件系统存储，无外部数据库依赖：

```
app_data_dir/
├── data/
│   ├── collections.json   # 合集 + 文章元数据
│   ├── providers.json     # AI 提供商配置
│   ├── settings.json      # 应用设置
│   ├── trash.json         # 回收站
│   ├── articles/          # 文章内容 (.md 文件)
│   │   ├── {id}.md        # Markdown 内容
│   │   └── {id}.meta.json # 文章元数据
│   ├── index/             # 预留：全文索引
│   └── codegraph/         # 预留：代码图分析
└── skills/                # 用户安装的 Skill
    └── {name}/SKILL.md
```

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
- 调用 AI API 执行写作任务
- 返回结构化 `AgentResult`（content + steps）

---

## 6. 数据模型

### 6.1 合集 (Collection)

```
Collection {
  id: string          # 唯一标识
  title: string       # 名称
  createdAt: number   # 创建时间戳
  articles: Article[] # 文章列表（内联存储）
}
```

### 6.2 文章 (Article)

```
Article {
  id: string          # 唯一标识
  title: string       # 标题
  createdAt: number   # 创建时间戳
  updatedAt: number   # 最后修改时间戳
}
```

- **内容存储**: `articles/{id}.md`（独立 Markdown 文件，便于版本控制和未来全文索引）
- **元数据**: `articles/{id}.meta.json`（独立文件，便于快速扫描）

### 6.3 AI 提供商 (Provider)

```
Provider {
  id: string           # 唯一标识
  label: string        # 显示名称
  kind: ProviderKind   # openai | anthropic | deepseek | custom
  baseUrl?: string     # API 基础 URL
  apiKey?: string      # API 密钥
  models: string[]     # 可用模型列表
  enabled: boolean     # 是否启用
  builtin: boolean     # 是否内置提供商
}
```

### 6.4 Skill 定义

```
Skill {
  name: string           # 技能名称
  description: string    # 描述
  body: string           # 技能定义正文（Markdown）
  scope: SkillScope      # Builtin | Global | Custom | Project
  path: string           # 文件路径
  run_as: RunAs          # Inline | Subagent
  allowed_tools: string[] # 允许的工具列表
  model?: string         # 指定模型
  effort?: string        # 思考努力度
  enabled: boolean       # 是否启用
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
  └─ OpenAI:    gpt-4o, gpt-4o-mini, gpt-4-turbo
  └─ Anthropic: claude-3.5-sonnet, claude-3-haiku
  └─ DeepSeek:  deepseek-chat, deepseek-coder
  └─ 自定义:    任意 OpenAI 兼容 API
```

### 8.2 两种 AI 交互模式

| 模式 | 路径 | 触发方式 |
|---|---|---|
| AI Dock（侧栏） | AIDock.tsx → 静态规则分析 | 自动 |
| AI Bar（底部指令条） | AIBar.tsx → lib/ai.ts → Rust ai.rs → HTTP | 用户输入 |
| Skill Agent | EditorPane → lib/skill.ts → Rust skill.rs + agent.rs | 意图选择 |

### 8.3 Skill 执行流程

```
用户选择意图（如"润色"）
  → AIBar 识别意图名称
  → 调用 runSkill(name, userInput, documentContent, selectedText)
  → Rust skill.rs 查找 Skill 定义
  → agent.rs 构建结构化 Prompt（Skill body + 文档上下文）
  → ai.rs 调用 AI API
  → 返回 AgentResult { content, steps }
  → 前端展示内联建议
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

---

## 10. 未来规划

- [ ] **全文搜索**: 基于文章内容的实时搜索（Fuse.js 或 Rust 端的 Tantivy）
- [ ] **流式 AI 响应**: SSE/流式 API 支持，实时输出 AI 生成内容
- [ ] **协作编辑**: 基于 CRDT 的多人协作
- [ ] **模板市场**: 编辑器样式模板的社区分享
- [ ] **本地知识库**: RAG 增强，基于个人文档的 AI 问答
- [ ] **导出增强**: PDF、DOCX、HTML 格式导出
- [ ] **图片处理**: 拖拽上传、粘贴图片、本地存储
- [ ] **移动端适配**: PWA 或 React Native

---

> 本设计文档反映了项目当前状态（v0.1.0），会随项目演进持续更新。
