# InkWise 项目笔记

## 项目概览
- **名称**: InkWise 墨智 — AI 写作助手
- **版本**: v2.0.0（已发布）
- **技术栈**: React 19 + TypeScript 6 + Vite 6 + Tauri 2 + Rust (edition 2021)
- **编辑器**: TipTap 3 (ProseMirror) — 富文本 & Markdown 双模
- **状态管理**: Zustand (articleStore/themeStore/panelStore)
- **存储**: Rust DataStore (JSON) + SQLite (FTS5) + localStorage (浏览器降级)

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
