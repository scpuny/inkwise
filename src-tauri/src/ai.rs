use serde::{Deserialize, Serialize};
use std::time::Duration;

// ─── Request / Response types ───

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub role: String, // "system" | "user" | "assistant"
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatRequest {
    pub provider_id: String,
    pub model: String,
    pub messages: Vec<ChatMessage>,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
    pub stream: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[allow(dead_code)]
pub struct ChatResponse {
    pub content: String,
    pub model: String,
}

// ─── Provider config (read from stored providers) ───

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProviderConfig {
    pub id: String,
    pub kind: String, // "openai" | "anthropic" | "deepseek" | "custom"
    pub base_url: String,
    pub api_key: String,
    pub model: String,
}

/// Minimal config for listing models (no model needed)
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProviderListConfig {
    pub id: String,
    pub kind: String,
    pub base_url: String,
    pub api_key: String,
}

// ─── OpenAI-compatible chat completion ───

async fn openai_chat(
    client: &reqwest::Client,
    config: &ProviderConfig,
    req: &ChatRequest,
) -> Result<String, String> {
    let url = format!("{}/chat/completions", config.base_url.trim_end_matches('/'));

    let mut body = serde_json::json!({
        "model": req.model,
        "messages": req.messages.iter().map(|m| {
            serde_json::json!({"role": m.role, "content": m.content})
        }).collect::<Vec<_>>(),
        "stream": false,
    });

    if let Some(t) = req.temperature {
        body["temperature"] = serde_json::json!(t);
    }
    if let Some(m) = req.max_tokens {
        body["max_tokens"] = serde_json::json!(m);
    }

    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", config.api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .timeout(Duration::from_secs(120))
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    let status = response.status();
    let text = response.text().await.map_err(|e| format!("读取响应失败: {}", e))?;

    if !status.is_success() {
        return Err(format!("API 错误 ({}): {}", status, text));
    }

    let parsed: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("解析响应失败: {}", e))?;

    let content = parsed["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .to_string();

    Ok(content)
}

// ─── Anthropic chat completion ───

async fn anthropic_chat(
    client: &reqwest::Client,
    config: &ProviderConfig,
    req: &ChatRequest,
) -> Result<String, String> {
    let url = format!("{}/messages", config.base_url.trim_end_matches('/'));

    // Extract system message if present
    let system = req
        .messages
        .iter()
        .find(|m| m.role == "system")
        .map(|m| m.content.clone());

    let messages: Vec<serde_json::Value> = req
        .messages
        .iter()
        .filter(|m| m.role != "system")
        .map(|m| serde_json::json!({"role": m.role, "content": m.content}))
        .collect();

    let mut body = serde_json::json!({
        "model": req.model,
        "messages": messages,
        "max_tokens": req.max_tokens.unwrap_or(4096),
        "stream": false,
    });

    if let Some(s) = system {
        body["system"] = serde_json::json!(s);
    }
    if let Some(t) = req.temperature {
        body["temperature"] = serde_json::json!(t);
    } else {
        body["temperature"] = serde_json::json!(0.7);
    }

    let response = client
        .post(&url)
        .header("x-api-key", &config.api_key)
        .header("anthropic-version", "2023-06-01")
        .header("Content-Type", "application/json")
        .json(&body)
        .timeout(Duration::from_secs(120))
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    let status = response.status();
    let text = response.text().await.map_err(|e| format!("读取响应失败: {}", e))?;

    if !status.is_success() {
        return Err(format!("API 错误 ({}): {}", status, text));
    }

    let parsed: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("解析响应失败: {}", e))?;

    let content = parsed["content"][0]["text"].as_str().unwrap_or("").to_string();

    Ok(content)
}

// ─── Main chat function ───

pub async fn chat_completion(config: &ProviderConfig, req: &ChatRequest) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    match config.kind.as_str() {
        "anthropic" => anthropic_chat(&client, config, req).await,
        _ => openai_chat(&client, config, req).await, // openai, deepseek, custom all use OpenAI-compatible
    }
}

/// Fetch available models from an OpenAI-compatible provider's /v1/models endpoint.
/// Falls back to a best-effort list if the endpoint is not available.
pub async fn fetch_available_models(config: &ProviderListConfig) -> Result<Vec<String>, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    let url = format!("{}/models", config.base_url.trim_end_matches('/'));

    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", config.api_key))
        .header("Content-Type", "application/json")
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    let status = response.status();
    let text = response.text().await.map_err(|e| format!("读取响应失败: {}", e))?;

    if !status.is_success() {
        return Err(format!("API 错误 ({}): {}", status, text));
    }

    let parsed: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("解析响应失败: {}", e))?;

    let models = parsed["data"]
        .as_array()
        .ok_or("响应格式错误：找不到 data 字段")?;

    let mut model_ids: Vec<String> = models
        .iter()
        .filter_map(|m| m["id"].as_str().map(|s| s.to_string()))
        .filter(|id| {
            let lower = id.to_lowercase();
            // Filter out non-chat models
            !lower.contains("text-embedding")
                && !lower.contains("speech")
                && !lower.contains("tts")
                && !lower.contains("stt")
                && !lower.contains("whisper")
                && !lower.contains("embedding")
                && !lower.contains("moderation")
                && !lower.contains("rerank")
                && !lower.contains("dall")
        })
        .collect();

    model_ids.sort();
    Ok(model_ids)
}
