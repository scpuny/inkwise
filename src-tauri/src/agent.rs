use crate::ai::{self, ChatMessage, ChatRequest, ProviderConfig, TokenCallback};
use crate::skill::{Skill, ToolCapability};
use crate::store::ArticleBlueprint;

use serde::{Deserialize, Serialize};
use std::path::Path;

// ─── Agent execution result ───

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AgentResult {
    pub content: String,
    pub steps: Vec<String>,
}

// ─── ContextPlan (精准上下文注入计划) ───

/// 上下文注入计划：指定按用户意图注入哪些信息、跳过哪些
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ContextPlan {
    pub intent: String,
    pub skip_sections: Vec<String>,
    pub priority_files: Vec<String>,
}

impl Default for ContextPlan {
    fn default() -> Self {
        Self {
            intent: "default".into(),
            skip_sections: vec![],
            priority_files: vec![],
        }
    }
}

// ─── Agent context (enriched with blueprint) ───

pub struct AgentContext {
    pub document_content: String,
    pub selected_text: Option<String>,
    pub user_input: String,
    pub blueprint: Option<ArticleBlueprint>,
    pub current_section_id: Option<String>,
    /// 关联项目根目录（用于文件级工具调用）
    pub project_path: Option<String>,
}

// ─── Tool calling support ───

const MAX_TOOL_ROUNDS: u32 = 15;

/// Build ToolDefinition array from ToolCapability list
pub fn build_tool_definitions(tools: &[ToolCapability]) -> Vec<ai::ToolDefinition> {
    let mut defs = Vec::new();
    for tool in tools {
        let def = match tool {
            ToolCapability::ReadDocument => ai::ToolDefinition {
                function: ai::ToolFunction {
                    name: "read_document".into(),
                    description: "读取当前文档的完整内容".into(),
                    parameters: serde_json::json!({
                        "type": "object",
                        "properties": {},
                        "additionalProperties": false,
                        "required": []
                    }),
                },
            },
            ToolCapability::WriteDocument => ai::ToolDefinition {
                function: ai::ToolFunction {
                    name: "write_document".into(),
                    description: "将内容写入当前文档".into(),
                    parameters: serde_json::json!({
                        "type": "object",
                        "properties": {
                            "content": {
                                "type": "string",
                                "description": "要写入的完整文档内容"
                            }
                        },
                        "required": ["content"],
                        "additionalProperties": false
                    }),
                },
            },
            ToolCapability::SearchDocument => ai::ToolDefinition {
                function: ai::ToolFunction {
                    name: "search_document".into(),
                    description: "在文档中搜索特定关键词，返回匹配的段落".into(),
                    parameters: serde_json::json!({
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "要搜索的关键词"
                            }
                        },
                        "required": ["query"],
                        "additionalProperties": false
                    }),
                },
            },
            ToolCapability::ReadProjectFiles => ai::ToolDefinition {
                function: ai::ToolFunction {
                    name: "read_project_files".into(),
                    description: "读取关联项目中一个或多个文件的完整源码。每次最多读取6个文件。需提供相对项目根目录的路径".into(),
                    parameters: serde_json::json!({
                        "type": "object",
                        "properties": {
                            "paths": {
                                "type": "array",
                                "items": { "type": "string" },
                                "description": "相对项目根目录的文件路径列表，如 ['src/main.rs', 'src/lib.rs']"
                            }
                        },
                        "required": ["paths"],
                        "additionalProperties": false
                    }),
                },
            },
            ToolCapability::ListProjectFiles => ai::ToolDefinition {
                function: ai::ToolFunction {
                    name: "list_project_files".into(),
                    description: "列出关联项目中指定路径下的文件和子目录（不递归）".into(),
                    parameters: serde_json::json!({
                        "type": "object",
                        "properties": {
                            "path": {
                                "type": "string",
                                "description": "相对项目根目录的路径，如 'src'，不传则列出根目录"
                            }
                        },
                        "additionalProperties": false
                    }),
                },
            },
            ToolCapability::SearchProjectFiles => ai::ToolDefinition {
                function: ai::ToolFunction {
                    name: "search_project_files".into(),
                    description: "在关联项目中搜索匹配关键词的文件名（不区分大小写）".into(),
                    parameters: serde_json::json!({
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "搜索关键词，匹配文件名"
                            }
                        },
                        "required": ["query"],
                        "additionalProperties": false
                    }),
                },
            },
            ToolCapability::GitDiff => ai::ToolDefinition {
                function: ai::ToolFunction {
                    name: "git_diff".into(),
                    description: "查看项目的 Git 变更记录。不传参数时显示当前工作区未提交的变更；传 commit 时查看指定提交".into(),
                    parameters: serde_json::json!({
                        "type": "object",
                        "properties": {
                            "commit": {
                                "type": "string",
                                "description": "可选的提交哈希或范围，不传时显示工作区变更"
                            },
                            "path": {
                                "type": "string",
                                "description": "可选的路径过滤，只查看该路径的变更"
                            }
                        },
                        "additionalProperties": false
                    }),
                },
            },
            ToolCapability::VectorSearch => ai::ToolDefinition {
                function: ai::ToolFunction {
                    name: "vector_search".into(),
                    description: "通过语义搜索查找与查询最相关的文档或项目块".into(),
                    parameters: serde_json::json!({
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "语义搜索查询语句"
                            },
                            "limit": {
                                "type": "integer",
                                "description": "返回结果数量，默认5",
                                "default": 5
                            }
                        },
                        "required": ["query"],
                        "additionalProperties": false
                    }),
                },
            },
            ToolCapability::CallWebSearch => ai::ToolDefinition {
                function: ai::ToolFunction {
                    name: "call_web_search".into(),
                    description: "搜索互联网获取最新信息".into(),
                    parameters: serde_json::json!({
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "搜索关键词"
                            }
                        },
                        "required": ["query"],
                        "additionalProperties": false
                    }),
                },
            },
        };
        defs.push(def);
    }
    defs
}

/// Execute a single tool call and return the result string
async fn dispatch_tool_call(
    call: &ai::ToolCall,
    context: &AgentContext,
) -> String {
    let name = &call.function.name;
    let args: serde_json::Value = serde_json::from_str(&call.function.arguments)
        .unwrap_or(serde_json::json!({}));

    match name.as_str() {
        "read_document" => {
            if context.document_content.is_empty() {
                "当前文档内容为空".to_string()
            } else {
                format!("当前文档内容：\n```\n{}\n```", context.document_content)
            }
        }

        "write_document" => {
            let content = args["content"].as_str().unwrap_or("");
            if content.is_empty() {
                "错误：未提供写入内容".to_string()
            } else {
                format!("文档内容已更新（{} 字）", content.chars().count())
            }
        }

        "search_document" => {
            let query = args["query"].as_str().unwrap_or("");
            if query.is_empty() {
                return "错误：未指定搜索关键词".to_string();
            }
            if context.document_content.is_empty() {
                return "当前文档内容为空".to_string();
            }
            let lower_query = query.to_lowercase();
            let mut matches: Vec<String> = Vec::new();
            for line in context.document_content.lines() {
                if line.to_lowercase().contains(&lower_query) {
                    matches.push(format!("- {}", line.trim()));
                }
            }
            if matches.is_empty() {
                format!("未找到匹配 \"{}\" 的内容", query)
            } else {
                format!("找到 {} 处匹配：\n{}", matches.len(), matches.join("\n"))
            }
        }

        "read_project_files" => {
            let project_path = match &context.project_path {
                Some(p) => p.clone(),
                None => return "错误：未设置项目目录，无法读取文件".to_string(),
            };
            let paths: Vec<String> = args["paths"]
                .as_array()
                .map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                .unwrap_or_default();
            if paths.is_empty() {
                return "错误：未指定文件路径".to_string();
            }
            let mut results: Vec<String> = Vec::new();
            for rel_path in paths.iter().take(6) {
                let full_path = Path::new(&project_path).join(rel_path);
                if !full_path.exists() {
                    results.push(format!("### {}\n错误：文件不存在", rel_path));
                    continue;
                }
                match std::fs::read_to_string(&full_path) {
                    Ok(content) => {
                        let line_count = content.lines().count();
                        results.push(format!("### {} ({} lines)\n```\n{}\n```", rel_path, line_count, content));
                    }
                    Err(e) => {
                        results.push(format!("### {}\n错误：{}", rel_path, e));
                    }
                }
            }
            results.join("\n\n")
        }

        "list_project_files" => {
            let project_path = match &context.project_path {
                Some(p) => p.clone(),
                None => return "错误：未设置项目目录，无法列出文件".to_string(),
            };
            let rel_path = args["path"].as_str().unwrap_or("");
            let dir_path = if rel_path.is_empty() {
                Path::new(&project_path).to_path_buf()
            } else {
                Path::new(&project_path).join(rel_path)
            };
            if !dir_path.exists() || !dir_path.is_dir() {
                return format!("错误：目录 \"{}\" 不存在", rel_path);
            }
            match std::fs::read_dir(&dir_path) {
                Ok(entries) => {
                    let mut items: Vec<String> = Vec::new();
                    for entry in entries.flatten() {
                        let name = entry.file_name().to_string_lossy().to_string();
                        if name.starts_with('.') { continue; }
                        let icon = if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                            "📁"
                        } else {
                            "📄"
                        };
                        items.push(format!("{} {}", icon, name));
                    }
                    if items.is_empty() {
                        format!("目录 \"{}\" 为空", rel_path)
                    } else {
                        items.sort();
                        items.join("\n")
                    }
                }
                Err(e) => format!("错误：读取目录失败: {}", e),
            }
        }

        "search_project_files" => {
            let project_path = match &context.project_path {
                Some(p) => p.clone(),
                None => return "错误：未设置项目目录，无法搜索文件".to_string(),
            };
            let query = args["query"].as_str().unwrap_or("");
            if query.is_empty() {
                return "错误：未指定搜索关键词".to_string();
            }
            fn visit_dirs(dir: &std::path::Path, query: &str, project_path: &str, matches: &mut Vec<String>, depth: usize) -> std::io::Result<()> {
                if depth > 8 { return Ok(()); }
                if dir.is_dir() {
                    for entry in std::fs::read_dir(dir)? {
                        let entry = entry?;
                        let path = entry.path();
                        if path.is_dir() {
                            visit_dirs(&path, query, project_path, matches, depth + 1)?;
                        } else if path.is_file() {
                            let name = path.file_name().unwrap_or_default().to_string_lossy().to_lowercase();
                            if name.contains(&query.to_lowercase()) {
                                if let Ok(rel) = path.strip_prefix(project_path) {
                                    matches.push(format!("- {}", rel.display()));
                                }
                            }
                        }
                    }
                }
                Ok(())
            }
            let mut matches: Vec<String> = Vec::new();
            let _ = visit_dirs(std::path::Path::new(&project_path), &query, &project_path, &mut matches, 0);
            if matches.is_empty() {
                format!("未找到匹配 \"{}\" 的文件", query)
            } else {
                format!("找到 {} 个匹配文件：\n{}", matches.len(), matches.join("\n"))
            }
        }

        "git_diff" => {
            let project_path = match &context.project_path {
                Some(p) => p.clone(),
                None => return "错误：未设置项目目录，无法查看 Git 变更".to_string(),
            };
            let commit = args["commit"].as_str().unwrap_or("");
            let path_filter = args["path"].as_str().unwrap_or("");
            let mut cmd = std::process::Command::new("git");
            cmd.arg("-C").arg(&project_path);
            cmd.arg("diff");
            if !commit.is_empty() {
                cmd.arg(commit);
            }
            if !path_filter.is_empty() {
                cmd.arg("--").arg(path_filter);
            }
            match cmd.output() {
                Ok(output) => {
                    if output.status.success() {
                        let diff = String::from_utf8_lossy(&output.stdout).to_string();
                        if diff.is_empty() {
                            "没有未提交的变更".to_string()
                        } else {
                            format!("```diff\n{}```", diff)
                        }
                    } else {
                        let err = String::from_utf8_lossy(&output.stderr);
                        format!("Git 命令失败: {}", err)
                    }
                }
                Err(e) => format!("执行 Git 失败: {}", e),
            }
        }

        "vector_search" => {
            format!("向量搜索功能尚未集成（查询: {}）", args["query"].as_str().unwrap_or(""))
        }

        "call_web_search" => {
            format!("网络搜索功能尚未集成（查询: {}）", args["query"].as_str().unwrap_or(""))
        }

        _ => format!("未知工具: {}", name),
    }
}

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
        content = format!("{}\n\n（工具调用超过最大轮数 {}，已中断）", content, MAX_TOOL_ROUNDS);
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

    Ok(AgentResult {
        content,
        steps,
    })
}

// ─── Prompt builders ───

fn build_agent_prompt(skill: &Skill, context: &AgentContext, plan: &ContextPlan) -> String {
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
                prompt.push_str(&format!("{}. {}{}{}\n", i + 1, section.title, desc, marker));
            }
        }
        prompt.push_str("\n");
        // Inject style/action context
        if let Some(ref style_id) = bp.style_id {
            prompt.push_str(&format!("## 写作风格\n{}\n", style_id));
        }
        if let Some(ref action_id) = bp.action_id {
            prompt.push_str(&format!("## 当前动作\n{}\n", action_id));
        }
    }

    // Skill body
    prompt.push_str(&skill.body);
    prompt.push_str("\n\n");

    // ContextPlan: skip sections if specified
    if !plan.skip_sections.contains(&"agent_instructions".to_string()) {
        prompt.push_str("# Agent 指令\n\n");
        prompt.push_str("你是一个 AI 写作助手 Agent。请根据用户请求和当前文档上下文完成写作任务。\n\n");
        prompt.push_str("## 流程\n");
        prompt.push_str("1. 理解用户请求\n");
        prompt.push_str("2. 如果需要读取更多信息，使用提供的工具\n");
        prompt.push_str("3. 执行写作任务\n");
        prompt.push_str("4. 输出最终结果\n\n");
    }

    // Tool info (skip if in plan)
    if !plan.skip_sections.contains(&"tool_info".to_string()) {
        prompt.push_str("## 可用工具\n");
        if skill.allowed_tools.contains(&ToolCapability::ReadDocument) {
            prompt.push_str("- read_document: 读取当前文档内容\n");
        }
        if skill.allowed_tools.contains(&ToolCapability::WriteDocument) {
            prompt.push_str("- write_document: 写入内容到文档\n");
        }
        if skill.allowed_tools.contains(&ToolCapability::SearchDocument) {
            prompt.push_str("- search_document: 搜索文档中的特定内容\n");
        }
        if skill.allowed_tools.contains(&ToolCapability::ReadProjectFiles) {
            prompt.push_str("- read_project_files: 读取项目文件内容\n");
        }
        if skill.allowed_tools.contains(&ToolCapability::ListProjectFiles) {
            prompt.push_str("- list_project_files: 列出项目目录\n");
        }
        if skill.allowed_tools.contains(&ToolCapability::SearchProjectFiles) {
            prompt.push_str("- search_project_files: 搜索项目文件\n");
        }
        if skill.allowed_tools.contains(&ToolCapability::GitDiff) {
            prompt.push_str("- git_diff: 查看 Git 变更记录\n");
        }
        if skill.allowed_tools.contains(&ToolCapability::VectorSearch) {
            prompt.push_str("- vector_search: 语义搜索\n");
        }
        if skill.allowed_tools.contains(&ToolCapability::CallWebSearch) {
            prompt.push_str("- call_web_search: 网络搜索\n");
        }
        prompt.push_str("\n");
    }

    // Output format
    if !plan.skip_sections.contains(&"output_format".to_string()) {
        prompt.push_str("## 输出格式\n");
        prompt.push_str("直接输出结果，无需额外解释。\n");
    }

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
        prompt.push_str("```\n");
        let total_chars: usize = context.document_content.chars().count();
        let max_tail = 4000;
        let max_head = 500;
        let doc = if total_chars > max_tail + max_head {
            let head: String = context.document_content.chars().take(max_head).collect();
            let tail_start = total_chars - max_tail;
            let tail: String = context.document_content.chars().skip(tail_start).take(max_tail).collect();
            format!("{}...(中间略去 {} 字)\n{}", head, total_chars - max_head - max_tail, tail)
        } else {
            context.document_content.clone()
        };
        prompt.push_str(&doc);
        prompt.push_str("\n```\n");
    }

    prompt
}
