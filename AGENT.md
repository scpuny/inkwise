# InkWise 墨智 — Agent 指南

> 本文件为 AI 编码助手（如 Codex）提供项目上下文和开发指南。

---

## 项目概况

InkWise 墨智（Inkwise）是一个桌面端中文写作应用，基于 React 19 + TypeScript + Tauri 2 构建，使用 TipTap 3 富文本编辑器内核，支持接入多种 AI 提供商辅助写作。内置 SQLite 全文检索、多平台发布（微信/头条）、项目上下文索引与专栏规划功能。

---

## 开发命令

```bash
npm run dev              # Vite 开发服务器（浏览器模式）
npm run build            # Vite 生产构建
npm run typecheck        # TypeScript 类型检查
npm run tauri:dev        # Tauri 桌面开发模式
npm run tauri:build      # Tauri 生产构建
```

---

## 关键约定

### 双环境兼容

- 所有数据操作必须通过 `invokeOrFallback()` 模式兼容浏览器和 Tauri 两种环境
- `lib/tauri.ts` 提供了 `isTauriEnv()`、`tryInvoke()`、`invokeOrFallback()` 三个核心函数
- 浏览器模式下 AI 功能不可用，需返回清晰的提示信息

### 样式规范

- 单文件 CSS（`src/styles.css`），不使用 CSS-in-JS 或 CSS 模块
- BEM 命名：`.block__element--modifier`
- CSS 变量驱动主题：所有颜色/尺寸通过变量引用
- 新增组件时直接在 `styles.css` 底部追加，按 BEM 规则命名

### 主题系统

- 6 种风格（graphite/aurora/slate/carbon/nocturne/amber） × 3 种模式（auto/dark/light）
- 添加新风格时需同步更新：`THEME_STYLES`（`theme.ts`）、`styleLabels` / `styleColors`（`ThemePicker.tsx`）、CSS 变量（`styles.css`）
- 字号预设：small/default/large/xlarge，通过 `data-text-size` 属性控制
- 字体预设：system/yahei/pingfang/noto/serif/custom，通过 `data-font-family` 属性控制

### 数据持久化

- **Tauri 模式（旧路径）**: Rust `DataStore` 将数据写入 `app_data_dir/data/*.json`，文章内容存为 `articles/{id}.md`
- **Tauri 模式（新路径）**: Rust `Database`（`db.rs`）使用 SQLite 持久化，位于 `~/.inkwise/data/inkwise.db`，含 FTS5 全文索引
- **浏览器模式**: 所有数据通过 `localStorage` 存储，Key 前缀 `inkwise-`
- 新增数据模型时需同时实现 Rust 端（`store.rs` 或 `db.rs`）和前端（对应 `lib/` 文件）的读写逻辑
- SQLite 迁移：`db.rs` 内置 schema 版本管理，新增表/字段需更新 `SCHEMA_VERSION` 并编写迁移 SQL

### AI 提供商

- 内置开源箱：OpenAI、Anthropic、DeepSeek
- 自定义提供商需遵循 OpenAI 兼容 API 格式
- 新增提供商类型时需更新：`ProviderKind` 类型、`BUILTIN_PROVIDERS` 列表、`defaultModels()` 函数（前端）、以及 Rust 端 `ai.rs` 的路由逻辑
- API Key 仅存储在本地配置文件中，不发送到第三方

### Skill 系统

- Skill 是 Markdown 文件，头部包含 `---` frontmatter 元数据
- 内置 Skill 定义在 Rust `skill.rs` 的 `builtin_skills()` 函数中
- 新增内置 Skill 需同时更新 Rust `builtin_skills()` 和前端 `getFallbackSkills()`
- Skill 可通过 UI 安装（写入 `{data_dir}/skills/{name}/SKILL.md`）
- 支持快捷键绑定：Alt+1~5 快速执行润色/改写/翻译/扩写/分析
- 支持上下文注入源（ContextSource），可注入项目上下文、文章信息、风格维度等

### 多平台发布

- 微信发布流程：PlatformConfig 配置 → 获取 access_token → 上传封面图 → 创建草稿 → 发布
- 发布记录通过 `PublishRecord` 持久化，可追踪每篇文章在不同平台的发布状态
- 新增平台需在 `publisher.rs` 中实现对应的 API 调用逻辑

### 项目上下文索引

- `project_indexer.rs` 扫描本地项目目录，生成结构化的项目上下文
- 支持输出目录树、语言统计、配置文件、符号定义和导入关系
- 上下文可注入 Agent System Prompt，帮助 AI 理解项目背景
- 检测 Codegraph 可用性，优先使用图谱查询

---

## 代码规范

### TypeScript

- 严格模式启用（`strict: true`）
- 使用 `useCallback` / `useEffect` / `useRef` 等 React Hooks
- 类型定义放在 `lib/types.ts` 或模块头部，避免内联 `any`
- 文件名小写字母 + 连字符（kebab-case）

### Rust

- 所有 Tauri 命令函数使用 `#[tauri::command]` 属性宏
- `DataStore`（store.rs）和 `Database`（db.rs）是持久化入口，均通过 `Mutex` 在 `AppState` 中共享
- 新命令需在 `lib.rs` 的 `generate_handler![]` 宏中注册
- 错误处理统一返回 `Result<T, String>` 类型

### CSS

- 禁止在组件中使用内联样式（`style={{}}` 仅用于动态 CSS 变量）
- 颜色值必须引用 CSS 变量（`var(--fg)`），禁止硬编码色值
- 字号使用 `var(--text-*)` 变量族
- 尊重 `prefers-reduced-motion`

---

## 项目结构

```
Inkwise/
+-- index.html                # 入口 HTML
+-- vite.config.ts            # Vite 配置
+-- tsconfig.json             # TypeScript 配置
+-- package.json              # 前端依赖
+-- deploy.yaml               # 部署配置
+-- src/
|   +-- main.tsx              # React 入口
|   +-- App.tsx               # 根布局
|   +-- styles.css            # 全局样式（单文件 ~6000 行）
|   +-- components/           # React 组件（40+ 组件）
|   |   +-- Sidebar.tsx, CollectionTree.tsx, OutlinePanel.tsx
|   |   +-- EditorPane.tsx, EditorContent.tsx, Toolbar.tsx
|   |   +-- AIBar.tsx, AIDock.tsx, AICommandBar.tsx
|   |   +-- SettingsPanel.tsx, ThemePicker.tsx, StatusBar.tsx
|   |   +-- ArticleHeader.tsx, ArticleInfoPanel.tsx, ArticlePreview.tsx
|   |   +-- SeriesPlanner.tsx, SeriesOverview.tsx
|   |   +-- BlueprintEditor.tsx, BlueprintProgress.tsx, PlanReview.tsx
|   |   +-- PublishDialog.tsx, PublishStatusPanel.tsx
|   |   +-- SearchPanel.tsx, CommandPalette.tsx
|   |   +-- AgentPanel.tsx, AgentProvider.tsx
|   |   +-- StartupSplash.tsx, ContextMenu.tsx, PopoverMenu.tsx
|   |   +-- IntentMenu.tsx, InlineConfirmButton.tsx
|   |   +-- InlineToolbar.tsx, InlineGhostText.tsx, StylePanel.tsx
|   |   +-- ArticleManager.tsx, ArticleFinalPage.tsx
|   |   +-- CollectionFormModal.tsx, DocPicker.tsx
|   |   +-- ProjectFileTree.tsx, FinalSidePanel.tsx, FinalTopBar.tsx
|   |   +-- ConfirmDialog.tsx, CustomSelect.tsx
|   |   +-- ErrorBoundary.tsx, VersionHistoryModal.tsx
|   +-- lib/                 # 工具库
|       +-- types.ts, tauri.ts, theme.ts
|       +-- textSize.ts, fontFamily.ts
|       +-- collections.ts, articles.ts
|       +-- ai.ts, providerModels.ts
|       +-- skill.ts, editorStyles.ts
+-- src-tauri/
|   +-- Cargo.toml           # Rust 依赖
|   +-- tauri.conf.json      # Tauri 配置
|   +-- src/
|   |   +-- main.rs          # Rust 入口
|   |   +-- lib.rs           # 命令注册、AppState
|   |   +-- store.rs         # JSON 文件持久化（旧路径）
|   |   +-- db.rs            # SQLite 持久层 + FTS5 全文检索（新路径）
|   |   +-- ai.rs            # AI API 调用
|   |   +-- skill.rs         # Skill 管理
|   |   +-- agent.rs         # Agent 执行
|   |   +-- publisher.rs     # 多平台发布（微信/头条）
|   |   +-- project_indexer.rs # 项目上下文索引
|   +-- icons/               # 应用图标
+-- docs/
|   +-- SKILL-ARCH-REVIEW.md
|   +-- WRITING-SKILL-DESIGN.md
|   +-- article-final-page-design.md
+-- DESIGN.md                # 设计文档
+-- AGENT.md                 # Agent 指南（本文）
+-- LICENSE                  # MIT 开源协议
+-- dist/                    # 构建输出
```

---

## 常见开发场景

### 添加新组件

1. 在 `src/components/` 下创建文件
2. 类型定义优先放在组件文件顶部或 `lib/types.ts`
3. 样式追加到 `src/styles.css` 底部
4. 如果组件需要全局状态，在 `App.tsx` 中管理并通过 props 下传
5. 确保 Tauri 相关操作使用 `invokeOrFallback` 包裹

### 添加新的 AI 提供商

1. 前端 `providerModels.ts` 的 `ProviderKind` 类型 + `BUILTIN_PROVIDERS` 列表
2. 前端 `providerModels.ts` 的 `defaultModels()` 函数
3. Rust `ai.rs` 的 `chat_completion()` 路由逻辑
4. Rust `store.rs` 或 `db.rs` 的 Provider 相关读写（如需新增字段）

### 添加内置 Skill

1. Rust `skill.rs` 的 `builtin_skills()` 函数
2. 前端 `skill.ts` 的 `getFallbackSkills()` 函数
3. 前端 `AIBar.tsx` 的 `skillDisplayLabel()` 函数（如需要中文显示名）
4. 如需快捷键绑定，更新 `AIBar.tsx` 的快捷键处理逻辑

### 修改写作技能 Prompt

内置写作技能的 prompt 定义在 `src/lib/ai/writingSkill/builtins.ts`，默认 prompt 在 `defaults.ts`：

1. 每个技能包含 title/description/outline/tags/writing 阶段的独立 systemPrompt
2. 修改后需确保：
   - 每个阶段 prompt 包含「核心规则」或「开篇要求」章节
   - writing prompt 包含「结构与节奏」「语言」「格式」等章节
   - 保持 Markdown 语法规范约束
3. 新增技能需同时加入 `getBuiltinSkills()` 和 `getAllSkills()`

### 添加事件总线事件

事件定义在 `src/lib/events/events.ts`，通过 `eventBus.ts` 的 `emit/on/off` API 操作：

1. 在 `events.ts` 的类型定义中添加新事件名和 payload 类型
2. 在触发点调用 `emit(eventName, payload)`
3. 在订阅点调用 `on(eventName, handler)` 并保存返回的取消函数
4. 组件卸载时调用取消函数清理

### 操作 SQLite 数据库（db.rs）

1. 在 `Database` 结构体上新增查询/写入方法
2. 如需新增表或字段，更新 `SCHEMA_VERSION` 并在 `migrate()` 中添加迁移 SQL
3. 在 `lib.rs` 中注册新命令，通过 `AppState.db` 访问
4. 前端通过 `invoke("command_name", { args })` 调用

### 新增发布平台（publisher.rs）

1. 在 `PlatformConfig` 中确认平台标识
2. 在 `publish()` 函数中新增平台分支（match platform）
3. 实现平台 API 调用逻辑（获取 token → 上传素材 → 创建文章 → 发布）
4. 返回统一的 `PublishResult` 格式

### 扩展项目索引（project_indexer.rs）

1. 在 `ProjectContext` 中新增字段支持更多元数据
2. 在 `scan_project()` 中新增文件扫描逻辑
3. 在 `build_context_text()` 中格式化输出供 Agent 使用

---

## 参考资源

- [Tauri 2 文档](https://v2.tauri.app)
- [TipTap 3 文档](https://tiptap.dev)
- [rusqlite 文档](https://docs.rs/rusqlite)
- [Reasonix](https://github.com/yetone/reasonix) — UI 风格参考
- CSS 变量体系详见 `src/styles.css` 顶部
- 完整数据模型详见 `src-tauri/src/store.rs`、`src-tauri/src/db.rs` 和 `src/lib/types.ts`
