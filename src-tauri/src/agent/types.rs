// agent/types.rs — Agent 类型定义（AgentResult / ContextPlan / AgentContext）
use crate::domain::ArticleBlueprint;
use serde::{Deserialize, Serialize};

// ─── Agent execution result ───

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AgentResult {
    pub content: String,
    pub steps: Vec<String>,
}

// ─── ContextPlan (精准上下文注入计划) ───

/// 上下文来源类型
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum ContextSourceKind {
    #[serde(rename = "git_diff")]
    GitDiff,
    #[serde(rename = "ast_symbols")]
    AstSymbols,
    #[serde(rename = "config_file")]
    ConfigFile,
    #[serde(rename = "vector_search")]
    VectorSearch,
    #[serde(rename = "article_series")]
    ArticleSeries,
    #[serde(rename = "publish_history")]
    PublishHistory,
    #[serde(rename = "project_structure")]
    ProjectStructure,
    #[serde(rename = "document_content")]
    DocumentContent,
    #[serde(rename = "selected_text")]
    SelectedText,
}

/// 单条上下文项
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ContextItem {
    pub source: ContextSourceKind,
    pub scope: String,          // "changed_files" | "full_project" | "related_only"
    pub max_tokens: u32,
    pub priority: u8,           // 1-5，5最高
}

/// 上下文注入计划：指定按用户意图注入哪些信息、跳过哪些
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ContextPlan {
    pub intent: String,
    /// 需要注入的上下文项（按优先级排序）
    pub required_contexts: Vec<ContextItem>,
    /// 建议使用的工具名列表
    pub suggested_tools: Vec<String>,
    /// 需要优先读取的文件
    pub priority_files: Vec<String>,
    /// 不需要注入的部分
    pub skip_sections: Vec<String>,
}

impl Default for ContextPlan {
    fn default() -> Self {
        Self {
            intent: "default".to_string(),
            required_contexts: vec![],
            suggested_tools: vec![],
            priority_files: vec![],
            skip_sections: vec![],
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
