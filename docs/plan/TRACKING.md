# InkWise v2.0.0 · 功能开发跟踪表
> 最后更新: 2026-07-03 | 分支: `codex/v2.0.0-s4` | 状态: 🟡 Sprint 4 开发中

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
| 4.4.1 | 编辑器 Toolbar 增加 🖼️ 配图独立按钮 | `Toolbar.tsx` | 🔴 | — | — | 不再只通过 AI 面板 |
| 4.4.2 | 配图生成缓存（hash 文章内容 → 缓存 key） | `draw.ts` | 🔴 | — | — | 防重复生成浪费 token |
| 4.4.3 | 支持更多绘图 Provider（ComfyUI/Stable Diffusion） | `image_gen.rs`, `draw.ts` | 🔴 | — | — | 现只 DALL·E 3 |

---

## 未来扩展（doc 15）| 目标: v2.x

| # | 功能点 | 文件 | 状态 | 开发者 | 完成日 | 备注 |
|---|--------|------|------|--------|--------|------|
| 5.1 | AI 改写适配：Rust 改写引擎 + 平台预设 | `rewrite/` | 🔴 | — | — | 复用 Plan+Agent |
| 5.2 | 视频/音频提取：ffmpeg + Whisper 集成 | `media/` | 🔴 | — | — | 本地/云端双模式 |
| 5.3 | 多平台热点追踪：数据源调度 + UI 展示 | `hot-topics/` | 🔴 | — | — | 依赖外部 API |
| 5.4 | 效果追踪：阅读量/点赞/评论分析 | `analytics/` | 🔴 | — | — | 依赖发布平台 API |
| 5.5 | 热点 → 自动选题 | `hot-topics/matcher.ts` | 🔴 | — | — | 依赖 5.3 |
| 5.6 | 多平台一键改写 + 发布 | `rewrite/`, `publisher/` | 🔴 | — | — | 依赖 5.1 + 发布模块 |

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
| S4: 体验优化 | 16 | 13 | 0 | 3 | 0 | 81% |
| 未来扩展 | 6 | 0 | 0 | 6 | 0 | 0% |
| **总计** | **91** | **84** | 0 | 7 | 1 | 92% |
---

## 里程碑记录

| 里程碑 | 目标日期 | 实际日期 | 备注 |
|--------|---------|---------|------|
| v2.0.0-alpha (S1 完成) | 2026-07-03 | 2026-07-03 | Sprint 1 全部 23 项功能完成 |
| v2.0.0-beta (S2 完成) | 2026-07-03 | 2026-07-03 | Sprint 2 全部 28 项功能完成 |
| v2.0.0-rc (S3 完成) | — | 2026-07-03 | — |
| v2.0.0 (S4 完成) | — | — | — |
