# Changelog

## [3.0.0] — 2026-07-12

### 🏆 架构重构里程碑

InkWise v3.0 是一次**从底到顶的全量架构重构**，覆盖 Rust 后端、前端分层、存储统一和组件拆分。v2.0.0 的所有业务功能保持兼容，代码结构彻底重塑。

### ⚡ 存储统一

- **统一存储访问**：旧 JSON 文件 + localStorage + 桥接层三套存储方案整合，全部通过 `TauriDocumentStore` / `TauriSettingsStore` 桥接层访问
- **SQLite 作为唯一事实源**：所有业务数据写入 SQLite，JSON 文件作为安全网保留
- **所有旧存储非桥接消费者清零**：`storage/collections`、`storage/articles`、`storage/articleDocument`、`storage/providerModels`、`storage/platforms`、`storage/articleVersions`、`lib/ai/article/blueprint` — **7 个旧模块全部仅通过桥接层访问** ✅

### 🧱 Rust 后端重构

- **模块拆分**：`lib.rs` 从 2139 行拆分为 `commands/`、`storage/`、`domain/`、`ai/` 四个模块目录
- **AppStorage 统一层**：`storage/app_storage.rs`（~300 行）包装 DataStore（JSON）+ Database（SQLite），提供约 40 个统一方法，内部处理 Mutex 锁定
- **AppState 精简**：从 5 字段（store + db + watcher + project + embedder）精简为 4 字段（storage + watcher + project + embedder）
- **向量搜索加速**：`vector/search.rs` 重写为 ndarray 矩阵乘（`Array2::from_shape_vec` + `dot`），消除逐行 cosine 计算
- **域类型独立**：`domain/` 模块从 `store.rs` 剥离，新增 `#[serde(rename_all = "camelCase")]` 保证前后端命名一致
- **死代码清理**：删除 8 处迁移残留函数 + 修复 3 处过期 API（base64/ndarray），Rust warnings 从 29 降到 13（均为预留架构代码）

### 🏗️ 前端四层架构

- **domain/**：纯数据定义，零外部依赖 — `Document`、`Collection`、`Plan`、`Project`、`Provider`、`Publish`、`enums` 共 8 个文件
- **infrastructure/**：接口抽象 — `DocumentStore`、`AIProvider`、`SettingsStore`、`EventBus` + 3 个 Tauri 桥接实现
- **services/**：业务编排 — `DocumentService`、`CollectionService`、`PlanService`、`SettingsService`、`PhaseConfigService`
- **hooks/**：React 胶水层 — `useDocument`、`useCollection`、`usePlan`、`useSettings`
- **全量 60+ UI 组件**：均通过 hooks 访问数据，不再直接引用旧存储

### ✂️ UI 组件拆分

- **EditorPane（1910 行 → 5 组件）**：拆分为 `EditorCanvas` + `PlanPanel` + `AISidebar` + `EditorSaveIndicator` + `ArticleHeader`
- **AISidebar**：AI 聊天、样式配置、审阅面板合并为 tab 侧栏，`Cmd+B` 切换
- **PlanPanel**：新建文档三态（欢迎页 / 加载中 / 规划审阅）统一管理

### 🔄 渐进迁移（Phase 1-6 + Batch 1-8）

- **30+ 文件**逐步从旧 `storage/` 迁移到新架构
- **触碰原则**：改到哪个文件就顺手切到新 hooks
- **100% 类型安全**：所有旧存储类型引用迁移到 `domain/`

### 🧹 代码质量

- **常量枚举体系**：`domain/enums.ts` 消除魔法字符串（Phase / PlanStep / DocumentPhase / EventName / Cmd）
- **Skill 净化**：Skill 只保留元数据（id/name/desc/icon/inputSchema），systemPrompt 移入 `PhaseConfigService`
- **前后端命名一致**：Rust struct 统一 `#[serde(rename_all = "camelCase")]`
- **市场预留架构**：`Package` 基类（skill/template/theme 三类）为未来插件市场做准备

---

## [2.1.0-alpha] — 2026-07-07

### 新增

- **ArticleDocument 统一上下文**：文章唯一聚合根，包含 styleId/actionId/tone/outline/tags/publishRecords/reviewState，替代原先 5 处分散存储

### 修复

- **版本号显示不一致**：Vite `define` 注入 `__APP_VERSION__` 消除硬编码
- **回收站操作无响应**：`@tauri-apps/plugin-dialog` 原生 confirm 替代 `window.confirm()`
- **UTF-8 截断乱码**：累积原始 `Vec<u8>` 只在完整 SSE event 边界解码
- **AI 输出泄露思考链**：system prompt 追加抑制指令
- **中英混杂输出**：补全 tone/targetAudience/targetWordCount 字段
- **新建文档标题/简介不生成**：重写 `handleStartPlan`，规划即创建 ArticleDocument

---

## [2.0.0] — 2026-07-05

### Sprint 1-5 功能合入

- **数据一致性**：loadCollections 统一入口，SQLite FTS5 搜索，保存失败 toast 提示
- **删除级联**：trashArticle / removeCollection / deleteSeriesPlan 级联清理 SQLite + 向量索引
- **回收站逻辑修正**：软删除（移出合集列表）+ 物理删除（永久清理）+ 可恢复
- **风格/动作分离**：WritingStyle + WritingAction 类型定义，agent 执行上下文拼接
- **架构重塑**：agent 统一、模块拆分、UX 改造
- **智能增强**：Query AST、向量嵌入、增量扫描
- **体验优化**：Context Planner、新技能、主题系统精简
- **技能系统**：21 种预设写作风格 + 5 种写作动作
- **主题系统**：6 种风格 × 3 种模式 × 4 种字号 × 6 种字体
- **发布功能**：支持自定义 API 发布，自动 markdown→HTML 编译

---

## [1.10.0] — 2026-06-20

初始功能版本：基础编辑器、AI 写作、合集管理、系列规划、回收站、版本历史。
