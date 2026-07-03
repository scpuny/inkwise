// agent/prompt.rs — Agent 提示词构建器
use crate::agent::{AgentContext, ContextPlan};
use crate::skill::{Skill, ToolCapability};

/// Build the system prompt from skill body + blueprint context + ContextPlan
pub fn build_agent_prompt(skill: &Skill, context: &AgentContext, plan: &ContextPlan) -> String {
    let mut prompt = String::new();

    // ─── ContextPlan: 意图声明 ───
    if plan.intent != "default" {
        prompt.push_str(&format!("# 任务意图: {}\n\n", plan.intent));
    }

    // ─── ContextPlan: 优先读取文件 ───
    if !plan.priority_files.is_empty() {
        prompt.push_str("## 优先关注的文档\n");
        for f in &plan.priority_files {
            prompt.push_str(&format!("- `{}`\n", f));
        }
        prompt.push_str("\n");
    }

    // ─── ContextPlan: 建议使用的工具 ───
    if !plan.suggested_tools.is_empty() {
        prompt.push_str("## 建议优先使用的工具\n");
        for t in &plan.suggested_tools {
            prompt.push_str(&format!("- `{}`\n", t));
        }
        prompt.push_str("\n");
    }

    // ─── ContextPlan: 要求注入的上下文 ───
    if !plan.required_contexts.is_empty() {
        prompt.push_str("## 已注入的上下文\n");
        for ctx in &plan.required_contexts {
            let source_str = match ctx.source {
                crate::agent::ContextSourceKind::GitDiff => "Git 变更记录",
                crate::agent::ContextSourceKind::AstSymbols => "AST 符号表",
                crate::agent::ContextSourceKind::ConfigFile => "配置文件",
                crate::agent::ContextSourceKind::VectorSearch => "向量语义检索",
                crate::agent::ContextSourceKind::ArticleSeries => "系列文章规划",
                crate::agent::ContextSourceKind::PublishHistory => "发布历史",
                crate::agent::ContextSourceKind::ProjectStructure => "项目结构",
                crate::agent::ContextSourceKind::DocumentContent => "文档内容",
                crate::agent::ContextSourceKind::SelectedText => "选中文本",
            };
            let scope_str = match ctx.scope.as_str() {
                "changed_files" => "仅变更文件",
                "full_project" => "全量",
                "related_only" => "关联项",
                _ => &ctx.scope,
            };
            prompt.push_str(&format!(
                "- {}（范围: {}, Token预算: {}, 优先级: {}/5）\n",
                source_str, scope_str, ctx.max_tokens, ctx.priority
            ));
        }
        prompt.push_str("\n");
    }

    // Inject blueprint context (article structure)
    if !plan.skip_sections.contains(&"blueprint".to_string()) {
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
                        if section.id == *cur_id {
                            " ← 当前位置"
                        } else {
                            ""
                        }
                    } else {
                        ""
                    };
                    let desc = section
                        .description
                        .as_ref()
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

/// Build user prompt from agent context
pub fn build_user_prompt(context: &AgentContext) -> String {
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
            let tail: String = context
                .document_content
                .chars()
                .skip(tail_start)
                .take(max_tail)
                .collect();
            format!(
                "{}...(中间略去 {} 字)\n{}",
                head,
                total_chars - max_head - max_tail,
                tail
            )
        } else {
            context.document_content.clone()
        };
        prompt.push_str(&doc);
        prompt.push_str("\n```\n");
    }

    prompt
}
