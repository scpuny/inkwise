use serde::{Deserialize, Serialize};
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
                let size: u64 = children.iter().map(|c| c.size).sum();
                nodes.push(FileNode {
                    name,
                    path: rel_path,
                    is_dir: true,
                    language: None,
                    size,
                    children,
                });
            } else {
                let ext = entry_path
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("");
                let lang = detect_language(ext);
                let size = std::fs::metadata(&entry_path)
                    .map(|m| m.len())
                    .unwrap_or(0);
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
                entry.1 += 1; // placeholder, actual line count below
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

    // Sort by size, take top 20
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
                let max_len = 4000;
                let truncated = content.len() > max_len;
                let content = if truncated {
                    format!("{}...\n[内容太长，已截断]", &content[..max_len])
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
    // 从配置文件推断
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
    // 从文件数量最多的语言推断
    summary
        .languages
        .first()
        .map(|l| l.language.clone())
}

// ─── 代码符号提取（Level 1: 正则级别，后续 tree-sitter 增强） ───

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
            if line.starts_with("pub ") || line.starts_with("pub(crate) ") || line.starts_with("pub(super) ") {
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
            // impl block
            if line.starts_with("impl ") && line.contains(" for ") {
                let name = extract_name_impl(line);
                if let Some(name) = name {
                    symbols.push(SymbolInfo {
                        name,
                        kind: "impl".into(),
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

fn extract_name(line: &str, keyword: &str) -> Option<String> {
    let after_keyword = line.split(keyword).nth(1)?;
    let name = after_keyword.trim().split(|c: char| c.is_whitespace() || c == '<' || c == '(' || c == '{').next()?;
    Some(name.trim_end_matches(|c: char| c == ':' || c == ';').to_string())
}

fn extract_name_impl(line: &str) -> Option<String> {
    let after_impl = line.split("impl").nth(1)?;
    let parts: Vec<&str> = after_impl.split(" for ").collect();
    if parts.len() == 2 {
        Some(format!("impl {} for {}", parts[0].trim(), parts[1].trim()))
    } else {
        Some(parts[0].trim().to_string())
    }
}

// ─── 扫描源代码文件获取符号 ───

fn scan_source_symbols(dir: &Path) -> Vec<SymbolInfo> {
    let mut all_symbols = Vec::new();

    fn walk(dir: &Path, base: &Path, all: &mut Vec<SymbolInfo>) {
        let entries = match std::fs::read_dir(dir) {
            Ok(e) => e,
            Err(_) => return,
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            if should_ignore(&name) { continue; }
            if path.is_dir() {
                walk(&path, base, all);
            } else {
                let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
                if !matches!(ext, "ts" | "tsx" | "js" | "jsx" | "rs") { continue; }
                let rel = path.strip_prefix(base).unwrap_or(&path).to_string_lossy().to_string();
                if let Ok(content) = std::fs::read_to_string(&path) {
                    let mut syms = extract_symbols_basic(&content, ext);
                    for s in &mut syms {
                        s.file_path = rel.clone();
                    }
                    all.extend(syms);
                }
            }
        }
    }

    walk(dir, dir, &mut all_symbols);
    all_symbols
}

// ─── 扫描导入关系（简单实现） ───

fn scan_imports(dir: &Path) -> Vec<ImportEdge> {
    let mut imports = Vec::new();

    fn walk(dir: &Path, base: &Path, imports: &mut Vec<ImportEdge>) {
        let entries = match std::fs::read_dir(dir) {
            Ok(e) => e,
            Err(_) => return,
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            if should_ignore(&name) { continue; }
            if path.is_dir() {
                walk(&path, base, imports);
            } else {
                let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
                if !matches!(ext, "ts" | "tsx" | "js" | "jsx" | "rs") { continue; }
                let rel = path.strip_prefix(base).unwrap_or(&path).to_string_lossy().to_string();
                if let Ok(content) = std::fs::read_to_string(&path) {
                    for raw_line in content.lines() {
            let line = raw_line.trim();
                        // import from / require
                        if ext != "rs" {
                            if let Some(target) = line
                                .strip_prefix("import ")
                                .or_else(|| line.strip_prefix("const "))
                                .and_then(|s| {
                                    if s.contains(" from ") {
                                        s.split(" from ").nth(1)
                                    } else if s.contains("require(") {
                                        s.split("require(").nth(1)
                                    } else { None }
                                })
                                .and_then(|s| {
                                    let s = s.trim().trim_matches('\'').trim_matches('"');
                                    Some(s.split(|c| c == '\'' || c == '"').next()?.to_string())
                                })
                            {
                                imports.push(ImportEdge {
                                    source: rel.clone(),
                                    target,
                                    kind: "import".into(),
                                });
                            }
                        }
                        // Rust use
                        if ext == "rs" && line.starts_with("use ") {
                            let target = line
                                .strip_prefix("use ")
                                .and_then(|s| s.split("::").next())
                                .map(|s| s.to_string());
                            if let Some(target) = target {
                                imports.push(ImportEdge {
                                    source: rel.clone(),
                                    target,
                                    kind: "import".into(),
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    walk(dir, dir, &mut imports);

    // Deduplicate near-duplicates
    imports.sort_by(|a, b| a.source.cmp(&b.source).then_with(|| a.target.cmp(&b.target)));
    imports.dedup_by(|a, b| a.source == b.source && a.target == b.target);
    imports.truncate(200); // limit
    imports
}

// ─── 主入口 ───

pub fn scan_project(path: &str) -> Result<ProjectContext, String> {
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

    // 5. Code symbols
    let symbols = scan_source_symbols(dir);

    // 6. Import edges
    let imports = scan_imports(dir);

    // 7. CodeGraph availability
    let codegraph_available = dir.join(".codegraph").join("codegraph.db").exists();

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

// ─── 构建 AI 可读的上下文文本 ───

pub fn build_context_text(ctx: &ProjectContext) -> String {
    let mut parts = Vec::new();

    // Project overview
    parts.push(format!(
        "## 项目概况\n- 名称: {}\n- 语言: {}\n- 文件数: {}, 目录数: {}\n- CodeGraph 索引: {}\n",
        ctx.name,
        ctx.primary_language.as_deref().unwrap_or("未知"),
        ctx.summary.total_files,
        ctx.summary.total_dirs,
        if ctx.codegraph_available { "可用" } else { "无" },
    ));

    // Language distribution
    if !ctx.summary.languages.is_empty() {
        parts.push("## 语言分布".into());
        for lang in &ctx.summary.languages {
            parts.push(format!("- {}: {} 文件", lang.language, lang.count));
        }
    }

    // Key configs
    for cfg in &ctx.configs {
        parts.push(format!(
            "## 配置文件: {}\n```\n{}\n```",
            cfg.name, cfg.content
        ));
    }

    // Top-level exports (organized by kind)
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

    // Module dependency summary
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
