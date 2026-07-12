// project_indexer/types.rs — 项目索引类型定义
use serde::{Deserialize, Serialize};

// ─── 输出类型 ───
// ─── 输出类型 ───

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProjectContext {
    pub name: String,
    pub root_path: String,
    pub primary_language: Option<String>,
    pub structure: Vec<FileNode>,
    pub summary: ProjectSummary,
    pub configs: Vec<ConfigFile>,
    pub symbols: Vec<SymbolInfo>,
    pub imports: Vec<ImportEdge>,
    pub codegraph_available: bool,
    /// 树级上下文行（函数签名/类声明/方法定义等），用于 AI 理解项目结构
    pub root_contexts: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub language: Option<String>,
    pub size: u64,
    pub lines: u64,
    pub children: Vec<FileNode>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSummary {
    pub total_files: u32,
    pub total_dirs: u32,
    pub total_lines: u64,
    pub languages: Vec<LanguageStat>,
    pub top_files: Vec<FileInfo>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LanguageStat {
    pub language: String,
    pub count: u32,
    pub lines: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileInfo {
    pub path: String,
    pub language: Option<String>,
    pub lines: u64,
    pub size: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ConfigFile {
    pub name: String,
    pub content: String,
    pub truncated: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SymbolInfo {
    pub name: String,
    pub kind: String,
    pub file_path: String,
    pub line: u32,
    pub is_exported: bool,
    pub docstring: Option<String>,
    pub signature: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ImportEdge {
    pub source: String,
    pub target: String,
    pub kind: String,
}

