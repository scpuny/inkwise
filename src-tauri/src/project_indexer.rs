use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

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
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub language: Option<String>,
    pub size: u64,
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

// ─── 文件 Hash 缓存（增量扫描） ───

#[allow(clippy::large_enum_variant)]
enum FileHashCache {
    /// 用户已安装 CodeGraph，读写其 files 表
    Codegraph(rusqlite::Connection),
    /// 无 CodeGraph，使用 JSON 缓存文件
    Json { path: PathBuf, hashes: HashMap<String, String> },
}

impl FileHashCache {
    fn open(project_dir: &Path, data_dir: Option<&Path>) -> Self {
        // 优先使用 CodeGraph DB
        let cg_path = project_dir.join(".codegraph").join("codegraph.db");
        if cg_path.exists() {
            if let Ok(conn) = rusqlite::Connection::open(&cg_path) {
                return Self::Codegraph(conn);
            }
        }

        // 降级到 JSON 文件
        let cache_dir = data_dir
            .map(|d| d.join("index"))
            .unwrap_or_else(|| project_dir.join(".inkwise_index"));
        std::fs::create_dir_all(&cache_dir).ok();
        let cache_path = cache_dir.join("file_hashes.json");
        let hashes = std::fs::read_to_string(&cache_path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default();
        Self::Json {
            path: cache_path,
            hashes,
        }
    }

    fn get_hash(&self, rel_path: &str) -> Option<&str> {
        match self {
            Self::Codegraph(conn) => {
                let mut stmt = conn
                    .prepare("SELECT content_hash FROM files WHERE path = ?1")
                    .ok()?;
                stmt.query_row(rusqlite::params![rel_path], |row| row.get::<_, String>(0))
                    .ok()
                    .map(|s| {
                        // Leak the string to get a &str with static lifetime
                        // (we only hold references temporarily in scan loops)
                        let leaked: &'static str = Box::leak(s.into_boxed_str());
                        leaked
                    })
            }
            Self::Json { hashes, .. } => hashes.get(rel_path).map(|s| s.as_str()),
        }
    }

    fn set_hash(&mut self, rel_path: &str, hash: &str) {
        match self {
            Self::Codegraph(conn) => {
                // 只写，不关心 files 表其他字段是否一致
                let _ = conn.execute(
                    "INSERT OR REPLACE INTO files (path, content_hash, language, size, modified_at, indexed_at)
                     VALUES (?1, ?2, 'unknown', 0, 0, 0)",
                    rusqlite::params![rel_path, hash],
                );
            }
            Self::Json { hashes, .. } => {
                hashes.insert(rel_path.to_string(), hash.to_string());
            }
        }
    }

    fn persist(&self) {
        if let Self::Json { path, hashes } = self {
            if let Ok(content) = serde_json::to_string(hashes) {
                let _ = std::fs::write(path, &content);
            }
        }
    }
}

fn compute_file_hash(content: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content);
    hex::encode(hasher.finalize())
}

// ─── 语言检测 ───

fn detect_language(ext: &str) -> Option<&'static str> {
    match ext {
        "ts" | "tsx" => Some("TypeScript"),
        "js" | "jsx" | "mjs" => Some("JavaScript"),
        "rs" => Some("Rust"),
        "py" => Some("Python"),
        "go" => Some("Go"),
        "java" => Some("Java"),
        "rb" => Some("Ruby"),
        "php" => Some("PHP"),
        "swift" => Some("Swift"),
        "kt" => Some("Kotlin"),
        "c" | "h" => Some("C"),
        "cpp" | "hpp" | "cc" | "cxx" => Some("C++"),
        "css" | "scss" | "less" => Some("CSS"),
        "html" | "htm" => Some("HTML"),
        "json" => Some("JSON"),
        "yaml" | "yml" => Some("YAML"),
        "toml" => Some("TOML"),
        "md" | "mdx" => Some("Markdown"),
        "sql" => Some("SQL"),
        "sh" | "bash" | "zsh" => Some("Shell"),
        "dockerfile" | "Dockerfile" => Some("Dockerfile"),
        _ => None,
    }
}

// ─── 忽略的目录 ───

const IGNORE_DIRS: &[&str] = &[
    ".git", "node_modules", "target", "dist", "build", ".next",
    ".cache", ".codegraph", "__pycache__", ".venv", "venv",
    ".idea", ".vscode", "coverage", ".rustup",
];

fn should_ignore(name: &str) -> bool {
    name.starts_with('.') && name != ".env" || IGNORE_DIRS.contains(&name)
}

// ─── 关键配置文件 ───

const KEY_CONFIG_FILES: &[&str] = &[
    "README.md", "README", "package.json", "Cargo.toml",
    "pyproject.toml", "go.mod", "composer.json", "Gemfile",
    "Makefile", "Dockerfile", "docker-compose.yml",
    ".env.example", "tsconfig.json", "vite.config.ts",
    "next.config.js", "webpack.config.js",
];

// ─── 文件树构建 ───

fn build_file_tree(dir: &Path, max_depth: usize) -> Vec<FileNode> {
    fn walk(
        path: &Path,
        base: &Path,
        depth: usize,
        max_depth: usize,
        seen: &mut std::collections::HashSet<PathBuf>,
    ) -> Vec<FileNode> {
        if depth > max_depth || !seen.insert(path.to_path_buf()) {
            return vec![];
        }

        let mut nodes = Vec::new();
        let entries = match std::fs::read_dir(path) {
            Ok(e) => e,
            Err(_) => return vec![],
        };

        let mut items: Vec<_> = entries
            .flatten()
            .filter(|e| {
                let name = e.file_name().to_string_lossy().to_string();
                !should_ignore(&name)
            })
            .collect();
        items.sort_by_key(|e| {
            let name = e.file_name().to_string_lossy().to_lowercase();
            (e.path().is_dir(), name)
        });

        for entry in items {
            let entry_path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            let rel_path = entry_path
                .strip_prefix(base)
                .unwrap_or(&entry_path)
                .to_string_lossy()
                .to_string();
            if entry_path.is_dir() {
                let children = walk(&entry_path, base, depth + 1, max_depth, seen);
                nodes.push(FileNode {
                    name,
                    path: rel_path,
                    is_dir: true,
                    language: None,
                    size: 0,
                    children,
                });
            } else {
                let ext = entry_path.extension().and_then(|e| e.to_str()).unwrap_or("");
                let lang = detect_language(ext);
                let size = std::fs::metadata(&entry_path).map(|m| m.len()).unwrap_or(0);
                nodes.push(FileNode {
                    name,
                    path: rel_path,
                    is_dir: false,
                    language: lang.map(|l| l.to_string()),
                    size,
                    children: vec![],
                });
            }
        }
        nodes
    }

    walk(dir, dir, 0, max_depth, &mut std::collections::HashSet::new())
}

// ─── 收集概要统计 ───

fn collect_summary(structure: &[FileNode]) -> ProjectSummary {
    let mut total_files = 0u32;
    let mut total_dirs = 0u32;
    let mut total_lines = 0u64;
    let mut lang_map: HashMap<String, (u32, u64)> = HashMap::new();
    let mut all_files: Vec<FileInfo> = Vec::new();

    fn walk_nodes(
        nodes: &[FileNode],
        files: &mut u32,
        dirs: &mut u32,
        lines: &mut u64,
        lang_map: &mut HashMap<String, (u32, u64)>,
        all_files: &mut Vec<FileInfo>,
    ) {
        for node in nodes {
            if node.is_dir {
                *dirs += 1;
                walk_nodes(&node.children, files, dirs, lines, lang_map, all_files);
            } else {
                *files += 1;
                let entry = lang_map
                    .entry(node.language.clone().unwrap_or_else(|| "其他".into()))
                    .or_insert((0, 0));
                entry.0 += 1;
                entry.1 += 1;
                all_files.push(FileInfo {
                    path: node.path.clone(),
                    language: node.language.clone(),
                    lines: 0,
                    size: node.size,
                });
            }
        }
    }

    walk_nodes(
        structure,
        &mut total_files,
        &mut total_dirs,
        &mut total_lines,
        &mut lang_map,
        &mut all_files,
    );

    all_files.sort_by(|a, b| b.size.cmp(&a.size));
    let top_files: Vec<FileInfo> = all_files.into_iter().take(20).collect();

    let mut languages: Vec<LanguageStat> = lang_map
        .into_iter()
        .map(|(lang, (count, lines))| LanguageStat {
            language: lang,
            count,
            lines,
        })
        .collect();
    languages.sort_by(|a, b| b.count.cmp(&a.count));

    ProjectSummary {
        total_files,
        total_dirs,
        total_lines,
        languages,
        top_files,
    }
}

// ─── 读取关键配置文件 ───

fn read_configs(dir: &Path) -> Vec<ConfigFile> {
    let mut configs = Vec::new();
    for name in KEY_CONFIG_FILES {
        let path = dir.join(name);
        if path.exists() && path.is_file() {
            if let Ok(content) = std::fs::read_to_string(&path) {
                let max_bytes = 4000usize;
                let truncated = content.len() > max_bytes;
                let content = if truncated {
                    let byte_end = content.char_indices()
                        .take_while(|(i, _)| *i < max_bytes)
                        .last()
                        .map(|(i, c)| i + c.len_utf8())
                        .unwrap_or(max_bytes);
                    format!("{}...\n[内容太长，已截断]", &content[..byte_end])
                } else {
                    content
                };
                configs.push(ConfigFile {
                    name: name.to_string(),
                    content,
                    truncated,
                });
            }
        }
    }
    configs
}

// ─── 检测主语言 ───

fn detect_primary_language(summary: &ProjectSummary, configs: &[ConfigFile]) -> Option<String> {
    for cfg in configs {
        match cfg.name.as_str() {
            "Cargo.toml" => return Some("Rust".into()),
            "package.json" => {
                if cfg.content.contains("\"next") {
                    return Some("TypeScript (Next.js)".into());
                }
                if cfg.content.contains("\"react") || cfg.content.contains("React") {
                    return Some("TypeScript (React)".into());
                }
                return Some("JavaScript/TypeScript".into());
            }
            "pyproject.toml" | "requirements.txt" => return Some("Python".into()),
            "go.mod" => return Some("Go".into()),
            "Gemfile" => return Some("Ruby".into()),
            _ => {}
        }
    }
    summary
        .languages
        .first()
        .map(|l| l.language.clone())
}

// ═══════════════════════════════════════════════════════════════
// tree-sitter 符号提取（Level 2）
// ═══════════════════════════════════════════════════════════════

/// 判断扩展名是否可被 tree-sitter 解析
fn ts_supported_ext(ext: &str) -> bool {
    matches!(ext, "ts" | "tsx" | "js" | "jsx" | "rs")
}

/// 获取 tree-sitter 语言
fn get_tree_sitter_language(ext: &str) -> Option<(tree_sitter::Language, &'static str)> {
    match ext {
        "ts" | "tsx" => {
            let lang: tree_sitter::Language = tree_sitter_typescript::LANGUAGE_TSX.into();
            Some((lang, "typescript"))
        }
        "js" | "jsx" => {
            let lang: tree_sitter::Language = tree_sitter_typescript::LANGUAGE_TSX.into();
            Some((lang, "javascript"))
        }
        "rs" => {
            let lang: tree_sitter::Language = tree_sitter_rust::LANGUAGE.into();
            Some((lang, "rust"))
        }
        _ => None,
    }
}

/// 用 tree-sitter 解析源码，提取符号（替代正则方案）
fn extract_symbols_treesitter(source: &str, ext: &str) -> Vec<SymbolInfo> {
    let mut symbols = Vec::new();
    let (lang, _lang_name) = match get_tree_sitter_language(ext) {
        Some(v) => v,
        None => return symbols,
    };

    let mut parser = tree_sitter::Parser::new();
    parser
        .set_language(&lang)
        .expect("tree-sitter language 初始化失败");

    let tree = match parser.parse(source, None) {
        Some(t) => t,
        None => return symbols,
    };

    let root = tree.root_node();
    let _cursor = root.walk();
    let mut visited = std::collections::HashSet::new();
    let mut node_stack = vec![root];

    while let Some(node) = node_stack.pop() {
        let node_id = node.id() as usize;
        if !visited.insert(node_id) {
            continue;
        }

        let kind = node.kind();
        let start_line = node.start_position().row as u32 + 1;
        let start_byte = node.start_byte();
        let end_byte = node.end_byte();

        // 是否导出（检查 preceding 的 export 关键字）
        let is_exported = if ext == "rs" {
            // Rust: pub 关键字
            kind == "function" || kind == "struct" || kind == "enum" || kind == "trait"
                || kind == "type_alias" || kind == "const_item" || kind == "static_item"
                || kind == "mod_item"
        } else {
            // TS/JS: export 关键字
            false
        };

        // 提取命名符号
        match kind {
            "function_declaration"
            | "function"
            | "method_definition"
            | "method_declaration"
            | "arrow_function" if !kind.is_empty() =>
            {
                let name = find_child_text(node, &["name", "identifier"], source);
                if let Some(name) = name {
                    let sig = build_signature_treesitter(node, source, ext);
                    let doc = extract_doc_comment_treesitter(node, source);
                    symbols.push(SymbolInfo {
                        name,
                        kind: "function".into(),
                        file_path: String::new(),
                        line: start_line,
                        is_exported,
                        docstring: doc,
                        signature: sig,
                    });
                }
            }
            "class_declaration" | "class" => {
                let name = find_child_text(node, &["name", "identifier"], source);
                if let Some(name) = name {
                    let doc = extract_doc_comment_treesitter(node, source);
                    symbols.push(SymbolInfo {
                        name,
                        kind: "class".into(),
                        file_path: String::new(),
                        line: start_line,
                        is_exported,
                        docstring: doc,
                        signature: None,
                    });
                }
            }
            "interface_declaration" | "struct" | "trait" => {
                let name = find_child_text(node, &["name", "identifier"], source);
                if let Some(name) = name {
                    let kind_label = match kind {
                        "interface_declaration" => "interface",
                        "struct" => "struct",
                        "trait" => "trait",
                        _ => kind,
                    };
                    let doc = extract_doc_comment_treesitter(node, source);
                    symbols.push(SymbolInfo {
                        name,
                        kind: kind_label.into(),
                        file_path: String::new(),
                        line: start_line,
                        is_exported,
                        docstring: doc,
                        signature: None,
                    });
                }
            }
            "enum_declaration" | "enum" => {
                let name = find_child_text(node, &["name", "identifier"], source);
                if let Some(name) = name {
                    let doc = extract_doc_comment_treesitter(node, source);
                    symbols.push(SymbolInfo {
                        name,
                        kind: "enum".into(),
                        file_path: String::new(),
                        line: start_line,
                        is_exported,
                        docstring: doc,
                        signature: None,
                    });
                }
            }
            "type_alias" | "type_definition" => {
                let name = find_child_text(node, &["name", "identifier"], source);
                if let Some(name) = name {
                    let doc = extract_doc_comment_treesitter(node, source);
                    let sig = Some(source[start_byte..end_byte].to_string());
                    symbols.push(SymbolInfo {
                        name,
                        kind: "type_alias".into(),
                        file_path: String::new(),
                        line: start_line,
                        is_exported,
                        docstring: doc,
                        signature: sig,
                    });
                }
            }
            "lexical_declaration" | "variable_declaration" => {
                // const/let/var 提取每个声明
                if kind == "lexical_declaration" || kind == "variable_declaration" {
                    let is_const = source[start_byte..end_byte].starts_with("const")
                        || source[start_byte..end_byte].starts_with("export const");
                    let name = find_child_text(node, &["name", "identifier"], source);
                    if let Some(name) = name {
                        let sig = Some(source[start_byte..end_byte].to_string());
                        let doc = extract_doc_comment_treesitter(node, source);
                        symbols.push(SymbolInfo {
                            name,
                            kind: if is_const { "constant".into() } else { "variable".into() },
                            file_path: String::new(),
                            line: start_line,
                            is_exported,
                            docstring: doc,
                            signature: sig,
                        });
                    }
                }
            }
            "const_item" | "static_item" => {
                let name = find_child_text(node, &["name", "identifier"], source);
                if let Some(name) = name {
                    let sig = Some(source[start_byte..end_byte].to_string());
                    let doc = extract_doc_comment_treesitter(node, source);
                    symbols.push(SymbolInfo {
                        name,
                        kind: "constant".into(),
                        file_path: String::new(),
                        line: start_line,
                        is_exported: true,
                        docstring: doc,
                        signature: sig,
                    });
                }
            }
            _ => {}
        }

        // 遍历子节点
        for i in 0..node.child_count() {
            if let Some(child) = node.child(i) {
                node_stack.push(child);
            }
        }
    }

    symbols
}

/// 查找命名子节点文本
fn find_child_text(node: tree_sitter::Node, names: &[&str], source: &str) -> Option<String> {
    for i in 0..node.child_count() {
        if let Some(child) = node.child(i) {
            let child_kind = child.kind();
            if names.contains(&child_kind) {
                return child.utf8_text(source.as_bytes()).ok().map(|s| s.to_string());
            }
        }
    }
    None
}

/// 构建函数签名文本
fn build_signature_treesitter(node: tree_sitter::Node, source: &str, ext: &str) -> Option<String> {
    let start = node.start_byte();
    let end = node.end_byte();
    let text = source[start..end].to_string();
    // 函数/方法截取签名行（第一行或到 { 为止）
    let sig = if ext == "rs" {
        text.lines().next().map(|l| {
            if let Some(pos) = l.find("->") {
                let upto = pos + 2;
                let rest: String = l[upto..].trim().chars().take_while(|c| !c.is_whitespace() || *c == ' ').collect();
                format!("{} {}", &l[..=pos], rest.trim())
            } else if let Some(pos) = l.find('{') {
                l[..pos].trim().to_string()
            } else if let Some(pos) = l.find("where") {
                format!("{} ...", l[..pos].trim())
            } else {
                l.trim().to_string()
            }
        })
    } else {
        text.lines().next().map(|l| {
            if let Some(pos) = l.find('{') {
                l[..pos].trim().to_string()
            } else {
                l.trim().to_string()
            }
        })
    };
    sig
}

/// 提取 AST 节点上方的文档注释
fn extract_doc_comment_treesitter(node: tree_sitter::Node, source: &str) -> Option<String> {
    let start_line = node.start_position().row;
    let lines: Vec<&str> = source.lines().collect();
    let mut docs = Vec::new();

    // 向上扫描连续注释行
    let mut line = if start_line > 0 { start_line - 1 } else { return None };
    loop {
        let current = lines.get(line)?;
        let trimmed = current.trim();
        if trimmed.starts_with("///") {
            docs.push(trimmed.trim_start_matches("///").trim());
        } else if trimmed.starts_with("//!") {
            docs.push(trimmed.trim_start_matches("//!").trim());
        } else if trimmed.starts_with("/**") {
            // 多行 /** ... */
            let mut block = Vec::new();
            block.push(trimmed.trim_start_matches("/**").trim().trim_end_matches("*/").trim());
            // 反向往上读（当前行已经是注释行）
            for l in lines[..line].iter().rev() {
                let t = l.trim();
                if t.ends_with("*/") && !t.starts_with("/**") {
                    break;
                }
                if t.starts_with('*') {
                    block.push(t.trim_start_matches('*').trim());
                } else if t.starts_with('/') {
                    break;
                } else {
                    // 非注释行
                    break;
                }
            }
            // 实际顺序应该是从上往下
            block.reverse();
            docs.extend(block);
            break;
        } else if trimmed.starts_with("/*") {
            let mut block = Vec::new();
            block.push(trimmed.trim_start_matches("/*").trim().trim_end_matches("*/").trim());
            for l in lines[..line].iter().rev() {
                let t = l.trim();
                if t.contains("*/") && !t.contains("/*") {
                    break;
                }
                if t.starts_with('*') || t.starts_with("/*") {
                    block.push(t.trim_start_matches('*').trim_start_matches('/').trim());
                } else {
                    break;
                }
            }
            block.reverse();
            docs.extend(block);
            break;
        } else {
            break;
        }
        if line == 0 {
            break;
        }
        line = line.wrapping_sub(1);
    }

    docs.reverse();
    if docs.is_empty() {
        None
    } else {
        Some(docs.join(" ").trim().to_string())
    }
}


/// 用 tree-sitter 解析源码导入语句（替代正则方案）
fn extract_imports_treesitter(source: &str, ext: &str) -> Vec<(String, String)> {
    let mut imports = Vec::new();
    let (lang, _lang_name) = match get_tree_sitter_language(ext) {
        Some(v) => v,
        None => return imports,
    };

    let mut parser = tree_sitter::Parser::new();
    parser
        .set_language(&lang)
        .expect("tree-sitter language 初始化失败");

    let tree = match parser.parse(source, None) {
        Some(t) => t,
        None => return imports,
    };

    let root = tree.root_node();
    traverse_imports(root, source, ext, &mut imports);
    imports
}

/// 遍历 AST 节点提取 import 信息
fn traverse_imports(
    node: tree_sitter::Node,
    source: &str,
    ext: &str,
    imports: &mut Vec<(String, String)>,
) {
    if ext == "rs" {
        // Rust: use 声明
        if node.kind() == "use_declaration" {
            if let Some(use_val) = find_use_target(node, source) {
                imports.push((use_val, "module".to_string()));
            }
        }
    } else {
        // TS/JS: import 语句
        if node.kind() == "import_statement" {
            if let Some(target) = find_import_source(node, source) {
                imports.push((target, "module".to_string()));
            }
        }
        // require() 调用
        if node.kind() == "call_expression" {
            if let Some(target) = find_require_target(node, source) {
                imports.push((target, "module".to_string()));
            }
        }
        // dynamic import()
        if node.kind() == "import_expression" || node.kind() == "import" {
            if let Some(target) = find_dynamic_import_target(node, source) {
                imports.push((target, "module".to_string()));
            }
        }
    }

    for i in 0..node.child_count() {
        if let Some(child) = node.child(i) {
            if child.child_count() > 0 {
                traverse_imports(child, source, ext, imports);
            }
        }
    }
}

/// 从 import 语句提取模块路径
fn find_import_source(node: tree_sitter::Node, source: &str) -> Option<String> {
    // import 语句中找 string 类型的子节点（模块路径）
    for i in 0..node.child_count() {
        if let Some(child) = node.child(i) {
            let kind = child.kind();
            if kind == "string" || kind == "string_fragment" {
                if let Ok(text) = child.utf8_text(source.as_bytes()) {
                    let cleaned = text.trim().trim_matches('\'').trim_matches('"');
                    if !cleaned.is_empty() && !cleaned.starts_with('.') && !cleaned.starts_with('/') {
                        // 外部模块：取包名（第一个 / 之前的部分）
                        let pkg = cleaned.split('/').next().unwrap_or(cleaned);
                        return Some(pkg.to_string());
                    }
                }
            }
        }
    }
    // 尝试从 named_imports 或 namespace_import 的父节点找 source
    for i in 0..node.child_count() {
        if let Some(child) = node.child(i) {
            for j in 0..child.child_count() {
                if let Some(grandchild) = child.child(j) {
                    let kind = grandchild.kind();
                    if kind == "string" || kind == "string_fragment" {
                        if let Ok(text) = grandchild.utf8_text(source.as_bytes()) {
                            let cleaned = text.trim().trim_matches('\'').trim_matches('"');
                            if !cleaned.is_empty() && !cleaned.starts_with('.') {
                                let pkg = cleaned.split('/').next().unwrap_or(cleaned);
                                return Some(pkg.to_string());
                            }
                        }
                    }
                }
            }
        }
    }
    None
}

/// 从 require() 调用提取模块路径
fn find_require_target(node: tree_sitter::Node, source: &str) -> Option<String> {
    let text = node.utf8_text(source.as_bytes()).ok()?;
    if !text.contains("require(") {
        return None;
    }
    // 从 call_expression 中找 string 参数
    for i in 0..node.child_count() {
        if let Some(child) = node.child(i) {
            if child.kind() == "string" || child.kind() == "string_fragment" || child.kind() == "arguments" {
                for j in 0..child.child_count() {
                    if let Some(grandchild) = child.child(j) {
                        let gk = grandchild.kind();
                        if gk == "string" || gk == "string_fragment" {
                            if let Ok(t) = grandchild.utf8_text(source.as_bytes()) {
                                let cleaned = t.trim().trim_matches('\'').trim_matches('"');
                                if !cleaned.is_empty() && !cleaned.starts_with('.') {
                                    let pkg = cleaned.split('/').next().unwrap_or(cleaned);
                                    return Some(pkg.to_string());
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    None
}

/// 从 dynamic import() 提取模块路径
fn find_dynamic_import_target(node: tree_sitter::Node, source: &str) -> Option<String> {
    for i in 0..node.child_count() {
        if let Some(child) = node.child(i) {
            let kind = child.kind();
            if kind == "string" || kind == "string_fragment" || kind == "arguments" {
                for j in 0..child.child_count() {
                    if let Some(grandchild) = child.child(j) {
                        let gk = grandchild.kind();
                        if gk == "string" || gk == "string_fragment" {
                            if let Ok(t) = grandchild.utf8_text(source.as_bytes()) {
                                let cleaned = t.trim().trim_matches('\'').trim_matches('"');
                                if !cleaned.is_empty() && !cleaned.starts_with('.') {
                                    let pkg = cleaned.split('/').next().unwrap_or(cleaned);
                                    return Some(pkg.to_string());
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    None
}

/// 从 Rust use 声明提取模块路径
fn find_use_target(node: tree_sitter::Node, source: &str) -> Option<String> {
    // use crate::module; -> crate
    // use module::SubModule; -> module
    // use module::{Sub1, Sub2}; -> module
    for i in 0..node.child_count() {
        if let Some(child) = node.child(i) {
            let kind = child.kind();
            // scoped_identifier: crate::module or module::sub
            if kind == "scoped_identifier" {
                if let Ok(text) = child.utf8_text(source.as_bytes()) {
                    let parts: Vec<&str> = text.split("::").collect();
                    if !parts.is_empty() {
                        let root = parts[0];
                        if root != "crate" && root != "self" && root != "super" {
                            return Some(root.to_string());
                        } else if parts.len() > 1 {
                            return Some(parts[1].to_string());
                        }
                    }
                }
            }
            // use_as_clause: use foo as bar
            if kind == "use_as_clause" {
                for j in 0..child.child_count() {
                    if let Some(inner) = child.child(j) {
                        if inner.kind() == "scoped_identifier" {
                            if let Ok(text) = inner.utf8_text(source.as_bytes()) {
                                let parts: Vec<&str> = text.split("::").collect();
                                if !parts.is_empty() {
                                    let root = parts[0];
                                    if root != "crate" && root != "self" && root != "super" {
                                        return Some(root.to_string());
                                    } else if parts.len() > 1 {
                                        return Some(parts[1].to_string());
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    None
}

// ═══════════════════════════════════════════════════════════════
// 正则降级方案（Level 1，tree-sitter 不支持时使用）
// ═══════════════════════════════════════════════════════════════

fn extract_symbols_basic(source: &str, ext: &str) -> Vec<SymbolInfo> {
    let mut symbols = Vec::new();
    for (raw_lineno, raw_line) in source.lines().enumerate() {
        let line = raw_line.trim();
        let lineno = raw_lineno as u32;

        // TypeScript/JavaScript
        if matches!(ext, "ts" | "tsx" | "js" | "jsx") {
            if line.starts_with("export ") {
                if line.contains(" function ") || line.contains(" async function ") {
                    let name = extract_name(line, "function");
                    symbols.push(SymbolInfo {
                        name: name.unwrap_or_else(|| "?".into()),
                        kind: "function".into(),
                        file_path: String::new(),
                        line: lineno,
                        is_exported: true,
                        docstring: None,
                        signature: Some(line.to_string()),
                    });
                } else if line.contains(" class ") {
                    let name = extract_name(line, "class");
                    symbols.push(SymbolInfo {
                        name: name.unwrap_or_else(|| "?".into()),
                        kind: "class".into(),
                        file_path: String::new(),
                        line: lineno,
                        is_exported: true,
                        docstring: None,
                        signature: Some(line.to_string()),
                    });
                } else if line.contains(" interface ") {
                    let name = extract_name(line, "interface");
                    symbols.push(SymbolInfo {
                        name: name.unwrap_or_else(|| "?".into()),
                        kind: "interface".into(),
                        file_path: String::new(),
                        line: lineno,
                        is_exported: true,
                        docstring: None,
                        signature: Some(line.to_string()),
                    });
                } else if line.contains(" type ") {
                    let name = extract_name(line, "type");
                    symbols.push(SymbolInfo {
                        name: name.unwrap_or_else(|| "?".into()),
                        kind: "type_alias".into(),
                        file_path: String::new(),
                        line: lineno,
                        is_exported: true,
                        docstring: None,
                        signature: Some(line.to_string()),
                    });
                }
            }
        }

        // Rust
        if ext == "rs" {
            if line.starts_with("pub ") || line.starts_with("pub(") {
                if line.contains(" fn ") {
                    let name = extract_name(line, "fn");
                    symbols.push(SymbolInfo {
                        name: name.unwrap_or_else(|| "?".into()),
                        kind: "function".into(),
                        file_path: String::new(),
                        line: lineno,
                        is_exported: true,
                        docstring: None,
                        signature: Some(line.to_string()),
                    });
                } else if line.contains(" struct ") {
                    let name = extract_name(line, "struct");
                    symbols.push(SymbolInfo {
                        name: name.unwrap_or_else(|| "?".into()),
                        kind: "struct".into(),
                        file_path: String::new(),
                        line: lineno,
                        is_exported: true,
                        docstring: None,
                        signature: Some(line.to_string()),
                    });
                } else if line.contains(" enum ") {
                    let name = extract_name(line, "enum");
                    symbols.push(SymbolInfo {
                        name: name.unwrap_or_else(|| "?".into()),
                        kind: "enum".into(),
                        file_path: String::new(),
                        line: lineno,
                        is_exported: true,
                        docstring: None,
                        signature: Some(line.to_string()),
                    });
                } else if line.contains(" trait ") {
                    let name = extract_name(line, "trait");
                    symbols.push(SymbolInfo {
                        name: name.unwrap_or_else(|| "?".into()),
                        kind: "trait".into(),
                        file_path: String::new(),
                        line: lineno,
                        is_exported: true,
                        docstring: None,
                        signature: Some(line.to_string()),
                    });
                }
            }
        }
    }
    symbols
}

fn extract_name(line: &str, kind: &str) -> Option<String> {
    let after_kind = line.split(kind).nth(1)?;
    let name = after_kind.split(|c: char| c.is_whitespace() || c == '(' || c == '<' || c == '{')
        .find(|s| !s.is_empty())?;
    Some(name.to_string())
}

// ═══════════════════════════════════════════════════════════════
// CodeGraph DB 读取（Level 3）
// ═══════════════════════════════════════════════════════════════

/// 从 CodeGraph SQLite 读取符号数据，返回 (symbols, imports, file_hashes_map)
fn read_codegraph_data(
    db_path: &Path,
) -> (Vec<SymbolInfo>, Vec<ImportEdge>, HashMap<String, String>) {
    let conn = match rusqlite::Connection::open(db_path) {
        Ok(c) => c,
        Err(_) => return (vec![], vec![], HashMap::new()),
    };

    let mut symbols = Vec::new();

    // 读取 nodes（排除 file 类型）
    if let Ok(mut stmt) = conn.prepare(
        "SELECT name, kind, file_path, start_line, is_exported, docstring, signature, qualified_name
         FROM nodes WHERE kind != 'file' ORDER BY file_path, start_line",
    ) {
        if let Ok(rows) = stmt.query_map([], |row| {
            Ok(SymbolInfo {
                name: row.get::<_, String>(0)?,
                kind: row.get::<_, String>(1)?,
                file_path: row.get::<_, String>(2)?,
                line: row.get::<_, i64>(3)? as u32,
                is_exported: row.get::<_, i64>(4)? != 0,
                docstring: row.get::<_, Option<String>>(5)?,
                signature: row.get::<_, Option<String>>(6)?,
            })
        }) {
            for row in rows.flatten() {
                symbols.push(row);
            }
        }
    }

    // 读取 edges -> import 关系
    let mut imports = Vec::new();
    if let Ok(mut stmt) = conn.prepare(
        "SELECT e.source, e.target, e.kind
         FROM edges e
         JOIN nodes src ON e.source = src.id
         JOIN nodes tgt ON e.target = tgt.id
         WHERE e.kind IN ('import', 'calls', 'contains')
         LIMIT 500",
    ) {
        if let Ok(rows) = stmt.query_map([], |row| {
            let source_node_id: String = row.get(0)?;
            let target_node_id: String = row.get(1)?;
            let kind: String = row.get(2)?;
            Ok((source_node_id, target_node_id, kind))
        }) {
            // 解析 node_id -> file_path
            let _node_path_cache: HashMap<String, String> = symbols
                .iter()
                .map(|s| (format!("{}:{}:{}", s.kind, s.name, s.file_path), s.file_path.clone()))
                .collect();
            // 从 node_id 提取 file_path (node_id 的格式是 kind:hash 或 file:path)
            for row in rows.flatten() {
                let (src_id, tgt_id, kind) = row;
                // source node_id 格式可能是 "file:src/lib/foo.ts" 或 "function:hash"
                let src_path = src_id.strip_prefix("file:").unwrap_or("").to_string();
                let tgt_path = tgt_id.strip_prefix("file:").unwrap_or("").to_string();
                if !src_path.is_empty() && !tgt_path.is_empty() && src_path != tgt_path {
                    imports.push(ImportEdge {
                        source: src_path,
                        target: tgt_path,
                        kind,
                    });
                }
            }
        }
    }

    // 读取 files content_hash
    let mut file_hashes = HashMap::new();
    if let Ok(mut stmt) = conn.prepare("SELECT path, content_hash FROM files") {
        if let Ok(rows) = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        }) {
            for row in rows.flatten() {
                file_hashes.insert(row.0, row.1);
            }
        }
    }

    (symbols, imports, file_hashes)
}

// ═══════════════════════════════════════════════════════════════
// 扫描源码符号（增量扫描 + tree-sitter + 正则降级）
// ═══════════════════════════════════════════════════════════════

fn scan_source_symbols(
    dir: &Path,
    hash_cache: &mut FileHashCache,
    codegraph_symbols: &[SymbolInfo],
    cg_file_hashes: &HashMap<String, String>,
) -> Vec<SymbolInfo> {
    let mut all_symbols: Vec<SymbolInfo> = Vec::new();
    // 预填充 CodeGraph 符号（去重用文件路径 + 符号名 + 行号）
    let mut cg_set: std::collections::HashSet<(String, String, u32)> =
        std::collections::HashSet::new();
    for s in codegraph_symbols {
        cg_set.insert((s.file_path.clone(), s.name.clone(), s.line));
        all_symbols.push(s.clone());
    }

    fn walk(
        dir: &Path,
        base: &Path,
        all: &mut Vec<SymbolInfo>,
        hash_cache: &mut FileHashCache,
        cg_set: &std::collections::HashSet<(String, String, u32)>,
        cg_file_hashes: &HashMap<String, String>,
    ) {
        let entries = match std::fs::read_dir(dir) {
            Ok(e) => e,
            Err(_) => return,
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            if should_ignore(&name) {
                continue;
            }
            if path.is_dir() {
                walk(&path, base, all, hash_cache, cg_set, cg_file_hashes);
            } else {
                let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
                if !matches!(ext, "ts" | "tsx" | "js" | "jsx" | "rs") {
                    continue;
                }
                let rel = path
                    .strip_prefix(base)
                    .unwrap_or(&path)
                    .to_string_lossy()
                    .to_string();

                // 增量扫描：检查 hash 是否变化
                if cg_file_hashes.contains_key(&rel) {
                    // CodeGraph 已有该文件 hash，无需重新扫描
                    continue;
                }
                let cached_hash = hash_cache.get_hash(&rel);
                let current_hash = match std::fs::read(&path) {
                    Ok(bytes) => compute_file_hash(&bytes),
                    Err(_) => continue,
                };
                if cached_hash == Some(current_hash.as_str()) {
                    continue; // 文件未变化，跳过
                }
                hash_cache.set_hash(&rel, &current_hash);

                // 如果 CodeGraph 已有该文件包含的符号，跳过文件扫描
                let has_cg_symbols = cg_set.iter().any(|(fp, _, _)| fp == &rel);
                if has_cg_symbols {
                    continue;
                }

                let content = match std::fs::read_to_string(&path) {
                    Ok(c) => c,
                    Err(_) => continue,
                };

                // 优先 tree-sitter
                let syms = if ts_supported_ext(ext) {
                    let mut ts_syms = extract_symbols_treesitter(&content, ext);
                    // 去重 line + name
                    let seen: std::collections::HashSet<(String, u32)> = all
                        .iter()
                        .map(|s| (s.name.clone(), s.line))
                        .collect();
                    ts_syms.retain(|s| !seen.contains(&(s.name.clone(), s.line)));
                    for s in &mut ts_syms {
                        s.file_path = rel.clone();
                    }
                    ts_syms
                } else {
                    let mut re_syms = extract_symbols_basic(&content, ext);
                    let seen: std::collections::HashSet<(String, u32)> = all
                        .iter()
                        .map(|s| (s.name.clone(), s.line))
                        .collect();
                    re_syms.retain(|s| !seen.contains(&(s.name.clone(), s.line)));
                    for s in &mut re_syms {
                        s.file_path = rel.clone();
                    }
                    re_syms
                };

                all.extend(syms);
            }
        }
    }

    walk(
        dir,
        dir,
        &mut all_symbols,
        hash_cache,
        &cg_set,
        cg_file_hashes,
    );

    // 去重最终列表
    all_symbols.sort_by(|a, b| a.file_path.cmp(&b.file_path).then(a.line.cmp(&b.line)));
    all_symbols.dedup_by(|a, b| a.file_path == b.file_path && a.name == b.name && a.line == b.line);

    all_symbols
}

// ═══════════════════════════════════════════════════════════════
// 扫描导入关系（增量扫描 + CodeGraph edges）
// ═══════════════════════════════════════════════════════════════

fn scan_imports(
    dir: &Path,
    hash_cache: &mut FileHashCache,
    cg_imports: &[ImportEdge],
    cg_file_hashes: &HashMap<String, String>,
) -> Vec<ImportEdge> {
    let mut imports = cg_imports.to_vec();
    let mut cg_source_set: std::collections::HashSet<String> = cg_imports
        .iter()
        .map(|e| e.source.clone())
        .collect();

    fn walk(
        dir: &Path,
        base: &Path,
        imports: &mut Vec<ImportEdge>,
        hash_cache: &mut FileHashCache,
        cg_source_set: &mut std::collections::HashSet<String>,
        cg_file_hashes: &HashMap<String, String>,
    ) {
        let entries = match std::fs::read_dir(dir) {
            Ok(e) => e,
            Err(_) => return,
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            if should_ignore(&name) {
                continue;
            }
            if path.is_dir() {
                walk(
                    &path,
                    base,
                    imports,
                    hash_cache,
                    cg_source_set,
                    cg_file_hashes,
                );
            } else {
                let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
                if !matches!(ext, "ts" | "tsx" | "js" | "jsx" | "rs") {
                    continue;
                }
                let rel = path
                    .strip_prefix(base)
                    .unwrap_or(&path)
                    .to_string_lossy()
                    .to_string();

                // 增量扫描：hash 检查
                if cg_file_hashes.contains_key(&rel) {
                    continue; // CodeGraph 已有
                }
                let cached_hash = hash_cache.get_hash(&rel);
                let current_hash = match std::fs::read(&path) {
                    Ok(bytes) => compute_file_hash(&bytes),
                    Err(_) => continue,
                };
                if cached_hash == Some(current_hash.as_str()) {
                    continue;
                }
                hash_cache.set_hash(&rel, &current_hash);

                // CodeGraph 已处理的边跳过
                if cg_source_set.contains(&rel) {
                    continue;
                }

                let content = match std::fs::read_to_string(&path) {
                    Ok(c) => c,
                    Err(_) => continue,
                };

                // 使用 tree-sitter 提取导入关系（替代正则）
                let file_imports = if ts_supported_ext(ext) {
                    extract_imports_treesitter(&content, ext)
                } else {
                    Vec::new()
                };

                // 如果 tree-sitter 没解析到任何导入，对 .rs 文件额外尝试简单的行扫描（兜底）
                let file_imports = if file_imports.is_empty() && ext == "rs" {
                    let mut fallback = Vec::new();
                    for raw_line in content.lines() {
                        let line = raw_line.trim();
                        if line.starts_with("use ") {
                            let target = line
                                .strip_prefix("use ")
                                .and_then(|s| s.split("::").next())
                                .map(|s| s.to_string());
                            if let Some(target) = target {
                                fallback.push((target, "module".to_string()));
                            }
                        }
                    }
                    fallback
                } else {
                    file_imports
                };

                for (target, _kind) in &file_imports {
                    imports.push(ImportEdge {
                        source: rel.clone(),
                        target: target.clone(),
                        kind: "import".into(),
                    });
                }
            }
        }
    }

    walk(
        dir,
        dir,
        &mut imports,
        hash_cache,
        &mut cg_source_set,
        cg_file_hashes,
    );

    imports.sort_by(|a, b| a.source.cmp(&b.source).then_with(|| a.target.cmp(&b.target)));
    imports.dedup_by(|a, b| a.source == b.source && a.target == b.target);
    imports.truncate(200);
    imports
}

// ═══════════════════════════════════════════════════════════════
// 主入口
// ═══════════════════════════════════════════════════════════════

/// 扫描项目。force_rescan=true 时忽略所有缓存强制全量扫描。
pub fn scan_project(path: &str, force_rescan: bool) -> Result<ProjectContext, String> {
    let dir = Path::new(path);
    if !dir.is_dir() {
        return Err("路径不是有效的文件夹".into());
    }

    let project_name = dir
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "未命名项目".into());

    // 1. Build file tree (5 levels deep)
    let structure = build_file_tree(dir, 5);

    // 2. Summary
    let summary = collect_summary(&structure);

    // 3. Config files
    let configs = read_configs(dir);

    // 4. Primary language
    let primary_language = detect_primary_language(&summary, &configs);

    // 5. CodeGraph 可用性检查 + 数据读取
    let cg_db_path = dir.join(".codegraph").join("codegraph.db");
    let codegraph_available = cg_db_path.exists();

    let (cg_symbols, cg_imports, cg_file_hashes) = if codegraph_available {
        read_codegraph_data(&cg_db_path)
    } else {
        (vec![], vec![], HashMap::new())
    };

    // 6. Heavy analysis — full tree-sitter on force, CodeGraph on available, skip otherwise
    let (symbols, imports) = if force_rescan {
        let s = scan_source_symbols_fresh(dir);
        let i = scan_imports_fresh(dir);
        (s, i)
    } else if codegraph_available {
        let mut hc = FileHashCache::open(dir, None);
        let s = scan_source_symbols(dir, &mut hc, &cg_symbols, &cg_file_hashes);
        let i = scan_imports(dir, &mut hc, &cg_imports, &cg_file_hashes);
        hc.persist();
        (s, i)
    } else {
        // ponytail: non-force, no CodeGraph — skip tree-sitter parsing entirely
        (vec![], vec![])
    };

    Ok(ProjectContext {
        name: project_name,
        root_path: dir.to_string_lossy().to_string(),
        primary_language,
        structure,
        summary,
        configs,
        symbols,
        imports,
        codegraph_available,
    })
}

// 全量扫描（忽略缓存）
fn scan_source_symbols_fresh(dir: &Path) -> Vec<SymbolInfo> {
    let mut all_symbols = Vec::new();
    fn walk(dir: &Path, base: &Path, all: &mut Vec<SymbolInfo>) {
        let entries = match std::fs::read_dir(dir) {
            Ok(e) => e,
            Err(_) => return,
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            if should_ignore(&name) {
                continue;
            }
            if path.is_dir() {
                walk(&path, base, all);
            } else {
                let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
                if !matches!(ext, "ts" | "tsx" | "js" | "jsx" | "rs") {
                    continue;
                }
                let rel = path
                    .strip_prefix(base)
                    .unwrap_or(&path)
                    .to_string_lossy()
                    .to_string();
                let content = match std::fs::read_to_string(&path) {
                    Ok(c) => c,
                    Err(_) => continue,
                };
                let syms = if ts_supported_ext(ext) {
                    let mut ts_syms = extract_symbols_treesitter(&content, ext);
                    for s in &mut ts_syms {
                        s.file_path = rel.clone();
                    }
                    ts_syms
                } else {
                    let mut re_syms = extract_symbols_basic(&content, ext);
                    for s in &mut re_syms {
                        s.file_path = rel.clone();
                    }
                    re_syms
                };
                all.extend(syms);
            }
        }
    }
    walk(dir, dir, &mut all_symbols);
    all_symbols
}

fn scan_imports_fresh(dir: &Path) -> Vec<ImportEdge> {
    let mut imports = Vec::new();
    fn walk(dir: &Path, base: &Path, imports: &mut Vec<ImportEdge>) {
        let entries = match std::fs::read_dir(dir) {
            Ok(e) => e,
            Err(_) => return,
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            if should_ignore(&name) {
                continue;
            }
            if path.is_dir() {
                walk(&path, base, imports);
            } else {
                let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
                if !matches!(ext, "ts" | "tsx" | "js" | "jsx" | "rs") {
                    continue;
                }
                let rel = path
                    .strip_prefix(base)
                    .unwrap_or(&path)
                    .to_string_lossy()
                    .to_string();
                let content = match std::fs::read_to_string(&path) {
                    Ok(c) => c,
                    Err(_) => continue,
                };
                // 使用 tree-sitter 提取导入关系（替代正则）
                let file_imports = if ts_supported_ext(ext) {
                    extract_imports_treesitter(&content, ext)
                } else {
                    Vec::new()
                };
                // 兜底：.rs 文件如果 tree-sitter 没命中，尝试行扫描
                let file_imports = if file_imports.is_empty() && ext == "rs" {
                    let mut fallback = Vec::new();
                    for raw_line in content.lines() {
                        let line = raw_line.trim();
                        if line.starts_with("use ") {
                            if let Some(target) = line.strip_prefix("use ").and_then(|s| s.split("::").next()) {
                                fallback.push((target.to_string(), "module".to_string()));
                            }
                        }
                    }
                    fallback
                } else {
                    file_imports
                };
                for (target, _kind) in &file_imports {
                    imports.push(ImportEdge {
                        source: rel.clone(),
                        target: target.clone(),
                        kind: "import".into(),
                    });
                }
            }
        }
    }
    walk(dir, dir, &mut imports);
    imports.sort_by(|a, b| a.source.cmp(&b.source).then_with(|| a.target.cmp(&b.target)));
    imports.dedup_by(|a, b| a.source == b.source && a.target == b.target);
    imports.truncate(200);
    imports
}

// ─── 构建 AI 可读的上下文文本 ───

pub fn build_context_text(ctx: &ProjectContext) -> String {
    let mut parts = Vec::new();

    parts.push(format!(
        "## 项目概况\n- 名称: {}\n- 语言: {}\n- 文件数: {}, 目录数: {}\n- CodeGraph 索引: {}\n",
        ctx.name,
        ctx.primary_language.as_deref().unwrap_or("未知"),
        ctx.summary.total_files,
        ctx.summary.total_dirs,
        if ctx.codegraph_available { "可用" } else { "无" },
    ));

    if !ctx.summary.languages.is_empty() {
        parts.push("## 语言分布".into());
        for lang in &ctx.summary.languages {
            parts.push(format!("- {}: {} 文件", lang.language, lang.count));
        }
    }

    for cfg in &ctx.configs {
        parts.push(format!(
            "## 配置文件: {}\n```\n{}\n```",
            cfg.name, cfg.content
        ));
    }

    if !ctx.symbols.is_empty() {
        parts.push("## 导出符号".into());
        let mut by_kind: std::collections::BTreeMap<String, Vec<&SymbolInfo>> =
            std::collections::BTreeMap::new();
        for s in &ctx.symbols {
            by_kind.entry(s.kind.clone()).or_default().push(s);
        }
        for (kind, syms) in &by_kind {
            parts.push(format!("### {} ({} 个)", kind, syms.len()));
            for s in syms.iter().take(20) {
                let sig = s.signature.as_deref().unwrap_or(&s.name);
                parts.push(format!("- `{}` — {}", sig, s.file_path));
            }
            if syms.len() > 20 {
                parts.push(format!("  ... 还有 {} 个", syms.len() - 20));
            }
        }
    }

    if !ctx.imports.is_empty() {
        parts.push("## 模块依赖关系".into());
        let mut sources: std::collections::BTreeMap<&str, Vec<&str>> =
            std::collections::BTreeMap::new();
        for imp in &ctx.imports {
            sources.entry(imp.source.as_str()).or_default().push(&imp.target);
        }
        for (src, targets) in &sources {
            let mut unique_targets: Vec<_> = targets.clone();
            unique_targets.sort();
            unique_targets.dedup();
            parts.push(format!("- `{}` → {} 个外部依赖", src, unique_targets.len()));
        }
    }

    parts.join("\n\n")
}


// ═══════════════════════════════════════════════════════════════
// 文件系统监听（实时增量扫描）
// ═══════════════════════════════════════════════════════════════

use std::time::Duration;
use notify_debouncer_mini::new_debouncer;

/// 在后台线程启动文件监听，文件变更时通过回调通知。
/// 返回的 JoinHandle 可用于停止监听（drop handle 即停止）。
/// 
/// 变更的文件会更新 hash 缓存，并通过 on_change 回调返回相对路径列表。
pub fn spawn_folder_watcher<F>(
    base_dir: &Path,
    data_dir: Option<&Path>,
    on_change: F,
) -> std::thread::JoinHandle<()>
where
    F: Fn(Vec<String>) + Send + 'static,
{
    let base = base_dir.to_path_buf();

    // 加载已有 hash 缓存
    let cache_dir = data_dir
        .map(|d| d.join("index"))
        .unwrap_or_else(|| base_dir.join(".inkwise_index"));
    std::fs::create_dir_all(&cache_dir).ok();
    let cache_path = cache_dir.join("file_hashes.json");
    let hashes: std::collections::HashMap<String, String> = std::fs::read_to_string(&cache_path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();
    let hashes = std::sync::Arc::new(std::sync::Mutex::new(hashes));

    // 使用 channel 接收 debouncer 事件
    let (tx, rx) = std::sync::mpsc::channel::<notify_debouncer_mini::DebounceEventResult>();

    let mut debouncer = match new_debouncer(Duration::from_secs(2), tx) {
        Ok(d) => d,
        Err(e) => {
            log::error!("创建文件监听器失败: {}", e);
            return std::thread::spawn(|| {});
        }
    };

    if let Err(e) = debouncer.watcher().watch(&base, notify::RecursiveMode::Recursive) {
        log::error!("开始监听目录失败: {}", e);
        return std::thread::spawn(|| {});
    }

    std::thread::spawn(move || {
        // 保持 debouncer 存活
        let _debouncer = debouncer;
        loop {
            match rx.recv() {
                Ok(Ok(events)) => {
                    let mut changed = Vec::new();
                    for event in &events {
                        let path = &event.path;
                        let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
                        if should_ignore(&name) {
                            continue;
                        }
                        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
                        if !matches!(ext, "ts" | "tsx" | "js" | "jsx" | "rs") {
                            continue;
                        }
                        let rel = match path.strip_prefix(&base) {
                            Ok(r) => r.to_string_lossy().to_string(),
                            Err(_) => continue,
                        };
                        if let Ok(bytes) = std::fs::read(&path) {
                            let new_hash = compute_file_hash(&bytes);
                            if let Ok(mut h) = hashes.lock() {
                                let old = h.get(&rel).cloned();
                                if old.as_deref() != Some(&new_hash) {
                                    h.insert(rel.clone(), new_hash);
                                    changed.push(rel);
                                }
                            }
                        }
                    }
                    if !changed.is_empty() {
                        if let Ok(h) = hashes.lock() {
                            if let Ok(json) = serde_json::to_string(&*h) {
                                let _ = std::fs::write(&cache_path, json);
                            }
                        }
                        on_change(changed);
                    }
                }
                Ok(Err(e)) => log::warn!("文件监听 debouncer 错误: {:?}", e),
                Err(_) => break,
            }
        }
    })
}
