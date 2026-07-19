// agent/tools.rs — AI 工具定义与调度（9 种 ToolCapability）
use crate::ai;
use crate::agent::AgentContext;
use crate::skill::ToolCapability;
use std::path::Path;

pub const MAX_TOOL_ROUNDS: u32 = 15;

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
pub(crate) async fn dispatch_tool_call(call: &ai::ToolCall, context: &AgentContext) -> String {
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
                        results.push(format!(
                            "### {} ({} lines)\n```\n{}\n```",
                            rel_path, line_count, content
                        ));
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
                        if name.starts_with('.') {
                            continue;
                        }
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

            fn visit_dirs(
                dir: &std::path::Path,
                query: &str,
                project_path: &str,
                matches: &mut Vec<String>,
                depth: usize,
            ) -> std::io::Result<()> {
                if depth > 8 {
                    return Ok(());
                }
                if dir.is_dir() {
                    for entry in std::fs::read_dir(dir)? {
                        let entry = entry?;
                        let path = entry.path();
                        if path.is_dir() {
                            visit_dirs(&path, query, project_path, matches, depth + 1)?;
                        } else if path.is_file() {
                            let name = path
                                .file_name()
                                .unwrap_or_default()
                                .to_string_lossy()
                                .to_lowercase();
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
            let _ = visit_dirs(
                std::path::Path::new(&project_path),
                &query,
                &project_path,
                &mut matches,
                0,
            );
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
            let query = args["query"].as_str().unwrap_or("");
            let limit = args["limit"].as_u64().unwrap_or(5) as usize;
            if query.is_empty() {
                return "错误：未指定搜索查询".to_string();
            }
            if let Some(ref search_fn) = context.vector_search_fn {
                match search_fn(query, limit) {
                    Ok(result) => result,
                    Err(e) => format!("向量搜索失败: {}", e),
                }
            } else {
                "向量搜索不可用（嵌入器未加载或数据库未初始化）。请使用 search_project_files 或 read_project_files 工具替代。".to_string()
            }
        }

        "call_web_search" => {
            format!(
                "网络搜索功能尚未集成（查询: {}）",
                args["query"].as_str().unwrap_or("")
            )
        }

        _ => format!("未知工具: {}", name),
    }
}
