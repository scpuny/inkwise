// ─── Storage 层：抽象存储接口 ───
// 所有数据操作通过此 trait，方便测试 mock + 切换实现

pub mod migration;
pub mod sqlite;
pub mod app_storage;

use crate::domain::*;

/// 统一存储接口
pub trait Storage: Send + Sync {
    // ─── Collection ───
    fn load_collections(&self) -> Vec<Collection>;
    fn save_collections(&self, collections: &[Collection]) -> Result<(), String>;

    // ─── Document ───
    fn save_article_document(&self, doc: &ArticleDocument) -> Result<(), String>;
    fn load_article_document(&self, id: &str) -> Option<ArticleDocument>;
    fn delete_article_document(&self, id: &str) -> Result<(), String>;
    fn list_article_documents(&self) -> Vec<ArticleDocument>;

    // ─── Article content (.md) ───
    fn save_article_content(&self, id: &str, content: &str) -> Result<(), String>;
    fn load_article_content(&self, id: &str) -> Option<String>;
    fn delete_article_content(&self, id: &str) -> Result<(), String>;

    // ─── Blueprint ───
    fn save_blueprint(&self, id: &str, blueprint: &ArticleBlueprint) -> Result<(), String>;
    fn load_blueprint(&self, id: &str) -> Option<ArticleBlueprint>;
    fn delete_blueprint(&self, id: &str) -> Result<(), String>;

    // ─── Trash ───
    fn load_trash(&self) -> Vec<TrashItem>;
    fn save_trash(&self, trash: &[TrashItem]) -> Result<(), String>;

    // ─── Provider ───
    fn load_providers(&self) -> Vec<Provider>;
    fn save_providers(&self, providers: &[Provider]) -> Result<(), String>;

    // ─── Platform Config ───
    fn load_platform_configs(&self) -> Vec<PlatformConfig>;
    fn save_platform_configs(&self, configs: &[PlatformConfig]) -> Result<(), String>;

    // ─── Series Plan ───
    fn save_series_plan(&self, plan: &SeriesPlan) -> Result<(), String>;
    fn load_series_plan(&self, id: &str) -> Option<SeriesPlan>;
    fn delete_series_plan(&self, id: &str) -> Result<(), String>;

    // ─── Settings ───
    fn load_app_settings(&self) -> AppSettings;
    fn save_app_settings(&self, settings: &AppSettings) -> Result<(), String>;
    fn load_ai_config(&self) -> AiConfig;
    fn save_ai_config(&self, config: &AiConfig) -> Result<(), String>;

    // ─── Skills ───
    fn save_skills(&self, skills: &[WritingSkill]) -> Result<(), String>;
    fn load_skills(&self) -> Vec<WritingSkill>;

    // ─── Images ───
    fn save_article_image(&self, image: &super::db::ArticleImageRow) -> Result<(), String>;
    fn load_article_images(&self, article_id: &str) -> Vec<super::db::ArticleImageRow>;
    fn delete_article_image(&self, id: &str) -> Result<(), String>;

    // ─── Search ───
    fn search_articles(&self, query: &str, limit: i64) -> Vec<super::db::SearchResult>;

    // ─── Deletion cascade ───
    fn delete_all_for_article(&self, article_id: &str) -> Result<(), String>;
}
