// image_gen.rs — 图片生成引擎
// 支持 OpenAI DALL·E 3 / OpenAI-compatible 绘图 API

use serde::{Deserialize, Serialize};
use std::time::Duration;

// ─── Request / Response types ───

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageGenRequest {
    pub provider_id: String,
    pub model: String,
    pub prompt: String,
    pub negative_prompt: Option<String>,
    pub size: Option<String>,
    pub quality: Option<String>,
    pub style: Option<String>,
    pub n: Option<u8>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImageGenResult {
    pub data: Vec<ImageData>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImageData {
    pub b64_json: Option<String>,
    pub url: Option<String>,
    pub revised_prompt: Option<String>,
}

// ─── Dispatcher ───

pub async fn generate_image(
    client: &reqwest::Client,
    provider_kind: &str,
    base_url: &str,
    api_key: &str,
    req: &ImageGenRequest,
) -> Result<ImageGenResult, String> {
    match provider_kind {
        "openai" | "custom" => openai_image_gen(client, base_url, api_key, req).await,
        _ => Err(format!("不支持的 provider 类型: {}", provider_kind)),
    }
}

// ─── OpenAI DALL·E 3 ───

async fn openai_image_gen(
    client: &reqwest::Client,
    base_url: &str,
    api_key: &str,
    req: &ImageGenRequest,
) -> Result<ImageGenResult, String> {
    let url = format!("{}/images/generations", base_url.trim_end_matches('/'));

    let mut body = serde_json::json!({
        "model": req.model,
        "prompt": req.prompt,
        "n": req.n.unwrap_or(1),
    });

    if let Some(ref size) = req.size {
        body["size"] = serde_json::json!(size);
    }
    // response_format is only supported by DALL-E models
    if req.model.to_lowercase().contains("dall-e") {
        body["response_format"] = serde_json::json!("b64_json");
        if let Some(ref quality) = req.quality {
            body["quality"] = serde_json::json!(quality);
        }
        if let Some(ref style) = req.style {
            body["style"] = serde_json::json!(style);
        }
    }

    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .timeout(Duration::from_secs(120))
        .send()
        .await
        .map_err(|e| format!("图片生成请求失败: {}", e))?;

    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|e| format!("读取响应失败: {}", e))?;

    if !status.is_success() {
        return Err(format!("图片 API 错误 ({}): {}", status, text));
    }

    let parsed: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("解析响应失败: {}", e))?;

    let data = parsed["data"]
        .as_array()
        .ok_or("API 返回中缺少 data 字段")?
        .iter()
        .map(|item| ImageData {
            b64_json: item["b64_json"].as_str().map(|s| s.to_string()),
            url: item["url"].as_str().map(|s| s.to_string()),
            revised_prompt: item["revised_prompt"].as_str().map(|s| s.to_string()),
        })
        .collect();

    Ok(ImageGenResult { data })
}
