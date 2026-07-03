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
pub use snapshot::{IndexSnapshot, save_snapshot, snapshot_dir_files};
pub use watcher::{build_context_text, spawn_folder_watcher};

/// 所有支持索引/监听/快照的文本文件扩展名（不含点号）
/// 与 scanner::detect_language + snapshot::is_text_file 保持同步
pub const SUPPORTED_TEXT_EXTS: &[&str] = &[
    // 编程语言
    "rs", "go", "py", "js", "jsx", "ts", "tsx", "vue", "svelte",
    "java", "kt", "swift", "c", "cpp", "h", "hpp", "cc", "cxx",
    "mjs", "cjs", "mts", "cts",
    // 脚本/配置
    "sh", "bash", "zsh", "fish", "ps1",
    "lua", "r", "rb", "php", "pl", "pm", "scala",
    "zig", "nim", "crystal", "dart", "clj", "cljs",
    "erl", "ex", "exs",
    // Web
    "css", "scss", "less", "html", "htm", "xml", "svg",
    // 数据/标记
    "json", "yaml", "yml", "toml", "ini", "cfg", "conf",
    "md", "mdx", "txt", "log", "csv", "sql",
    // 构建/工具
    "gradle", "sbt", "lock", "env",
    "gitignore", "dockerignore", "editorconfig",
];
