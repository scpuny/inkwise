// ─── JSON → SQLite 数据迁移 ───
// 一次性迁移脚本。将 data/*.json 中的数据迁移到 SQLite 表。
// 迁移完成后，JSON 文件保留不删（安全网），标记迁移完成。

use crate::db;
use crate::domain::*;
use crate::store::DataStore;
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

    let store = DataStore::new_with_dir(&data_dir.to_path_buf());

    // ─── 1. 迁移 Collections ───
    let collections = store.load_collections();
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
                let doc = store.load_article_document(&a.id);
                let content = store.load_article_content(&a.id).unwrap_or_default();
                let blueprint = store.load_blueprint(&a.id);
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
    let providers = store.load_providers();
    if !providers.is_empty() {
        if let Ok(json) = serde_json::to_string(&providers) {
            database.set_setting("providers_json", &json).ok();
            report.providers_migrated = providers.len();
        }
    }

    // ─── 3. 迁移 Platform Configs ───
    let configs = store.load_platform_configs();
    if !configs.is_empty() {
        if let Ok(json) = serde_json::to_string(&configs) {
            database.set_setting("platform_configs_json", &json).ok();
            report.platform_configs_migrated = configs.len();
        }
    }

    // ─── 4. 迁移 AppSettings ───
    let settings = store.load_settings();
    if let Ok(json) = serde_json::to_string(&settings) {
        database.set_setting("app_settings_json", &json).ok();
        report.settings_migrated = true;
    }

    // ─── 5. 迁移 AiConfig ───
    let ai_config = store.load_ai_config();
    if let Ok(json) = serde_json::to_string(&ai_config) {
        database.set_setting("ai_config_json", &json).ok();
        report.ai_config_migrated = true;
    }

    // ─── 6. 迁移 Skills ───
    let skills = store.load_writing_skills();
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
