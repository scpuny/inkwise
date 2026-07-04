// vector/ — 向量嵌入与语义搜索模块（Sprint 3.2）
//
// 模块组成:
//   types.rs     — 类型定义
//   embedder.rs  — Node.js Transformers.js 桥接 + 相似度计算
//   chunk.rs     — 文本分块策略
//   indexer.rs   — 增量索引
//   search.rs    — 语义搜索

pub mod chunk;
pub mod embedder;
pub mod indexer;
pub mod search;
pub mod types;

pub use types::*;
pub use chunk::chunk_content;
pub use chunk::ChunkResult;
pub use embedder::{Embedder, EmbedderState};
pub use embedder::ensure_onnxruntime_dylib;
pub use embedder::download_model;
pub use indexer::index_article;
pub use indexer::delete_article_index;
pub use indexer::IndexResult;
pub use search::semantic_search;
