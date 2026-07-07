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
        "sd" | "stable-diffusion" => sd_image_gen(client, base_url, req).await,
        "comfyui" => comfyui_image_gen(client, base_url, req).await,
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
// ─── Stable Diffusion (AUTOMATIC1111 API) ───

async fn sd_image_gen(
    client: &reqwest::Client,
    base_url: &str,
    req: &ImageGenRequest,
) -> Result<ImageGenResult, String> {
    let url = format!("{}/sdapi/v1/txt2img", base_url.trim_end_matches('/'));

    let mut payload = serde_json::json!({
        "prompt": req.prompt,
        "negative_prompt": req.negative_prompt.as_deref().unwrap_or(""),
        "steps": 20,
        "batch_size": req.n.unwrap_or(1),
        "cfg_scale": 7,
    });

    // Parse size (format: "widthxheight" like "1024x1024")
    if let Some(ref size) = req.size {
        if let Some((w, h)) = size.split_once('x') {
            payload["width"] = serde_json::json!(w.parse::<u32>().unwrap_or(1024));
            payload["height"] = serde_json::json!(h.parse::<u32>().unwrap_or(1024));
        }
    }

    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&payload)
        .timeout(Duration::from_secs(300))
        .send()
        .await
        .map_err(|e| format!("SD 请求失败: {}", e))?;

    let status = response.status();
    let text = response.text().await.map_err(|e| format!("读取响应失败: {}", e))?;
    if !status.is_success() {
        return Err(format!("SD API 错误 ({}): {}", status, text));
    }

    let parsed: serde_json::Value = serde_json::from_str(&text).map_err(|e| format!("解析失败: {}", e))?;

    let data = parsed["images"]
        .as_array()
        .ok_or("SD 返回中缺少 images 字段")?
        .iter()
        .map(|img| ImageData {
            b64_json: img.as_str().map(|s| s.to_string()),
            url: None,
            revised_prompt: None,
        })
        .collect();

    Ok(ImageGenResult { data })
}

// ─── ComfyUI API ───

async fn comfyui_image_gen(
    client: &reqwest::Client,
    base_url: &str,
    req: &ImageGenRequest,
) -> Result<ImageGenResult, String> {
    let base = base_url.trim_end_matches('/');

    // Step 1: Queue prompt via ComfyUI API
    // ComfyUI expects a workflow JSON with prompt text embedded
    let queue_url = format!("{}/prompt", base);

    // Build a minimal ComfyUI workflow (user needs to provide their own for production)
    let workflow = serde_json::json!({
        "prompt": {
            "1": {
                "class_type": "CLIPTextEncode",
                "inputs": {
                    "text": req.prompt,
                    "clip": ["2", 0]
                }
            },
            "2": {
                "class_type": "CLIPSetLastLayer",
                "inputs": {
                    "stop_at_clip_layer": -1,
                    "clip": ["3", 0]
                }
            },
            "3": {
                "class_type": "CheckpointLoaderSimple",
                "inputs": {
                    "ckpt_name": "model.safetensors"
                }
            },
            "4": {
                "class_type": "KSampler",
                "inputs": {
                    "seed": 42,
                    "steps": 20,
                    "cfg": 7.0,
                    "sampler_name": "euler",
                    "scheduler": "normal",
                    "denoise": 1.0,
                    "model": ["3", 0],
                    "positive": ["1", 0],
                    "negative": ["5", 0],
                    "latent_image": ["6", 0]
                }
            },
            "5": {
                "class_type": "CLIPTextEncode",
                "inputs": {
                    "text": req.negative_prompt.as_deref().unwrap_or(""),
                    "clip": ["2", 0]
                }
            },
            "6": {
                "class_type": "EmptyLatentImage",
                "inputs": {
                    "width": 1024,
                    "height": 1024,
                    "batch_size": 1
                }
            },
            "7": {
                "class_type": "VAEDecode",
                "inputs": {
                    "vae": ["3", 2],
                    "samples": ["4", 0]
                }
            },
            "8": {
                "class_type": "SaveImage",
                "inputs": {
                    "filename_prefix": "inkwise",
                    "images": ["7", 0]
                }
            }
        }
    });

    // Override size if specified
    if let Some(ref size) = req.size {
        if let Some((w, h)) = size.split_once('x') {
            if let Some(width) = w.parse::<u32>().ok() {
                if let Some(height) = h.parse::<u32>().ok() {
                    if let Some(obj) = workflow["prompt"]["6"].as_object() {
                        let mut inputs = obj.get("inputs").unwrap().as_object().unwrap().clone();
                        inputs.insert("width".to_string(), serde_json::json!(width));
                        inputs.insert("height".to_string(), serde_json::json!(height));
                    }
                }
            }
        }
    }

    let response = client
        .post(&queue_url)
        .header("Content-Type", "application/json")
        .json(&workflow)
        .timeout(Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("ComfyUI 队列请求失败: {}", e))?;

    let status = response.status();
    let text = response.text().await.map_err(|e| format!("读取响应失败: {}", e))?;
    if !status.is_success() {
        return Err(format!("ComfyUI API 错误 ({}): {}", status, text));
    }

    // Step 2: ComfyUI returns a prompt_id - we'd need to poll for results
    // For now, return the prompt_id in revised_prompt for follow-up
    let parsed: serde_json::Value = serde_json::from_str(&text).map_err(|e| format!("解析失败: {}", e))?;
    let prompt_id = parsed["prompt_id"].as_str().unwrap_or("unknown").to_string();

    // Return placeholder - actual image fetching requires polling
    Ok(ImageGenResult {
        data: vec![ImageData {
            b64_json: None,
            url: Some(format!("{}/view?prompt_id={}", base, prompt_id)),
            revised_prompt: Some(format!("ComfyUI prompt_id: {}", prompt_id)),
        }],
    })
}

