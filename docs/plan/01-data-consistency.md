# 01 — 数据一致性：单源头设计

> 关联: INDEX.md, 02-deletion-cascade.md

---

## 现状

### 三套存储

```
Rust JSON (~/.inkwise/data/)
├── collections.json        ← 合集 + 文章元信息
├── articles/{id}.md        ← 文章内容
├── articles/{id}.meta.json ← 文章元信息
├── articles/{id}.blueprint.json
├── trash.json / providers.json / settings.json / ...

Rust SQLite (~/.inkwise/data/inkwise.db)
├── articles  (含 content 全文)
├── collections
├── article_images
├── article_fts  (FTS5 全文索引)

前端 localStorage
├── inkwise-collections          ← 合集缓存（组件直接读）
├── article:{id}                ← 文章内容缓存
├── meta:{id}                   ← 元信息缓存
├── plan-draft-{id}             ← 草稿缓存
├── editor-* / theme-* / ...    ← 配置
└── inkwise-custom-skills       ← 自定义技能
```

### 三个问题

**问题 1：Rust JSON ↔ localStorage 双写不同步**

`saveCollections()` 同时写 Rust JSON 和 localStorage，但部分组件不走 `loadCollections()`，直接用 `browserLoad()` 读 localStorage：

```
// ❌ 以下代码绕过 CRUD 层，直接读缓存
src/components/sidebar/CollectionTree.tsx:199
src/components/collections/ArticleManager.tsx:104
src/components/collections/useCollectionCrud.ts:22
```

**问题 2：Rust JSON ↔ SQLite 双写不同步**

`save_article` 写 JSON (`{id}.md`)，`save_article_db` 写 SQLite。前端需要手动调两次，无事务保证。

**问题 3：数据冗余**

同一篇文章的 content 同时存在：

| 存储 | 路径 | 用途 |
|------|------|------|
| Rust JSON | `articles/{id}.md` | **权威存储** |
| SQLite | `articles.content` | FTS 全文搜索 |
| localStorage | `article:{id}` | 前端缓存 |

---

## 设计方案：单源头 + 统一读

### 核心原则

1. **Rust JSON 是唯一权威源**。所有写操作先写 Rust JSON，失败则整个操作回滚
2. **SQLite 只做 FTS 全文搜索**，不做日常 CRUD 读写。content 在搜索场景下冗余存储
3. **localStorage 只做前端只读缓存**，不可作为决策依据
4. **所有组件必须走 CRUD 层**，禁止直接 `browserLoad()` / `localStorage.getItem()`

### CRUD 层改造

```typescript
// src/lib/storage/collections/crud.ts

// 原理：所有导出函数是唯一读写通道

export async function loadCollections(): Promise<Collection[]> {
  // 1. 从 Rust JSON 读（权威源）
  // 2. 更新 localStorage 缓存
  // 3. 返回数据
  // 流程不变，但保证任何地方调 loadCollections 都是最新数据
}

export async function saveCollections(collections: Collection[]): Promise<void> {
  // 1. tryInvoke(SetCollections) → Rust JSON（权威写入）
  // 2. browserSave(COLLECTIONS_KEY, collections) → 更新缓存
  // 3. 如果 Rust 写入失败，不更新缓存（保持一致性）
}
```

### 组件改造清单

| 文件 | 当前做法 | 改法 |
|------|---------|------|
| `CollectionTree.tsx:199` | `browserLoad('inkwise-collections')` | 调 `loadCollections()` |
| `ArticleManager.tsx:104` | `browserLoad('inkwise-collections')` | 调 `loadCollections()` |
| `useCollectionCrud.ts:22` | `browserLoad('inkwise-collections')` | 调 `loadCollections()` |
| `crud.ts:149` | `loadFromStorage()` | 统一用 `loadCollections()` |

### SQLite 瘦身

```sql
-- 当前：SQLite articles 表存全量 content
-- 改为：只存搜索需要的最小字段
CREATE TABLE articles_search (
    id TEXT PRIMARY KEY,
    title TEXT,
    description TEXT,
    content_snippet TEXT,  -- 前 2000 字，用于 FTS
    tags TEXT,
    collection_id TEXT,
    created_at INTEGER,
    updated_at INTEGER
);

-- 保持 FTS5 索引
CREATE VIRTUAL TABLE articles_fts USING fts5(
    title, description, content_snippet, tags,
    content='articles_search'
);
```

前端搜索时从 SQLite 查，编辑器加载内容时从 Rust JSON 读 `{id}.md`。

### 浏览器模式（无 Tauri）

浏览器模式下 localStorage 是唯一存储，CRUD 层自动降级：

```typescript
export async function loadCollections(): Promise<Collection[]> {
  if (isTauriEnv()) {
    // Tauri 模式：Rust JSON 权威 → 缓存到 localStorage
    try {
      const raw = await tryInvoke(TauriCommands.GetCollections);
      if (raw) {
        browserSave(COLLECTIONS_KEY, raw);
        return raw;
      }
    } catch { /* fallback */ }
  }
  // 浏览器模式 / 降级：localStorage
  return browserLoad(COLLECTIONS_KEY, []);
}
```

---

## 改动范围

| 文件 | 改动 | 量级 |
|------|------|------|
| `crud.ts` | 移除 `loadFromStorage` / `saveToStorage`，统一为 `loadCollections` | 小 |
| `CollectionTree.tsx` | `browserLoad` → `loadCollections` | 极小 |
| `ArticleManager.tsx` | 同上 | 极小 |
| `useCollectionCrud.ts` | 同上 | 极小 |
| `db.rs` | 建新表 `articles_search`，迁移数据 | 中 |
| `store.rs` | 不变（已是权威源） | 无 |
