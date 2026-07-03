// agent/types.rs — Agent 类型定义（AgentResult / ContextPlan / AgentContext）
use crate::store::ArticleBlueprint;
use serde::{Deserialize, Serialize};

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
            intent: "default".to_string(),
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
