// vector/types.rs — 向量嵌入相关类型定义

use serde::{Deserialize, Serialize};

/// 向量分块记录（对应 SQLite vector_chunks 表）
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VectorChunkRow {
    pub id: String,
    pub article_id: String,
    pub chunk_index: i64,
    pub content: String,
    pub content_hash: String,
    /// 原始 embedding float32 数组的二进制编码（Base64）
    pub embedding: Option<String>,
    pub created_at: i64,
}

/// 分块策略
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ChunkStrategy {
    /// 按段落分割（默认，适合一般文章）
    Paragraph,
    /// 按函数/代码块分割（适合项目代码）
    Function,
    /// 混合：段落 + 函数
    Hybrid,
}

/// 向量搜索结果
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VectorSearchResult {
    pub chunk_id: String,
    pub article_id: String,
    pub content: String,
    pub score: f32,
}

