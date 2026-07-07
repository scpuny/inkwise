# 02 — 删除级联：数据清理矩阵

> 关联: 01-data-consistency.md, 03-incremental-scanning.md, 05-vector-embedding.md

---

## 当前问题

```
removeCollection(id) → 只移出合集列表，子文章全部变成孤儿
trashArticle(id)     → 清理 JSON + localStorage，但不清理 SQLite
permanentlyDelete    → 移出回收站列表，残留 SQLite 和向量
emptyTrash()         → 同上
deleteSeriesPlan()   → 只清理 localStorage，不清理关联文章和向量
unlinkCollection     → 清理项目缓存，但不清理 project_chunks 向量
```

## 数据层级

```
合集 (Collection)
├── linkedFolder → 项目路径
├── articles[]   → 文章列表
│     └── 每篇文章的关联数据:
│           ├── content    ({id}.md)
│           ├── meta       ({id}.meta.json)
│           ├── blueprint  ({id}.blueprint.json)
│           ├── versions   (articleVersions)
│           ├── SQLite row (db.rs)
│           ├── plan-draft (localStorage)
│           └── vector chunks (article_chunks)
├── series_plans[]
│     └── 每个系列的关联数据:
│           ├── series_chunks (向量)
│           └── plan-draft-{articleId} (localStorage)
└── project_chunks (向量，关联 linkedFolder)
```

## 完整清理矩阵

### 文章级别的清理

```
操作: trashArticle(collectionId, articleId)

清理链:
  ✅ 从集合列表中移除文章元信息            ← 已有
  ✅ 添加到回收站                         ← 已有
  ✅ deleteArticleContent(content + meta) ← 已有
  ✅ deleteAllVersions(articleId)         ← 已有
  ✅ 清理 plan-draft                      ← 已有
  ❌ delete_article_db / delete_article  ← 缺失，补充
  ❌ 清理 article_chunks 向量             ← 新增向量层后补充

操作: permanentlyDeleteArticle(trashId)

清理链:
  ✅ 从回收站列表移除                     ← 已有
  ❌ 清理 article_chunks 向量             ← 缺失，补充
  ❌ 确认 content/meta/versions 已清       ← 已有（trash时已做）

操作: restoreArticle(trashId)

清理链:
  ✅ 从回收站移除并恢复到文章列表           ← 已有
  (向量保持不变，不需处理)
```

### 合集级别的清理

```
操作: removeCollection(collectionId)

清理链（需新增）:
  for each article in collection.articles:
    ├── deleteArticleContent(id)        ← 新增
    ├── delete_article_db(id)           ← 新增
    ├── deleteAllVersions(id)           ← 新增
    ├── 清理 article_chunks             ← 新增（向量层）
    └── 清理 plan-draft-{id}            ← 新增
  for each series_plan:
    ├── 清理 series_chunks             ← 新增（向量层）
    └── 清理 localStorage 系列数据      ← 新增
  清理 project_chunks                  ← 新增（向量层）
  从合集列表中移除                       ← 已有
```

### 系列规划的清理

```
操作: deleteSeriesPlan(collectionId, seriesId)

清理链:
  ✅ 清理 localStorage 系列数据          ← 已有
  ❌ 清理 series_chunks 向量             ← 缺失，补充
  (系列文章本身不删除，仅移除系列关联)
```

### 取消项目关联

```
操作: unlinkCollectionFolder(collectionId)

清理链:
  ✅ linkedFolder = undefined            ← 已有
  ✅ 清理 folder_index 缓存              ← 已有
  ✅ 清理 project insights / file tree   ← 已有
  ✅ 清理所有 plan-draft                 ← 已有
  ❌ 清理 project_chunks 向量            ← 缺失，补充
  (article_chunks 和 series_chunks 保留，文章还在)
```

## Rust 端实现

在 `src-tauri/src/lib.rs` 中为新/补充的 Tauri 命令增加清理逻辑：

```rust
#[tauri::command]
fn delete_article_completely(state: tauri::State<AppState>, id: String) -> Result<(), String> {
    let store = state.store.lock().map_err(|e| e.to_string())?;
    store.delete_article_content(&id)?;    // {id}.md
    store.delete_article_meta(&id)?;       // {id}.meta.json
    store.delete_blueprint(&id).ok();      // {id}.blueprint.json
    
    // 新增：清理 SQLite
    if let Some(ref db) = *state.db.lock().map_err(|e| e.to_string())? {
        db.delete_article(&id).ok();
        db.delete_article_images(&id).ok();
    }
    
    // 新增：清理向量索引（触发前端重新索引）
    Ok(())
}

#[tauri::command]
fn delete_collection_cascade(state: tauri::State<AppState>, id: String) -> Result<(), String> {
    let store = state.store.lock().map_err(|e| e.to_string())?;
    let mut collections = store.load_collections();
    let col = match collections.iter().position(|c| c.id == id) {
        Some(i) => collections.remove(i),
        None => return Err("合集不存在".into()),
    };
    
    // 级联清理子文章
    for article in &col.articles {
        store.delete_article_content(&article.id)?;
        store.delete_article_meta(&article.id)?;
        store.delete_blueprint(&article.id).ok();
        if let Some(ref db) = *state.db.lock().map_err(|e| e.to_string())? {
            db.delete_article(&article.id).ok();
        }
    }
    
    store.save_collections(&collections)?;
    Ok(())
}
```

---

## 改造清单

| 文件 | 改动 |
|------|------|
| `src/lib/storage/collections/crud.ts` | `removeCollection` 新增级联清理子文章；`trashArticle` 补充 SQLite 清理 |
| `src/lib/storage/collections/series.ts` | `deleteSeriesPlan` 补充向量清理（预留） |
| `src-tauri/src/lib.rs` | 新增 `delete_collection_cascade` 命令；补充 `delete_article_completely` |
| `src-tauri/src/db.rs` | 确保 `delete_article` 清理所有关联数据（images, fts） |
