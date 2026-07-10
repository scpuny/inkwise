// ai.rs — AI 聊天接口，支持多 provider 和 function/tool calling
use crate::store::DataStore;
use std::sync::Mutex;
use serde::{Deserialize, Serialize};
use std::time::Duration;

// ─── Request / Response types ───

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub role: String,  // "system" | "user" | "assistant" | "tool"
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

impl ChatMessage {
    pub fn system(content: impl Into<String>) -> Self {
        Self { role: "system".into(), content: Some(content.into()), tool_calls: None, tool_call_id: None, name: None }
    }
    pub fn user(content: impl Into<String>) -> Self {
        Self { role: "user".into(), content: Some(content.into()), tool_calls: None, tool_call_id: None, name: None }
    }
    #[allow(dead_code)]
    pub fn assistant(content: impl Into<String>) -> Self {
        Self { role: "assistant".into(), content: Some(content.into()), tool_calls: None, tool_call_id: None, name: None }
    }
    pub fn tool(tool_call_id: impl Into<String>, content: impl Into<String>) -> Self {
        Self { role: "tool".into(), content: Some(content.into()), tool_calls: None, tool_call_id: Some(tool_call_id.into()), name: None }
    }
    pub fn with_tool_calls(tool_calls: Vec<ToolCall>) -> Self {
        Self { role: "assistant".into(), content: None, tool_calls: Some(tool_calls), tool_call_id: None, name: None }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolDefinition {
    pub function: ToolFunction,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolFunction {
    pub name: String,
    pub description: String,
    pub parameters: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolCall {
    pub id: String,
    #[serde(rename = "type")]
    pub tool_type: String,
    pub function: ToolCallFunction,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolCallFunction {
    pub name: String,
    pub arguments: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatToolResponse {
    pub content: Option<String>,
    pub thinking: Option<String>,
    pub tool_calls: Option<Vec<ToolCall>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatRequest {
    pub provider_id: String,
    pub model: String,
    pub messages: Vec<ChatMessage>,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
    pub stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tools: Option<Vec<ToolDefinition>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_choice: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[allow(dead_code)]
pub struct ChatResponse {
    pub content: String,
    pub model: String,
}

// ─── Provider config ───

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProviderConfig {
    pub id: String,
    pub kind: String, // "openai" | "anthropic" | "deepseek" | "custom"
    pub base_url: String,
    pub api_key: String,
    pub model: String,
}

/// Minimal config for listing models
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProviderListConfig {
    pub id: String,
    pub kind: String,
    pub base_url: String,
    pub api_key: String,
}

// ─── Provider resolution ───

/// Look up a provider and build a ProviderConfig.
/// If `provider_id` is Some, finds by id.
/// If `model` is Some, tries to find the provider that has that model first.
/// Otherwise uses the first enabled provider,
/// but prefers the user's default model from AiConfig when available.
pub fn resolve_provider(
    store: &Mutex<DataStore>,
    provider_id: Option<&str>,
    model: Option<&str>,
) -> Result<ProviderConfig, String> {
    let store = store.lock().map_err(|e| e.to_string())?;
    let providers = store.load_providers();

    // If no model specified, try to use the user's saved default model from AiConfig
    let effective_model: Option<String> = model
        .map(|m| m.to_string())
        .or_else(|| {
            store.load_ai_config()
                .and_then(|cfg| cfg.default_model)
                .filter(|m| !m.is_empty())
        });

    // If we have a specific model but no provider_id, find the provider that has it
    let provider = match provider_id {
        Some(pid) => providers.iter().find(|p| p.id == pid)
            .ok_or_else(|| format!("未找到提供商: {pid}"))?,
        None => {
            // Try to find a provider that has the requested model
            if let Some(ref m) = effective_model {
                if let Some(p) = providers.iter().find(|p| {
                    p.enabled && p.models.iter().any(|pm| pm.id == *m)
                }) {
                    p
                } else {
                    providers.iter().find(|p| p.enabled && !p.models.is_empty())
                        .ok_or_else(|| "没有已启用的 AI 提供商".to_string())?
                }
            } else {
                providers.iter().find(|p| p.enabled && !p.models.is_empty())
                    .ok_or_else(|| "没有已启用的 AI 提供商".to_string())?
            }
        },
    };

    let model = effective_model.unwrap_or_else(|| provider.models[0].id.clone());

    Ok(ProviderConfig {
        id: provider.id.clone(),
        kind: provider.kind.clone(),
        base_url: provider.base_url.clone().unwrap_or_else(|| match provider.kind.as_str() {
            "anthropic" => "https://api.anthropic.com/v1".into(),
            "deepseek" => "https://api.deepseek.com/v1".into(),
            _ => "https://api.openai.com/v1".into(),
        }),
        api_key: provider.api_key.clone().ok_or("未配置 API Key")?,
        model,
    })
}

// ─── Callback type ───

pub type TokenCallback = Box<dyn Fn(String) + Send + Sync>;

// ─── SSE parser ───

fn parse_sse_line(line: &str) -> Option<String> {
    let line = line.trim();
    if !line.starts_with("data: ") {
        return None;
    }
    let data = &line[6..];
    if data == "[DONE]" {
        return None;
    }
    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(data) {
        // OpenAI: choices[0].delta.content
        if let Some(choice) = parsed["choices"].as_array()?.first() {
            if let Some(delta) = choice["delta"].as_object() {
                if let Some(content) = delta.get("content") {
                    return content.as_str().map(|s| s.to_string());
                }
                // OpenAI reasoning models: delta.reasoning_content
                if let Some(reasoning) = delta.get("reasoning_content") {
                    return reasoning.as_str().map(|s| s.to_string());
                }
            }
        }
        // Anthropic: content_block_delta
        if parsed["type"] == "content_block_delta" {
            if let Some(text) = parsed["delta"]["text"].as_str() {
                return Some(text.to_string());
            }
        }
    }
    None
}

// ─── Message builders ───

fn build_openai_messages(messages: &[ChatMessage]) -> Vec<serde_json::Value> {
    messages.iter().map(|m| {
        let mut msg = serde_json::json!({"role": m.role});
        if let Some(ref content) = m.content {
            msg["content"] = serde_json::json!(content);
        } else if m.tool_calls.is_some() {
            msg["content"] = serde_json::Value::Null;
        } else {
            msg["content"] = serde_json::json!("");
        }
        if let Some(ref calls) = m.tool_calls {
            // Build tool_calls JSON manually to ensure correct format
            let calls_json: Vec<serde_json::Value> = calls.iter().map(|tc| {
                serde_json::json!({
                    "id": tc.id,
                    "type": tc.tool_type,
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments,
                    }
                })
            }).collect();
            msg["tool_calls"] = serde_json::json!(calls_json);
        }
        if let Some(ref id) = m.tool_call_id {
            msg["tool_call_id"] = serde_json::json!(id);
        }
        if let Some(ref name) = m.name {
            msg["name"] = serde_json::json!(name);
        }
        msg
    }).collect()
}

fn build_anthropic_messages(messages: &[ChatMessage]) -> (Vec<serde_json::Value>, Option<String>) {
    let mut system: Option<String> = None;
    let msgs: Vec<serde_json::Value> = messages.iter().filter_map(|m| {
        if m.role == "system" {
            system = m.content.clone();
            return None;
        }
        let mut msg = serde_json::json!({"role": m.role});

        if let Some(ref content) = m.content {
            if m.role == "tool" {
                msg["content"] = serde_json::json!([
                    {
                        "type": "tool_result",
                        "tool_use_id": m.tool_call_id.as_deref().unwrap_or(""),
                        "content": content
                    }
                ]);
            } else {
                msg["content"] = serde_json::json!(content);
            }
        } else if let Some(ref calls) = m.tool_calls {
            let mut blocks = vec![serde_json::json!({"type": "text", "text": ""})];
            for tc in calls {
                let input: serde_json::Value = serde_json::from_str(&tc.function.arguments).unwrap_or(serde_json::json!({}));
                blocks.push(serde_json::json!({
                    "type": "tool_use",
                    "id": tc.id,
                    "name": tc.function.name,
                    "input": input
                }));
            }
            msg["content"] = serde_json::json!(blocks);
        } else {
            msg["content"] = serde_json::json!("");
        }
        Some(msg)
    }).collect();
    (msgs, system)
}

// ─── OpenAI-compatible chat completion with tool support ───

async fn openai_chat(
    client: &reqwest::Client,
    config: &ProviderConfig,
    req: &ChatRequest,
) -> Result<ChatToolResponse, String> {
    let url = format!("{}/chat/completions", config.base_url.trim_end_matches('/'));

    let mut body = serde_json::json!({
        "model": req.model,
        "messages": build_openai_messages(&req.messages),
        "stream": false,
    });

    if let Some(t) = req.temperature {
        body["temperature"] = serde_json::json!(t);
    }
    if let Some(m) = req.max_tokens {
        body["max_tokens"] = serde_json::json!(m);
    }
    if let Some(ref tools) = req.tools {
        // Build tools JSON manually to ensure correct format
        let tools_json: Vec<serde_json::Value> = tools.iter().map(|t| {
            serde_json::json!({
                "type": "function",
                "function": {
                    "name": t.function.name,
                    "description": t.function.description,
                    "parameters": t.function.parameters,
                }
            })
        }).collect();
        body["tools"] = serde_json::json!(tools_json);
    }
    if let Some(ref choice) = req.tool_choice {
        body["tool_choice"] = choice.clone();
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

    let message = &parsed["choices"][0]["message"];
    let content = message["content"].as_str().map(|s| s.to_string()).filter(|s| !s.is_empty());

    // Parse reasoning/thinking content (OpenAI o-series, DeepSeek R1, etc.)
    let thinking = message.get("reasoning_content")
        .or_else(|| message.get("reasoning"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .filter(|s| !s.is_empty());

    let tool_calls = message["tool_calls"].as_array().map(|arr| {
        arr.iter().map(|tc| ToolCall {
            id: tc["id"].as_str().unwrap_or("").to_string(),
            tool_type: tc["type"].as_str().unwrap_or("function").to_string(),
            function: ToolCallFunction {
                name: tc["function"]["name"].as_str().unwrap_or("").to_string(),
                arguments: tc["function"]["arguments"].as_str().unwrap_or("{}").to_string(),
            },
        }).collect::<Vec<_>>()
    }).filter(|v: &Vec<ToolCall>| !v.is_empty());

    Ok(ChatToolResponse { content, thinking, tool_calls })
}

// ─── OpenAI-compatible streaming ───

async fn openai_chat_stream(
    client: &reqwest::Client,
    config: &ProviderConfig,
    req: &ChatRequest,
    on_token: &TokenCallback,
) -> Result<String, String> {
    let url = format!("{}/chat/completions", config.base_url.trim_end_matches('/'));

    let mut body = serde_json::json!({
        "model": req.model,
        "messages": build_openai_messages(&req.messages),
        "stream": true,
    });

    if let Some(t) = req.temperature {
        body["temperature"] = serde_json::json!(t);
    }
    if let Some(m) = req.max_tokens {
        body["max_tokens"] = serde_json::json!(m);
    }
    if let Some(ref tools) = req.tools {
        let tools_json: Vec<serde_json::Value> = tools.iter().map(|t| {
            serde_json::json!({
                "type": "function",
                "function": {
                    "name": t.function.name,
                    "description": t.function.description,
                    "parameters": t.function.parameters,
                }
            })
        }).collect();
        body["tools"] = serde_json::json!(tools_json);
    }

    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", config.api_key))
        .header("Content-Type", "application/json")
        .header("Accept", "text/event-stream")
        .json(&body)
        .timeout(Duration::from_secs(180))
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    let status = response.status();
    if !status.is_success() {
        let text = response.text().await.unwrap_or_default();
        return Err(format!("API 错误 ({}): {}", status, text));
    }

    let mut full_content = String::new();
    let mut stream = response.bytes_stream();
    use futures_util::StreamExt;
    let mut raw_buf: Vec<u8> = Vec::new();

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("读取流失败: {}", e))?;
        raw_buf.extend_from_slice(&chunk);

        // 只在完整的 SSE event 边界 (\n\n) 处解码，避免 UTF-8 跨 chunk 截断
        loop {
            let event_end = raw_buf.windows(2)
                .position(|w| w == b"\n\n");
            match event_end {
                Some(pos) => {
                    let event_bytes = &raw_buf[..pos];
                    // 完整 event 应为有效 UTF-8，用 from_utf8 而非 from_utf8_lossy
                    match String::from_utf8(event_bytes.to_vec()) {
                        Ok(event_str) => {
                            raw_buf.drain(..pos + 2);
                            for line in event_str.lines() {
                                if let Some(token) = parse_sse_line(line) {
                                    full_content.push_str(&token);
                                    on_token(token);
                                }
                            }
                        }
                        // 事件仍被跨 chunk 截断 → 保留字节等待下一个 chunk
                        Err(_) => break,
                    }
                }
                None => break,
            }
        }
    }

    // 尾部残留（可能不完整，fallback 到 lossy）
    if !raw_buf.is_empty() {
        let remaining = String::from_utf8_lossy(&raw_buf);
        for line in remaining.lines() {
            if let Some(token) = parse_sse_line(line) {
                full_content.push_str(&token);
                on_token(token);
            }
        }
    }

    Ok(full_content)
}

// ─── OpenAI-compatible non-streaming legacy (no tools) ───

async fn openai_chat_legacy(
    client: &reqwest::Client,
    config: &ProviderConfig,
    req: &ChatRequest,
) -> Result<String, String> {
    let url = format!("{}/chat/completions", config.base_url.trim_end_matches('/'));

    let mut body = serde_json::json!({
        "model": req.model,
        "messages": build_openai_messages(&req.messages),
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

// ─── Anthropic chat completion with tool support ───

async fn anthropic_chat(
    client: &reqwest::Client,
    config: &ProviderConfig,
    req: &ChatRequest,
) -> Result<ChatToolResponse, String> {
    let url = format!("{}/messages", config.base_url.trim_end_matches('/'));

    let (messages, system) = build_anthropic_messages(&req.messages);

    let mut body = serde_json::json!({
        "model": req.model,
        "messages": messages,
        "max_tokens": req.max_tokens.unwrap_or(4096),
    });

    if let Some(s) = system {
        body["system"] = serde_json::json!(s);
    }
    if let Some(t) = req.temperature {
        body["temperature"] = serde_json::json!(t);
    }
    if let Some(ref tools) = req.tools {
        // Anthropic tool format: name, description, input_schema
        let tools_json: Vec<serde_json::Value> = tools.iter().map(|t| {
            serde_json::json!({
                "name": t.function.name,
                "description": t.function.description,
                "input_schema": t.function.parameters,
            })
        }).collect();
        body["tools"] = serde_json::json!(tools_json);
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
        return Err(format!("Anthropic API 错误 ({}): {}", status, text));
    }

    let parsed: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("解析响应失败: {}", e))?;

    // Parse Anthropic response format
    let mut content = String::new();
    let mut tool_calls: Vec<ToolCall> = Vec::new();

    if let Some(blocks) = parsed["content"].as_array() {
        for block in blocks {
            match block["type"].as_str() {
                Some("text") => {
                    if let Some(text) = block["text"].as_str() {
                        content.push_str(text);
                    }
                }
                Some("tool_use") => {
                    let id = block["id"].as_str().unwrap_or("").to_string();
                    let name = block["name"].as_str().unwrap_or("").to_string();
                    let input = block["input"].clone();
                    let arguments = serde_json::to_string(&input).unwrap_or_else(|_| "{}".to_string());
                    tool_calls.push(ToolCall {
                        id,
                        tool_type: "function".to_string(),
                        function: ToolCallFunction { name, arguments },
                    });
                }
                _ => {}
            }
        }
    }

    let content = if content.is_empty() { None } else { Some(content) };
    let tool_calls = if tool_calls.is_empty() { None } else { Some(tool_calls) };

    // Anthropic thinking content
    let thinking = parsed.get("thinking")
        .or_else(|| parsed.get("reasoning"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .filter(|s| !s.is_empty());

    Ok(ChatToolResponse { content, thinking, tool_calls })
}

// ─── Streaming ───

async fn anthropic_chat_stream(
    client: &reqwest::Client,
    config: &ProviderConfig,
    req: &ChatRequest,
    on_token: &TokenCallback,
) -> Result<String, String> {
    let url = format!("{}/messages", config.base_url.trim_end_matches('/'));

    let (messages, system) = build_anthropic_messages(&req.messages);

    let mut body = serde_json::json!({
        "model": req.model,
        "messages": messages,
        "max_tokens": req.max_tokens.unwrap_or(4096),
        "stream": true,
    });

    if let Some(s) = system {
        body["system"] = serde_json::json!(s);
    }
    if let Some(t) = req.temperature {
        body["temperature"] = serde_json::json!(t);
    }
    if let Some(ref tools) = req.tools {
        let tools_json: Vec<serde_json::Value> = tools.iter().map(|t| {
            serde_json::json!({
                "name": t.function.name,
                "description": t.function.description,
                "input_schema": t.function.parameters,
            })
        }).collect();
        body["tools"] = serde_json::json!(tools_json);
    }

    let response = client
        .post(&url)
        .header("x-api-key", &config.api_key)
        .header("anthropic-version", "2023-06-01")
        .header("Content-Type", "application/json")
        .header("Accept", "text/event-stream")
        .json(&body)
        .timeout(Duration::from_secs(180))
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    let status = response.status();
    if !status.is_success() {
        let text = response.text().await.unwrap_or_default();
        return Err(format!("Anthropic API 错误 ({}): {}", status, text));
    }

    let mut full_content = String::new();
    let mut stream = response.bytes_stream();
    use futures_util::StreamExt;
    let mut raw_buf: Vec<u8> = Vec::new();

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("读取流失败: {}", e))?;
        raw_buf.extend_from_slice(&chunk);

        loop {
            let event_end = raw_buf.windows(2)
                .position(|w| w == b"\n\n");
            match event_end {
                Some(pos) => {
                    let event_bytes = &raw_buf[..pos];
                    match String::from_utf8(event_bytes.to_vec()) {
                        Ok(event_str) => {
                            raw_buf.drain(..pos + 2);
                            for line in event_str.lines() {
                                if let Some(token) = parse_sse_line(line) {
                                    full_content.push_str(&token);
                                    on_token(token);
                                }
                            }
                        }
                        Err(_) => break,
                    }
                }
                None => break,
            }
        }
    }

    if !raw_buf.is_empty() {
        let remaining = String::from_utf8_lossy(&raw_buf);
        for line in remaining.lines() {
            if let Some(token) = parse_sse_line(line) {
                full_content.push_str(&token);
                on_token(token);
            }
        }
    }

    Ok(full_content)
}

// ─── Public API ───

/// Non-streaming chat completion with optional tool support.
/// Returns structured response with content and/or tool_calls.
pub async fn chat_completion(config: &ProviderConfig, req: &ChatRequest) -> Result<ChatToolResponse, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    match config.kind.as_str() {
        "anthropic" => anthropic_chat(&client, config, req).await,
        _ => openai_chat(&client, config, req).await,
    }
}

/// Non-streaming chat that returns only the text content (backward compat).
pub async fn chat_completion_text(config: &ProviderConfig, req: &ChatRequest) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    match config.kind.as_str() {
        "anthropic" => {
            let resp = anthropic_chat(&client, config, req).await?;
            Ok(resp.content.unwrap_or_default())
        }
        _ => openai_chat_legacy(&client, config, req).await,
    }
}

/// Streaming chat completion. Returns the full accumulated content.
pub async fn chat_completion_stream(
    config: &ProviderConfig,
    req: &ChatRequest,
    on_token: TokenCallback,
) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(180))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    match config.kind.as_str() {
        "anthropic" => anthropic_chat_stream(&client, config, req, &on_token).await,
        _ => openai_chat_stream(&client, config, req, &on_token).await,
    }
}

/// Fetch available models from provider.
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
