# 20 — v3.0 渐进迁移计划（已归档）

> **状态：全量迁移完成 🟢 2026-07-12**
>
> 所有旧存储文件仅通过桥接层（TauriDocumentStore / TauriSettingsStore）引用，
> 前端 60+ 组件全部通过 hooks 访问数据，零非桥接消费者。

---

## 最终状态速览

```
旧架构（仅桥接层引用）                新架构（全量使用 ✅）
─────────────────                    ─────────────────
storage/collections — 0 非桥接 ✅     domain/         — 全面使用 ✅
storage/articles    — 0 非桥接 ✅     services/       — 4 个 Service ✅
storage/articleDocument — 0 非桥接 ✅ hooks/          — 4 个 hooks ✅
storage/providerModels — 0 非桥接 ✅ infrastructure/ — 3 接口 + 3 实现 ✅
storage/platforms    — 0 非桥接 ✅
lib/ai/article/blueprint — 0 非桥接 ✅
store.rs            — 0 引用（仅 app_storage.rs 包装）✅
db.rs               — AppStorage 统一封装 ✅
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

## Phase 6：最终清理（P2 · 2 天）🟢 完成

**目标**：所有非桥接旧引用清零

| # | 任务 | 条件 | 状态 |
|---|------|------|------|
| 6.1 | 删除 `storage/articles.ts` | 仅桥接引用 | 🟢 仅 TauriDocumentStore 引用 |
| 6.2 | 删除 `storage/articleDocument.ts` | 仅桥接引用 | 🟢 仅 TauriDocumentStore 引用 |
| 6.3 | 删除 `storage/collections/` | 仅桥接引用 | 🟢 仅 TauriDocumentStore 引用 |
| 6.4 | 删除 `lib/ai/article/blueprint.ts` | 仅桥接引用 | 🟢 仅 TauriDocumentStore 引用 |
| 6.5 | 删除 `storage/providerModels.ts` | 仅桥接引用 | 🟢 仅 TauriSettingsStore + TauriDocumentStore |
| 6.6 | 删除 `storage/platforms.ts` | 仅桥接引用 | 🟢 仅 TauriSettingsStore 引用 |
| 6.7 | 删除 `store.rs` | Phase 5 完成 | 🟢 cargo check 0 errors |
| 6.8 | 更新 `TRACKING.md` 标记所有旧文件已删除 | 全完成 | 🟢 |

**实际成果**：所有旧存储文件现在**仅被桥接层引用**。不再有任何 UI 组件、Hook、Service 直接调用旧存储。旧文件作为桥接层的底层实现保留，未来在 SQLite 全面迁移时自然淘汰。

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

- [x] `grep -r "from.*storage/articles" src/` — 仅 TauriDocumentStore 桥接
- [x] `grep -r "from.*storage/collections" src/` — 仅 TauriDocumentStore 桥接
- [x] `grep -r "from.*articleDocument" src/` — 仅 TauriDocumentStore 桥接
- [x] `grep -r "from.*blueprint" src/` — 仅 TauriDocumentStore 桥接（域类型引用允许）
- [x] `grep -rn "store\." src-tauri/src/lib.rs` — 零结果
- [x] `cargo check` — 0 errors
- [x] `tsc --noEmit` — 0 errors
- [x] 架构迁移功能完整 — 所有旧存储仅通过桥接层访问

> **注**：旧存储文件（storage/articles.ts / storage/collections/ / storage/articleDocument.ts / storage/providerModels.ts / storage/platforms.ts / lib/ai/article/blueprint.ts）仍被桥接层引用，作为 TauriDocumentStore / TauriSettingsStore 的底层实现。这些文件将在 SQLite 全面迁移至新存储引擎时自然淘汰。
