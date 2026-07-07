// vector/indexer.rs — 向量增量索引（批量嵌入）
//
// 流程: 内容变化检测 → 收集需更新的 chunk → 批量嵌入 → 批量 upsert

use crate::db::Database;
use crate::vector::ChunkResult;
use crate::vector::chunk::chunk_content;
use crate::vector::embedder::Embedder;
use crate::vector::types::{ChunkStrategy, VectorChunkRow};

use std::time::{SystemTime, UNIX_EPOCH};

/// 对单篇文章进行增量索引
///
/// 先 chunk，对比 content_hash 跳过未变化的块，
/// 然后将所有需更新的块**批量**送入嵌入器，最后批量 upsert。
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

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64;

    // ── 收集需更新的 chunk ──
    let mut changed_chunks: Vec<&ChunkResult> = Vec::new();
    let mut changed_indices: Vec<usize> = Vec::new();

    for (i, chunk) in chunks.iter().enumerate() {
        let key = chunk.index.to_string();
        if let Some(existing_hash) = existing_map.get(&key) {
            if existing_hash == &chunk.content_hash {
                skipped += 1;
                continue;
            }
        }
        changed_chunks.push(chunk);
        changed_indices.push(i);
    }

    // ── 批量嵌入 ──
    if !changed_chunks.is_empty() {
        let texts: Vec<String> = changed_chunks.iter()
            .map(|c| c.content.clone())
            .collect();

        let embeddings = embedder.embed(texts).map_err(|e| format!("批量嵌入失败: {}", e))?;

        if embeddings.len() != changed_chunks.len() {
            return Err(format!("批量嵌入返回数量不匹配: {} vs {}", embeddings.len(), changed_chunks.len()));
        }

        // ── 批量 upsert ──
        for (i, chunk) in changed_chunks.iter().enumerate() {
            let emb_vec = &embeddings[i];

            let emb_bytes: Vec<u8> = emb_vec
                .iter()
                .flat_map(|f| f.to_le_bytes())
                .collect();
            let emb_b64 = base64::encode(&emb_bytes);

            let row = VectorChunkRow {
                id: format!("{}_{}", article_id, chunk.index),
                article_id: article_id.to_string(),
                chunk_index: chunk.index as i64,
                content: chunk.content.clone(),
                content_hash: chunk.content_hash.clone(),
                embedding: Some(emb_b64),
                created_at: now,
            };

            if let Err(e) = db.upsert_vector_chunk(&row) {
                errors += 1;
                eprintln!("[向量] upsert chunk {} 失败: {}", chunk.index, e);
            } else {
                indexed += 1;
            }
        }
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
