# InkWise 架构演进方案

> 版本: v1.0 | 状态: 设计阶段 | 日期: 2026-07-03

---

## 背景

基于对 InkWise 现有代码的全面审查，发现以下核心问题：

| # | 问题 | 严重度 | 涉及模块 |
|---|------|--------|---------|
| 1 | **数据多源头不一致**：Rust JSON / localStorage / SQLite 三套存储互相覆盖 | P0 | crud.ts, store.rs, db.rs |
| 2 | **删除级联遗漏**：删除合集不删子文章、回收站操作不清理向量和 SQLite | P0 | crud.ts, series.ts |
| 3 | **离线变更无法检测**：文件 watcher 只在运行时有效，关 app 后的变更完全丢失 | P0 | project_indexer.rs |
| 4 | **AST 遍历方式落后**：200 行手写 node_stack 遍历，而非 tree-sitter Query | P1 | project_indexer.rs |
| 5 | **缺少语义检索**：只能精确匹配符号名，无法语义搜索相关代码/文章 | P1 | 无（新模块） |
| 6 | **工具使用缺乏规划**：所有项目上下文一股脑塞给 AI，没有按意图裁剪 | P2 | agent.rs |
| 7 | **CodeGraph 角色模糊**：装了也不知能额外得到什么 | P2 | project_indexer.rs |

---

## 方案总览

整个演进分为 7 个有序步骤，每步独立可部署：

```
步骤 1: 数据一致性        →  单源头 + 统一 CRUD 入口
步骤 2: 删除级联          →  所有删除操作补全清理链
步骤 3: 离线增量扫描      →  三层降级策略 (git/mtime/hash)
步骤 4: Query 化 AST      →  tree-sitter Query 替代手写遍历
步骤 5: 本地向量嵌入      →  ONNX 模型 + 三层索引
步骤 6: Context Planner   →  按意图预检 → 精准上下文注入
步骤 7: 新技能注册        →  项目变动报告、影响评估等
```

---

## 文档索引

| 文档 | 核心内容 | 前置依赖 |
|------|---------|---------|
| [01-data-consistency.md](01-data-consistency.md) | 存储现状、单源头设计、CRUD 改造方案 | — |
| [02-deletion-cascade.md](02-deletion-cascade.md) | 删除/回收站操作的级联清理矩阵 | 01 |
| [03-incremental-scanning.md](03-incremental-scanning.md) | 三层降级扫描、IndexSnapshot、watcher 补齐 | 01 |
| [04-query-ast.md](04-query-ast.md) | tree-sitter Query 体系、三层 .scm 文件 | 03 |
| [05-vector-embedding.md](05-vector-embedding.md) | ONNX 模型选择、chunk 策略、增量索引 | 03, 04 |
| [06-context-planner.md](06-context-planner.md) | 意图识别、预检路由、精准注入 | 04, 05 |
| [07-new-skills.md](07-new-skills.md) | 项目变动报告、影响评估、智能工具选择 | 06 |
| [08-codegraph-role.md](08-codegraph-role.md) | CodeGraph 定位：可选加速器 vs 向量互补 | 04, 05 |

---

## 优先级路线图

```
P0（当前 Sprint）
├── 01-data-consistency: 修复数据一致性问题
├── 02-deletion-cascade: 补全删除级联
└── 03-incremental-scanning: 离线启动检测 + watcher 补齐

P1（下个 Sprint）
├── 04-query-ast: tree-sitter Query 重构
└── 05-vector-embedding: ONNX 模型 + 三层向量索引

P2（未来 Sprint）
├── 06-context-planner: 意图预检
└── 07-new-skills: 新技能注册
└── 08-codegraph-role: 文档澄清 + UI 优化
```

| 5 | **"风格"和"动作"混淆为 skill**：文章绑定风格后后续操作丢失风格上下文 | P0 | skill.rs, agent.rs, plan.ts |
| 6 | **审阅不感知风格**：5 维度硬编码，不匹配当前写作风格 | P1 | articleReview.ts |
| 7 | **1585 行 editorStyles.ts**：编辑器/模板/导入导出耦合成一个文件 | P1 | editorStyles.ts |
| 8 | **markdown 手写解析器**：易遗漏 edge case | P1 | markdown/renderer.ts |

---

## 完整文档索引

| 文档 | 核心内容 |
|------|---------|
| [INDEX.md](INDEX.md) | 方案索引 + 优先级路线图（本文档） |
| [01-data-consistency.md](01-data-consistency.md) | 存储现状、单源头设计、CRUD 改造方案 |
| [02-deletion-cascade.md](02-deletion-cascade.md) | 删除/回收站操作的级联清理矩阵 |
| [03-incremental-scanning.md](03-incremental-scanning.md) | 三层降级扫描、IndexSnapshot、watcher 补齐 |
| [04-query-ast.md](04-query-ast.md) | tree-sitter Query 体系、三层 .scm 文件 |
| [05-vector-embedding.md](05-vector-embedding.md) | ONNX 模型选择、chunk 策略、增量索引 |
| [06-context-planner.md](06-context-planner.md) | 意图识别、预检路由、精准注入 |
| [07-new-skills.md](07-new-skills.md) | 项目变动报告、影响评估、智能工具选择 |
| [08-codegraph-role.md](08-codegraph-role.md) | CodeGraph 定位：可选加速器 vs 向量互补 |
| [09-skill-system-review.md](09-skill-system-review.md) | 技能系统缺陷分析 + UnifiedSkill 统一契约 |
| [10-theme-system-review.md](10-theme-system-review.md) | 文章主题缺陷分析 + 类型语义化 + 25→12 精简 |
| [11-architecture-restructure.md](11-architecture-restructure.md) | 整体架构重塑原则 + 目标模块树 |
| [12-feature-map.md](12-feature-map.md) | 完整功能地图 + 11 个业务域逐功能审查 |

## 优先级路线图

```
P0（当前 Sprint）
├── 01-data-consistency: 修复数据一致性问题
├── 02-deletion-cascade: 补全删除级联
├── 03-incremental-scanning: 离线启动检测 + watcher 补齐
└── 12-skill-business-redesign: 风格/动作拆分 + 审阅感知风格（核心业务修复）

P1（下个 Sprint）
├── 04-query-ast: tree-sitter Query 重构
├── 05-vector-embedding: ONNX 模型 + 三层向量索引
├── 09-skill-system-review: UnifiedSkill 统一契约
├── 10-theme-system-review: 主题类型精简
└── 11-architecture-restructure: 模块重组（editorStyles 拆分等）

P2（未来 Sprint）
├── 06-context-planner: 意图预检
├── 07-new-skills: 新技能注册
├── 08-codegraph-role: 文档澄清 + UI 优化
└── 12-feature-map: 持续更新功能地图
```

| 文档 | 核心内容 |
|------|---------|
| [14-ux-review.md](14-ux-review.md) | 前端 UX 易用性审查 + 布局调整方案 + 14 个问题 |
