# InkWise 项目笔记

## 项目概览
- **名称**: InkWise 墨智 — AI 写作助手
- **版本**: v3.0（已合并到 main）
- **技术栈**: React 19 + TypeScript 6 + Vite 6 + Tauri 2 + Rust (edition 2021)
- **编辑器**: TipTap 3 (ProseMirror) — 富文本 & Markdown 双模
- **状态管理**: Zustand (articleStore/themeStore/panelStore)
- **存储**: Rust DataStore (JSON) + SQLite (FTS5) + localStorage (浏览器降级) — 统一通过桥接层访问

## 开发命令
- `npm run dev` — 浏览器模式
- `npm run tauri:dev` — Tauri 桌面模式
- `npm run build` — 生产构建
- `npm run typecheck` — 类型检查
- `npx playwright test` — E2E 测试

## 开发工作流规则 (v2.0.0)
1. 每完成一个功能点，先更新 `docs/plan/TRACKING.md`（状态🟢 + 完成日期 + 统计）
2. 更新后立即 Git 提交，格式：`feat: [功能编号] 功能描述`
3. 只有提交后才能开始下一个功能点
4. 严格按 Sprint 顺序执行，不可跳 Sprint
5. Sprint 完成后更新 INDEX.md 并打 tag（alpha → beta → rc → v2.0.0）

## 关键约定
- 双环境兼容：`invokeOrFallback()` 模式，所有 Tauri IPC 通过 `src/lib/bridge/tauri.ts`
- CSS：单文件 `styles.css`，BEM 命名，CSS 变量驱动主题
- 主题：6 种风格 × 3 种模式 × 4 种字号 × 6 种字体
- AI 提供商：OpenAI/Anthropic/DeepSeek + 自定义兼容 API
- 事件总线：mitt 驱动，事件定义在 `src/lib/events/events.ts`
- Git：新提交不 amend，不强制推送，不跳 hook

## 核心模块
- 前端组件按领域分组：agent/collections/common/editor/series/settings/sidebar
- Rust 后端模块：store/db/ai/skill/agent/project_indexer/vector/platform
- Tauri 命令：~80 个，覆盖合集/AI/文章/技能/数据库/项目索引/发布/图片/向量搜索

## 迁移状态（v3.0 渐进式迁移）
### 已完成
- **Phase 1**（hooks 补全）：useDocument/usePlan/useCollection + TauriDocumentStore/TauriAIProvider
- **Phase 2**（Sidebar 迁移）：Sidebar/CollectionTree/SearchPanel → useCollection
- **Phase 3**（EditorPane 迁移）：EditorPane/ArticleFinalPage → useDocument + useCollection
- **Phase 4**（文章管理器迁移）：ArticleManager → useCollection + useDocument；ArticleFinalPage 补充迁移
- **Phase 5**（Rust 后端统一存储）：AppStorage 包装 DataStore + Database，store./db. 引用清零
- **Batch 1 增量迁移**：TrashDialog/ProjectPanel/GeneralSection/ProjectExplorer/DocPicker/useCollectionCrud → useCollection
- **Batch 2-5 增量迁移**：appHooks/useArticleLifecycle/MainEditorPage/SeriesOverview/SeriesPlanner/EditorPane/ReviewPanel/ArticleFinalPage 等 20+ 文件迁移 + domain 类型补全（Publish.ts/Provider.ts）
- **Batch 6（里程碑）**：storage/articles + storage/articleDocument 非桥接消费者清零；blueprint 类型引用全面清零
- **Batch 7（基础设施）**：创建 SettingsStore 接口 + TauriSettingsStore + useSettings；迁移 7 个 settings/publish 消费者
- **Phase 6（全量迁移完成）**：蓝图存储函数桥接 + ArticleFinalPage fallback 重构 — 零非桥接消费者 🏆
- **Rust 死代码清理**：删除 8 处迁移残留死代码，修复 3 处过期 API，warnings 29→13
- **Branch merge**：`codex/v3.0-s6` → `main`；v3.0 tag 移至 main HEAD

### 旧存储引用剩余
- `storage/collections` → 仅 TauriDocumentStore 桥接 ✅
- `storage/articles.ts` → 仅 TauriDocumentStore 桥接 ✅
- `storage/articleDocument` → 仅 TauriDocumentStore 桥接 ✅
- `lib/ai/article/blueprint` → 仅 TauriDocumentStore 桥接 ✅（类型+工具函数已 domain）
- `storage/providerModels` → 仅 TauriSettingsStore + TauriDocumentStore 桥接 ✅
- `storage/platforms` → 仅 TauriSettingsStore 桥接 ✅

### 新架构层次
1. **domain/** — 纯数据类型（Document/Collection/Plan/Project/enums/Publish/Provider）
2. **infrastructure/** — 接口定义（DocumentStore/AIProvider/SettingsStore/EventBus）+ Tauri 桥接实现
3. **services/** — 业务编排（DocumentService/CollectionService/PlanService/SettingsService）
4. **hooks/** — React 胶水层（useDocument/useCollection/usePlan/useSettings）

### 迁移策略
- 触碰原则（Touch Rule）：改到哪个文件就顺手切到新架构
- 解构别名：`useDocument().loadDocument` → `loadArticleDocument`
- 全局 eventBus 共享确保事件互通
- 旧代码不删直到零引用
