# 类型同步清单

维护 Rust / TypeScript 之间的双向字段对称关系。

## Article / ArticleMeta

| 字段 | TypeScript `Article` | Rust `ArticleMeta` | 方向 | 备注 |
|------|---------------------|-------------------|------|------|
| `id` | `string` | `String` | 双向 |  |
| `collectionId` | — (派生自 Collection) | `collection_id` | TS→Rust | `toTauriCollection` 注入 |
| `title` | `string` | `String` | 双向 |  |
| `createdAt` | `number` | `u64` | 双向 | Rust `#[serde(rename_all = "camelCase")]` |
| `updatedAt` | `number` | `u64` | 双向 |  |
| `description` | `string?` | — | TS 仅前端 | localStorage 持久化，Rust 不存储 |
| `tags` | `string[]?` | — | TS 仅前端 | 同上 |
| `phase` | `string?` | — | TS 仅前端 | 同上 |
| `blueprint` | `string?` | — | TS 仅前端 | 同上 |
| `pinned` | `boolean?` | — | TS 仅前端 | 同上 |

## Collection

| 字段 | TypeScript `Collection` | Rust `Collection` | 方向 |
|------|------------------------|-------------------|------|
| `id` | `string` | `String` | 双向 |
| `title` | `string` | `String` | 双向 |
| `createdAt` | `number` | `u64` | 双向 |
| `linkedFolder` | `string?` | `Option<String>` | 双向 |
| `articles` | `Article[]` | `Vec<ArticleMeta>` | 双向 |
| `description` | `string?` | — | TS 仅前端 |
| `coverImage` | `string?` | — | TS 仅前端 |

## ArticleBlueprint / SeriesPlan / TrashItem

参见 `src-tauri/src/store.rs` 和 `src/lib/storage/collections/types.ts` 中对应结构体定义。

## 维护规则

1. **`toTauriCollection` 与 `fromTauriCollection` 必须字段对称** — 前者序列化所有 TS 端需持久化字段，后者解析 Rust 返回的全部字段。
2. **纯前端字段**（如 `description`、`tags`、`phase`、`blueprint`）通过 localStorage 持久化，Tauri `ArticleMeta` 不存储它们。
3. 修改 Rust `#[serde(rename_all = "camelCase")]` 结构体时，同步更新本清单和对应转换函数。
