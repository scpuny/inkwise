// ─── SQLite 存储实现 ───
// 逐步将操作从 JSON 迁移到 SQLite

use crate::db;
use crate::domain::*;
use std::path::PathBuf;

use super::Storage;

/// SQLite 存储实现
pub struct SqliteStorage {
    db: db::Database,
    _data_dir: PathBuf,
}

impl SqliteStorage {
    pub fn open(app_dir: &PathBuf) -> Result<Self, String> {
        let db = db::Database::open(app_dir).map_err(|e| e.to_string())?;
        Ok(Self {
            db,
            _data_dir: app_dir.join("data"),
        })
    }
}

impl Storage for SqliteStorage {
    // ─── Collection ───
    fn load_collections(&self) -> Vec<Collection> {
        self.db.list_collections().unwrap_or_default().into_iter().map(|r| Collection {
            id: r.id,
            title: r.title,
            created_at: r.created_at as u64,
            linked_folder: r.linked_folder,
            articles: vec![],
        }).collect()
    }

    fn save_collections(&self, _collections: &[Collection]) -> Result<(), String> {
        Ok(()) // TODO: implement via db.rs
    }

    // ─── Document ───
    fn save_article_document(&self, doc: &ArticleDocument) -> Result<(), String> {
        self.db.save_article(&db::ArticleRow {
            id: doc.id.clone(),
            collection_id: doc.collection_id.clone().unwrap_or_default(),
            title: doc.title.clone(),
            content: doc.content.clone(),
            description: String::new(),
            tags: serde_json::to_string(&doc.tags).unwrap_or_default(),
            tone: doc.tone.clone(),
            audience: doc.target_audience.clone(),
            target_word_count: doc.target_word_count.map(|v| v as i64),
            outline: serde_json::to_string(&doc.outline).unwrap_or_default(),
            phase: doc.phase.clone(),
            status: "draft".to_string(),
            word_count: doc.content.len() as i64,
            collection_title: None,
            created_at: doc.created_at as i64,
            updated_at: doc.updated_at as i64,
        }).map_err(|e| e.to_string())
    }

    fn load_article_document(&self, id: &str) -> Option<ArticleDocument> {
        self.db.get_article(id).ok()?.map(|row| ArticleDocument {
            id: row.id,
            collection_id: Some(row.collection_id),
            title: row.title,
            content: row.content,
            style_id: "general".to_string(),
            action_id: "action-write".to_string(),
            tone: row.tone,
            target_audience: row.audience,
            target_word_count: row.target_word_count.map(|v| v as u32),
            phase: row.phase,
            outline: serde_json::from_str(&row.outline).unwrap_or_default(),
            tags: serde_json::from_str(&row.tags).unwrap_or_default(),
            style_config: serde_json::Value::Null,
            linked_folder: None,
            project_context: None,
            series_context: None,
            publish_records: vec![],
            review_state: None,
            source: None,
            inspiration: None,
            version: 1,
            deleted_at: None,
            created_at: row.created_at as u64,
            updated_at: row.updated_at as u64,
        })
    }

    fn delete_article_document(&self, id: &str) -> Result<(), String> {
        self.db.delete_article(id).map_err(|e| e.to_string())
    }

    fn list_article_documents(&self) -> Vec<ArticleDocument> {
        self.db.list_all_articles().unwrap_or_default().into_iter().map(|row| {
            ArticleDocument {
                id: row.id,
                collection_id: Some(row.collection_id),
                title: row.title,
                content: row.content,
                style_id: "general".to_string(),
                action_id: "action-write".to_string(),
                tone: row.tone,
                target_audience: row.audience,
                target_word_count: row.target_word_count.map(|v| v as u32),
                phase: row.phase,
                outline: serde_json::from_str(&row.outline).unwrap_or_default(),
                tags: serde_json::from_str(&row.tags).unwrap_or_default(),
                style_config: serde_json::Value::Null,
                linked_folder: None,
                project_context: None,
                series_context: None,
                publish_records: vec![],
                review_state: None,
                source: None,
                inspiration: None,
                version: 1,
                deleted_at: None,
                created_at: row.created_at as u64,
                updated_at: row.updated_at as u64,
            }
        }).collect()
    }

    // ─── Article content (delegated to store.rs) ───
    fn save_article_content(&self, _id: &str, _content: &str) -> Result<(), String> {
        Ok(())
    }

    fn load_article_content(&self, _id: &str) -> Option<String> { None }
    fn delete_article_content(&self, _id: &str) -> Result<(), String> { Ok(()) }

    // ─── Blueprint (delegated to store.rs) ───
    fn save_blueprint(&self, _id: &str, _bp: &ArticleBlueprint) -> Result<(), String> { Ok(()) }
    fn load_blueprint(&self, _id: &str) -> Option<ArticleBlueprint> { None }
    fn delete_blueprint(&self, _id: &str) -> Result<(), String> { Ok(()) }

    // ─── Trash ───
    fn load_trash(&self) -> Vec<TrashItem> { vec![] }
    fn save_trash(&self, _trash: &[TrashItem]) -> Result<(), String> { Ok(()) }

    // ─── Provider ───
    fn load_providers(&self) -> Vec<Provider> { vec![] }
    fn save_providers(&self, _providers: &[Provider]) -> Result<(), String> { Ok(()) }

    // ─── Platform Config ───
    fn load_platform_configs(&self) -> Vec<PlatformConfig> { vec![] }
    fn save_platform_configs(&self, _configs: &[PlatformConfig]) -> Result<(), String> { Ok(()) }

    // ─── Series Plan ───
    fn save_series_plan(&self, _plan: &SeriesPlan) -> Result<(), String> { Ok(()) }
    fn load_series_plan(&self, _id: &str) -> Option<SeriesPlan> { None }
    fn delete_series_plan(&self, _id: &str) -> Result<(), String> { Ok(()) }

    // ─── Settings ───
    fn load_app_settings(&self) -> AppSettings {
        AppSettings {
            theme: "light".into(), theme_style: "default".into(),
            font_family: "".into(), text_size: "medium".into(),
            draw_model: "".into(), draw_style: "".into(),
            draw_size: "".into(), draw_count: 1,
            draw_negative_prompt: "".into(), vector_model_enabled: false,
        }
    }
    fn save_app_settings(&self, _settings: &AppSettings) -> Result<(), String> { Ok(()) }
    fn load_ai_config(&self) -> AiConfig {
        AiConfig { default_model: None, effort: "auto".into(), max_tokens: 4096 }
    }
    fn save_ai_config(&self, _config: &AiConfig) -> Result<(), String> { Ok(()) }

    // ─── Skills ───
    fn save_skills(&self, _skills: &[WritingSkill]) -> Result<(), String> { Ok(()) }
    fn load_skills(&self) -> Vec<WritingSkill> { vec![] }

    // ─── Images ───
    fn save_article_image(&self, _image: &db::ArticleImageRow) -> Result<(), String> { Ok(()) }
    fn load_article_images(&self, _article_id: &str) -> Vec<db::ArticleImageRow> { vec![] }
    fn delete_article_image(&self, _id: &str) -> Result<(), String> { Ok(()) }

    // ─── Search ───
    fn search_articles(&self, query: &str, limit: i64) -> Vec<db::SearchResult> {
        self.db.search(query, limit).unwrap_or_default()
    }

    // ─── Deletion cascade ───
    fn delete_all_for_article(&self, article_id: &str) -> Result<(), String> {
        self.delete_article_document(article_id)
    }
}
