use crate::ai::{self, ChatMessage, ChatRequest, ProviderConfig, TokenCallback};
use crate::skill::Skill;
use crate::store::ArticleBlueprint;

use serde::{Deserialize, Serialize};

// ─── Agent execution result ───

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AgentResult {
    pub content: String,
    pub steps: Vec<String>,
}

// ─── Agent context (enriched with blueprint) ───

pub struct AgentContext {
    pub document_content: String,
    pub selected_text: Option<String>,
    pub user_input: String,
    pub blueprint: Option<ArticleBlueprint>,
    pub current_section_id: Option<String>,
}

// ─── Agent engine ───

pub async fn execute_agent(
    skill: &Skill,
    config: &ProviderConfig,
    context: &AgentContext,
    on_token: Option<TokenCallback>,
) -> Result<AgentResult, String> {
    // Build agent prompt with blueprint context
    let system_prompt = build_agent_prompt(skill, context);
    let user_prompt = build_user_prompt(context);

    let messages = vec![
        ChatMessage { role: "system".into(), content: system_prompt },
        ChatMessage { role: "user".into(), content: user_prompt },
    ];

    let req = ChatRequest {
        provider_id: config.id.clone(),
        model: config.model.clone(),
        messages,
        temperature: Some(0.7),
        max_tokens: Some(4096),
        stream: on_token.is_some(),
    };

    let response = if let Some(callback) = on_token {
        ai::chat_completion_stream(config, &req, callback).await?
    } else {
        ai::chat_completion(config, &req).await?
    };

    Ok(AgentResult {
        content: response,
        steps: vec!["分析请求".into(), "执行写作".into()],
    })
}

fn build_agent_prompt(skill: &Skill, context: &AgentContext) -> String {
    let mut prompt = String::new();

    // Inject blueprint context (article structure)
    if let Some(ref bp) = context.blueprint {
        prompt.push_str("# 文章信息\n\n");
        prompt.push_str(&format!("## 标题\n{}\n", bp.working_title));
        if !bp.description.is_empty() {
            prompt.push_str(&format!("## 简介\n{}\n", bp.description));
        }
        if let Some(ref tone) = bp.tone {
            prompt.push_str(&format!("## 语气风格\n{}\n", tone));
        }
        if let Some(ref audience) = bp.target_audience {
            prompt.push_str(&format!("## 目标读者\n{}\n", audience));
        }
        if let Some(wc) = bp.target_word_count {
            prompt.push_str(&format!("## 目标字数\n{} 字\n", wc));
        }

        // Outline with current section marker
        if !bp.outline.is_empty() {
            prompt.push_str("## 文章大纲\n");
            for (i, section) in bp.outline.iter().enumerate() {
                let marker = if let Some(ref cur_id) = context.current_section_id {
                    if section.id == *cur_id { " ← 当前位置" } else { "" }
                } else { "" };
                let desc = section.description.as_ref()
                    .map(|d| format!(" — {}", d))
                    .unwrap_or_default();
                let _status = match section.status.as_str() {
                    "complete" => "✅",
                    "writing" => "✍️",
                    "revised" => "📝",
                    _ => "⏳",
                };
                prompt.push_str(&format!("{}. {}{}{}\n", i + 1, section.title, desc, marker));
            }
        }
        prompt.push_str("\n");
    }

    // Skill body
    prompt.push_str(&skill.body);
    prompt.push_str("\n\n");

    // Agent instructions
    prompt.push_str("# Agent 指令\n\n");
    prompt.push_str("你是一个 AI 写作助手 Agent。请根据用户请求和当前文档上下文完成写作任务。\n\n");
    prompt.push_str("## 流程\n");
    prompt.push_str("1. 理解用户请求\n");
    prompt.push_str("2. 如果需要读取文档内容，使用提供的上下文\n");
    prompt.push_str("3. 执行写作任务\n");
    prompt.push_str("4. 输出最终结果\n\n");

    // Tool info
    prompt.push_str("## 可用工具\n");
    if skill.allowed_tools.contains(&"read_document".to_string()) {
        prompt.push_str("- read_document: 读取当前文档内容\n");
    }
    if skill.allowed_tools.contains(&"write_document".to_string()) {
        prompt.push_str("- write_document: 写入内容到文档\n");
    }
    if skill.allowed_tools.contains(&"search_document".to_string()) {
        prompt.push_str("- search_document: 搜索文档中的特定内容\n");
    }
    prompt.push_str("\n");

    // Output format
    prompt.push_str("## 输出格式\n");
    prompt.push_str("直接输出结果，无需额外解释。\n");

    prompt
}

fn build_user_prompt(context: &AgentContext) -> String {
    let mut prompt = String::new();
    prompt.push_str(&context.user_input);
    prompt.push_str("\n\n");

    // Add selected text context
    if let Some(ref sel) = context.selected_text {
        if !sel.is_empty() {
            prompt.push_str("## 选中的文本\n```\n");
            prompt.push_str(sel);
            prompt.push_str("\n```\n\n");
        }
    }

    // Add document context
    if !context.document_content.is_empty() {
        prompt.push_str("## 当前文档内容\n");
        // The frontend already prepends blueprint context to document_content,
        // so this may already include the full article structure info
        prompt.push_str("```\n");
        let doc = if context.document_content.len() > 3000 {
            let target = context.document_content.len() - 3000;
            // Find the nearest char boundary to avoid slicing in the middle of a multi-byte char
            let start = if target > 0 && !context.document_content.is_char_boundary(target) {
                (target..context.document_content.len()).find(|&i| context.document_content.is_char_boundary(i)).unwrap_or(target)
            } else {
                target
            };
            let truncated = &context.document_content[start..];
            format!("...(前略)\n{}", truncated)
        } else {
            context.document_content.clone()
        };
        prompt.push_str(&doc);
        prompt.push_str("\n```\n");
    }

    prompt
}
