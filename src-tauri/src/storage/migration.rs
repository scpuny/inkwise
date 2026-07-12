// ─── JSON → SQLite 数据迁移 ───
// 一次性迁移脚本。将 data/*.json 中的数据迁移到 SQLite 表。
// 迁移完成后，JSON 文件保留不删（安全网），标记迁移完成。

use serde::Serialize;
use std::path::Path;

/// 执行全量迁移

/// 迁移完成后清理旧 JSON 文件（可选执行）
/// 调用此函数前请确保已确认 SQLite 数据完整。
pub fn cleanup_old_files(data_dir: &Path) -> Result<CleanupReport, String> {
    let mut report = CleanupReport::default();
    let articles_dir = data_dir.join("articles");
    let documents_dir = data_dir.join("documents");

    // ─── 1. 删除 data/*.json（不含子目录） ───
    let json_patterns = [
        "collections.json", "trash.json", "providers.json",
        "settings.json", "ai_config.json", "platform_configs.json",
    ];
    for name in &json_patterns {
        let path = data_dir.join(name);
        if path.exists() {
            std::fs::remove_file(&path).map_err(|e| format!("删除 {} 失败: {}", name, e))?;
            report.files_deleted += 1;
        }
    }

    // ─── 2. 删除 skills*.json ───
    if let Ok(entries) = std::fs::read_dir(data_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with("skills") && name.ends_with(".json") {
                std::fs::remove_file(entry.path()).ok();
                report.files_deleted += 1;
            }
        }
    }

    // ─── 3. 删除 series_*.json ───
    if let Ok(entries) = std::fs::read_dir(data_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with("series_") && name.ends_with(".json") {
                std::fs::remove_file(entry.path()).ok();
                report.files_deleted += 1;
            }
        }
    }

    // ─── 4. 删除 articles/*.blueprint.json ───
    if articles_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&articles_dir) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.ends_with(".blueprint.json") || name.ends_with(".meta.json") {
                    std::fs::remove_file(entry.path()).ok();
                    report.files_deleted += 1;
                }
            }
        }
    }

    // ─── 5. 删除 documents/*.json（ArticleDocument 旧格式） ───
    if documents_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&documents_dir) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.ends_with(".json") {
                    std::fs::remove_file(entry.path()).ok();
                    report.documents_deleted += 1;
                }
            }
        }
    }

    report.cleanup_complete = true;
    Ok(report)
}

/// 清理报告
#[derive(Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupReport {
    pub cleanup_complete: bool,
    pub files_deleted: usize,
    pub documents_deleted: usize,
}
