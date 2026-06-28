# InkWise 墨智 — 文档目录

> 按功能模块分类组织，便于快速定位

---

## 📐 架构总览 (`docs/architecture/`)

| 文档 | 说明 |
|------|------|
| [overview.md](architecture/overview.md) | 系统架构总览、技术栈、数据模型、设计决策 |
| [tauri-bridge.md](architecture/tauri-bridge.md) | Tauri ↔ 浏览器双模式 IPC 桥接 |
| [state-management.md](architecture/state-management.md) | Zustand 状态管理（app/editor/theme store） |
| [event-system.md](architecture/event-system.md) | 事件总线（emit/on/off 解耦通信） |

## 🎨 前端 (`docs/frontend/`)

| 文档 | 说明 |
|------|------|
| [AI写作助手-UI设计方案.md](frontend/AI写作助手-UI设计方案.md) | UI 设计哲学、色彩体系、组件体系、交互细节 |
| [editor-engine.md](frontend/editor-engine.md) | TipTap 编辑内核、扩展、Markdown 双模 |
| [theme-system.md](frontend/theme-system.md) | CSS 变量体系、6 种主题风格、3 种模式 |
| [shortcuts.md](frontend/shortcuts.md) | 全局快捷键与编辑器快捷键一览 |
| [agent-panel.md](frontend/agent-panel.md) | AI Agent 面板（AIBar、AgentPanel、HistoryPanel） |
| [series-planning.md](frontend/series-planning.md) | 专栏系列规划（SeriesPlanner、PlanReview） |
| [export-system.md](frontend/export-system.md) | 导出系统（HTML / 微信排版） |
| [settings-system.md](frontend/settings-system.md) | 设置系统（外观/编辑器/AI 模型/主题/快捷键） |

## 🤖 AI 与技能 (`docs/ai/`)

| 文档 | 说明 |
|------|------|
| [WRITING-SKILL-DESIGN.md](ai/WRITING-SKILL-DESIGN.md) | 写作技能系统设计（8 种内置技能） |
| [SKILL-ARCH-REVIEW.md](ai/SKILL-ARCH-REVIEW.md) | 技能架构评估与重构方案 |
| [ai-integration.md](ai/ai-integration.md) | AI 多提供商集成、Prompt 管线、流式响应 |
| [agent-engine.md](ai/agent-engine.md) | Agent 编排引擎（session/蓝图/审阅） |

## 📤 发布系统 (`docs/publishing/`)

| 文档 | 说明 |
|------|------|
| [article-final-page-design.md](publishing/article-final-page-design.md) | 成品页面与第三方发布设计 |
| [publish-flow.md](publishing/publish-flow.md) | Rust publisher 模块实现详解 |

## 💾 存储 (`docs/storage/`)

| 文档 | 说明 |
|------|------|
| [storage-architecture.md](storage/storage-architecture.md) | StorageEngine、SQLite FTS5、localStorage 双模式 |
| [article-context.md](storage/article-context.md) | ArticleContext 文章级独立上下文管理 |

## 🦀 后端 (`docs/backend/`)

| 文档 | 说明 |
|------|------|
| [DESIGN-PROJECT-WRITING.md](backend/DESIGN-PROJECT-WRITING.md) | 项目系列写作与代码扫描设计 |
| [backend-modules.md](backend/backend-modules.md) | Rust 后端模块总览（store/db/ai/skill/agent/publisher/indexer） |
| [project-indexer.md](backend/project-indexer.md) | tree-sitter AST 提取 + 文件监听增量扫描 |

## 🧪 测试 (`docs/test/`)

| 文档 | 说明 |
|------|------|
| [test-report.md](test/test-report.md) | 全功能自动化测试报告 |

---

> 主设计文档: [architecture/overview.md](architecture/overview.md)
> 最后更新: 2026-06-28
