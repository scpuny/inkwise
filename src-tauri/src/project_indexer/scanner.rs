// project_indexer/scanner.rs — 项目扫描 / tree-sitter 解析 / hash 缓存
use sha2::{Sha256, Digest};
use std::collections::HashMap;
use std::path::{Path, PathBuf};


use crate::project_indexer::*;
use streaming_iterator::StreamingIterator;

// ─── 文件 Hash 缓存（增量扫描）───

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

    fn get_hash(&self, rel_path: &str) -> Option<String> {
        match self {
            Self::Codegraph(conn) => {
                let mut stmt = conn
                    .prepare("SELECT content_hash FROM files WHERE path = ?1")
                    .ok()?;
                stmt.query_row(rusqlite::params![rel_path], |row| row.get::<_, String>(0))
                    .ok()
            }
            Self::Json { hashes, .. } => hashes.get(rel_path).cloned(),
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

pub(crate) fn compute_file_hash(content: &[u8]) -> String {
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

pub(crate) fn should_ignore(name: &str) -> bool {
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
                    lines: 0,
                    children,
                });
            } else {
                let ext = entry_path.extension().and_then(|e| e.to_str()).unwrap_or("");
                let lang = detect_language(ext);
                let size = std::fs::metadata(&entry_path).map(|m| m.len()).unwrap_or(0);
                let lines = std::fs::read_to_string(&entry_path)
                    .map(|c| c.lines().count() as u64)
                    .unwrap_or(0);
                nodes.push(FileNode {
                    name,
                    path: rel_path,
                    is_dir: false,
                    language: lang.map(|l| l.to_string()),
                    size,
                    lines,
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
                entry.1 += node.lines;
                all_files.push(FileInfo {
                    path: node.path.clone(),
                    language: node.language.clone(),
                    lines: node.lines,
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
// ═══════════════════════════════════════════════════════════════
// tree-sitter Query 通用执行（参考 Kiro AST 算法，基于 .scm 文件）
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

/// 扩展名 → .scm 查询文件语言名
fn ext_to_query_lang(ext: &str) -> Option<&'static str> {
    match ext {
        "ts" | "tsx" | "js" | "jsx" => Some("typescript"),
        "rs" => Some("rust"),
        "py" => Some("python"),
        "go" => Some("go"),
        "java" => Some("java"),
        _ => None,
    }
}

/// 加载 .scm 查询文件文本
fn load_query_text(lang_name: &str, layer: &str) -> Option<String> {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tree-sitter-queries")
        .join(layer)
        .join(format!("{}.scm", lang_name));
    std::fs::read_to_string(&path).ok()
}

// ─── tree-sitter Query 执行结果类型 ───

/// 单次捕获（一个 @name 标签）
#[derive(Debug, Clone)]
struct QueryCapture {
    /// 捕获名（definition / name / parameters / source 等）
    name: String,
    /// 捕获节点的 tree-sitter kind（function_declaration / string 等）
    node_kind: String,
    /// 捕获到的源码文本
    text: String,
    /// 起始字节偏移
    start_byte: usize,
    /// 结束字节偏移
    end_byte: usize,
    /// 起始行（0-based）
    start_line: u32,
    /// 结束行（0-based）
    end_line: u32,
}

/// 一次 pattern 匹配的所有 captures 分组
#[derive(Debug, Clone)]
struct QueryMatch {
    captures: Vec<QueryCapture>,
    pattern_index: usize,
}

/// 通用 tree-sitter Query 执行函数
///
/// 加载指定层的 .scm 文件，执行查询，返回所有匹配的 capture 分组。
/// layer 可选值: "code-snippet" / "import" / "root-context"
fn query_execute(source: &str, ext: &str, layer: &str) -> Vec<QueryMatch> {
    let (lang, _) = match get_tree_sitter_language(ext) {
        Some(v) => v,
        None => return Vec::new(),
    };
    let lang_name = match ext_to_query_lang(ext) {
        Some(v) => v,
        None => return Vec::new(),
    };
    let query_text = match load_query_text(lang_name, layer) {
        Some(t) => t,
        None => return Vec::new(),
    };

    // 编译 query
    let query = match tree_sitter::Query::new(&lang, &query_text) {
        Ok(q) => q,
        Err(_) => return Vec::new(),
    };

    // 解析源码
    let mut parser = tree_sitter::Parser::new();
    parser
        .set_language(&lang)
        .expect("tree-sitter language 初始化失败");
    let tree = match parser.parse(source, None) {
        Some(t) => t,
        None => return Vec::new(),
    };

    // 执行 query（tree-sitter 0.24 API: QueryMatches::next() 手动迭代）
    let mut cursor = tree_sitter::QueryCursor::new();
    let mut query_matches = cursor.matches(&query, tree.root_node(), source.as_bytes());
    let capture_names = query.capture_names();

    let mut results: Vec<QueryMatch> = Vec::new();
    query_matches.advance();
    while let Some(match_) = query_matches.get() {
        let mut captures: Vec<QueryCapture> = Vec::with_capacity(match_.captures.len());
        for cap in match_.captures.iter() {
            let node = cap.node;
            if let Ok(text) = node.utf8_text(source.as_bytes()) {
                captures.push(QueryCapture {
                    name: capture_names[cap.index as usize].to_string(),
                    node_kind: node.kind().to_string(),
                    text: text.to_string(),
                    start_byte: node.start_byte(),
                    end_byte: node.end_byte(),
                    start_line: node.start_position().row as u32,
                    end_line: node.end_position().row as u32,
                });
            }
        }
        captures.shrink_to_fit();
        results.push(QueryMatch {
            captures,
            pattern_index: match_.pattern_index,
        });
        query_matches.advance();
    }
    results
}

// ─── code-snippet 层：Query → SymbolInfo ───

/// 从 code-snippet 层 query 结果提取 SymbolInfo
fn symbols_from_query(source: &str, ext: &str, matches: &[QueryMatch]) -> Vec<SymbolInfo> {
    let mut symbols = Vec::new();
    for m in matches {
        let def = match m.captures.iter().find(|c| c.name == "definition") {
            Some(d) => d,
            None => continue,
        };
        let name = match m.captures.iter().find(|c| c.name == "name") {
            Some(n) => n,
            None => continue,
        };

        // node_kind → SymbolInfo.kind
        let kind: &str = match def.node_kind.as_str() {
            // TypeScript/JavaScript
            "function_declaration" | "method_definition" | "arrow_function"
            | "generator_function_declaration" => "function",
            "class_declaration" => "class",
            "interface_declaration" => "interface",
            "type_alias" => "type_alias",
            "enum_declaration" => "enum",
            // Rust
            "function_item" => "function",
            "struct_item" => "struct",
            "enum_item" => "enum",
            "trait_item" => "trait",
            "impl_item" => "impl",
            "type_item" => "type_alias",
            "const_item" | "static_item" => "constant",
            _ => &def.node_kind,
        };

        // docstring: 优先 @comment 捕获，降级源码行扫描
        let docstring = m
            .captures
            .iter()
            .find(|c| c.name == "comment")
            .map(|c| c.text.clone())
            .or_else(|| extract_docstring_lines(source, def.start_line));

        // 签名: 截取定义第一行到 {
        let signature = def.text.lines().next().map(|l| {
            if let Some(pos) = l.find('{') {
                l[..pos].trim().to_string()
            } else {
                l.trim().to_string()
            }
        });

        // is_exported
        let is_exported = if ext == "rs" {
            true // Rust: 简化标记所有项
        } else {
            check_export_keyword(source, def.start_byte)
        };

        symbols.push(SymbolInfo {
            name: name.text.clone(),
            kind: kind.to_string(),
            file_path: String::new(),
            line: def.start_line + 1, // 1-based
            is_exported,
            docstring,
            signature,
        });
    }
    symbols
}

/// 检查 definition 节点前是否有 export 关键字
fn check_export_keyword(source: &str, def_start_byte: usize) -> bool {
    if def_start_byte == 0 {
        return false;
    }
    let before = &source[..def_start_byte];
    before
        .split(|c: char| c.is_whitespace() || c == '\n' || c == '\r')
        .any(|w| w == "export")
}

/// 源码行扫描提取文档注释（用于无 @comment 捕获的语言）
fn extract_docstring_lines(source: &str, def_start_line: u32) -> Option<String> {
    let lines: Vec<&str> = source.lines().collect();
    let mut docs: Vec<&str> = Vec::new();
    let mut line = def_start_line as isize - 1;
    while line >= 0 {
        let current = lines[line as usize].trim();
        if current.starts_with("///") {
            docs.push(current.trim_start_matches("///").trim());
        } else if current.starts_with("//!") {
            docs.push(current.trim_start_matches("//!").trim());
        } else if current.starts_with('/') {
            // block comment /* ... */ — 简单提取最后一段
            if let Some(text) = current
                .trim_start_matches('/')
                .trim_start_matches('*')
                .trim_end_matches('*')
                .trim_end_matches('/')
                .trim()
                .split('*')
                .last()
            {
                if !text.is_empty() {
                    docs.push(text.trim());
                }
            }
            break;
        } else if current.is_empty() {
            // skip empty line
        } else {
            break;
        }
        line -= 1;
    }
    docs.reverse();
    if docs.is_empty() {
        None
    } else {
        Some(docs.join(" ").to_string())
    }
}

// ─── 入口：统一调用 query_execute + 转换 ───

/// 用 tree-sitter query 提取符号（替代手写 AST 遍历）
fn extract_symbols_treesitter(source: &str, ext: &str) -> Vec<SymbolInfo> {
    let matches = query_execute(source, ext, "code-snippet");
    symbols_from_query(source, ext, &matches)
}

// ─── import 层：Query → ImportEdge 列表 ───

/// 从 import 层 query 结果提取导入列表
fn imports_from_query(matches: &[QueryMatch]) -> Vec<(String, String)> {
    let mut imports = Vec::new();
    for m in matches {
        // TypeScript/JS: @source 捕获
        if let Some(src) = m.captures.iter().find(|c| c.name == "source") {
            let cleaned = src.text.trim().trim_matches('\'').trim_matches('"');
            if !cleaned.is_empty() && !cleaned.starts_with('.') {
                let pkg = cleaned.split('/').next().unwrap_or(cleaned);
                imports.push((pkg.to_string(), "module".to_string()));
            }
        }
        // Python: @module 捕获
        if let Some(module) = m.captures.iter().find(|c| c.name == "module") {
            let cleaned = module.text.trim();
            if !cleaned.is_empty() {
                imports.push((cleaned.to_string(), "module".to_string()));
            }
        }
        // Rust: @path 捕获（use 声明）
        if let Some(path) = m.captures.iter().find(|c| c.name == "path") {
            let parts: Vec<&str> = path.text.split("::").collect();
            if !parts.is_empty() {
                let root = parts[0];
                if root != "crate" && root != "self" && root != "super" {
                    imports.push((root.to_string(), "module".to_string()));
                } else if parts.len() > 1 {
                    imports.push((parts[1].to_string(), "module".to_string()));
                }
            }
        }
        // Rust: @crate_name 捕获（extern crate）
        if let Some(crate_name) = m.captures.iter().find(|c| c.name == "crate_name") {
            imports.push((crate_name.text.clone(), "module".to_string()));
        }
    }
    imports
}

/// 用 tree-sitter query 提取导入关系（替代手写 AST 遍历）
fn extract_imports_treesitter(source: &str, ext: &str) -> Vec<(String, String)> {
    let matches = query_execute(source, ext, "import");
    imports_from_query(&matches)
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
                if cached_hash.as_deref() == Some(current_hash.as_str()) {
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
                if cached_hash.as_deref() == Some(current_hash.as_str()) {
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

