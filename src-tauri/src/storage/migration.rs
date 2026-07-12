// ─── JSON → SQLite 数据迁移 ───
// 一次性迁移脚本。将 data/*.json 中的数据迁移到 SQLite 表。
// 迁移完成后，JSON 文件保留不删（安全网），标记迁移完成。

use crate::db;
use crate::domain::*;
use crate::storage::app_storage::AppStorage;
use serde::Serialize;
use std::path::Path;

/// 执行全量迁移
pub fn run(data_dir: &Path, database: &db::Database) -> Result<MigrateReport, String> {
    let mut report = MigrateReport::default();

    // 检查是否已迁移过
    if let Ok(Some(v)) = database.get_setting("json_migrated_version") {
        if v.as_str() >= "2.1.0" {
            report.already_migrated = true;
            return Ok(report);
        }
    }

    // 使用 app_dir（数据目录的父目录）初始化 AppStorage
    let app_dir = data_dir.parent().unwrap_or(data_dir);
    let storage = AppStorage::new_with_json_dir(app_dir, data_dir);

    // ─── 1. 迁移 Collections ───
    let collections = storage.load_collections();
    if !collections.is_empty() {
        for c in &collections {
            // INSERT OR IGNORE — 已有记录的不覆盖
            if database.create_collection(&c.id, &c.title, 0, c.created_at as i64).is_ok() {
                if let Some(ref f) = c.linked_folder {
                    database.update_collection_folder(&c.id, Some(f)).ok();
                }
                report.collections_migrated += 1;
            }
        }
        // 迁移合集内的文章元数据
        for c in &collections {
            for a in &c.articles {
                let doc = storage.load_article_document(&a.id);
                let content = storage.load_article_content(&a.id).unwrap_or_default();
                let blueprint = storage.load_blueprint(&a.id);
                let (outline, phase, tags) = match blueprint {
                    Some(ref bp) => (
                        serde_json::to_string(&bp.outline).unwrap_or_default(),
                        bp.phase.clone(),
                        serde_json::to_string(&bp.tags).unwrap_or_default(),
                    ),
                    None => ("[]".into(), "planning".into(), "[]".into()),
                };

                let title = doc.as_ref().map(|d| d.title.as_str()).unwrap_or(&a.title);
                let tone = doc.as_ref().and_then(|d| d.tone.clone());
                let audience = doc.as_ref().and_then(|d| d.target_audience.clone());
                let word_count = doc.as_ref().map(|d| d.content.len() as i64).unwrap_or(content.len() as i64);
                let created = doc.as_ref().map(|d| d.created_at as i64).unwrap_or(a.created_at as i64);
                let updated = doc.as_ref().map(|d| d.updated_at as i64).unwrap_or(a.updated_at as i64);

                if database.save_article(&db::ArticleRow {
                    id: a.id.clone(),
                    collection_id: c.id.clone(),
                    title: title.to_string(),
                    content,
                    description: String::new(),
                    tags,
                    tone,
                    audience,
                    target_word_count: None,
                    outline,
                    phase,
                    status: "draft".to_string(),
                    word_count,
                    collection_title: Some(c.title.clone()),
                    created_at: created,
                    updated_at: updated,
                }).is_ok() {
                    report.articles_migrated += 1;
                }
            }
        }
    }

    // ─── 2. 迁移 Providers ───
    let providers = storage.load_providers();
    if !providers.is_empty() {
        if let Ok(json) = serde_json::to_string(&providers) {
            database.set_setting("providers_json", &json).ok();
            report.providers_migrated = providers.len();
        }
    }

    // ─── 3. 迁移 Platform Configs ───
    let configs = storage.load_platform_configs();
    if !configs.is_empty() {
        if let Ok(json) = serde_json::to_string(&configs) {
            database.set_setting("platform_configs_json", &json).ok();
            report.platform_configs_migrated = configs.len();
        }
    }

    // ─── 4. 迁移 AppSettings ───
    let settings = storage.load_settings();
    if let Ok(json) = serde_json::to_string(&settings) {
        database.set_setting("app_settings_json", &json).ok();
        report.settings_migrated = true;
    }

    // ─── 5. 迁移 AiConfig ───
    let ai_config = storage.load_ai_config();
    if let Ok(json) = serde_json::to_string(&ai_config) {
        database.set_setting("ai_config_json", &json).ok();
        report.ai_config_migrated = true;
    }

    // ─── 6. 迁移 Skills ───
    let skills = storage.load_writing_skills();
    if !skills.is_empty() {
        if let Ok(json) = serde_json::to_string(&skills) {
            database.set_setting("skills_json", &json).ok();
            report.skills_migrated = skills.len();
        }
    }

    // ─── 7. 标记迁移完成 ───
    database.set_setting("json_migrated_version", "2.1.0").ok();

    Ok(report)
}

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

/// 迁移报告
#[derive(Debug, Default)]
pub struct MigrateReport {
    pub already_migrated: bool,
    pub collections_migrated: usize,
    pub articles_migrated: usize,
    pub providers_migrated: usize,
    pub platform_configs_migrated: usize,
    pub settings_migrated: bool,
    pub ai_config_migrated: bool,
    pub skills_migrated: usize,
}
