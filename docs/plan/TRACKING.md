# InkWise v2.0.0 · 功能开发跟踪表
> 最后更新: 2026-07-10 | 分支: `main` | 状态: 🟡 Sprint 5 进行中

---

## 使用说明

- **状态**: 🔴 未开始 / 🟡 进行中 / 🟢 已完成 / ⏸ 暂停
- **每 Sprint 按功能点拆分**，每个功能点完成后标记 🟢
- **Sprint 完成标准**：该 Sprint 下所有功能点 🟢
- **统计**：表格底部自动汇总完成率

---

## 工作流规则

1. **每完成一个功能点**，必须先更新本表：状态改 🟢、填完成日、更新统计看板
2. **更新后立即提交 Git**（提交信息格式：`feat: [功能编号] 功能描述`）
3. **提交后才能开始下一个功能点**
4. **严格按 Sprint 顺序执行**，不可跳 Sprint

---

---

## Sprint 1：核心业务修复（P0）| 目标: v2.0.0-alpha

### 1.1 数据一致性（doc 01）

| # | 功能点 | 文件 | 状态 | 开发者 | 完成日 | 备注 |
|---|--------|------|------|--------|--------|------|
| 1.1.1 | `loadCollections` 统一入口，移除直接 `browserLoad` 调用 | `crud.ts`, `CollectionTree.tsx`, `ArticleManager.tsx`, `useCollectionCrud.ts` | 🟢 | — | 2026-07-03 | 3 处直接调用需改 |
| 1.1.2 | `saveCollections` 原子写入：Rust JSON 先写，localStorage 后跟，失败则回滚 | `crud.ts` | 🟢 | — | 2026-07-03 | 关键一致性的保底 |
| 1.1.3 | SQLite `articles_search` 新表，只存 FTS 所需最小字段 | `db.rs` | 🟢 | — | 2026-07-03 | content_snippet 取前 2000 字，FTS5 改指向 articles_search |
| 1.1.4 | 前端搜索改为调 SQLite FTS，废弃 `search.ts` 内存遍历 | `search.ts`, `db.rs` | 🟢 | — | 2026-07-03 | FTS 为默认搜索，移除 useFts5 开关 |
| 1.1.5 | 浏览器模式 localStorage 降级路径 | `crud.ts` | 🟢 | — | 2026-07-03 | 1.1.1/1.1.2 已实现，验证通过 |
| 1.1.6 | 保存失败时前端 toast 提示用户 | `useArticleLifecycle.ts`, `useCollectionCrud.ts` | 🟢 | — | 2026-07-03 | Toast 组件+Store+CSS，覆盖合集CRUD和规划创建保存路径 |

### 1.2 删除级联（doc 02）

| # | 功能点 | 文件 | 状态 | 开发者 | 完成日 | 备注 |
|---|--------|------|------|--------|--------|------|
| 1.2.1 | `trashArticle` 补充 SQLite 和向量清理 | `crud.ts`, `lib.rs` | 🟢 | — | 2026-07-03 | 新增 DeleteArticleDb 调用+向量清理占位 |
| 1.2.2 | `removeCollection` 级联删除子文章所有关联数据 | `crud.ts`, `lib.rs` | 🟢 | — | 2026-07-03 | 遍历子文章清理 content/meta/versions/SQLite/图片，向量清理占位 |
| 1.2.3 | `deleteSeriesPlan` 补充向量清理 | `series.ts`, `lib.rs` | 🟢 | — | 2026-07-03 | 新增 Tauri 后端 DeleteSeriesPlan 调用+向量清理占位 |
| 1.2.4 | `unlinkCollectionFolder` 清理 project_chunks | `lib.rs` | 🟢 | — | 2026-07-03 | 新增向量清理占位 |
| 1.2.5 | 新增 `delete_collection_cascade` Tauri 命令 | `lib.rs`, `tauri.ts` | 🟢 | — | 2026-07-03 | Rust 级联命令 + 前端桥接 + crud.ts/ArticleManager 改用新命令 |

### 1.3 回收站逻辑修正（doc 17 — 🔴 新发现）

| # | 功能点 | 文件 | 状态 | 开发者 | 完成日 | 备注 |
|---|--------|------|------|--------|--------|------|
| 1.3.1 | `trashArticle` 改为软删除：只移出合集列表，不删 content/meta | `crud.ts` | 🟢 | — | 2026-07-03 | 移除物理清理逻辑，保留 localStorage plan-draft 清理 |
| 1.3.2 | `permanentlyDeleteArticle` 物理删除 content/meta/versions/db/vector | `crud.ts`, `lib.rs` | 🟢 | — | 2026-07-03 | 从 trash 移出后执行完整物理清理 |
| 1.3.3 | `restoreArticle` 改回内容可恢复（从 trash 移回合集） | `crud.ts` | 🟢 | — | 2026-07-03 | 1.3.1 改为软删除后，恢复即可用（内容仍在） |

### 1.4 风格/动作分离（doc 13 — 核心业务修复）

| # | 功能点 | 文件 | 状态 | 开发者 | 完成日 | 备注 |
|---|--------|------|------|--------|--------|------|
| 1.4.1 | 定义 `WritingStyle` 和 `WritingAction` 类型 | `writingStyle.ts` 新文件 | 🟢 | — | 2026-07-03 | 定义 WritingStyle/WritingAction/ActionPhase + 4 个内置动作 |
| 1.4.2 | `ArticleBlueprint` 新增 `styleId` + `actionId` | `articleBlueprint.ts` | 🟢 | — | 2026-07-03 | 新增 styleId/actionId 字段，向后兼容 skillId |
| 1.4.3 | 迁移前端 WritingSkill → Style（名称不变，结构重构） | `writingStyle.ts` | 🟢 | — | 2026-07-03 | 从 WritingSkill 提取风格部分，getBuiltinStyles/getStyle 函数 |
| 1.4.4 | 迁移 Rust builtin_skills 中的动作 → Action 枚举 | `skill.rs` | 🟢 | — | 2026-07-03 | 新增 WritingActionKind 枚举（18 个）+ as_str/from_str |
| 1.4.5 | 改造 `agent.ts` execute：Action + 当前 Style 上下文拼接 | `agent.ts` | 🟢 | 2026-07-03 | 风格传递链 |
| 1.4.6 | 改造 `agent.rs` execute_action：接受 Style 参数 | `agent.rs` | 🟢 | — | 2026-07-03 | Rust 端配合 |
| 1.4.7 | 改造 `articleReview.ts`：动态维度 + 风格感知 | `articleReview.ts` | 🟢 | 🟢 | 2026-07-03 | 不再硬编码 5 维 |
| 1.4.8 | 改造 `applyOptimization`：逐段修复而非全量重写 | `articleReview.ts` | 🟢 | — | 2026-07-03 | 可接受/拒绝 |
| 1.4.9 | 审阅结果缓存（文章未修改不重复审阅） | `articleReview.ts` | 🟢 | — | 2026-07-03 | doc 17 建议 |

---


### 1.5 AI生成修复（doc 20 — 🔴 新发现）

| # | 功能点 | 文件 | 状态 | 开发者 | 完成日 | 备注 |
|---|--------|------|------|--------|--------|------|
| 1.5.1 | `ensureHeadingNumbers` 修复：处理 h1 + h3 无 h2 父级时 0.x 序号 | `plan.ts` | 🟢 | — | 2026-07-06 | h1 重置计数器，无 h2 父级的 h3 用简单顺序编号 |
| 1.5.2 | 强制系列文章必须生成开场白/引言 | `plan.ts`, `defaults.ts`, `EditorPane.tsx` | 🟢 | — | 2026-07-06 | 系统提示词 "可以用" → "必须用" |
| 1.5.3 | 微信发布列表项多余空行修复 | `wechat.ts` | 🟢 | — | 2026-07-06 | 添加 section.wechat-wrapper li{margin:0!important} |
| 1.5.4 | 系列规划项目目录结构展示优化 | `SeriesPlanner.tsx`, `styles.css` | 🟢 | — | 2026-07-06 | showProjectTree 默认 true + 加载状态 + 全部始终显示 |


## Sprint 2：架构重塑 + UX 改造（P0-P1）| 目标: v2.0.0-beta

### 2.1 技能系统统一（doc 09）

| # | 功能点 | 文件 | 状态 | 开发者 | 完成日 | 备注 |
|---|--------|------|------|--------|--------|------|
| 2.1.1 | 定义 `UnifiedSkill` + `ToolCapability` 枚举类型 | `skill.rs`, `skillTypes.ts` | 🟢 | — | 2026-07-03 | 新增9种ToolCapability+ContextSourceType+EffortLevel+SkillPhase+PhaseConfigUnified+UnifiedSkill | |
| 2.1.2 | 合并 `builtin_skills()` 和 `getBuiltinSkills()` 为一套 | `skill.rs` | 🟢 | — | 2026-07-03 | unified_builtin_skills()+前端unifiedSkills.ts+Tauri命令list_unified_skills |
| 2.1.3 | 前端改为从 IPC 获取技能列表 | `storage.ts`, `builtins.ts` | 🟢 | — | 2026-07-03 | builtins.ts IPC优先+本地降级, storage.ts getAllSkills整合UnifiedSkill |
| 2.1.4 | 枚举替换 `allowed_tools` 字符串 | `skill.rs`, `agent.rs` | 🟢 | — | 2026-07-03 | ToolCapability 枚举替换字符串比较 |
2.1.5 | `agent.rs` 支持 tool calling + ContextPlan | `agent.rs`, `lib.rs`, `skill.ts` | 🟢 | — | 2026-07-03 | tool loop + ContextPlan + dispatch_tool_call |
| 2.1.6 | 废弃前端 `writingSkill/` 独立目录 | `writingSkill/` | 🟢 | — | 2026-07-03 | 添加 deprecation 注释，确保向后兼容 |

### 2.2 模块重构（doc 11）

| # | 功能点 | 文件 | 状态 | 开发者 | 完成日 | 备注 |
|---|--------|------|------|--------|--------|------|
| 2.2.1 | `skill.rs` → `skill/` 模块拆分（类型/builtins/store/frontmatter） | `skill/` | 🟢 | — | 2026-07-03 | types/builtins/store/frontmatter 4 文件拆分 |
| 2.2.2 | `agent.rs` → `agent/` 模块拆分（engine/prompt） | `agent/` | 🟢 | — | 2026-07-03 | engine/prompt/tools/types 4 文件拆分 |
| 2.2.3 | `project_indexer.rs` → `project_indexer/` 模块拆分 | `project_indexer/` | 🟢 | — | 2026-07-03 | types/scanner/watcher 3 文件拆分 |
| 2.2.4 | `editorStyles.ts` 拆分（1585 行 → 3 文件） | `editorStyles.ts` | 🟢 | — | 2026-07-03 | editorTemplates.ts + editorStyles.ts 精简 |
| 2.2.5 | `storage/collections/` 整合（7 文件精简） | `collections/` | 🟢 | — | 2026-07-03 | 7→4 文件精简（internal+search+series → crud） |
| 2.2.6 | `lib/ai/` 扁平化 → 按领域分包（skill/agent/article/project） | `lib/` | 🟢 | — | 2026-07-03 | skill/agent/article 三级分包，根文件→重导出壳 |
| 2.2.7 | 注释规范统一（文件头/模块线/复杂函数 JSDoc） | 全库 | 🟢 | — | 2026-07-03 | 文件头/模块线注释规范化 |

### 2.3 UX 改造（doc 14）

| # | 功能点 | 文件 | 状态 | 开发者 | 完成日 | 备注 |
|---|--------|------|------|--------|--------|------|
| 2.3.1 | 右侧面板合并为浮动层（取消固定 AgentPanel + StylePanel 列） | `MainEditorPage.tsx`, `styles.css` | 🟢 | — | 2026-07-03 | 浮动层: fixed+背板+float-in动画, 移除旧grid列/dock-resizer/ai-dock |
| 2.3.2 | 新建文档默认不弹合集选择器 | `MainEditorPage.tsx` | 🟢 | — | 2026-07-03 | 直接进编辑器 |
| 2.3.3 | 保存状态移到编辑器右上角（绿点 + 旋转图标） | `EditorPane.tsx` | 🟢 | — | 2026-07-03 | 右上角 saveState: saving/saved/error |
| 2.3.4 | 标题双击直接编辑（不再打开蓝图编辑器弹窗） | `ArticleHeader.tsx` | 🟢 | — | 2026-07-03 | 双击变 input, Enter确认/Escape取消 |
| 2.3.5 | AIBar 默认折叠 36px，聚焦展开 | `AICommandBar.tsx`, `styles.css` | 🟢 | — | 2026-07-03 | 折叠 36px 条+点击展开, 失焦关闭 |
| 2.3.6 | Sidebar 增加 tab 切换（目录/大纲/项目） | `Sidebar.tsx`, `styles.css`, `ProjectPanel.tsx` | 🟢 | — | 2026-07-03 | 三 tab（目录/大纲/项目）+ ProjectPanel 卡片 + 底部图标按钮 |
| 2.3.7 | 阶段切换引导对话框 | `PhaseGuideDialog.tsx`, `BlueprintEditor.tsx` | 🟢 | — | 2026-07-03 | 首次切换阶段弹出 PhaseGuideDialog 说明四阶段作用 |
| 2.3.8 | Toolbar hover 显示键盘快捷键 | `Toolbar.tsx` | 🟢 | — | 2026-07-03 | ToolBtn 新增 shortcut prop, 显示 ⌘B/⌘I/⌘U/⌘Z 等 10+ 快捷键 |
| 2.3.9 | 审阅完成后自动切换到评估 tab | `AgentPanel.tsx`, `events.ts`, `review.ts` | 🟢 | — | 2026-07-03 | 新增 review-complete 事件, auto-switch + tab-flash 动画 |
| 2.3.10 | StartupSplash 增加引导步骤 | `StartupSplash.tsx` | 🟢 | — | 2026-07-03 | 新手引导弹窗: 4步流程说明 + 快捷键速查表 |
| 2.3.11 | 状态栏精简（默认只显示字数+保存+模型） | `StatusBar.tsx` | 🟢 | — | 2026-07-03 | 默认字数+保存+模型，其余折叠可展开 |
| 2.3.12 | InlineToolbar 增加 AI 快捷动作（润色/改写/翻译） | `InlineToolbar.tsx` | 🟢 | — | 2026-07-03 | 选中文字后弹出润色/改写/翻译/扩写/分析等快捷动作 |
| 2.3.13 | 大纲滚动联动增强 | `EditorContent.tsx` | 🟢 | — | 2026-07-03 | 实时 ProseMirror 大纲解析+高亮闪烁 |
| 2.3.14 | 焦点模式退出按钮优化（右上角中文 + Esc 提示） | `MainEditorPage.tsx` | 🟢 | — | 2026-07-03 | 中文「退出焦点模式」+ Esc标签 |
| 2.3.15 | ReviewPanel 逐段修复交互（接受/拒绝） | `ReviewPanel.tsx` | 🟢 | — | 2026-07-03 | 逐建议接受/拒绝 + 状态持久化 |
| 2.3.16 | 浮动层布局 CSS 样式 | `styles.css` | 🟢 | — | 2026-07-03 | 响应式宽度+微交互动画+小屏适配 |

---

## Sprint 3：智能能力增强（P1）| 目标: v2.0.0-rc

### 3.1 Query AST（doc 04 + Kiro 验证）

| # | 功能点 | 文件 | 状态 | 开发者 | 完成日 | 备注 |
|---|--------|------|------|--------|--------|------|
| 3.1.1 | 创建 `tree-sitter-queries/` 目录 + 语言子目录 | 新目录 | 🟢 | — | 2026-07-03 | Kiro 结构对齐 |
| 3.1.2 | 写入 code-snippet 层：`typescript.scm`, `rust.scm` | `.scm` 文件 | 🟢 | — | 2026-07-03 | Kiro 结构对齐 |
| 3.1.3 | 写入 import 层：`typescript.scm`, `rust.scm` | `.scm` 文件 | 🟢 | — | 2026-07-03 | Kiro 结构对齐 |
| 3.1.4 | 写入 root-context 层 | `.scm` 文件 | 🟢 | — | 2026-07-03 | Kiro 结构对齐 |
| 3.1.5 | 实现 `query_symbols()` 通用执行函数 | `project_indexer/scanner.rs` | 🟢 | — | 2026-07-03 | 替换 ~150 行手写遍历 |
| 3.1.6 | 替换 `extract_symbols_treesitter()` 调用 | `project_indexer/scanner.rs` | 🟢 | — | 2026-07-03 | 改为 query_execute(code-snippet) + symbols_from_query |
| 3.1.7 | 替换 `extract_imports_treesitter()` 调用 | `project_indexer/scanner.rs` | 🟢 | — | 2026-07-03 | 改为 query_execute(import) + imports_from_query |
| 3.1.8 | 添加 `python.scm`, `go.scm`, `java.scm` 等扩展 | `.scm` 文件 | 🟢 | — | 2026-07-03 | Kiro 结构对齐 |

### 3.2 本地向量嵌入（doc 05）

| # | 功能点 | 文件 | 状态 | 开发者 | 完成日 | 备注 |
|---|--------|------|------|--------|--------|------|
| 3.2.1 | 下载 `bge-small-zh-v1.5` ONNX 到 `models/` | 外部 | 🔴 | — | — | — |
| 3.2.2 | 建 `vector_chunks` 表（SQLite） | `db.rs` | 🟢 | — | 2026-07-03 | 含 embedding BLOB |
| 3.2.3 | 实现 `embed_text()` Transformers.js 调用 | `vector/embedder.rs` | 🟢 | — | 2026-07-03 | Node REPL 桥接 |
| 3.2.4 | 实现 `chunk_content()` 按段落/函数分块 | `vector/chunk.rs` | 🟢 | — | 2026-07-03 | 3 种分块策略 |
| 3.2.5 | 实现增量索引（文件变更 → 重 Embedding → Upsert） | `vector/indexer.rs` | 🟢 | — | 2026-07-03 | hash 对比防重复 |
| 3.2.6 | 实现 `vector_search()` 余弦相似度检索 | `vector/search.rs` | 🟢 | — | 2026-07-03 | Top-K + 阈值过滤 |
| 3.2.7 | 实现首次全量索引（后台线程 + 进度事件推送） | `lib.rs`, `vector/indexer.rs` | 🟢 | — | 2026-07-03 | 不阻塞用户 |
| 3.2.8 | 前端接入搜索接口 + 结果组件 | `ai/agent.ts`, 新组件 | 🟢 | — | 2026-07-03 | vectorSearch服务+SearchPanel升级+三阶降级 |

### 3.3 增量扫描（doc 03）

| # | 功能点 | 文件 | 状态 | 开发者 | 完成日 | 备注 |
|---|--------|------|------|--------|--------|------|
| 3.3.1 | 定义 `IndexSnapshot` 和 `StartupDiff` 类型 | `project_indexer/snapshot.rs` | 🟢 | — | 2026-07-03 | — |
| 3.3.2 | 实现 `save_snapshot()` / `load_snapshot()` | `project_indexer/snapshot.rs` | 🟢 | — | 2026-07-03 | JSON 文件 |
| 3.3.3 | 实现 `detect_startup_changes()` 三层降级 | `project_indexer/snapshot.rs` | 🟢 | — | 2026-07-03 | git → mtime → hash |
| 3.3.4 | 改造 `scan_project()` 支持增量模式（`changed_files` 参数） | `project_indexer/scanner.rs` | 🟢 | — | 2026-07-03 | 新增 rescan_project_incremental + Tauri命令 |
| 3.3.5 | 扩展 watcher 支持的语言列表 | `project_indexer/mod.rs+watcher.rs+snapshot.rs` | 🟢 | — | 2026-07-03 | SUPPORTED_TEXT_EXTS 共享常量 |
| 3.3.6 | 关 app / 切项目时保存 IndexSnapshot | `lib.rs` | 🟢 | — | 2026-07-03 | on_window_event + 扫描后自动保存 |

---

## Sprint 4：体验优化 + 新技能（P1-P2）| 目标: v2.0.0

### 4.1 Context Planner（doc 06）

| # | 功能点 | 文件 | 状态 | 开发者 | 完成日 | 备注 |
|---|--------|------|------|--------|--------|------|
| 4.1.1 | 定义 `ContextPlan` 和 `IntentPattern` 类型 | `contextPlanner.ts`, `agent/types.rs`, `agent/prompt.rs` | 🟢 | — | 2026-07-03 | Rust+前端双向类型；prompt.rs 增强全字段利用 |
| 4.1.2 | 实现关键词规则引擎（~10 个 intent pattern） | `contextPlanner.ts` | 🟢 | — | 2026-07-03 | 9 个内置 pattern + 技能名降级 |
| 4.1.3 | 改造 `build_agent_prompt` 接受 `ContextPlan` | `agent/prompt.rs` | 🟢 | — | 2026-07-03 | 全字段利用：intent/required_contexts/suggested_tools/priority_files/skip_sections |
| 4.1.4 | 向量检索就绪后接入第 2 层（语义降级） | `contextPlanner.ts` | 🟢 | — | 2026-07-03 | 规则未命中 → 向量检索 |
| 4.1.5 | 小模型预检第 3 层（预留，暂不实现） | `contextPlanner.ts` | ⏸ | — | — | 未来扩展 |

### 4.2 新技能注册（doc 07）

| # | 功能点 | 文件 | 状态 | 开发者 | 完成日 | 备注 |
|---|--------|------|------|--------|--------|------|
| 4.2.1 | 项目变动报告 builtin skill（Rust + 前端同步） | `skill/builtins.rs`, `unified.ts` | 🟢 | — | 2026-07-03 | Context Planner 联动 |
| 4.2.2 | 项目结构导读 builtin skill | `skill/builtins.rs`, `unified.ts` | 🟢 | — | 2026-07-03 | — |
| 4.2.3 | 代码影响评估 builtin skill | `skill/builtins.rs`, `unified.ts` | 🟢 | — | 2026-07-03 | 依赖调用链分析 |

### 4.3 主题系统精简（doc 10）

| # | 功能点 | 文件 | 状态 | 开发者 | 完成日 | 备注 |
|---|--------|------|------|--------|--------|------|
| 4.3.1 | 完善类型定义（`PxValue` / `EmValue` / `HexColor`） | `articleThemes.ts` | 🟢 | — | 2026-07-03 | PxValue/EmValue/HexColor 语义类型 + ArticleThemeVars 字段注解 |
| 4.3.2 | 定义 `renderThemeVars()` 统一单位拼接 | `articleThemes.ts` | 🟢 | — | 2026-07-03 | renderThemeVars + renderThemeUnit + cssEntriesToText |
| 4.3.3 | 按风格标签重组主题分组（简约/暖色/暗色/纸墨） | `articleThemes.ts` | 🟢 | — | 2026-07-03 | CoreTheme+PlatformOverride 类型，12 核心风格按标签分组 |
| 4.3.4 | 合并同质主题为平台变体（25 → 12 核心 + platformOverrides） | `articleThemes.ts` | 🟢 | — | 2026-07-03 | generateFullThemes 展开，31 主题保持向后兼容 |
| 4.3.5 | 技能 ↔ 主题联动：`recommendedThemeId` | `UnifiedSkill`, `plan.ts` | 🟢 | — | 2026-07-03 | Rust Skill/UnifiedSkill+TS + builder, 13个技能关联推荐主题 |
| 4.3.6 | 自定义主题支持 Rust 后端持久化 | `store.rs`, `crud.ts` | 🟢 | — | 2026-07-03 | load/save/delete Tauri 命令 + store.rs JSON 持久化 + 前端最佳努力双写 |

### 4.4 图片/插图专项改进（doc 17）

| # | 功能点 | 文件 | 状态 | 开发者 | 完成日 | 备注 |
|---|--------|------|------|--------|--------|------|
| 4.4.1 | 编辑器 Toolbar 增加 🖼️ 配图独立按钮 | `Toolbar.tsx` | 🟢 | — | 2026-07-03 | DrawPopover 组件 + 缓存集成 |
| 4.4.2 | 配图生成缓存（hash 文章内容 → 缓存 key） | `draw.ts` | 🟢 | — | 2026-07-03 | 内容哈希 + 24h TTL + 50 LRU |
| 4.4.3 | 支持更多绘图 Provider（ComfyUI/Stable Diffusion） | `image_gen.rs` | 🟢 | — | 2026-07-03 | sd_image_gen + comfyui_image_gen 路由 |

---

## Sprint 5：ArticleDocument 统一上下文（doc 18）| 目标: v2.1.0-alpha

### 5.1 定义 + 存储层

| # | 功能点 | 文件 | 状态 | 开发者 | 完成日 | 备注 |
|---|--------|------|------|--------|--------|------|
| 5.1.1 | 定义 `ArticleDocument` 完整类型 | `storage/articleDocument.ts` | 🟢 | — | 2026-07-10 | 含 styleConfig/outline/publishRecords/reviewState 嵌套 |
| 5.1.2 | 实现 `loadArticleDocument` / `saveArticleDocument`（Tauri + localStorage） | `storage/articleDocument.ts` | 🟢 | — | 2026-07-10 | 原子写入 |
| 5.1.3 | 实现 `migrateArticleDocument` 从旧数据重建 | `storage/articleDocument.ts` | 🟢 | — | 2026-07-10 | 惰性迁移 |
| 5.1.4 | Rust 新增 `load_article_document` / `save_article_document` 命令 | `lib.rs`, `store.rs` | 🟢 | — | 2026-07-10 | 存储于 `documents/{id}.json` |
| 5.1.5 | 前端桥接注册新命令 | `bridge/tauri.ts` | 🟢 | — | 2026-07-10 | TauriCommands + invokeOrFallback |

### 5.2 EditorPane 接入

| # | 功能点 | 文件 | 状态 | 开发者 | 完成日 | 备注 |
|---|--------|------|------|--------|--------|------|
| 5.2.1 | EditorPane 新增 `activeDoc` 状态，打开文章时 loadDocument | `EditorPane.tsx` | 🟢 | — | 2026-07-10 | 替换旧的 activeBlueprint/activeArticle 分散状态 |
| 5.2.2 | `handleStartPlan` 改为创建 ArticleDocument | `EditorPane.tsx` | 🟢 | — | 2026-07-10 | 通过 debounced sync 自动创建 |
| 5.2.3 | `handlePlanConfirm` 改为写入 document | `EditorPane.tsx` | 🟢 | — | 2026-07-10 | 构建完整 doc 含 styleId/actionId |
| 5.2.4 | `handleExecute` 从 activeDoc 同步的 blueprint 读全部参数 | `EditorPane.tsx` | 🟢 | — | 2026-07-10 | activeDoc→blueprint 同步机制保证数据一致 |

### 5.3 AI 引擎改造

| # | 功能点 | 文件 | 状态 | 开发者 | 完成日 | 备注 |
|---|--------|------|------|--------|--------|------|
| 5.3.1 | ArticleGenInput 增加 styleId/actionId 字段 | `plan.ts` | 🟢 | — | 2026-07-10 | 不再残缺 |
| 5.3.2 | generateFullArticleWithTools/Stream 传递 style/action 到 buildSystemPrompt | `plan.ts` | 🟢 | — | 2026-07-10 | 初稿即可感知风格/动作 |
| 5.3.3 | buildSystemPrompt 注入风格/动作到 AI 上下文 | `plan.ts` | 🟢 | — | 2026-07-10 | 含 system prompt 和 user prompt |
| 5.3.4 | handlePlanConfirm 的 genInput 补传 styleId/actionId | `EditorPane.tsx` | 🟢 | — | 2026-07-10 | 链路完整 |

### 5.4 周边组件适配

| # | 功能点 | 文件 | 状态 | 开发者 | 完成日 | 备注 |
|---|--------|------|------|--------|--------|------|
| 5.4.1 | BlueprintEditor 同步到 document + handleSaveBlueprint 写入 doc | `EditorPane.tsx` | 🟢 | — | 2026-07-10 | saveBlueprint 后同步 activeDoc |
| 5.4.2 | ArticleFinalPage 从 document 加载 + 发布记录写入 doc | `ArticleFinalPage.tsx` | 🟢 | — | 2026-07-10 | 前后双兼容 |
| 5.4.3 | ReviewPanel 存储层改为优先使用 document.reviewExtra | `review.ts` | 🟢 | — | 2026-07-10 | localStorage 降级 |
| 5.4.4 | ArticleContext 保存时同步写入 document.styleConfig | `ArticleContext.ts` | 🟢 | — | 2026-07-10 | 异步写入不阻塞 UI |

### 5.5 SeriesPlanner 补全 + 清理

| # | 功能点 | 文件 | 状态 | 开发者 | 完成日 | 备注 |
|---|--------|------|------|--------|--------|------|
| 5.5.1 | SeriesPlanner UI 增加 styleId/actionId 选择器 | `SeriesPlanner.tsx` | 🟢 | — | 2026-07-10 | 填入 handleConfirm |
| 5.5.2 | 旧类型清理注释标记 | 全库 | 🟢 | — | 2026-07-10 | 向后兼容，逐步迁移至 doc |
| 5.5.3 | 旧 Tauri 命令废弃标记 | `lib.rs`, `tauri.ts` | 🟢 | — | 2026-07-10 | 添加 DEPRECATED 注释 |

---

## 未来扩展（doc 15）| 目标: v2.x

| # | 功能点 | 文件 | 状态 | 开发者 | 完成日 | 备注 |
|---|--------|------|------|--------|--------|------|
| 6.1 | AI 改写适配：Rust 改写引擎 + 平台预设 | `rewrite/` | 🔴 | — | — | 复用 Plan+Agent |
| 6.2 | 视频/音频提取：ffmpeg + Whisper 集成 | `media/` | 🔴 | — | — | 本地/云端双模式 |
| 6.3 | 多平台热点追踪：数据源调度 + UI 展示 | `hot-topics/` | 🔴 | — | — | 依赖外部 API |
| 6.4 | 效果追踪：阅读量/点赞/评论分析 | `analytics/` | 🔴 | — | — | 依赖发布平台 API |
| 6.5 | 热点 → 自动选题 | `hot-topics/matcher.ts` | 🔴 | — | — | 依赖 6.3 |
| 6.6 | 多平台一键改写 + 发布 | `rewrite/`, `publisher/` | 🔴 | — | — | 依赖 6.1 + 发布模块 |

---

## 已知但未计划（won't fix）

| # | 事项 | 原因 |
|---|------|------|
| — | Web-tree-sitter WASM 切换 | 当前原生 Rust crate 够用，WASM 是长期方向，不急 |
| — | 版本快照存 Rust JSON | localStorage 版本在 Tauri 模式下够用，可靠性要求不高 |
| — | 导出数据脱敏 | 当前 API Key 随 JSON 导出，但用户场景为本地备份，风险可控 |

---

## 统计看板

| Sprint | 总功能点 | 🟢 完成 | 🟡 进行中 | 🔴 未开始 | ⏸ 暂停 | 完成率 |
|--------|---------|---------|-----------|-----------|--------|--------|
| S1: 核心修复 | 23 | 23 | 0 | 0 | 0 | 100% |
| S2: 架构+UX | 29 | 29 | 0 | 0 | 0 | 100% |
| S3: 智能增强 | 22 | 22 | 0 | 0 | 0 | 100% |
| S4: 体验优化 | 16 | 16 | 0 | 0 | 0 | 100% |
| S5: ArticleDocument | 16 | 16 | 0 | 0 | 0 | 100% |
| 未来扩展 | 6 | 0 | 0 | 6 | 0 | 0% |
| **总计** | **107** | **96** | 0 | 11 | 0 | 90% |
---

## v2.0.0 热修复（2026-07-04）

| # | 问题 | 文件 | 状态 | 完成日 |
|---|------|------|------|--------|
| F1 | `\.startup-splash__spinner` CSS 反斜杠导致旋转动画不生效 | `styles.css` | 🟢 | 2026-07-04 |
| F2 | SeriesPlanner 只加载 builtin skills，缺少自定义 skills | `SeriesPlanner.tsx` | 🟢 | 2026-07-04 |
| F3 | 系列文章触发 auto-plan-article 时 folderContextRef 竞态未加载 | `EditorPane.tsx` | 🟢 | 2026-07-04 |
| F4 | 大纲 padding-left 太小 + parseOutline 解析脆弱、match 组错位 | `styles.css`, `plan.ts` | 🟢 | 2026-07-04 |
| F5 | 实时生成内容流式显示无 Markdown 渲染 | `StartupSplash.tsx`, `styles.css` | 🟢 | 2026-07-04 |
| F6 | resolveSkill 不搜索 IPC unified skills，自定义技能永远找不到 | `plan.ts` | 🟢 | 2026-07-04 |
| F7 | 工具调用事件显示简陋，缺乏文件路径/结果预览/thinking显示 | `StartupSplash.tsx`, `styles.css` | 🟢 | 2026-07-04 |
| F8 | 系列文章的系列上下文（标题/描述）未传递给规划阶段 | `appHooks.ts`, `EditorPane.tsx`, `events.ts` | 🟢 | 2026-07-05 |
| F9 | 大纲 prompt 不明确导致输出格式混乱，parseOutline 忽略 "1.1" 编号项 | `plan.ts` | 🟢 | 2026-07-05 |
| F10 | 大纲渲染缺少嵌套结构/序号前缀/描述样式 | `StartupSplash.tsx`, `styles.css` | 🟢 | 2026-07-05 |
| F11 | 写作阶段 UI 简陋，流式内容无占位提示/版式/样式 | `StartupSplash.tsx`, `styles.css` | 🟢 | 2026-07-05 |
| F12 | 大纲系统 prompt 与用户 prompt 格式冲突，AI 输出混乱导致 fallback | `defaults.ts` | 🟢 | 2026-07-05 |
| F13 | generateOutline 无错误日志/空结果检查，静默 fallback 到引言/正文/结语 | `plan.ts` | 🟢 | 2026-07-05 |
| F14 | 系列文章 auto-plan-article 事件未传递 collectionId，项目上下文竞态丢失 | `EditorPane.tsx`, `plan.ts` | 🟢 | 2026-07-05 |
| F15 | 项目文件读取工具调用事件太啰嗦，改为紧凑进度条 | `StartupSplash.tsx`, `styles.css` | 🟢 | 2026-07-05 |
| F16 | 系列文章 styleId/actionId 未传递，规划阶段丢失完整参数 | `appHooks.ts`, `events.ts`, `types.ts` | 🟢 | 2026-07-05 |
| F17 | 新建文章继承旧样式，未重置为默认值 | `editorStore.ts` | 🟢 | 2026-07-05 |
| F18 | outline fallback 文本"正文/结语"过于简单，缺少描述 | `plan.ts` | 🟢 | 2026-07-05 |
| F19 | 生成文章 AI 系统 prompt 缺少"必须基于真实项目"的强约束 | `plan.ts` | 🟢 | 2026-07-05 |
| F20 | CSS 文件 89 处重复 @keyframes 定义 | `styles.css` | 🟢 | 2026-07-05 |
| F21 | appHooks.ts TypeScript 错误：await 在非 async setTimeout 中 | `appHooks.ts` | 🟢 | 2026-07-05 |
| F22 | SeriesPlanner getProvider() 未用 resolveProviderForModel，模型切换后服务商未切换 | `SeriesPlanner.tsx` | 🟢 | 2026-07-06 |
| F23 | 快照 rename/copy ENOENT → 简化直接写入 + 过期快照自动清理 | `snapshot.rs`, `lib.rs` | 🟢 | 2026-07-06 |
| F23 | 快照 rename/copy ENOENT → 简化直接写入 + 过期快照自动清理 | `snapshot.rs`, `lib.rs` | 🟢 | 2026-07-06 |

## v2.0.0 热修复（2026-07-07）

| # | 问题 | 文件 | 状态 | 完成日 |
|---|------|------|------|--------|
| F24 | StartupSplash 关联项目侧栏缺失（projectName/projectFiles/projectStructure 未渲染） | `StartupSplash.tsx`, `EditorPane.tsx`, `styles.css` | 🟢 | 2026-07-07 |
| F25 | addHeadingNumbers 跳过 h3，cleanText 只剥一层序号导致重复编号 | `editorStyles.ts` | 🟢 | 2026-07-07 |
| F26 | edit-series-plan useEffect 缺少 existingPlan 依赖导致编辑规划不生效 | `SeriesPlanner.tsx` | 🟢 | 2026-07-07 |
| F27 | StartupSplash autoFocus 触发 onFocus 导致建议词条永远不显示 | `StartupSplash.tsx` | 🟢 | 2026-07-07 |
| F28 | Sidebar 底部按钮贴紧（padding-bottom 移除） | `styles.css` | 🟢 | 2026-07-07 |
| F29 | SeriesPlanner 页模式左侧关联项目列表未显示 | `SeriesPlanner.tsx`, `styles.css` | 🟢 | 2026-07-07 |
| F30 | SeriesPlanner usePanelStore hooks 违反 React Hooks 规则（条件分支内调用） | `SeriesPlanner.tsx` | 🟢 | 2026-07-07 |
| F31 | StartupSplash 无关联项目时不显示侧栏 | `StartupSplash.tsx` | 🟢 | 2026-07-07 |
| F32 | AI 大纲泄漏思考过程 + 格式错乱 | `plan.ts`, `defaults.ts` | 🟢 | 2026-07-10 |
| F33 | AI 中英混杂（新建文档路径缺指令） | `plan.ts` | 🟢 | 2026-07-10 |
| F34 | 回收站不显示已删除文章（参数名不匹配） | `crud.ts`, `store.rs`, `lib.rs` | 🟢 | 2026-07-10 |
| F35 | 回收站按钮操作失效（confirm 被拦截） | `TrashDialog.tsx` | 🟢 | 2026-07-10 |
| F36 | Rust SSE 流 UTF-8 乱码 | `ai.rs` | 🟢 | 2026-07-10 |
| F37 | 标题/简介不显示（空字符串+falsy+缺指令） | `plan.ts`, `EditorPane.tsx` | 🟢 | 2026-07-10 |
| F38 | askAI 短文本用流式接口 + 生命周期不清晰 | `plan.ts`, `EditorPane.tsx`, `articleDocument.ts` | 🟢 | 2026-07-10 |

### 统计看板（含热修复）

| 类别 | 总数 | 🟢 完成 | 完成率 |
|------|------|---------|--------|
| Sprint 1-4 功能 | 91 | 87 | 96% |
| 热修复 | 31 | 31 | 100% |

## v2.1.0 热修复（2026-07-10）

| # | 问题 | 文件 | 状态 | 完成日 |
|---|------|------|------|--------|
| F32 | AI 大纲生成泄漏思考过程（输出"Here's a thinking process:"） | `plan.ts`, `defaults.ts` | 🟢 | 2026-07-10 |
| F33 | AI 大纲格式错乱：序号重复、分隔符用中文冒号而非破折号、parseOutline 无法解析 | `plan.ts` | 🟢 | 2026-07-10 |

## 里程碑记录

| 里程碑 | 目标日期 | 实际日期 | 备注 |
|--------|---------|---------|------|
| v2.0.0-alpha (S1 完成) | 2026-07-03 | 2026-07-03 | Sprint 1 全部 23 项功能完成 |
| v2.0.0-beta (S2 完成) | 2026-07-03 | 2026-07-03 | Sprint 2 全部 28 项功能完成 |
| v2.0.0-rc (S3 完成) | — | 2026-07-03 | — |
| v2.0.0 (S4 完成) | — | 2026-07-03 | Sprint 4 全部 16 项功能完成 |

---

## Sprint 6：存储统一 + Rust 模块拆分

**目标**：SQLite 成为唯一事实源，Rust 后端按职责拆分

| # | 功能点 | 文件 | 状态 | 完成日 | 备注 |
|---|--------|------|------|--------|------|
| 6.1 | 创建 `domain/` 目录，从 `store.rs` 剥离类型定义 | `domain/*.rs` | 🟢 | 2026-07-11 | 8 个 Rust 类型文件 + serde camelCase |
| 6.2 | 实现 `storage/` 目录（Storage trait + sqlite.rs） | `storage/mod.rs`, `sqlite.rs` | 🟢 | 2026-07-11 | 25 方法 trait + SQLite 实现 |
| 6.3 | 编写 migration.rs（JSON → SQLite 迁移） | `storage/migration.rs` | 🟢 | 2026-07-11 | 全量迁移脚本 + 7 项数据 |
| 6.4 | 创建 `commands/` 目录 + 集成到 lib.rs | `commands/*.rs`, `lib.rs` | 🟢 | 2026-07-11 | 23 个命令从 lib.rs 移入 commands/，cargo build 通过 |
| 6.5 | 拆分 `ai.rs` 为 `ai/` 模块 | `ai/*.rs` | 🟢 | 2026-07-11 | ai.rs → ai/mod.rs 目录模块 |
| 6.6 | 前端存储层适配 SQLite：补充 DB 命令桥接 + crud.ts/articles.ts DB 优先 | `bridge/tauri.ts`, `crud.ts`, `articles.ts` | 🟢 | 2026-07-11 | 类型检查通过 |
| 6.7 | 旧 JSON 文件清理（cleanup_old_json 命令） | `migration.rs`, `lib.rs`, `tauri.ts` | 🟢 | 2026-07-11 | 确认 SQLite 稳定后手动触发 |
| 6.8 | 端到端测试：构建验证 + 编译检查 | `cargo build`, `playwright` | 🟢 | 2026-07-11 | cargo build + tsc + vite build 全部通过 |

### 统计看板

| 类别 | 总数 | 🟢 完成 | 🔴 未开始 | 完成率 |
|------|------|---------|-----------|--------|
| Sprint 1-4 功能 | 91 | 87 | — | 96% |
| 热修复 | 31 | 31 | — | 100% |
| Sprint 5 功能 | 16 | 16 | — | 100% |
| **Sprint 6 功能** | **8** | **8** | **0** | **100%** |

## Sprint 7：分层拆分 + Service 提取

**目标**：前后端按 UI/Service/Domain/Infrastructure 四层组织

| # | 功能点 | 文件 | 状态 | 完成日 | 备注 |
|---|--------|------|------|--------|------|
| 7.1 | 前端 `domain/` 目录创建 + 类型剥离 | `src/domain/*.ts` | 🟢 | 2026-07-11 | 5 文件：Document/Collection/Plan/Project/enums + index |
| 7.2 | Infrastructure 接口定义 | `src/infrastructure/*.ts` | 🟢 | 2026-07-11 | AIProvider / DocumentStore / EventBus |
| 7.3 | Service 层：PlanService 提取 | `src/services/PlanService.ts` | 🟢 | 2026-07-11 | 依赖 AIProvider + DocumentStore 接口 |
| 7.4 | Service 层：DocumentService / CollectionService | `src/services/*.ts` | 🟢 | 2026-07-11 | 文档存管 + 合集管理 + 回收站 |
| 7.5 | hooks 胶水层 | `src/hooks/useDocument.ts` 等 | 🟢 | 2026-07-11 | useDocument / usePlan / useCollection |
| **Sprint 7 功能** | **5** | **5** | **0** | **100%** |

## Sprint 8：UI 组件拆分 + 能力增强

**目标**：EditorPane 拆分 + Skill 净化 + 向量加速

| # | 功能点 | 文件 | 状态 | 完成日 | 备注 |
|---|--------|------|------|--------|------|
| 8.1 | EditorPane → EditorPage + PlanPanel + EditorCanvas | `EditorPage.tsx` 等 | 🟢 | 2026-07-11 | 1910 行拆 5 个独立组件 |
| 8.2 | PlanPanel 内部 UI 拆分（5 个子组件） | `PlanPanel/` | 🟡 | 2026-07-11 | 已在 8.1 中由 PlanPanel 统一管理 StartuSplash 三状态，子拆分延迟到 v3.1 |
| 8.3 | AISidebar（AI/样式/审阅 tab 侧栏） | `AISidebar.tsx` | 🟢 | 2026-07-11 | 合并右侧面板，Cmd+B 切换 |
| 8.4 | Skill 纯净分离 — 去掉 systemPrompt | `domain/Skill.rs`, `services/PhaseConfigService.ts` | 🟢 | 2026-07-11 | Skill 只含元数据 + inputSchema |
| 8.5 | vector/search.rs ndarray 矩阵乘加速 | `vector/search.rs` | 🟢 | 2026-07-11 | 全量加载 → 矩阵运算 |
| 8.6 | 全量回归测试 + 发布 v3.0 | — | 🟢 | 2026-07-11 | cargo build + tsc + vite build + tag v3.0 |

| **Sprint 8 功能** | **6** | **6** | **0** | **100%** |
| **总计** | **151** | **147** | **4** | **97%** |

## 未完成旧代码迁移

v3.0 新架构代码已就位，但旧代码仍在使用中。详见 [20-migration-plan.md](20-migration-plan.md)。

| # | 旧文件 | 消费者 | 新替代 | 计划 Phase |
|---|--------|--------|--------|-----------|
| 1 | `storage/collections` | 25 个文件 | `services/CollectionService` | Phase 2 |
| 2 | `storage/articles.ts` | 10 个文件 | `services/DocumentService` | Phase 3 |
| 3 | `storage/providerModels` | 8 个文件 | `infrastructure/AIProvider` | Phase 2 |
| 4 | `lib/ai/article/blueprint` | 15 个文件 | `domain/Plan` + `services/PlanService` | Phase 3 |
| 5 | `store.rs` (DataStore) | 102 处 `store.` 引用 | `storage/Storage` trait | Phase 5 |
| 6 | `db.rs` (Database) | 25 处 `db::` 引用 | `storage/Storage` trait | Phase 5 |
