// project_indexer/synthesizer.rs — 知识综合器
// 将原始 ProjectContext 数据（符号/导入/配置/文件树/root_contexts）合成为
// AI 可直接理解的项目知识摘要，替代原始数据 dump。

use crate::project_indexer::*;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap, HashSet};

/// 综合后的项目知识摘要
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProjectKnowledge {
    /// 技术栈摘要（框架/语言/构建工具/关键依赖）
    pub tech_stack: String,
    /// 架构模式推断（MVC/模块化/单页应用/微服务等）
    pub architecture: String,
    /// 核心模块职责（每个顶级目录的职责推断）
    pub module_responsibilities: Vec<String>,
    /// 入口点文件
    pub entry_points: Vec<String>,
    /// 外部依赖图谱（去重后的关键依赖）
    pub key_dependencies: Vec<String>,
    /// 内部模块关系（哪些模块导入哪些模块）
    pub module_relations: Vec<String>,
    /// 顶层结构签名（函数/类声明，已按文件分组）
    pub root_signatures: Vec<String>,
}

impl ProjectKnowledge {
    /// 转为 AI 可读的 Markdown 文本
    pub fn to_markdown(&self) -> String {
        let mut parts = Vec::new();

        parts.push(format!("## 技术栈\n{}", self.tech_stack));

        parts.push(format!("## 架构模式\n{}", self.architecture));

        if !self.module_responsibilities.is_empty() {
            parts.push(format!(
                "## 核心模块职责\n{}",
                self.module_responsibilities.join("\n")
            ));
        }

        if !self.entry_points.is_empty() {
            parts.push(format!(
                "## 入口点\n{}",
                self.entry_points.join("\n")
            ));
        }

        if !self.key_dependencies.is_empty() {
            parts.push(format!(
                "## 关键依赖\n{}",
                self.key_dependencies.join("\n")
            ));
        }

        if !self.module_relations.is_empty() {
            parts.push(format!(
                "## 模块关系\n{}",
                self.module_relations.join("\n")
            ));
        }

        if !self.root_signatures.is_empty() {
            parts.push(format!(
                "## 核心接口签名\n```\n{}\n```",
                self.root_signatures.join("\n")
            ));
        }

        parts.join("\n\n")
    }
}

/// 从 ProjectContext 合成项目知识
pub fn synthesize_knowledge(ctx: &ProjectContext) -> ProjectKnowledge {
    ProjectKnowledge {
        tech_stack: synthesize_tech_stack(ctx),
        architecture: synthesize_architecture(ctx),
        module_responsibilities: synthesize_module_responsibilities(ctx),
        entry_points: identify_entry_points(ctx),
        key_dependencies: extract_key_dependencies(ctx),
        module_relations: synthesize_module_relations(ctx),
        root_signatures: ctx.root_contexts.clone(),
    }
}

// ─── 技术栈合成 ───

fn synthesize_tech_stack(ctx: &ProjectContext) -> String {
    let mut lines = Vec::new();

    // 主语言
    if let Some(lang) = &ctx.primary_language {
        lines.push(format!("- 主语言: {}", lang));
    }

    // 从配置文件提取技术栈信息
    for cfg in &ctx.configs {
        match cfg.name.as_str() {
            "package.json" => {
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&cfg.content) {
                    if let Some(name) = parsed.get("name").and_then(|v| v.as_str()) {
                        lines.push(format!("- 项目名: {}", name));
                    }
                    if let Some(desc) = parsed.get("description").and_then(|v| v.as_str()) {
                        lines.push(format!("- 描述: {}", desc));
                    }
                    if let Some(deps) = parsed.get("dependencies").and_then(|v| v.as_object()) {
                        let key_deps = extract_key_npm_deps(deps);
                        if !key_deps.is_empty() {
                            lines.push(format!("- 前端框架/库: {}", key_deps.join(", ")));
                        }
                    }
                    if let Some(dev_deps) = parsed.get("devDependencies").and_then(|v| v.as_object()) {
                        let build_tools = extract_build_tools(dev_deps);
                        if !build_tools.is_empty() {
                            lines.push(format!("- 构建工具: {}", build_tools.join(", ")));
                        }
                    }
                }
            }
            "Cargo.toml" => {
                for line in cfg.content.lines() {
                    let trimmed = line.trim();
                    if trimmed.starts_with("name = ") {
                        lines.push(format!("- 项目名: {}", trimmed.trim_start_matches("name = ").trim_matches('"')));
                    }
                    if trimmed.starts_with("edition = ") {
                        lines.push(format!("- Rust Edition: {}", trimmed.trim_start_matches("edition = ").trim_matches('"')));
                    }
                }
                // 提取关键依赖
                let deps = extract_cargo_deps(&cfg.content);
                if !deps.is_empty() {
                    lines.push(format!("- 关键 Crate: {}", deps.join(", ")));
                }
            }
            "go.mod" => {
                for line in cfg.content.lines() {
                    let trimmed = line.trim();
                    if trimmed.starts_with("module ") {
                        lines.push(format!("- 模块: {}", trimmed.trim_start_matches("module ")));
                    }
                    if trimmed.starts_with("go ") {
                        lines.push(format!("- Go 版本: {}", trimmed.trim_start_matches("go ")));
                    }
                }
            }
            "pyproject.toml" => {
                // 提取 Python 项目信息
                for line in cfg.content.lines() {
                    let trimmed = line.trim();
                    if trimmed.starts_with("name = ") {
                        lines.push(format!("- 项目名: {}", trimmed.trim_start_matches("name = ").trim_matches('"')));
                    }
                }
            }
            "README.md" => {
                // 提取第一段有意义的描述
                let desc = extract_readme_description(&cfg.content);
                if let Some(d) = desc {
                    lines.push(format!("- 项目简介: {}", d));
                }
            }
            _ => {}
        }
    }

    // 语言分布补充
    if !ctx.summary.languages.is_empty() {
        let lang_summary: Vec<String> = ctx
            .summary
            .languages
            .iter()
            .map(|l| format!("{}({}文件/{}行)", l.language, l.count, l.lines))
            .collect();
        lines.push(format!("- 语言分布: {}", lang_summary.join(", ")));
    }

    if lines.is_empty() {
        "无法识别技术栈信息".into()
    } else {
        lines.join("\n")
    }
}

/// 从 package.json dependencies 中提取关键前端框架
fn extract_key_npm_deps(deps: &serde_json::Map<String, serde_json::Value>) -> Vec<String> {
    let frameworks = [
        "react", "vue", "svelte", "angular", "next", "nuxt", "solid-js",
        "express", "fastify", "koa", "nestjs",
    ];
    let mut found = Vec::new();
    for key in deps.keys() {
        let base = key.split('/').next().unwrap_or(key);
        if frameworks.contains(&base) {
            found.push(base.to_string());
        }
    }
    found
}

/// 从 devDependencies 中提取构建工具
fn extract_build_tools(deps: &serde_json::Map<String, serde_json::Value>) -> Vec<String> {
    let tools = [
        "vite", "webpack", "rollup", "esbuild", "parcel", "turbo",
        "typescript", "tsc", "babel",
        "tailwindcss", "postcss", "sass",
        "eslint", "prettier", "vitest", "jest", "playwright",
        "tauri",
    ];
    let mut found = Vec::new();
    for key in deps.keys() {
        let base = key.split('/').next().unwrap_or(key);
        if tools.contains(&base) {
            found.push(base.to_string());
        }
    }
    found
}

/// 从 Cargo.toml 提取关键依赖名
fn extract_cargo_deps(content: &str) -> Vec<String> {
    let key_crates = [
        "tokio", "serde", "tauri", "reqwest", "rusqlite", "tree-sitter",
        "notify", "sha2", "base64", "ndarray", "tract-onnx",
        "axum", "actix-web", "warp", "rocket",
        "diesel", "sqlx", "sea-orm",
    ];
    let mut in_deps = false;
    let mut found = Vec::new();
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('[') {
            in_deps = trimmed.contains("dependencies");
            continue;
        }
        if in_deps {
            if let Some(name) = trimmed.split('=').next() {
                let name = name.trim();
                if key_crates.contains(&name) {
                    found.push(name.to_string());
                }
            }
        }
    }
    found
}

/// 从 README 提取第一段有意义的描述
fn extract_readme_description(content: &str) -> Option<String> {
    let mut in_content = false;
    let mut desc_lines = Vec::new();
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            if in_content && !desc_lines.is_empty() {
                break;
            }
            continue;
        }
        if trimmed.starts_with('#') {
            if in_content {
                break;
            }
            continue;
        }
        in_content = true;
        desc_lines.push(trimmed.to_string());
        if desc_lines.join(" ").len() > 200 {
            break;
        }
    }
    if desc_lines.is_empty() {
        None
    } else {
        Some(desc_lines.join(" "))
    }
}

// ─── 架构模式推断 ───

fn synthesize_architecture(ctx: &ProjectContext) -> String {
    let mut patterns = Vec::new();

    // 从目录结构推断
    let top_dirs: HashSet<&str> = ctx
        .structure
        .iter()
        .filter(|n| n.is_dir)
        .map(|n| n.name.as_str())
        .collect();

    // 前端框架特征
    if top_dirs.contains("src") && top_dirs.contains("public") {
        patterns.push("前端单页应用 (SPA)".into());
    }
    if top_dirs.contains("src-tauri") || top_dirs.contains("src") {
        // 检查是否有 Tauri
        if ctx.configs.iter().any(|c| c.name == "tauri.conf.json") {
            patterns.push("Tauri 桌面应用 (Rust + Web)".into());
        }
    }
    if top_dirs.contains("src") && top_dirs.contains("src-tauri") {
        patterns.push("前后端分离架构 (React/Vue + Rust)".into());
    }

    // 后端架构特征
    if top_dirs.contains("cmd") && top_dirs.contains("internal") {
        patterns.push("Go 标准布局 (cmd/internal/pkg)".into());
    }
    if top_dirs.contains("src") && ctx.configs.iter().any(|c| c.name == "Cargo.toml") {
        patterns.push("Rust 后端服务".into());
    }

    // 组件化特征
    if top_dirs.contains("components") || top_dirs.contains("src") {
        let has_components = ctx.structure.iter().any(|n| {
            n.is_dir && (n.name == "components" || n.name == "src")
                && n.children.iter().any(|c| c.name == "components")
        });
        if has_components {
            patterns.push("组件化前端架构".into());
        }
    }

    // 分层架构特征
    let layer_dirs = ["domain", "services", "infrastructure", "hooks", "controllers", "models", "views"];
    let found_layers: Vec<&str> = layer_dirs.iter().filter(|d| top_dirs.contains(*d)).copied().collect();
    if found_layers.len() >= 3 {
        patterns.push(format!("分层架构 ({})", found_layers.join("/")));
    }

    // 微服务特征
    if top_dirs.contains("services") || top_dirs.contains("packages") {
        if ctx.structure.iter().any(|n| n.is_dir && n.name == "services" && n.children.len() > 2) {
            patterns.push("微服务/多包架构".into());
        }
    }

    // 单体仓库特征
    if top_dirs.contains("packages") && top_dirs.contains("apps") {
        patterns.push("Monorepo (apps/packages)".into());
    }

    if patterns.is_empty() {
        // 通用描述
        format!(
            "标准项目结构，{} 个文件分布在 {} 个目录中",
            ctx.summary.total_files, ctx.summary.total_dirs
        )
    } else {
        patterns.join("\n")
    }
}

// ─── 核心模块职责推断 ───

fn synthesize_module_responsibilities(ctx: &ProjectContext) -> Vec<String> {
    let mut responsibilities = Vec::new();

    // 按顶级目录分组符号
    let mut dir_symbols: BTreeMap<String, Vec<&SymbolInfo>> = BTreeMap::new();
    for sym in &ctx.symbols {
        let parts: Vec<&str> = sym.file_path.split('/').collect();
        if parts.len() >= 2 {
            let top_dir = if parts[0] == "src" && parts.len() > 2 {
                parts[1].to_string()
            } else {
                parts[0].to_string()
            };
            dir_symbols.entry(top_dir).or_default().push(sym);
        }
    }

    // 每个目录推断职责
    for (dir, syms) in &dir_symbols {
        if syms.len() < 2 {
            continue;
        }
        let kinds: HashSet<&str> = syms.iter().map(|s| s.kind.as_str()).collect();
        let exported_count = syms.iter().filter(|s| s.is_exported).count();

        let mut desc = format!("- **{}** ({} 个符号, {} 个导出)", dir, syms.len(), exported_count);

        // 根据符号类型推断职责
        let mut roles = Vec::new();
        if kinds.contains("class") {
            roles.push("类定义");
        }
        if kinds.contains("function") {
            roles.push("函数逻辑");
        }
        if kinds.contains("struct") || kinds.contains("enum") {
            roles.push("数据结构");
        }
        if kinds.contains("trait") || kinds.contains("interface") {
            roles.push("接口/抽象");
        }
        if kinds.contains("method") {
            roles.push("方法实现");
        }
        if !roles.is_empty() {
            desc.push_str(&format!(" — {}", roles.join("/")));
        }

        // 列出前几个关键符号
        let key_syms: Vec<String> = syms
            .iter()
            .filter(|s| s.is_exported)
            .take(5)
            .map(|s| s.signature.as_deref().unwrap_or(&s.name).to_string())
            .collect();
        if !key_syms.is_empty() {
            desc.push_str(&format!("; 关键: {}", key_syms.join(", ")));
        }

        responsibilities.push(desc);
    }

    responsibilities.truncate(15);
    responsibilities
}

// ─── 入口点识别 ───

fn identify_entry_points(ctx: &ProjectContext) -> Vec<String> {
    let entry_patterns = [
        "main.rs", "lib.rs", "main.go", "main.py", "Main.java",
        "index.ts", "index.tsx", "index.js", "index.jsx",
        "app.ts", "app.tsx", "app.js", "app.jsx",
        "main.ts", "main.tsx", "main.js", "main.jsx",
    ];

    let mut entries = Vec::new();

    // 从文件树查找入口文件
    fn find_entries(node: &FileNode, entries: &mut Vec<String>, patterns: &[&str]) {
        if !node.is_dir {
            let name = node.name.as_str();
            if patterns.contains(&name) {
                entries.push(format!("- `{}` ({} 行)", node.path, node.lines));
            }
        }
        for child in &node.children {
            find_entries(child, entries, patterns);
        }
    }

    for node in &ctx.structure {
        find_entries(node, &mut entries, &entry_patterns);
    }

    // 从配置文件补充入口信息
    for cfg in &ctx.configs {
        if cfg.name == "package.json" {
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&cfg.content) {
                if let Some(main) = parsed.get("main").and_then(|v| v.as_str()) {
                    entries.push(format!("- `{}` (package.json main)", main));
                }
                if let Some(module) = parsed.get("module").and_then(|v| v.as_str()) {
                    entries.push(format!("- `{}` (ESM entry)", module));
                }
            }
        }
    }

    entries.dedup();
    entries.truncate(10);
    entries
}

// ─── 关键依赖提取 ───

fn extract_key_dependencies(ctx: &ProjectContext) -> Vec<String> {
    let mut dep_count: HashMap<String, usize> = HashMap::new();

    for imp in &ctx.imports {
        *dep_count.entry(imp.target.clone()).or_insert(0) += 1;
    }

    // 按引用次数排序，取 Top 20
    let mut sorted: Vec<_> = dep_count.into_iter().collect();
    sorted.sort_by(|a, b| b.1.cmp(&a.1));

    sorted
        .into_iter()
        .take(20)
        .map(|(dep, count)| format!("- `{}` (被 {} 个文件引用)", dep, count))
        .collect()
}

// ─── 模块关系合成 ───

fn synthesize_module_relations(ctx: &ProjectContext) -> Vec<String> {
    // 按顶级目录分组导入关系
    let mut dir_imports: BTreeMap<String, HashSet<String>> = BTreeMap::new();

    for imp in &ctx.imports {
        let parts: Vec<&str> = imp.source.split('/').collect();
        if parts.len() >= 2 {
            let top_dir = if parts[0] == "src" && parts.len() > 2 {
                parts[1].to_string()
            } else {
                parts[0].to_string()
            };
            dir_imports
                .entry(top_dir)
                .or_default()
                .insert(imp.target.clone());
        }
    }

    let mut relations = Vec::new();
    for (dir, deps) in &dir_imports {
        if deps.len() >= 2 {
            let mut dep_list: Vec<_> = deps.iter().collect();
            dep_list.sort();
            relations.push(format!(
                "- **{}** 依赖: {}",
                dir,
                dep_list
                    .iter()
                    .take(10)
                    .map(|d| format!("`{}`", d))
                    .collect::<Vec<_>>()
                    .join(", ")
            ));
        }
    }

    relations.truncate(12);
    relations
}
