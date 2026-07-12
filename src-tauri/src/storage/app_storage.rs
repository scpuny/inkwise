// app_storage.rs — 统一存储访问层
// 包装 DataStore（JSON）+ Database（SQLite），提供单一访问入口
// 所有 Tauri 命令通过 AppStorage 访问存储

use std::path::PathBuf;
use std::sync::Mutex;

use crate::store::DataStore;
use crate::db;
use crate::domain::*;
use crate::vector::types::VectorChunkRow;

pub struct AppStorage {
    json: Mutex<DataStore>,
    sqlite: Mutex<Option<db::Database>>,
}

impl AppStorage {
    // ─── 构造 ───

    pub fn new(app_dir: &PathBuf) -> Self {
        let database = db::Database::open(app_dir).ok();
        Self {
            json: Mutex::new(DataStore::new(app_dir.clone())),
            sqlite: Mutex::new(database),
        }
    }

    /// 获取底层 JSON DataStore 的锁
    /// 用于少数需要直接访问 DataStore 的兼容场景
    pub fn json_lock(&self) -> std::sync::MutexGuard<'_, DataStore> {
        self.json.lock().expect("AppStorage.json lock poisoned")
    }

    /// 获取底层 SQLite Database 的锁
    pub fn sqlite_lock(&self) -> std::sync::MutexGuard<'_, Option<db::Database>> {
        self.sqlite.lock().expect("AppStorage.sqlite lock poisoned")
    }

    // ═══════════════════════════════════════════════════════════
    // 路径方法
    // ═══════════════════════════════════════════════════════════

    pub fn data_dir(&self) -> PathBuf {
        self.json.lock().expect("lock").data_dir().clone()
    }

    pub fn articles_dir(&self) -> PathBuf {
        self.json.lock().expect("lock").articles_dir().clone()
    }

    // ═══════════════════════════════════════════════════════════
    // JSON 存储方法 — 委托到 DataStore
    // ═══════════════════════════════════════════════════════════

    // ── Collections ──

    pub fn load_collections(&self) -> Vec<Collection> {
        self.json.lock().expect("lock").load_collections()
    }

    pub fn save_collections(&self, collections: &[Collection]) -> Result<(), String> {
        self.json.lock().expect("lock").save_collections(collections)
    }

    // ── Trash ──

    pub fn load_trash(&self) -> Vec<TrashItem> {
        self.json.lock().expect("lock").load_trash()
    }

    pub fn save_trash(&self, trash: &[TrashItem]) -> Result<(), String> {
        self.json.lock().expect("lock").save_trash(trash)
    }

    // ── Providers ──

    pub fn load_providers(&self) -> Vec<Provider> {
        self.json.lock().expect("lock").load_providers()
    }

    pub fn save_providers(&self, providers: &[Provider]) -> Result<(), String> {
        self.json.lock().expect("lock").save_providers(providers)
    }

    // ── Settings ──

    pub fn load_settings(&self) -> AppSettings {
        self.json.lock().expect("lock").load_settings()
    }

    pub fn save_settings(&self, settings: &AppSettings) -> Result<(), String> {
        self.json.lock().expect("lock").save_settings(settings)
    }

    // ── AI Config ──

    pub fn load_ai_config(&self) -> Option<AiConfig> {
        self.json.lock().expect("lock").load_ai_config()
    }

    pub fn save_ai_config(&self, config: &AiConfig) -> Result<(), String> {
        self.json.lock().expect("lock").save_ai_config(config)
    }

    // ── Platform Config ──

    pub fn load_platform_configs(&self) -> Vec<PlatformConfig> {
        self.json.lock().expect("lock").load_platform_configs()
    }

    pub fn save_platform_configs(&self, configs: &[PlatformConfig]) -> Result<(), String> {
        self.json.lock().expect("lock").save_platform_configs(configs)
    }

    // ── Publish Records ──

    pub fn load_publish_records(&self) -> Vec<PublishRecord> {
        self.json.lock().expect("lock").load_publish_records()
    }

    pub fn save_publish_records(&self, records: &[PublishRecord]) -> Result<(), String> {
        self.json.lock().expect("lock").save_publish_records(records)
    }

    // ── Article Content ──

    pub fn save_article_content(&self, id: &str, content: &str) -> Result<(), String> {
        self.json.lock().expect("lock").save_article_content(id, content)
    }

    pub fn load_article_content(&self, id: &str) -> Option<String> {
        self.json.lock().expect("lock").load_article_content(id)
    }

    pub fn delete_article_content(&self, id: &str) -> Result<(), String> {
        self.json.lock().expect("lock").delete_article_content(id)
    }

    // ── Article Meta ──

    pub fn save_article_meta(&self, meta: &ArticleMeta) -> Result<(), String> {
        self.json.lock().expect("lock").save_article_meta(meta)
    }

    pub fn load_article_meta(&self, id: &str) -> Option<ArticleMeta> {
        self.json.lock().expect("lock").load_article_meta(id)
    }

    pub fn delete_article_meta(&self, id: &str) -> Result<(), String> {
        self.json.lock().expect("lock").delete_article_meta(id)
    }

    // ── Article Document ──

    pub fn save_article_document(&self, doc: &ArticleDocument) -> Result<(), String> {
        self.json.lock().expect("lock").save_article_document(doc)
    }

    pub fn load_article_document(&self, id: &str) -> Option<ArticleDocument> {
        self.json.lock().expect("lock").load_article_document(id)
    }

    pub fn delete_article_document(&self, id: &str) -> Result<(), String> {
        self.json.lock().expect("lock").delete_article_document(id)
    }

    // ── Blueprint ──

    pub fn save_blueprint(&self, id: &str, blueprint: &ArticleBlueprint) -> Result<(), String> {
        self.json.lock().expect("lock").save_blueprint(id, blueprint)
    }

    pub fn load_blueprint(&self, id: &str) -> Option<ArticleBlueprint> {
        self.json.lock().expect("lock").load_blueprint(id)
    }

    pub fn delete_blueprint(&self, id: &str) -> Result<(), String> {
        self.json.lock().expect("lock").delete_blueprint(id)
    }

    // ── Series Plan ──

    pub fn save_series_plan(&self, collection_id: &str, plan: &SeriesPlan) -> Result<(), String> {
        self.json.lock().expect("lock").save_series_plan(collection_id, plan)
    }

    pub fn load_series_plan(&self, collection_id: &str, series_id: &str) -> Option<SeriesPlan> {
        self.json.lock().expect("lock").load_series_plan(collection_id, series_id)
    }

    pub fn load_all_series_plans(&self, collection_id: &str) -> Vec<SeriesPlan> {
        self.json.lock().expect("lock").load_all_series_plans(collection_id)
    }

    pub fn save_all_series_plans(&self, collection_id: &str, plans: &[SeriesPlan]) -> Result<(), String> {
        self.json.lock().expect("lock").save_all_series_plans(collection_id, plans)
    }

    pub fn delete_series_plan(&self, collection_id: &str, series_id: &str) -> Result<(), String> {
        self.json.lock().expect("lock").delete_series_plan(collection_id, series_id)
    }

    // ── Writing Skills ──

    pub fn load_writing_skills(&self) -> Vec<WritingSkill> {
        self.json.lock().expect("lock").load_writing_skills()
    }

    pub fn save_writing_skills(&self, skills: &[WritingSkill]) -> Result<(), String> {
        self.json.lock().expect("lock").save_writing_skills(skills)
    }

    // ── Custom Themes ──

    pub fn load_custom_themes(&self) -> Vec<serde_json::Value> {
        self.json.lock().expect("lock").load_custom_themes()
    }

    pub fn save_custom_themes(&self, themes: &[serde_json::Value]) -> Result<(), String> {
        self.json.lock().expect("lock").save_custom_themes(themes)
    }

    // ═══════════════════════════════════════════════════════════
    // SQLite 存储方法 — 委托到 Database
    // ═══════════════════════════════════════════════════════════

    fn with_db<F, T>(&self, f: F) -> Result<T, String>
    where
        F: FnOnce(&db::Database) -> Result<T, String>,
    {
        let guard = self.sqlite.lock().expect("lock");
        match guard.as_ref() {
            Some(database) => f(database),
            None => Err("数据库未初始化".into()),
        }
    }

    fn with_db_opt<F, T>(&self, f: F) -> T
    where
        F: FnOnce(&db::Database) -> T,
        T: Default,
    {
        let guard = self.sqlite.lock().expect("lock");
        match guard.as_ref() {
            Some(database) => f(database),
            None => T::default(),
        }
    }

    // ── DB Collections ──

    pub fn db_list_collections(&self) -> Vec<db::CollectionRow> {
        self.with_db_opt(|db| db.list_collections().unwrap_or_default())
    }

    pub fn db_create_collection(&self, id: &str, title: &str, sort_order: i64, created_at: i64) -> Result<(), String> {
        self.with_db(|db| db.create_collection(id, title, sort_order, created_at).map_err(|e| e.to_string()))
    }

    pub fn db_rename_collection(&self, id: &str, title: &str) -> Result<(), String> {
        self.with_db(|db| db.rename_collection(id, title).map_err(|e| e.to_string()))
    }

    pub fn db_delete_collection(&self, id: &str) -> Result<(), String> {
        self.with_db(|db| db.delete_collection(id).map_err(|e| e.to_string()))
    }

    pub fn db_update_collection_folder(&self, id: &str, folder: Option<&str>) -> Result<(), String> {
        self.with_db(|db| db.update_collection_folder(id, folder).map_err(|e| e.to_string()))
    }

    // ── DB Articles ──

    pub fn db_list_articles(&self, collection_id: Option<&str>, status: Option<&str>, offset: i64, limit: i64) -> Vec<db::ArticleRow> {
        self.with_db_opt(|db| db.list_articles(collection_id, status, offset, limit).unwrap_or_default())
    }

    pub fn db_get_article(&self, id: &str) -> Option<db::ArticleRow> {
        self.with_db_opt(|db| db.get_article(id).unwrap_or(None))
    }

    pub fn db_save_article(&self, article: &db::ArticleRow) -> Result<(), String> {
        self.with_db(|db| db.save_article(article).map_err(|e| e.to_string()))
    }

    pub fn db_delete_article(&self, id: &str) -> Result<(), String> {
        self.with_db(|db| db.delete_article(id).map_err(|e| e.to_string()))
    }

    pub fn db_move_article(&self, id: &str, new_collection_id: &str) -> Result<(), String> {
        self.with_db(|db| db.move_article(id, new_collection_id).map_err(|e| e.to_string()))
    }

    pub fn db_list_all_articles(&self) -> Vec<db::ArticleRow> {
        self.with_db_opt(|db| db.list_all_articles().unwrap_or_default())
    }

    pub fn db_get_article_search(&self, id: &str) -> Option<db::ArticleSearchRow> {
        self.with_db_opt(|db| db.get_article_search(id).unwrap_or(None))
    }

    // ── DB Search ──

    pub fn db_search(&self, query: &str, limit: i64) -> Vec<db::SearchResult> {
        self.with_db_opt(|db| db.search(query, limit).unwrap_or_default())
    }

    // ── DB Images ──

    pub fn db_save_article_images(&self, article_id: &str, images: &[db::ArticleImageRow]) -> Result<(), String> {
        self.with_db(|db| db.save_article_images(article_id, images).map_err(|e| e.to_string()))
    }

    pub fn db_get_article_images(&self, article_id: &str) -> Vec<db::ArticleImageRow> {
        self.with_db_opt(|db| db.get_article_images(article_id).unwrap_or_default())
    }

    pub fn db_delete_article_images(&self, article_id: &str) -> Result<(), String> {
        self.with_db(|db| db.delete_article_images(article_id).map_err(|e| e.to_string()))
    }

    // ── DB Settings ──

    pub fn db_get_setting(&self, key: &str) -> Option<String> {
        self.with_db_opt(|db| db.get_setting(key).unwrap_or(None))
    }

    pub fn db_set_setting(&self, key: &str, value: &str) -> Result<(), String> {
        self.with_db(|db| db.set_setting(key, value).map_err(|e| e.to_string()))
    }

    // ── DB Vector ──

    pub fn db_list_vector_chunks(&self, article_id: &str) -> Vec<VectorChunkRow> {
        self.with_db_opt(|db| db.list_vector_chunks(article_id).unwrap_or_default())
    }

    pub fn db_list_vector_chunks_with_embedding(&self, article_id: Option<&str>) -> Vec<VectorChunkRow> {
        self.with_db_opt(|db| db.list_vector_chunks_with_embedding(article_id).unwrap_or_default())
    }

    pub fn db_upsert_vector_chunk(&self, chunk: &VectorChunkRow) -> Result<(), String> {
        self.with_db(|db| db.upsert_vector_chunk(chunk).map_err(|e| e.to_string()))
    }

    pub fn db_delete_vector_chunks(&self, article_id: &str) -> Result<(), String> {
        self.with_db(|db| db.delete_vector_chunks(article_id).map_err(|e| e.to_string()))
    }

    pub fn db_schema_version(&self) -> i64 {
        let guard = self.sqlite.lock().expect("lock");
        guard.as_ref().map(|db| db.schema_version()).unwrap_or(0)
    }

    pub fn db_vector_chunk_count(&self) -> i64 {
        self.with_db_opt(|db| db.vector_chunk_count().unwrap_or(0))
    }
}
