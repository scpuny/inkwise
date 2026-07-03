// vector/embedder.rs — 纯 Rust 文本嵌入引擎
//
// 使用 tract-onnx 纯 Rust ONNX 推理引擎 + tokenizers crate，
// 零系统依赖，全平台（Intel Mac / ARM Mac / Windows / Linux）一致运行。

use tract_onnx::prelude::*;
use tract_onnx::tract_core::model::typed::TypedRunnableModel;

use ndarray::{Array2, Array3, Axis, s};
use std::path::PathBuf;
use std::sync::Mutex;

/// 嵌入器实例
pub struct Embedder {
    model: Mutex<Arc<TypedRunnableModel>>,
    tokenizer: tokenizers::Tokenizer,
    pub hidden_size: usize,
}

impl Embedder {
    /// 初始化嵌入器
    pub fn new(model_dir: &PathBuf) -> Result<Self, String> {
        let onnx_path = model_dir.join("onnx").join("model_int8.onnx");
        let tokenizer_path = model_dir.join("tokenizer.json");

        if !onnx_path.exists() {
            return Err(format!("ONNX 模型未找到: {}", onnx_path.display()));
        }
        if !tokenizer_path.exists() {
            return Err(format!("Tokenizer 文件未找到: {}", tokenizer_path.display()));
        }

        println!("[向量] 加载 ONNX 模型...");
        let typed: TypedModel = onnx()
            .model_for_path(&onnx_path)
            .map_err(|e| format!("加载 ONNX 模型失败: {}", e))?
            .into_optimized()
            .map_err(|e| format!("优化模型失败: {}", e))?;

        let runnable = TypedRunnableModel::new(typed)
            .map_err(|e| format!("创建推理引擎失败: {}", e))?;

        let tokenizer = tokenizers::Tokenizer::from_file(&tokenizer_path)
            .map_err(|e| format!("加载 Tokenizer 失败: {}", e))?;

        let hidden_size = Self::detect_hidden_size(&runnable, &tokenizer)?;
        println!("[向量] hidden_size = {} (自动检测)", hidden_size);

        Ok(Self {
            model: Mutex::new(runnable),
            tokenizer,
            hidden_size,
        })
    }

    fn detect_hidden_size(
        model: &Arc<TypedRunnableModel>,
        tokenizer: &tokenizers::Tokenizer,
    ) -> Result<usize, String> {
        let encoding = tokenizer.encode("d", true)
            .map_err(|e| format!("dummy tokenize: {}", e))?;
        let ids: Vec<i64> = encoding.get_ids().iter().map(|&id| id as i64).collect();
        let mask: Vec<i64> = encoding.get_attention_mask().iter().map(|&m| m as i64).collect();
        let seq_len = ids.len();

        let ids_t: Tensor = Array2::from_shape_vec((1, seq_len), ids)
            .map_err(|e| format!("shape: {}", e))?.into();
        let mask_t: Tensor = Array2::from_shape_vec((1, seq_len), mask)
            .map_err(|e| format!("shape: {}", e))?.into();

        let outputs = model.clone().run(tvec!(ids_t.into(), mask_t.into()))
            .map_err(|e| format!("dummy 推理: {}", e))?;

        let t = outputs.into_iter().next().ok_or("无输出")?.into_tensor();
        let view = t.to_plain_array_view::<f32>()
            .map_err(|e| format!("提取输出: {}", e))?;

        Ok(view.shape()[2])
    }

    /// 批量文本嵌入
    pub fn embed(&self, texts: Vec<String>) -> Result<Vec<Vec<f32>>, String> {
        let batch_size = texts.len();
        if batch_size == 0 { return Ok(Vec::new()); }

        // 1. 批量 tokenize + 填充
        let mut all_ids: Vec<Vec<i64>> = Vec::with_capacity(batch_size);
        let mut all_masks: Vec<Vec<i64>> = Vec::with_capacity(batch_size);
        let mut max_len = 1usize;

        for text in &texts {
            let encoding = self.tokenizer.encode(text.as_str(), true)
                .map_err(|e| format!("Tokenize: {}", e))?;
            let ids: Vec<i64> = encoding.get_ids().iter().map(|&id| id as i64).collect();
            let mask: Vec<i64> = encoding.get_attention_mask().iter().map(|&m| m as i64).collect();
            if ids.len() > max_len { max_len = ids.len(); }
            if max_len > 512 { max_len = 512; }
            all_ids.push(ids[..max_len.min(ids.len())].to_vec());
            all_masks.push(mask[..max_len.min(mask.len())].to_vec());
        }

        let mut padded_ids = Vec::with_capacity(batch_size * max_len);
        let mut padded_masks = Vec::with_capacity(batch_size * max_len);
        for i in 0..batch_size {
            let len = all_ids[i].len();
            padded_ids.extend_from_slice(&all_ids[i]);
            padded_ids.extend(std::iter::repeat(0i64).take(max_len - len));
            padded_masks.extend_from_slice(&all_masks[i]);
            padded_masks.extend(std::iter::repeat(0i64).take(max_len - len));
        }

        // 2. tract-onnx 推理（细粒度锁）
        let output = {
            let model = self.model.lock().map_err(|e| e.to_string())?;

            let ids_a: Tensor = Array2::from_shape_vec((batch_size, max_len), padded_ids)
                .map_err(|e| format!("shape input_ids: {}", e))?.into();
            let mask_a: Tensor = Array2::from_shape_vec((batch_size, max_len), padded_masks)
                .map_err(|e| format!("shape attention_mask: {}", e))?.into();

            let outputs = model.run(tvec!(ids_a.into(), mask_a.into()))
                .map_err(|e| format!("ONNX 推理: {}", e))?;

            let t = outputs.into_iter().next().ok_or("无输出")?.into_tensor();
        t.to_plain_array_view::<f32>()
                .map_err(|e| format!("提取结果: {}", e))?
                .to_owned()
        };

        // output shape: (batch, seq_len, hidden)
        let seq_len = output.shape()[1];
        let hidden = output.shape()[2];

        // 3. 向量化 Mean Pooling
        let mut mask_2d = Array2::<f32>::zeros((batch_size, seq_len));
        for i in 0..batch_size {
            let len = all_masks[i].len();
            for j in 0..len.min(seq_len) { mask_2d[[i, j]] = 1.0; }
        }
        let mask_3d = mask_2d.view().insert_axis(Axis(2));
        let summed = (&output * &mask_3d).sum_axis(Axis(1));
        let count = mask_2d.sum_axis(Axis(1)).mapv(|x| x.max(1.0));
        let mut pooled = summed / count.view().insert_axis(Axis(1));

        // 4. L2 Normalize
        let norms = pooled.mapv(|x| x * x).sum_axis(Axis(1)).mapv(f32::sqrt);
        for i in 0..batch_size {
            if norms[i] > 0.0 {
                for j in 0..hidden { pooled[[i, j]] /= norms[i]; }
            }
        }

        let mut results = Vec::with_capacity(batch_size);
        for i in 0..batch_size {
            let mut row = Vec::with_capacity(hidden);
            for j in 0..hidden { row.push(pooled[[i, j]]); }
            results.push(row);
        }
        Ok(results)
    }

    /// 检查模型文件是否存在
    pub fn model_exists(model_dir: &PathBuf) -> bool {
        model_dir.join("onnx").join("model_int8.onnx").exists()
            && model_dir.join("tokenizer.json").exists()
    }
}

/// 余弦相似度
pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() || a.is_empty() { return 0.0; }
    use ndarray::Array1;
    let va = Array1::from_vec(a.to_vec());
    let vb = Array1::from_vec(b.to_vec());
    let dot = va.dot(&vb);
    let norm = va.mapv(|x| x * x).sum().sqrt() * vb.mapv(|x| x * x).sum().sqrt();
    if norm == 0.0 { 0.0 } else { (dot / norm).clamp(-1.0, 1.0) }
}

/// Top-K 相似度检索
#[allow(dead_code)]
pub fn top_k_similar(query_emb: &[f32], chunks: &[(String, Vec<f32>)], k: usize, threshold: f32) -> Vec<(String, f32)> {
    let mut scored: Vec<(String, f32)> = chunks.iter()
        .map(|(id, emb)| (id.clone(), cosine_similarity(query_emb, emb)))
        .filter(|(_, score)| *score >= threshold).collect();
    scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    scored.truncate(k);
    scored
}

// ── 模型文件下载 ──

const MODEL_FILES: &[(&str, &str)] = &[
    ("onnx/model_int8.onnx",  "onnx/model_int8.onnx"),
    ("tokenizer.json",        "tokenizer.json"),
    ("config.json",           "config.json"),
    ("tokenizer_config.json", "tokenizer_config.json"),
];

/// 下载 bge-small-zh-v1.5 模型文件（全平台通用）
pub async fn download_model(model_dir: &PathBuf) -> Result<(), String> {
    use sha2::{Sha256, Digest};
    use std::fs;
    use tokio::io::AsyncWriteExt;

    let base_url = std::env::var("HF_ENDPOINT")
        .unwrap_or_else(|_| "https://hf-mirror.com".to_string());
    let repo = "Xenova/bge-small-zh-v1.5";

    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| format!("HTTP 客户端: {}", e))?;

    fs::create_dir_all(&model_dir.join("onnx"))
        .map_err(|e| format!("创建模型目录: {}", e))?;

    for (remote_path, local_rel) in MODEL_FILES {
        let local_path = model_dir.join(local_rel);
        if local_path.exists() && local_path.metadata().map(|m| m.len()).unwrap_or(0) > 100 {
            println!("[向量] 跳过: {}", local_rel);
            continue;
        }
        let url = format!("{}/{}/resolve/main/{}", base_url, repo, remote_path);
        println!("[向量] 下载: {}", remote_path);
        let response = client.get(&url).send().await
            .map_err(|e| format!("下载 {}: {}", remote_path, e))?;
        if !response.status().is_success() {
            return Err(format!("下载 {} 返回 {}", remote_path, response.status()));
        }
        let bytes = response.bytes().await
            .map_err(|e| format!("读取 {}: {}", remote_path, e))?;
        let hash = Sha256::digest(&bytes);
        println!("[向量]   SHA256: {:x} ({} bytes)", hash, bytes.len());
        let mut file = tokio::fs::File::create(&local_path).await
            .map_err(|e| format!("创建 {}: {}", local_path.display(), e))?;
        file.write_all(&bytes).await
            .map_err(|e| format!("写入 {}: {}", local_path.display(), e))?;
    }
    Ok(())
}

/// 确保 ONNX Runtime 可用 — 全平台一致性方案
/// tract-onnx 是纯 Rust，编译即用，无需运行时依赖
pub fn ensure_onnxruntime_dylib(_model_dir: &PathBuf) -> Result<String, String> {
    Ok("tract (pure-rust, no system deps)".to_string())
}
