# 05 — 本地向量嵌入与多层索引

> 关联: 03-incremental-scanning.md, 04-query-ast.md, 06-context-planner.md

---

## 设计目标

- **完全本地**运行，不需要任何外部 API
- **增量**索引，不阻塞用户
- **分层**适配：独立文章 / 合集 / 合集+项目 三种场景

---

## 模型选择

当前 Kiro 使用 `all-MiniLM-L6-v2`（384 维，22MB，英文为主），但 InkWise 面向中文写作者。

| 模型 | 维度 | 大小 | 中文 | 来源 |
|------|------|------|------|------|
| all-MiniLM-L6-v2 | 384 | 22MB | 一般 | sentence-transformers |
| **bge-small-zh-v1.5** | 512 | ~33MB | ✅ 最佳 | BAAI |
| paraphrase-multilingual-MiniLM-L12-v2 | 384 | ~80MB | ✅ 好 | sentence-transformers |

**推荐：bge-small-zh-v1.5**（中文优化、体积小、检索精度高）。

## 运行时

通过 `@xenova/transformers` (Transformers.js) 在 Node.js / WASM 环境运行：

```typescript
import { pipeline } from '@xenova/transformers';

// 一次性加载（首次约 2-5s，之后复用）
const extractor = await pipeline('feature-extraction', 'Xenova/bge-small-zh-v1.5');

// 生成向量
async function embed(text: string): Promise<number[]> {
  const result = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(result.data);
}
```

**部署方式**：模型 ONNX 文件放在 `src-tauri/models/bge-small-zh-v1.5/onnx/`，随应用打包。

---

## 三层索引

```
向量库
├── article_chunks        ← 文章内容块（按段落/标题分块）
│   └── 所有文章
│
├── project_chunks        ← 项目文件块（按函数/类/模块分块）
│   └── 仅有关联项目的合集
│
└── series_chunks         ← 系列规划块（系列描述+每篇文章摘要）
    └── 有系列规划的合集
```

### Chunk 策略

| 源 | 分块方式 | 每块大小 | 重叠 |
|----|---------|---------|------|
| 文章内容 | 按标题段落 | ~512 tokens | 64 tokens |
| 项目文件 | 按函数/类 | 函数体全文 | 无 |
| 系列规划 | 系列描述 + 每篇文章摘要 | ~256 tokens | 无 |

### 索引表设计（SQLite）

```sql
CREATE TABLE vector_chunks (
    id TEXT PRIMARY KEY,           -- chunk_{uuid}
    source_type TEXT NOT NULL,     -- 'article' | 'project' | 'series'
    source_id TEXT NOT NULL,       -- article_id / file_path / series_id
    collection_id TEXT,            -- 所属合集（可为空=独立文章）
    chunk_order INTEGER,           -- 块在源中的顺序
    content TEXT NOT NULL,         -- 原始文本
    content_hash TEXT NOT NULL,    -- sha256（用于增量检测）
    embedding BLOB,                -- f32 向量，binary 存储
    created_at INTEGER,
    updated_at INTEGER
);

CREATE INDEX idx_chunks_source ON vector_chunks(source_type, source_id);
CREATE INDEX idx_chunks_collection ON vector_chunks(collection_id);
```

### 注入策略（按文章上下文）

```
独立文章 → 检索范围: article_chunks（找语义相似的历史文章）
合集文章（无项目）→ 检索范围: article_chunks + series_chunks
合集文章（有项目）→ 检索范围: article_chunks + series_chunks + project_chunks
```

检索方式：余弦相似度，取 Top-K（K=5~10）。

---

## 增量索引

### 文件变更时

```
文件变更 → watcher 触发
    ↓
读取文件内容
    ↓
按函数/类分块（复用 Query AST 的分块边界）
    ↓
每块计算 content_hash
    ↓
与已索引的 hash 对比
    ↓ hash 不变 → 跳过
    ↓ hash 变了 → 重新 embedding → upsert 到 vector_chunks
    ↓
清理已不存在的 chunk
```

### 文章变更时

```
保存文章内容
    ↓
按段落/标题分块
    ↓
对比 content_hash
    ↓ hash 不变 → 跳过
    ↓ hash 变了 → 重新 embedding → upsert
```

### 首次全量

首次关联项目时不可避免全量 embedding。**但后台异步执行，不阻塞用户**：

```
linkCollectionFolder → 返回 ProjectContext（轻量，立即响应）
    ↓
后台线程：
    遍历项目文件 → 分块 → embedding → 写入 SQLite
    进度通过事件总线推送到前端
    （UI 展示进度条）
```

---

## 搜索接口

```typescript
interface VectorSearchOptions {
  query: string;
  sourceType?: 'article' | 'project' | 'series';
  collectionId?: string;
  topK?: number;
  threshold?: number;  // 余弦相似度阈值，默认 0.5
}

interface VectorSearchResult {
  chunkId: string;
  sourceType: string;
  sourceId: string;
  content: string;
  score: number;       // 余弦相似度
}
```

前端在 Rust 端执行搜索（向量库在 SQLite 中，读取 embedding 后在 Rust 中计算余弦相似度）：

```rust
fn vector_search(
    db: &Database,
    query_vec: &[f32],    // 前端传过来的查询向量
    options: &SearchOptions,
) -> Result<Vec<SearchResult>, String> {
    let chunks = db.load_chunks(&options)?;
    let mut scored: Vec<(f32, &Chunk)> = chunks.iter()
        .map(|c| (cosine_similarity(query_vec, &c.embedding), c))
        .collect();
    scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap());
    Ok(scored.into_iter()
        .filter(|(s, _)| *s >= options.threshold)
        .take(options.top_k)
        .map(|(s, c)| SearchResult { score: s, /* ... */ })
        .collect())
}
```

---

## 实现步骤

| 步骤 | 内容 | 文件 |
|------|------|------|
| 1 | 下载 bge-small-zh-v1.5 ONNX 模型到 `models/` | 外部下载 |
| 2 | Rust 端建 `vector_chunks` 表 | `db.rs` |
| 3 | 实现 `embed_text()` → 通过 Node REPL 或子进程调 Transformers.js | 新文件 `vector.rs` |
| 4 | 实现 `chunk_content()` 分块 | `vector.rs` |
| 5 | 实现增量索引（文件变更/文章变更） | `vector.rs` |
| 6 | 实现 `vector_search()` 余弦相似度检索 | `vector.rs` |
| 7 | 实现首次全量索引（后台线程+进度推送） | `lib.rs` |
| 8 | 前端接入：检索接口 + 结果展示 | `ai/agent.ts` |
