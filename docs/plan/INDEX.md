# InkWise 架构方案索引

> **当前版本**: v2.1.0-alpha | **下一版本**: v3.0（设计方案） | 最后更新: 2026-07-11

---

## 现状：v2.x 已完成的工作

Sprint 1-5 已全部完成并发布（`v2.0.0` → `v2.1.0-alpha`），细节见 [TRACKING.md](TRACKING.md)。

已解决的 v1.x 问题：
- 数据一致性、删除级联、风格/动作分离、回收站修正
- 技能系统统一、模块重构、UX 改造、agent 统一
- Query AST、向量嵌入、增量扫描
- Context Planner、新技能、主题系统精简
- ArticleDocument 统一生命周期上下文

---

## 核心问题（v3.0 待解决）

| # | 问题 | 严重度 | 涉及文档 |
|---|------|--------|---------|
| 01 | **存储碎片化**：数据散在 4 个后端（SQLite/JSON/ls/文件）× 17+ 存储文件，同一内容存 5 处无同步保证 | P0 | [19-architecture-rewrite](19-architecture-rewrite.md) |
| 02 | **层混叠**：UI/Service/Domain/AI 互相混调，EditorPane 1910 行 | P0 | 同上 |
| 03 | **Skill 和 PhaseConfig 混淆**：Skill 结构体嵌 systemPrompt，加新技能要改 5 个文件 | P0 | 同上 |
| 04 | **无统一分层**：没有 Service/Domain/Infrastructure 边界，无法测试无法 mock | P1 | 同上 |
| 05 | **UI 状态机过于复杂**：planState 5 种状态，组件间事件耦合紧 | P1 | 同上 |
| 06 | **旧代码堆积**：store.rs JSON 读写 + articles.ts + articleDocument.ts 三个存储层并存 | P1 | 同上 |
| 07 | **回收站独立存储**：trash.json 可以用 Document.deletedAt 替代 | P1 | 同上 |

---

## 方案文档索引

| # | 文档 | 核心内容 | 状态 |
|---|------|---------|------|
| — | **[INDEX.md](INDEX.md)** | **方案索引（本文档）** | 🟢 |
| 01-17 | v2.x 遗留文档 | Sprint 1-5 方案（已实施） | ✅ 历史 |
| **18** | **[ArticleDocument](18-article-document.md)** | 统一文章生命周期上下文 | 🟢 Sprint 5 |
| **19** | **[架构重构 v3.0](19-architecture-rewrite.md)** | **完整方案：存储统一 + 分层拆分 + 净化** | 🟡 **设计方案** |

---

## v3.0 方案全景

```
┌─────────────────────────────────────────────────────────────────┐
│                     Infrastructure Layer                        │
│  SQLite（唯一事实源） → 废除 JSON + localStorage 业务数据       │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ documents  │  documents_fts  │  vector_chunks         │     │
│  │ collections│  series_plans   │  publish_records       │     │
│  │ providers  │  platform_configs│ settings               │     │
│  │ skills     │  phase_configs  │  article_images         │     │
│  └────────────────────────────────────────────────────────┘     │
│  文件系统：仅存图片 + 用户可见的 .md + packages/{id}/            │
│  localStorage：仅存系统主题偏好                                  │
│  ┌────────────────────────────────────────────────────────┐     │
│  │  +3 市场表：installed_packages / templates / template_skills│     │
│  └────────────────────────────────────────────────────────┘     │
├─────────────────────────────────────────────────────────────────┤
│                     Domain Layer                                │
│  Document（聚合根） | Skill（元数据） | PhaseConfig（模板）      │
│  Collection（容器） | SeriesPlan（编排）                         │
├─────────────────────────────────────────────────────────────────┤
│                     Service Layer                                │
│  PlanService  │  WriteService  │  DocumentService                │
│  PublishService│ ReviewService  │ CollectionService              │
│  TrashService  │  SkillService  │  AIService                     │
│  PackageService│ MarketplaceService │ TemplateService             │
│  编排流程 → 调 Domain 逻辑 → 调 Infrastructure 接口             │
├─────────────────────────────────────────────────────────────────┤
│                     UI Layer                                     │
│  EditorPage（~80行容器） + PlanPanel + EditorCanvas              │
│  AIActionBar + AISidebar（tab 侧栏，`Cmd+B` 切换）               │
│  只做渲染 + 事件绑定，状态由 Service 管理                        │
└─────────────────────────────────────────────────────────────────┘
```

### 核心原则

| 原则 | 说明 |
|------|------|
| **SQLite 唯一事实源** | 所有业务数据进 SQLite，不 split 到 JSON/localStorage |
| **Document 聚合根** | 一个 Document 包含一切（内容/元数据/样式/审阅/回收站状态） |
| **Skill 不含 AI** | Skill 只有 id/name/desc/icon，systemPrompt 在 PhaseConfig |
| **Service 编排不混 IO** | Service 调 Domain + Infrastructure 接口，不直接调 Tauri invoke |
| **UI 纯渲染** | 组件不包含业务逻辑，状态通过 Service 获取 |
| **市场就绪架构** | Package 统一基类，3 张表 + 3 个 Service 预留，加市场不改存储层 |

### 被清除的旧代码

| 删除 | 原因 |
|------|------|
| `store.rs` 中全部 JSON 读写方法 | SQLite 替代 |
| `articles/{id}.md` 独立文件 | 合并到 documents.content |
| `articles/{id}.meta.json` | 合并到 documents 表字段 |
| `articles/{id}.blueprint.json` | 合并到 documents.outline |
| `documents/{id}.json` | 合并到 documents 表 |
| `data/*.json` × 8 个文件 | 数据在 SQLite |
| `StorageEngine` 的 localStorage 写缓存 | 不需要，SQLite 直接读写 |
| `articleDocument.ts` | 合并到 DocumentService |
| `articles.ts` | 合并到 DocumentService |
| `articleVersions.ts` | 版本在 documents 表 |
| `trash.json` | Document.deletedAt 替代 |
| EditorPane 1700 → 拆为 5 个组件 | 组件职责明确 |

---

## 实施路线

```
Sprint 6（2 周）：存储统一 + Rust 后端模块拆分
  目标：SQLite 唯一事实源，lib.rs 2139→拆 commands/ + storage/ + domain/ + ai/
  ├── 周1：domain/ 类型定义 → storage/ (trait + sqlite + migration)
  ├── 周2：commands/ 迁移 + ai/ 拆分 → 前端适配
  └── 产出：v3.0-s6 分支，稳定后合并 main

Sprint 7（2 周）：分层拆分
  目标：UI/Service/Domain/Infrastructure 四层清晰
  ├── 周1：Domain + Infrastructure 接口定义
  ├── 周2：Service 层提取 + hooks 胶水层
  └── 产出：v3.0-s7 分支

Sprint 8（2 周）：UI 拆分 + 能力增强
  目标：EditorPane 1910→拆 5 组件 + Skill 净化 + 向量加速
  ├── 周1：EditorPage + PlanPanel + EditorCanvas + AIActionBar
  ├── 周2：AISidebar + Skill 净化 + ndarray 向量加速
  └── 产出：v3.0 正式发布
```

### 重写 vs 适配 vs 保留统计

| 分类 | 文件数 | 行数 | 占比 |
|------|--------|------|------|
| 🔴 重写 | ~20 文件 | ~12,000 行 | 17% |
| 🟡 适配 | ~30 文件 | ~15,000 行 | 22% |
| 🟢 保留 | ~40 文件 | ~42,000 行（含 CSS 27k） | 61% |
| **总计** | **~90 文件** | **~69,000 行** | 100% |

---

## 版本分支

```
main → v2.1.0-alpha
  └── codex/v3.0-s6     Sprint 6（存储统一）
  └── codex/v3.0-s7     Sprint 7（分层拆分）
  └── codex/v3.0-s8     Sprint 8（功能增强）
  └── v3.0              正式发布
```
