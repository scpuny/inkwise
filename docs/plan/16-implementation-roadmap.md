# 16 — 实施路线图

> 关联: 全部 plan/ 文档 | 版本: v2.0.0 → v2.1.0 | 状态: S1-S5 ✅ → v2.1.0-alpha 🏷️

---

## 一、总览

InkWise v1.x → v2.0.0 是一次**基础架构重塑 + 业务模型修复 + UX 升级**。不会一次性完成，而是分 4 个阶段、每个阶段可独立部署上线。

```
里程碑             交付物                      预估时间
──────────────────────────────────────────────────────────
Sprint 1: 核心修复   数据一致性 + 删除级联 + 风格分离    2-3 周
Sprint 2: 架构重塑   agent 统一 + 模块拆分 + UX 改造    3-4 周
Sprint 3: 智能增强   Query AST + 向量 + 增量扫描         3-4 周
Sprint 4: 体验优化   Context Planner + 新技能 + 主题     2-3 周
──────────────────────────────────────────────────────────
持续:              Kiro 代码扫描输出评估 + 兼容性测试
```

---

## 二、Sprint 1：核心业务修复（P0）

**目标**：修复最影响数据正确性和业务逻辑的缺陷，可在 v1.x 基础上热修复。

### 1.1 数据一致性（doc 01）

| 任务 | 文件 | 预估 |
|------|------|------|
| 统一 `loadCollections` 入口，移除直接 `browserLoad` 调用 | `crud.ts`, `CollectionTree.tsx`, `ArticleManager.tsx`, `useCollectionCrud.ts` | 0.5d |
| 改造 `saveCollections` 原子写入：Rust JSON 先写，localStorage 缓存后跟 | `crud.ts` | 0.5d |
| SQLite 瘦身：建 `articles_search` 表，只存 FTS 所需最小字段 | `db.rs` | 1d |
| 浏览器模式降级：无 Tauri 时 localStorage 为唯一存储 | `crud.ts` | 0.5d |

### 1.2 删除级联（doc 02）

| 任务 | 文件 | 预估 |
|------|------|------|
| `trashArticle` 补充 delete_article_db + 清理 SQLite FTS | `crud.ts`, `lib.rs` | 0.5d |
| `removeCollection` 级联删除子文章所有数据 | `crud.ts`, `lib.rs` | 1d |
| `deleteSeriesPlan` 补充清理 | `series.ts`, `lib.rs` | 0.5d |
| `unlinkCollectionFolder` 清理 project_chunks | `lib.rs` | 0.5d |
| 新增 `delete_collection_cascade` Tauri 命令 | `lib.rs` | 0.5d |

### 1.3 风格/动作分离（doc 13 — 最关键）

| 任务 | 文件 | 预估 |
|------|------|------|
| 定义 `WritingStyle` 和 `WritingAction` 类型 | `types.ts` 新文件 | 1d |
| `ArticleBlueprint.skillId` 改为 `styleId: string`（强必填） | `articleBlueprint.ts` | 0.5d |
| 迁移现有 WritingSkill → Style（名称不变、结构重构） | `builtins.ts` | 1d |
| 迁移 Rust builtin_skills 中的动作 → Action 枚举 | `skill.rs` | 1d |
| 改造 agent 执行：Action + 当前 Style 上下文拼接 | `agent.ts`, `agent.rs` | 2d |
| 改造审阅：动态维度 + 风格感知 | `articleReview.ts` | 1.5d |
| 改造 applyOptimization：逐段修复而非全量重写 | `articleReview.ts` | 1d |

### 1.4 知识验证 — Kiro AST 代码扫描

| 任务 | 说明 |
|------|------|
| 确认三层 Query 结构 | Kiro 已用 code-snippet + import + root-context 三层 .scm |
| 确认 .scm 语法 | Kiro 的 .scm 与我们设计文档一致（`@name`、`@definition`、`@parameters`） |
| 确认 WASM 运行时 | Kiro 用 `@vscode/tree-sitter-wasm`，支持 27 种语言 |
| 向量模型 | Kiro 未内置向量模型，InkWise 自主方案（doc 05）是正确的 |

---

## 三、Sprint 2：架构重塑 + UX 改造（P0-P1）

**目标**：重写模块结构，修复 UX 问题，提升可维护性。

### 2.1 技能系统统一（doc 09）

| 任务 | 文件 | 预估 |
|------|------|------|
| 定义 `UnifiedSkill` + 枚举类型 | `skill.rs`, `types.ts` | 1d |
| 合并 `builtin_skills()` 和 `getBuiltinSkills()` | `skill.rs` | 2d |
| 前端改为从 IPC 获取技能列表 | `storage.ts`, `builtins.ts` | 1d |
| 用枚举替换 `allowed_tools` 字符串 | `skill.rs` | 0.5d |
| `agent.rs` 支持 tool calling + ContextPlan | `agent.rs` | 2d |
| 废弃前端独立 `writingSkill/` 中的冗余代码 | 清理 | 0.5d |

### 2.2 模块重构（doc 11）

| 任务 | 说明 | 预估 |
|------|------|------|
| `skill.rs` → `skill/` 模块拆分 | 类型 + builtins + store + frontmatter | 1d |
| `agent.rs` → `agent/` 模块拆分 | engine + prompt | 1d |
| `project_indexer.rs` → `project_indexer/` 拆分 | scanner + snapshot + watcher + codegraph | 1d |
| `editorStyles.ts` 拆分（1585 行 → 3 文件） | 编辑器配置 / 样式 / 导入导出 | 1d |
| `writingSkill/` → 统一到 `skill/` | 删除独立技能系统 | 0.5d |
| `storage/` 领域分包 | collection / article / provider 分开 | 0.5d |
| 注释规范统一（文件头/模块线/复杂函数） | 全库 | 1d |

### 2.3 UX 改造（doc 14）

| 任务 | 文件 | 预估 |
|------|------|------|
| 右侧面板合并为浮动层 | `MainEditorPage.tsx`, `AgentPanel.tsx`, `StylePanel.tsx` | 3d |
| 新建文档默认不弹合集选择器 | `MainEditorPage.tsx` | 0.5d |
| 保存状态移到编辑器右上角 | `EditorPane.tsx` | 0.5d |
| 标题双击编辑 | `ArticleHeader.tsx` | 0.5d |
| AIBar 默认折叠 36px | `AIBar.tsx` | 0.5d |
| Sidebar 增加 tab 切换（目录/大纲/项目） | `Sidebar.tsx` | 1d |
| 阶段切换引导对话框 | `ArticleHeader.tsx` | 0.5d |
| Toolbar hover 快捷键提示 | `Toolbar.tsx` | 0.5d |
| 审阅自动切 tab | `AgentPanel.tsx` | 0.5d |
| StartupSplash 引导 | `StartupSplash.tsx` | 0.5d |
| 状态栏精简（默认字数+保存+模型） | `StatusBar.tsx` | 0.5d |
| InlineToolbar 增加 AI 快捷动作 | `InlineToolbar.tsx` | 0.5d |
| 大纲滚动联动增强 | `EditorContent.tsx` | 1d |
| 焦点模式退出按钮优化 | `FocusMode.tsx` | 0.5d |
| ReviewPanel 逐段修复交互 | `ReviewPanel.tsx` | 1d |
| 布局样式（浮动层/面板切换） | `styles.css` | 2d |

---

## 四、Sprint 3：智能能力增强（P1）

**目标**：引入向量语义检索、Query AST、离线增量扫描。

### 3.1 Query AST（doc 04）

| 任务 | 文件 | 预估 |
|------|------|------|
| 创建 `src-tauri/tree-sitter-queries/` 目录 + 语言子目录 | 新目录 | 0.5d |
| 写入 code-snippet 层：typescript.scm, rust.scm | `.scm` 文件 | 0.5d |
| 写入 import 层：typescript.scm, rust.scm | `.scm` 文件 | 0.5d |
| 写入 root-context 层 | `.scm` 文件 | 0.5d |
| 实现 `query_symbols()` 通用执行函数 | `project_indexer/` | 1.5d |
| 替换 `extract_symbols_treesitter()` 调用 | `project_indexer/` | 1d |
| 替换 `extract_imports_treesitter()` 调用 | `project_indexer/` | 0.5d |
| 添加 python.scm, go.scm 等扩展 | `.scm` 文件 | 1d |

### 3.2 本地向量嵌入（doc 05）

| 任务 | 文件 | 预估 |
|------|------|------|
| 下载 bge-small-zh-v1.5 ONNX 到 `models/` | 外部 | 0.5d（下载时间） |
| 建 `vector_chunks` 表 | `db.rs` | 0.5d |
| 实现 `embed_text()` Transformers.js 调用 | 新文件 `vector.rs` | 2d |
| 实现 `chunk_content()` 分块 | `vector.rs` | 1d |
| 实现增量索引（文件变更/文章变更） | `vector.rs` | 1.5d |
| 实现 `vector_search()` 余弦相似度检索 | `vector.rs` | 1d |
| 实现首次全量索引（后台线程+进度推送） | `lib.rs` | 1d |
| 前端接入搜索接口 + 结果展示 | `ai/agent.ts` | 1d |

### 3.3 增量扫描（doc 03）

| 任务 | 文件 | 预估 |
|------|------|------|
| 定义 `IndexSnapshot` 和 `StartupDiff` 类型 | `project_indexer/` | 0.5d |
| 实现 `save_snapshot()` / `load_snapshot()` | `project_indexer/` | 0.5d |
| 实现 `detect_startup_changes()` 三层降级 | `project_indexer/` | 1.5d |
| 改造 `scan_project()` 支持增量模式 | `project_indexer/` | 1d |
| 扩展 watcher 支持的语言列表 | `project_indexer/` | 0.5d |
| 关 app/切项目时保存 IndexSnapshot | `lib.rs` | 0.5d |

---

## 五、Sprint 4：体验优化 + 新技能（P1-P2）

**目标**：智能上下文注入、新技能、主题系统精简。

### 4.1 Context Planner（doc 06）

| 任务 | 文件 | 预估 |
|------|------|------|
| 定义 `ContextPlan` 和 `IntentPattern` 类型 | `contextPlanner.ts` | 1d |
| 实现关键词规则引擎 | `contextPlanner.ts` | 1d |
| 改造 `build_agent_prompt` 接受 `ContextPlan` | `agent.rs` | 1d |
| 向量检索就绪后接入第 2 层 | `contextPlanner.ts` | 0.5d |
| 小模型预检第 3 层（预留） | `contextPlanner.ts` | 0.5d |

### 4.2 新技能注册（doc 07）

| 任务 | 文件 | 预估 |
|------|------|------|
| 项目变动报告 builtin skill | `skill.rs`, `builtins.ts` | 0.5d |
| 项目结构导读 builtin skill | `skill.rs`, `builtins.ts` | 0.5d |
| 代码影响评估 builtin skill | `skill.rs`, `builtins.ts` | 0.5d |

### 4.3 主题系统精简（doc 10）

| 任务 | 文件 | 预估 |
|------|------|------|
| 完善类型定义（PxValue/HexColor/platforms） | `articleThemes.ts` | 0.5d |
| 定义 `renderThemeVars()` 统一单位拼接 | 新函数 | 0.5d |
| 按风格标签重组主题分组 | `articleThemes.ts` | 1d |
| 合并同质主题为平台变体（25→12） | `articleThemes.ts` | 1d |
| 技能 ↔ 主题联动：`recommendedThemeId` | `UnifiedSkill`, `plan.ts` | 0.5d |
| 自定义主题 Rust 后端持久化 | `store.rs`, `crud.ts` | 0.5d |

---

## 六、依赖关系图

```
Sprint 1 (核心修复)          Sprint 2 (架构重塑)       Sprint 3 (智能增强)     Sprint 4 (体验优化)
─────────────────────       ───────────────────       ─────────────────       ───────────────────
数据一致性 ──────────→  技能系统统一               Query AST ──────→ Context Planner
    │                           │                        │                    │
删除级联 ──→ 风格/动作分离       模块重构 ──→ UX 改造     向量嵌入 ─────→ 新技能
    │                           │                        │                    │
    └── Kiro 代码扫描 ──────────┘                       增量扫描              主题精简
                                                                            │
                                                                            ↓
                                                                       未来扩展
                                                                     (doc 15 按需)
```

**并行可行**：
- Sprint 3 的 Query AST 和 向量嵌入可部分并行（但嵌入依赖 AST 分块边界）
- Sprint 4 的 Context Planner 依赖 Sprint 3 的向量和 AST
- UX 改造 Sprint 2 和业务修改 Sprint 1 互相正交

---

## 七、版本号规则

```
v2.0.0-alpha   — Sprint 1 完成，核心修复验证
v2.0.0-beta    — Sprint 2 完成，UX + 架构重塑验证
v2.0.0-rc      — Sprint 3 完成，智能能力集成
v2.0.0         — Sprint 4 完成，全功能发布
```

---

## 八、风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| 风格/动作分离改动影响面大 | 高 | 高 | 先保留旧接口兼容，逐步迁移 |
| Transformers.js ONNX 运行时兼容性 | 中 | 中 | 预留降级：回退到 OpenAI embedding API |
| UX 浮动层布局改坏现有功能 | 中 | 中 | CSS 变量驱动，渐进式替换 |
| tree-sitter .scm 文件写错 | 低 | 中 | 加单元测试 + Kiro 已验证语法正确 |
| 增量扫描三层逻辑复杂 | 中 | 低 | 先做最简单的 git diff，不足再叠加 |

---

## 九、分支策略

```
codex/v2.0.0         ← 初始规划分支（当前）
    └── codex/v2.0.0-docs       ← 最终方案文档（当前）
codex/v2.0.0-s1      ← Sprint 1 实施
codex/v2.0.0-s2      ← Sprint 2 实施
codex/v2.0.0-s3      ← Sprint 3 实施
codex/v2.0.0-s4      ← Sprint 4 实施

每个 Sprint 完成后合并到 codex/v2.0.0，发布 alpha/beta/rc 版本。
可多 Sprint 并行，但合并前需通过集成测试。
```
