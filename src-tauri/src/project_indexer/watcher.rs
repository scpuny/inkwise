use crate::project_indexer::*;
use crate::project_indexer::scanner::{should_ignore, compute_file_hash};
use std::path::Path;
use notify_debouncer_mini::new_debouncer;
use std::time::Duration;

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
