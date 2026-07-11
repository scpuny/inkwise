// ─── Commands 模块：薄命令层 ───
// 每个 #[tauri::command] 不超过 10 行，所有逻辑委托给 Service 或 Storage

pub mod document_cmds;
pub mod collection_cmds;

pub use document_cmds::*;
pub use collection_cmds::*;
