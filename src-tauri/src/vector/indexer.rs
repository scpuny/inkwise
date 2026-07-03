// vector/indexer.rs — 向量增量索引
//
// 流程: 内容变化检测 → re-chunk → re-embed → upsert SQLite

use crate::db::Database;
use crate::vector::chunk::{chunk_content, ChunkResult};
use crate::vector::embedder::Embedder;
use crate::vector::types::{ChunkStrategy, VectorChunkRow};

use std::time::{SystemTime, UNIX_EPOCH};

/// 对单篇文章进行增量索引
///
/// 对比 content_hash 跳过未变化的分块，仅对有变化的分块重新嵌入。
/// article_id 可能为 ""（表示该内容不属于某篇文章，如项目文件）。
pub fn index_article(
    db: &Database,
    embedder: &Embedder,
    article_id: &str,
    content: &str,
    strategy: ChunkStrategy,
) -> Result<IndexResult, String> {
    let chunks = chunk_content(content, strategy);
    let mut indexed = 0;
    let mut skipped = 0;
    let mut errors = 0;

    // 获取当前所有 chunk 的 hash 映射
    let existing = db.list_vector_chunks(article_id).unwrap_or_default();
    let existing_map: std::collections::HashMap<String, String> = existing
        .iter()
        .map(|c| (c.chunk_index.to_string(), c.content_hash.clone()))
        .collect();

    for chunk in &chunks {
        let key = chunk.index.to_string();

        // hash 未变化 → 跳过
        if let Some(existing_hash) = existing_map.get(&key) {
            if existing_hash == &chunk.content_hash {
                skipped += 1;
                continue;
            }
        }

        // 重新嵌入
        let embedding = embedder
            .embed(vec![chunk.content.clone()])
            .map_err(|e| format!("嵌入 chunk {} 失败: {}", chunk.index, e))?;

        let emb_vec = embedding
            .into_iter()
            .next()
            .ok_or("嵌入返回空结果")?;

        // Base64 编码
        let emb_bytes: Vec<u8> = emb_vec
            .iter()
            .flat_map(|f| f.to_le_bytes())
            .collect();
        let emb_b64 = base64::encode(&emb_bytes);

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as i64;

        let row = VectorChunkRow {
            id: format!("{}_{}", article_id, chunk.index),
            article_id: article_id.to_string(),
            chunk_index: chunk.index as i64,
            content: chunk.content.clone(),
            content_hash: chunk.content_hash.clone(),
            embedding: Some(emb_b64),
            created_at: now,
        };

        db.upsert_vector_chunk(&row).map_err(|e| e.to_string())?;
        indexed += 1;
    }

    Ok(IndexResult {
        total: chunks.len(),
        indexed,
        skipped,
        errors,
    })
}

/// 删除文章的向量索引
pub fn delete_article_index(db: &Database, article_id: &str) -> Result<(), String> {
    db.delete_vector_chunks(article_id)
        .map_err(|e| format!("删除向量索引失败: {}", e))
}

/// 索引结果
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct IndexResult {
    pub total: usize,
    pub indexed: usize,
    pub skipped: usize,
    pub errors: usize,
}
