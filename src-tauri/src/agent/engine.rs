// agent/engine.rs — Agent 核心执行引擎（tool calling + ContextPlan）
use crate::ai::{self, ChatMessage, ChatRequest, ProviderConfig, TokenCallback};
use crate::agent::{AgentContext, AgentResult, ContextPlan};
use crate::agent::prompt::{build_agent_prompt, build_user_prompt};
use crate::agent::tools::{build_tool_definitions, dispatch_tool_call, MAX_TOOL_ROUNDS};
use crate::skill::Skill;

// ─── Agent engine (v2: tool calling + ContextPlan) ───

pub async fn execute_agent(
    skill: &Skill,
    config: &ProviderConfig,
    context: &AgentContext,
    on_token: Option<TokenCallback>,
) -> Result<AgentResult, String> {
    execute_agent_with_plan(skill, config, context, on_token, &ContextPlan::default()).await
}

/// Execute agent with ContextPlan support and tool calling loop
pub async fn execute_agent_with_plan(
    skill: &Skill,
    config: &ProviderConfig,
    context: &AgentContext,
    on_token: Option<TokenCallback>,
    plan: &ContextPlan,
) -> Result<AgentResult, String> {
    // Build system prompt with ContextPlan awareness
    let system_prompt = build_agent_prompt(skill, context, plan);
    let user_prompt = build_user_prompt(context);

    let mut messages = vec![
        ChatMessage::system(system_prompt),
        ChatMessage::user(user_prompt),
    ];

    // Determine if tool calling is needed
    let has_tools = !skill.allowed_tools.is_empty();

    // Build tool definitions
    let tools = if has_tools {
        Some(build_tool_definitions(&skill.allowed_tools))
    } else {
        None
    };

    // Effort → temperature mapping
    let temperature = match skill.effort.as_deref() {
        Some("high") => 0.3,
        Some("medium") => 0.5,
        _ => 0.7,
    };

    let req = ChatRequest {
        provider_id: config.id.clone(),
        model: config.model.clone(),
        messages: messages.clone(),
        temperature: Some(temperature),
        max_tokens: Some(8192),
        stream: false,
        tools: tools.clone(),
        tool_choice: None,
    };

    // Phase 1: Send initial request
    let response = ai::chat_completion(config, &req).await?;

    let mut content = response.content.unwrap_or_default();
    let mut tool_calls = response.tool_calls.unwrap_or_default();
    let mut tool_rounds = 0u32;

    // Phase 2: Tool calling loop
    while !tool_calls.is_empty() && tool_rounds < MAX_TOOL_ROUNDS {
        tool_rounds += 1;

        // Add assistant message with tool_calls
        messages.push(ChatMessage::with_tool_calls(tool_calls.clone()));

        // Execute each tool call
        for call in &tool_calls {
            let result = dispatch_tool_call(call, context).await;
            messages.push(ChatMessage::tool(&call.id, result));
        }

        // Send next request with tool results
        let next_req = ChatRequest {
            provider_id: config.id.clone(),
            model: config.model.clone(),
            messages: messages.clone(),
            temperature: Some(temperature),
            max_tokens: Some(8192),
            stream: false,
            tools: tools.clone(),
            tool_choice: None,
        };

        let next_resp = ai::chat_completion(config, &next_req).await?;
        content = next_resp.content.unwrap_or_default();
        tool_calls = next_resp.tool_calls.unwrap_or_default();
    }

    if tool_rounds >= MAX_TOOL_ROUNDS && !tool_calls.is_empty() {
        content = format!(
            "{}\n\n（工具调用超过最大轮数 {}，已中断）",
            content, MAX_TOOL_ROUNDS
        );
    }

    // If streaming was requested, stream the accumulated content
    if let Some(callback) = on_token {
        for ch in content.chars() {
            callback(ch.to_string());
        }
    }

    let mut steps = vec!["分析请求".into(), "执行写作".into()];
    if tool_rounds > 0 {
        steps.push(format!("工具调用 ({} 轮)", tool_rounds));
    }

    Ok(AgentResult { content, steps })
}
