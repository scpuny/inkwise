// agent/ — Agent 模块（v2.0.0 重构）
//
// 拆分说明：
//   types.rs  — 类型定义（AgentResult / ContextPlan / AgentContext）
//   tools.rs  — 工具定义（build_tool_definitions / dispatch_tool_call）
//   prompt.rs — 提示词构建（build_agent_prompt / build_user_prompt）
//   engine.rs — 核心执行（execute_agent / execute_agent_with_plan）

pub(crate) mod engine;
pub(crate) mod prompt;
pub(crate) mod tools;
pub(crate) mod types;

// Re-export public types and functions for backward compatibility
pub use types::{AgentContext, AgentResult, ContextPlan, ContextSourceKind, VectorSearchFn};
pub use engine::execute_agent;
