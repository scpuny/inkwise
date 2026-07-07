// vector/chunk.rs — 文本分块策略

use crate::vector::types::ChunkStrategy;

/// 分块结果
#[derive(Debug, Clone)]
pub struct ChunkResult {
    pub index: usize,
    pub content: String,
    pub content_hash: String,
}

/// 将文本按指定策略分块
pub fn chunk_content(content: &str, strategy: ChunkStrategy) -> Vec<ChunkResult> {
    match strategy {
        ChunkStrategy::Paragraph => chunk_by_paragraph(content),
        ChunkStrategy::Function => chunk_by_function(content),
        ChunkStrategy::Hybrid => {
            // 优先按函数分块，剩余段落兜底
            let func_chunks = chunk_by_function(content);
            if !func_chunks.is_empty() {
                func_chunks
            } else {
                chunk_by_paragraph(content)
            }
        }
    }
}

/// 策略1: 按段落分割
///
/// 每个段落（空行分隔）为一个 chunk。
/// 段落过短（< 20 字符）则合并到前一个 chunk。
/// 段落过长（> 2000 字符）则进一步按句号拆分。
fn chunk_by_paragraph(content: &str) -> Vec<ChunkResult> {
    let mut chunks = Vec::new();
    let paragraphs: Vec<&str> = content.split('\n').collect();
    let mut current = String::new();

    for para in paragraphs {
        let trimmed = para.trim();
        if trimmed.is_empty() {
            // 空行是段落分隔
            if !current.is_empty() {
                finalize_chunk(&mut chunks, &mut current);
            }
            continue;
        }

        if current.len() + trimmed.len() > 2000 {
            // 当前段落过长，分段
            if !current.is_empty() {
                finalize_chunk(&mut chunks, &mut current);
            }
            // 对大段落按句号拆分
            for sentence in trimmed.split_inclusive(|c: char| c == '。' || c == '！' || c == '？' || c == '\n') {
                let s = sentence.trim();
                if s.is_empty() {
                    continue;
                }
                if current.len() + s.len() > 2000 {
                    if !current.is_empty() {
                        finalize_chunk(&mut chunks, &mut current);
                    }
                    current.push_str(s);
                } else {
                    current.push_str(s);
                }
            }
        } else if current.is_empty() && trimmed.len() < 20 && !chunks.is_empty() {
            // 过短的段落追加到上一个 chunk
            if let Some(last) = chunks.last_mut() {
                last.content.push_str(" ");
                last.content.push_str(trimmed);
                last.content_hash = compute_hash(&last.content);
            }
        } else {
            if !current.is_empty() {
                current.push(' ');
            }
            current.push_str(trimmed);
        }
    }

    if !current.is_empty() {
        finalize_chunk(&mut chunks, &mut current);
    }

    chunks
}

/// 策略2: 按函数/代码块分割
///
/// 适用于项目代码：识别 function/class/impl 等关键字分割。
fn chunk_by_function(content: &str) -> Vec<ChunkResult> {
    let mut chunks = Vec::new();
    let mut current = String::new();

    for line in content.lines() {
        let trimmed = line.trim();
        let is_block_start = trimmed.starts_with("fn ")
            || trimmed.starts_with("pub fn ")
            || trimmed.starts_with("pub async fn ")
            || trimmed.starts_with("async fn ")
            || trimmed.starts_with("function ")
            || trimmed.starts_with("export function ")
            || trimmed.starts_with("export async function ")
            || trimmed.starts_with("class ")
            || trimmed.starts_with("export class ")
            || trimmed.starts_with("impl ")
            || trimmed.starts_with("pub struct ")
            || trimmed.starts_with("struct ")
            || trimmed.starts_with("pub enum ")
            || trimmed.starts_with("enum ")
            || trimmed.starts_with("pub trait ")
            || trimmed.starts_with("trait ")
            || trimmed.starts_with("def ")
            || trimmed.starts_with("async def ")
            || trimmed.starts_with("# ")
            || trimmed.starts_with("## ")
            || trimmed.starts_with("### ");

        if is_block_start && !current.is_empty() {
            finalize_chunk(&mut chunks, &mut current);
        }

        // 如果该行从函数/类定义开始，重置 current
        if is_block_start {
            current = line.to_string();
        } else {
            if !current.is_empty() {
                current.push('\n');
            }
            current.push_str(line);
        }

        // 单块上限
        if current.len() > 3000 {
            finalize_chunk(&mut chunks, &mut current);
        }
    }

    if !current.is_empty() {
        finalize_chunk(&mut chunks, &mut current);
    }

    chunks
}

/// 辅助：将当前缓冲区固化为一个 chunk
fn finalize_chunk(chunks: &mut Vec<ChunkResult>, current: &mut String) {
    let content = std::mem::take(current);
    if content.trim().is_empty() {
        return;
    }
    chunks.push(ChunkResult {
        index: chunks.len(),
        content_hash: compute_hash(&content),
        content,
    });
}

/// 计算内容的 SHA256 哈希
fn compute_hash(content: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    hex::encode(hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_chunk_paragraph_simple() {
        let text = "第一段内容。\n\n第二段内容。\n\n第三段内容。";
        let chunks = chunk_by_paragraph(text);
        assert!(!chunks.is_empty());
        assert_eq!(chunks.len(), 3);
    }

    #[test]
    fn test_chunk_function_rust() {
        let text = "fn hello() {\n    println!(\"hello\");\n}\n\nfn world() {\n    println!(\"world\");\n}";
        let chunks = chunk_by_function(text);
        assert_eq!(chunks.len(), 2);
    }

    #[test]
    fn test_content_hash_consistency() {
        let text = "同样的内容";
        let a = compute_hash(text);
        let b = compute_hash(text);
        assert_eq!(a, b);
    }
}
