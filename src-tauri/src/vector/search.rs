// vector/search.rs — 向量检索
//
// 从 SQLite 读取嵌入数据，反序列化后与查询向量做余弦相似度比较。

use crate::db::Database;
use crate::vector::embedder::Embedder;
use crate::vector::types::VectorSearchResult;

/// 语义搜索文章内容
///
/// 1. 用 embedder 将查询文本转为向量
/// 2. 从 SQLite 读取所有向量 chunk
/// 3. 计算余弦相似度，返回 Top-K
pub fn semantic_search(
    db: &Database,
    embedder: &Embedder,
    query: &str,
    article_id: Option<&str>,
    k: usize,
    threshold: f32,
) -> Result<Vec<VectorSearchResult>, String> {
    // 1. 查询文本嵌入
    let query_embs = embedder
        .embed(vec![query.to_string()])
        .map_err(|e| format!("查询嵌入失败: {}", e))?;
    let query_emb = query_embs
        .into_iter()
        .next()
        .ok_or("查询嵌入返回空")?;

    // 2. 读取索引数据
    let chunks = db
        .list_vector_chunks_with_embedding(article_id)
        .map_err(|e| format!("读取向量索引失败: {}", e))?;

    if chunks.is_empty() {
        return Ok(Vec::new());
    }

    // 3. 计算相似度
    let mut scored: Vec<(String, String, String, f32)> = Vec::with_capacity(chunks.len());

    for chunk in &chunks {
        let emb = match decode_embedding(&chunk.embedding) {
            Some(e) => e,
            None => continue,
        };

        let score = cosine_similarity(&query_emb, &emb);
        if score >= threshold {
            scored.push((
                chunk.id.clone(),
                chunk.article_id.clone(),
                chunk.content.clone(),
                score,
            ));
        }
    }

    // 4. 排序 + 截断
    scored.sort_by(|a, b| b.3.partial_cmp(&a.3).unwrap_or(std::cmp::Ordering::Equal));
    scored.truncate(k);

    Ok(scored
        .into_iter()
        .map(|(chunk_id, article_id, content, score)| VectorSearchResult {
            chunk_id,
            article_id,
            content,
            score,
        })
        .collect())
}

/// 解码 Base64 编码的 float32 向量
fn decode_embedding(b64: &Option<String>) -> Option<Vec<f32>> {
    let data = b64.as_ref()?;
    let bytes = base64::decode(data).ok()?;
    // 每 4 字节一个 f32
    let chunks: Vec<f32> = bytes
        .chunks_exact(4)
        .map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]]))
        .collect();
    Some(chunks)
}

/// 余弦相似度
fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }
    let dot: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm_a == 0.0 || norm_b == 0.0 {
        return 0.0;
    }
    (dot / (norm_a * norm_b)).clamp(-1.0, 1.0)
}
