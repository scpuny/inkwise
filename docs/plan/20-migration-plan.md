# 20 — v3.0 渐进迁移计划

> 目标：在不破坏现有功能的前提下，将 v3.0 架构落地到所有 UI 组件
> 策略：**触碰原则** — 改哪个文件就顺手切到新架构
> 周期：Sprint 9-11，约 4 周

---

## 现状速览

```
旧架构（删不得）                      新架构（没人用）
─────────────────                    ─────────────────
storage/collections — 25 消费者       domain/         — 8 消费者（仅内部）
storage/articles    — 10 消费者       services/       — 2 消费者（仅 hooks）
storage/blueprint   — 15 消费者       infrastructure/ — 3 消费者（仅服务层）
storage/providerModels — 8 消费者     hooks/          — 0 UI 消费者
storage/platforms   — 5 消费者        
store.rs            — 102 处引用（lib.rs）
db.rs               — 25 处引用（8 文件）
```

**核心问题**：新架构代码已存在，但没有任何一个 UI 组件实际使用它。

---

## 迁移原则

1. **不批量重写** — 每次只动一个模块，改完测试通过再动下一个
2. **触碰优先** — 需要改某个文件时，顺带把它从旧存储切到新服务
3. **旧代码不删，直到零引用** — 最后一步才是删除旧文件
4. **每个阶段可回滚** — 每个 PR 独立，出问题只影响一个模块

---

## Phase 1：连接 hooks → UI（P0 · 2 天）

**目标**：让 `useDocument`/`usePlan`/`useCollection` 真正可用，被 UI 组件实际调用

### 步骤

| # | 任务 | 涉及文件 | 工作量 |
|---|------|---------|--------|
| 1.1 | 补全 `useDocument`：实现 `load()` / `save()` / `create()` 完整功能，不再依赖外部 store | `hooks/useDocument.ts` | 4h |
| 1.2 | 补全 `usePlan`：实现 `startPlan()` / `continueToOutline()` / `confirmPlan()` 完整流程 | `hooks/usePlan.ts` | 4h |
| 1.3 | 补全 `useCollection`：实现 `listCollections()` / `createCollection()` / `trashArticle()` | `hooks/useCollection.ts` | 4h |
| 1.4 | 确保 hooks 调用 `infrastructure/` 接口而非旧 storage 函数 | 各 infrastructure 实现 | 2h |

**验证标准**：三个 hook 文件自身的测试通过，不依赖旧存储层

---

## Phase 2：Sidebar 迁移（P0 · 3 天）

**目标**：侧边栏组件（25 个 collections 消费者中最核心的）切换到新 hooks

### 依赖链

```
Sidebar.tsx                          ← 目前直接调 storage/collections
├── CollectionTree.tsx               ← 调 loadCollections/trashArticle/saveBlueprint
├── SearchPanel.tsx                  ← 调 loadCollections
├── OutlinePanel.tsx                 ← 调 outline 同步
└── ProjectPanel.tsx                 ← 调 getStoredProjectInsights
```

### 步骤

| # | 任务 | 旧代码 | 新代码 |
|---|------|--------|--------|
| 2.1 | `CollectionTree` 改用 `useCollection` | `loadCollections()` → `collectionService.list()` | 1d |
| 2.2 | `SearchPanel` 改用 `useCollection` | `loadCollections()` → `collectionService.search()` | 0.5d |
| 2.3 | 侧边栏状态管理从 `loadTrash` → `collectionService.listTrash()` | `loadTrash` → `useCollection().trash` | 0.5d |
| 2.4 | 验证 + 修类型 | 类型检查 | 1d |

**验证标准**：侧边栏展开、文集切换、搜索、回收站全部正常

---

## Phase 3：EditorPane 状态迁移（P0 · 4 天）

**目标**：EditorPane（1910 行，10 处旧引用）逐步切换到 hooks

### 现状

```
EditorPane.tsx                   ← 引用 10 处旧存储 + 多处旧 blueprint
├── loadArticleContent()         ← storage/articles (旧)
├── saveArticleContent()         ← storage/articles (旧)
├── loadArticleDocument()        ← storage/articleDocument (旧)
├── saveArticleDocument()        ← storage/articleDocument (旧)
├── loadBlueprint()              ← lib/ai/article/blueprint (旧)
├── saveBlueprint()              ← lib/ai/article/blueprint (旧)
├── loadCollections()            ← storage/collections (旧)
├── getCollectionFolderContext() ← storage/collections (旧)
├── saveVersionSnapshot()        ← storage/articleVersions (旧)
└── getProvidersSync()           ← storage/providerModels (旧)
```

### 步骤

| # | 任务 | 旧→新 |
|---|------|--------|
| 3.1 | 文章加载：`loadArticleContent` + `loadArticleDocument` → `useDocument().load()` | 1d |
| 3.2 | 文章保存：`saveArticleContent` + `saveArticleDocument` → `useDocument().save()` | 0.5d |
| 3.3 | 蓝图操作：`loadBlueprint` + `saveBlueprint` → `useDocument().blueprint` | 1d |
| 3.4 | 合集操作：`loadCollections` + `getCollectionFolderContext` → `useCollection()` | 0.5d |
| 3.5 | 版本/提供商：`saveVersionSnapshot` + `getProvidersSync` → 基础设施层 | 0.5d |
| 3.6 | 移除旧 import，验证类型检查 | 0.5d |

**验证标准**：新建文档、打开已有文档、规划流程、写作流程全部正常

---

## Phase 4：文章管理器迁移（P1 · 2 天）

**目标**：`ArticleManager.tsx` + `ArticleFinalPage.tsx` 等切换到新 hooks

### 步骤

| # | 文件 | 旧→新 |
|---|------|--------|
| 4.1 | `ArticleManager.tsx` | `loadArticleContent`/`saveArticleContent` → `useDocument()` | 1d |
| 4.2 | `ArticleFinalPage.tsx` | `loadArticleContent`/`loadArticleMeta`/`loadArticleDocument` → `useDocument()` | 1d |

---

## Phase 5：Rust 后端迁移（P1 · 3 天）

**目标**：减少 lib.rs 中 102 处 `store.` 引用

### 步骤

| # | 任务 | 方法 | 工作量 |
|---|------|------|--------|
| 5.1 | `AppState` 包装 DataStore + SqliteStorage | 新增 AppStorage struct 统一管理 | 1d |
| 5.2 | 逐命令迁移：文章/合集类命令改为调 Storage trait | 每次改 5-8 个命令 | 1d |
| 5.3 | 逐命令迁移：技能/设置/提供商类命令 | 同上 | 1d |
| 5.4 | `lib.rs` `store.` 引用清零后删除 `store.rs` | 最终清理 | 0.5d |

---

## Phase 6：最终清理（P2 · 2 天）

**目标**：所有旧引用清零，删除旧文件

| # | 任务 | 条件 |
|---|------|------|
| 6.1 | 删除 `storage/articles.ts` | Phase 3 完成 |
| 6.2 | 删除 `storage/articleDocument.ts` | Phase 3 完成 |
| 6.3 | 删除 `storage/collections/` | Phase 2+3+4 完成 |
| 6.4 | 删除 `lib/ai/article/blueprint.ts` | Phase 3 完成 |
| 6.5 | 删除 `storage/providerModels.ts` | 前端全部切到 AIProvider 接口 |
| 6.6 | 删除 `storage/platforms.ts` | 前端全部切到新 publish service |
| 6.7 | 删除 `store.rs` | Phase 5 完成 |
| 6.8 | 更新 `TRACKING.md` 标记所有旧文件已删除 | 全完成 |

---

## 阶段甘特图

```
Week 1                  Week 2                  Week 3                  Week 4
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Phase 1: Hooks  │     │ Phase 2: Sidebar│     │ Phase 3: Editor │     │ Phase 4-5:       │
│ 补全             │     │ 迁移             │     │ 迁移             │     │ Manager + Rust   │
│                 │     │                 │     │                 │     │                 │
│ useDocument     │     │ CollectionTree  │     │ load→useDoc()   │     │ ArticleManager  │
│ usePlan         │     │ SearchPanel     │     │ save→useDoc()   │     │ ArticleFinal    │
│ useCollection   │     │ Trash           │     │ blueprint→Doc   │     │ Rust store→     │
│                 │     │                 │     │ version→infra   │     │ Storage trait   │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
                                                                        ┌─────────────────┐
                                                                        │ Phase 6:        │
                                                                        │ 清理             │
                                                                        │ delete old files│
                                                                        └─────────────────┘
```

---

## 风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| Hook 实现不完整导致生产 bug | 中 | 高 | 每个 Phase 完成后 playright 跑全量 e2e |
| 旧文件引删除漏了 | 中 | 中 | 删除前跑 `grep -r "storage/articles" src/` 确认零引用 |
| Rust store.rs 102 处引用迁移遗漏 | 中 | 高 | cargo check 零 error = 全改完 |
| 迁移周期过长（>4 周） | 中 | 低 | 每个 Phase 独立 PR，不阻塞其他开发 |

---

## 验证清单

最终验收条件：

- [ ] `grep -r "from.*storage/articles" src/` — 零结果
- [ ] `grep -r "from.*storage/collections" src/` — 零结果
- [ ] `grep -r "from.*articleDocument" src/` — 零结果
- [ ] `grep -r "from.*blueprint" src/` — 零结果（允许 domain 引用）
- [ ] `grep -rn "store\." src-tauri/src/lib.rs` — 零结果
- [ ] `cargo check` — 0 errors
- [ ] `tsc --noEmit` — 0 errors
- [ ] `rm src-tauri/src/store.rs` — 成功（已无引用）
- [ ] `rm src/lib/storage/articles.ts` — 成功（已无引用）
- [ ] `rm src/lib/storage/articleDocument.ts` — 成功（已无引用）
- [ ] `rm -rf src/lib/storage/collections` — 成功（已无引用）
