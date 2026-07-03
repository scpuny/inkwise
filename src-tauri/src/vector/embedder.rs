// vector/embedder.rs — Node.js Transformers.js 桥接：文本嵌入
//
// 原理：启动 Node.js 子进程加载 @xenova/transformers 和 ONNX 模型，
//       通过 stdin/stdout JSON 通信完成文本 → 向量转换。

use crate::vector::types::{EmbedRequest, EmbedResponse};
use serde_json;
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;

/// Embedder 实例（持有 Node.js 子进程）
pub struct Embedder {
    process: Mutex<Child>,
}

impl Drop for Embedder {
    fn drop(&mut self) {
        if let Ok(mut proc) = self.process.lock() {
            let _ = proc.kill();
            let _ = proc.wait();
        }
    }
}

impl Embedder {
    /// 启动 Node.js 嵌入子进程
    ///
    /// `model_dir`: ONNX 模型所在目录
    /// `script_path`: embedding.mjs 的完整路径
    pub fn start(model_dir: &PathBuf, script_path: &PathBuf) -> Result<Self, String> {
        let model_dir_str = model_dir.to_string_lossy().to_string();

        let child = Command::new("node")
            .arg(script_path)
            .env("MODEL_DIR", &model_dir_str)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("无法启动 Node.js 嵌入进程: {}", e))?;

        Ok(Self {
            process: Mutex::new(child),
        })
    }

    /// 将一批文本转为向量
    ///
    /// 返回 Vec<Vec<f32>>，每个文本对应一个 embedding 向量。
    /// 向量维度由模型决定（BGE-small-zh-v1.5 为 512 维）。
    pub fn embed(&self, texts: Vec<String>) -> Result<Vec<Vec<f32>>, String> {
        let mut proc = self.process.lock().map_err(|e| e.to_string())?;
        let req = EmbedRequest { texts };

        // 发送 JSON 请求到 stdin
        let req_json = serde_json::to_string(&req).map_err(|e| e.to_string())?;
        let stdin = proc.stdin.as_mut().ok_or("stdin 不可用")?;
        writeln!(stdin, "{}", req_json).map_err(|e| format!("写入 stdin 失败: {}", e))?;
        stdin.flush().map_err(|e| format!("flush stdin 失败: {}", e))?;

        // 从 stdout 读取 JSON 响应
        let stdout = proc.stdout.as_mut().ok_or("stdout 不可用")?;
        let mut reader = BufReader::new(stdout);
        let mut response_line = String::new();
        reader
            .read_line(&mut response_line)
            .map_err(|e| format!("读取 stdout 失败: {}", e))?;

        let resp: EmbedResponse =
            serde_json::from_str(&response_line).map_err(|e| format!("解析嵌入响应失败: {}", e))?;

        if let Some(err) = resp.error {
            return Err(format!("嵌入错误: {}", err));
        }

        Ok(resp.embeddings)
    }
}

/// 计算两个向量之间的余弦相似度
pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
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

/// 计算查询向量与一组 chunk 向量的相似度，返回 Top-K 结果
pub fn top_k_similar(
    query_emb: &[f32],
    chunks: &[(String, Vec<f32>)], // (chunk_id, embedding)
    k: usize,
    threshold: f32,
) -> Vec<(String, f32)> {
    let mut scored: Vec<(String, f32)> = chunks
        .iter()
        .map(|(id, emb)| {
            let score = cosine_similarity(query_emb, emb);
            (id.clone(), score)
        })
        .filter(|(_, score)| *score >= threshold)
        .collect();

    // 按相似度降序排序
    scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    scored.truncate(k);
    scored
}
