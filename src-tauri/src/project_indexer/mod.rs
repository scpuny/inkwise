// project_indexer/ — Project Indexer 模块（v2.0.0 重构）
//
// 拆分说明：
//   types.rs    — 类型定义（ProjectContext / FileNode / SymbolInfo 等）
//   scanner.rs  — 扫描逻辑（scan_project / treesitter / hash cache）
//   watcher.rs  — 文件夹监听 + 上下文文本构建

pub(crate) mod scanner;
pub(crate) mod snapshot;
pub(crate) mod watcher;
pub(crate) mod types;

// Re-export public types and functions
pub use types::*;
pub use scanner::scan_project;
pub use scanner::rescan_project_incremental;
pub use snapshot::{IndexSnapshot, StartupDiff, save_snapshot, load_snapshot, snapshot_dir_files, detect_startup_changes, detect_git_changes};
pub use watcher::{build_context_text, spawn_folder_watcher};
