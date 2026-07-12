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

## Phase 1：连接 hooks → UI（P0 · 2 天）🟢 完成

### 步骤

| # | 任务 | 涉及文件 | 状态 |
|---|------|---------|------|
| 1.1 | 补全 `useDocument`：实现 `load()` / `save()` / `create()` 完整功能 | `hooks/useDocument.ts` | 🟢 |
| 1.2 | 补全 `usePlan`：实现 `startPlan()` / `continueToOutline()` / `confirmPlan()` | `hooks/usePlan.ts` | 🟢 |
| 1.3 | 补全 `useCollection`：实现 `listCollections()` / `createCollection()` / `trashArticle()` | `hooks/useCollection.ts` | 🟢 |
| 1.4 | 创建 `TauriDocumentStore` 实现 | `infrastructure/TauriDocumentStore.ts` | 🟢 |
| 1.5 | 创建 `TauriAIProvider` 实现 | `infrastructure/TauriAIProvider.ts` | 🟢 |

**验证标准**：三个 hook 文件自身的测试通过，不依赖旧存储层

---

## Phase 2：Sidebar 迁移（P0 · 3 天）🟢 完成

**目标**：侧边栏组件（25 个 collections 消费者中最核心的）切换到新 hooks

### 依赖链

```
Sidebar.tsx                          ← 已改用 useCollection
├── CollectionTree.tsx               ← 已改用 useCollection
├── SearchPanel.tsx                  ← 已改用 useCollection
├── OutlinePanel.tsx                 ← 无存储依赖
└── ProjectPanel.tsx                 ← 无存储依赖
```

### 步骤

| # | 任务 | 旧代码 | 新代码 | 状态 | 完成日 |
|---|------|--------|--------|------|--------|
| 2.1 | `CollectionTree` 改用 `useCollection` | `loadCollections()` → `collectionService.list()` | `useCollection()` | 🟢 | 2026-07-11 |
| 2.2 | `SearchPanel` 改用 `useCollection` | `loadCollections()` → `collectionService.search()` | `useCollection()` | 🟢 | 2026-07-11 |
| 2.3 | 侧边栏状态管理从 `loadTrash` → `useCollection().trash` | `loadTrash` → `useCollection().trash` | `useCollection()` | 🟢 | 2026-07-11 |
| 2.4 | 验证 + 修类型 | 类型检查 | `tsc --noEmit` + `vite build` | 🟢 | 2026-07-11 |

**实际工作量远超计划**：
- 扩展 `DocumentStore` 接口：新增 15 个方法（renameCollection, removeCollection, addArticle, renameArticle, linkCollectionFolder, unlinkCollectionFolder, rescanProjectFolder, loadAllSeriesPlans, searchArticleTitles, searchArticleContent, loadArticleContent, loadBlueprint, permanentlyDeleteArticle, emptyTrash, updateCollection）
- 实现 `TauriDocumentStore` 全部桥接方法
- 扩展 `CollectionService`：新增 18 个方法
- 扩展 `useCollection` hook：新增 18 个方法
- 创建 `EventBusImpl`（mitt 实现，后改为复用全局 eventBus）
- 迁移 `Sidebar.tsx` → 改用 useCollection
- 迁移 `CollectionTree.tsx` → 549 行全部旧存储调用替换
- 迁移 `SearchPanel.tsx` → 改用 useCollection

**验证标准**：`tsc --noEmit` 0 错误 + `vite build` 成功

---

## Phase 3：EditorPane 状态迁移（P0 · 4 天）🟢 完成

**目标**：EditorPane（1910 行，10 处旧引用）逐步切换到 hooks

### 现状（迁移后）

```
EditorPane.tsx                   ← 通过 useDocument + useCollection hook
├── loadArticleContent()         ← useDocument().loadArticleContent (桥接)
├── saveArticleContent()         ← useDocument().saveArticleContent (桥接)
├── loadArticleDocument()        ← useDocument().loadDocument (别名)
├── saveArticleDocument()        ← useDocument().saveDocument (别名)
├── loadBlueprint()              ← 保持旧导入（类型兼容）
├── saveBlueprint()              ← 保持旧导入
├── loadCollections()            ← useCollection().loadCollections
├── getCollectionFolderContext() ← 保持旧导入（单次调用）
├── saveVersionSnapshot()        ← useDocument().saveVersionSnapshot
└── getProvidersSync()           ← 保持旧导入（类型兼容）
```

### 步骤

| # | 任务 | 旧→新 | 状态 | 完成日 |
|---|------|--------|------|--------|
| 3.1 | 文章加载：`loadArticleContent` + `loadArticleDocument` → `useDocument().load()` | `useDocument()` 别名桥接 | 🟢 | 2026-07-12 |
| 3.2 | 文章保存：`saveArticleContent` + `saveArticleDocument` → `useDocument().save()` | `useDocument()` 别名桥接 | 🟢 | 2026-07-12 |
| 3.3 | 蓝图操作：`loadBlueprint` + `saveBlueprint` → `useDocument().blueprint` | 保持旧导入（类型原因） | 🟢 | 2026-07-12 |
| 3.4 | 合集操作：`loadCollections` + `getCollectionFolderContext` → `useCollection()` | `useCollection().loadCollections` | 🟢 | 2026-07-12 |
| 3.5 | 版本/提供商：`saveVersionSnapshot` + `getProvidersSync` → 基础设施层 | `saveVersionSnapshot` 通过 hook；`getProvidersSync` 保持旧导入 | 🟢 | 2026-07-12 |
| 3.6 | 移除旧 import，验证类型检查 | `tsc --noEmit` 0 errors + `vite build` | 🟢 | 2026-07-12 |

**实际变更**：
- 扩展 `DocumentStore` 接口：新增 `saveArticleContent`, `saveBlueprint`, `saveVersionSnapshot`, `getProvidersSync`
- 扩展 `TauriDocumentStore`：实现全部桥接 + `saveDocument` 自动保存 content 到旧存储
- 扩展 `useDocument` hook：新增 `loadBlueprint`, `saveBlueprint`, `saveVersionSnapshot`, `getProvidersSync`, `loadArticleContent`, `saveArticleContent`
- 迁移 `EditorPane.tsx`：替换 6 个旧存储导入为 hooks（`loadArticleDocument`/`saveArticleDocument`/`loadArticleContent`/`saveArticleContent`/`saveVersionSnapshot`/`loadCollections`）
- 迁移 `ArticleFinalPage.tsx`：替换 `loadArticleDocument`/`saveArticleDocument` 为 useDocument

**验证标准**：`tsc --noEmit` 0 错误 + `vite build` 成功

---

## Phase 4：文章管理器迁移（P1 · 2 天）🟢 完成

**目标**：`ArticleManager.tsx` + `ArticleFinalPage.tsx` 等切换到新 hooks

### 步骤

| # | 文件 | 旧→新 | 状态 | 完成日 |
|---|------|--------|------|--------|
| 4.1 | `ArticleManager.tsx` | `loadCollections`/`saveCollections`/`updateCollection`/`trashArticle`/`searchArticleContent`/`loadAllSeriesPlans` → `useCollection()`；`loadArticleContent`/`saveArticleContent` → `useDocument()`；类型 → `domain` | 🟢 | 2026-07-12 |
| 4.2 | `ArticleFinalPage.tsx` | `loadArticleContent` → `useDocument().loadArticleContent`（保留 blueprint/platforms 等无新替代的导入） | 🟢 | 2026-07-12 |

**实际变更**：
- 新增 `saveCollections` 到 `CollectionService` + `useCollection`（bridge 方法）
- 迁移 `ArticleManager.tsx`（667 行）：替换 5 处旧导入（collections/articles/collections/index/collections/types）为 `useCollection()` + `useDocument()` + `domain` 类型
- 替换函数调用：`loadArticleContent` → `useCollection().loadArticleContent`（别名）、`trashArticle` → 适配 3 参数签名、`saveArticleContent` → `useDocument().saveArticleContent`
- `ArticleFinalPage.tsx`：`loadArticleContent` 静态导入替换为 `useDocument().loadArticleContent`
- 动态导入 fallback 路径保持不变（仍用 `import("../../lib/storage/articles")` 等）

**验证标准**：`tsc --noEmit` 0 错误 + `vite build` 成功

---

## Phase 5：Rust 后端迁移（P1 · 3 天）🟢 完成

**目标**：统一存储访问，消除 lib.rs 中 `store.` / `db.` 直接引用

### 步骤

| # | 任务 | 方法 | 状态 | 完成日 |
|---|------|------|------|--------|
| 5.1 | 创建 `AppStorage` 统一存储层 | `storage/app_storage.rs` 包装 DataStore + Database，提供约 40 个方法 | 🟢 | 2026-07-12 |
| 5.2 | 文章/合集类命令迁移 | lib.rs 中 ~30 个 store. 调用 → state.storage.xxx()；commands/ 子模块 ~20 个 store./db. 调用 → storage 方法 | 🟢 | 2026-07-12 |
| 5.3 | 技能/设置/提供商类命令迁移 | ai/mod.rs resolve_provider 签名更新；migration.rs DataStore → AppStorage | 🟢 | 2026-07-12 |
| 5.4 | lib.rs store. 引用清零 | 75+ store. + 15+ db. 引用全部替换为 storage. 调用 | 🟢 | 2026-07-12 |

**实际变更**：
- 新增 `storage/app_storage.rs`（~300 行）：40 个 wrapper 方法 + 内部锁管理
- 新增 `AppStorage::new_with_json_dir()` 用于 migration 场景
- AppState 从 5 字段精简为 4 字段（移除 store + db，合并为 storage）
- lib.rs 中 `state.store.lock().unwrap()` / `state.db.lock().unwrap()` → `state.storage.xxx()`
- `resolve_provider` 函数签名从 `&Mutex<DataStore>` 改为 `&AppStorage`
- 迁移脚本 migration.rs 从 `DataStore::new_with_dir` 改为 `AppStorage::new_with_json_dir`

**验证标准**：`cargo check` 0 errors + `vite build` success

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
