use serde::{Deserialize, Serialize};
use std::path::PathBuf;

// ─── Data types ───

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ArticleDocument {
    pub id: String,
    pub collection_id: Option<String>,
    pub series_id: Option<String>,
    pub title: String,
    pub content: String,
    pub style_id: String,
    pub action_id: String,
    pub tone: Option<String>,
    pub target_audience: Option<String>,
    pub target_word_count: Option<u32>,
    pub phase: String,
    pub outline: Vec<OutlineSection>,
    pub tags: Vec<String>,
    pub style_config: serde_json::Value,
    pub linked_folder: Option<String>,
    pub project_context: Option<String>,
    pub series_context: Option<String>,
    pub publish_records: Vec<serde_json::Value>,
    pub review_state: Option<serde_json::Value>,
    pub version: u32,
    pub created_at: u64,
    pub updated_at: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ArticleMeta {
    pub id: String,
    pub collection_id: String,
    pub title: String,
    pub created_at: u64,
    pub updated_at: u64,
    pub style_id: Option<String>,
    pub action_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Collection {
    pub id: String,
    pub title: String,
    pub created_at: u64,
    pub linked_folder: Option<String>,
    /// Full article metadata stored inline for simple load/save.
    pub articles: Vec<ArticleMeta>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SeriesPlan {
    pub id: String,
    pub title: String,
    pub created_at: u64,
    pub tone: Option<String>,
    pub target_audience: Option<String>,
    pub articles: Vec<SeriesArticle>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SeriesArticle {
    pub id: String,
    pub title: String,
    pub description: String,
    pub target_word_count: Option<u32>,
    pub status: String,
    pub article_id: Option<String>,
    pub previous_article_id: Option<String>,
    pub next_article_id: Option<String>,
}


#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ImageModelConfig {
    pub sizes: Vec<String>,
    pub supports_quality: bool,
    pub supports_style: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModelEntry {
    pub id: String,
    pub capabilities: Vec<String>,
    pub image_config: Option<ImageModelConfig>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ImageSavedResult {
    pub local_path: String,
    pub alt_text: String,
    pub revised_prompt: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TrashItem {
    pub id: String,
    pub title: String,
    pub collection_id: String,
    pub collection_title: String,
    pub deleted_at: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Provider {
    pub id: String,
    pub label: String,
    pub kind: String,
    pub base_url: Option<String>,
    pub api_key: Option<String>,
    pub models: Vec<ModelEntry>,
    pub enabled: bool,
    pub builtin: bool,
}



// ─── Platform Config ───

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PlatformConfig {
    pub id: String,
    pub platform: String,       // "wechat" | "toutiao"
    pub label: String,
    pub app_id: String,
    pub app_secret: String,
    pub access_token: Option<String>,
    pub token_expires_at: Option<u64>,
    pub enabled: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PublishRecord {
    pub id: String,
    pub article_id: String,
    pub platform: String,
    pub platform_article_id: Option<String>,
    pub status: String,             // "draft" | "published" | "failed"
    pub error_message: Option<String>,
    pub published_at: u64,
    pub platform_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub theme: String,
    pub theme_style: String,
    pub font_family: String,
    pub text_size: String,
    #[serde(default)]
    pub draw_model: String,
    #[serde(default)]
    pub draw_style: String,
    #[serde(default)]
    pub draw_size: String,
    #[serde(default)]
    pub draw_count: u32,
    #[serde(default)]
    pub draw_negative_prompt: String,
    #[serde(default)]
    pub vector_model_enabled: bool,
}

// ─── AI Config ───

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AiConfig {
    pub default_model: Option<String>,
    pub effort: String,
    pub max_tokens: u32,
}

// ─── WritingSkill ───

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PhaseConfig {
    pub system_prompt: String,
    pub temperature: Option<f64>,
    pub model: Option<String>,
    pub max_tokens: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ContextSource {
    pub r#type: String,
    pub label: String,
    pub required: bool,
    pub max_length: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StyleDimension {
    pub name: String,
    pub value: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WritingSkill {
    pub id: String,
    pub name: String,
    pub description: String,
    pub icon: String,
    pub scope: String,
    pub phase: Option<String>,
    pub configs: std::collections::HashMap<String, PhaseConfig>,
    pub context_sources: Vec<ContextSource>,
    pub dimensions: Vec<StyleDimension>,
    pub example_text: Option<String>,
    pub builtin: bool,
    pub created_at: u64,
    pub updated_at: u64,
    pub style_id: Option<String>,
    pub action_id: Option<String>,
}

// ─── DataStore ───

pub struct DataStore {
    data_dir: PathBuf,
    articles_dir: PathBuf,
    documents_dir: PathBuf,
    _index_dir: PathBuf,
    _codegraph_dir: PathBuf,
}

impl DataStore {
    pub fn new(app_dir: PathBuf) -> Self {
        let data_dir = app_dir.join("data");
        let articles_dir = data_dir.join("articles");
        let documents_dir = data_dir.join("documents");
        let index_dir = data_dir.join("index");
        let codegraph_dir = data_dir.join("codegraph");
        for d in [&data_dir, &articles_dir, &documents_dir, &index_dir, &codegraph_dir] {
            std::fs::create_dir_all(d).ok();
        }
        Self {
            data_dir,
            articles_dir,
            documents_dir,
            _index_dir: index_dir,
            _codegraph_dir: codegraph_dir,
        }
    }

    // ─── Generic JSON helpers ───

    fn read_json<T: serde::de::DeserializeOwned>(&self, name: &str) -> Result<T, String> {
        let path = self.data_dir.join(format!("{}.json", name));
        if !path.exists() {
            return Err("not found".into());
        }
        let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())
    }

    fn write_json<T: serde::Serialize + ?Sized>(&self, name: &str, data: &T) -> Result<(), String> {
        let path = self.data_dir.join(format!("{}.json", name));
        let tmp_path = self.data_dir.join(format!("{}.json.tmp", name));
        let content = serde_json::to_string_pretty(data).map_err(|e| e.to_string())?;
        std::fs::write(&tmp_path, &content).map_err(|e| e.to_string())?;
        let f = std::fs::File::open(&tmp_path).map_err(|e| e.to_string())?;
        f.sync_all().map_err(|e| e.to_string())?;
        drop(f);
        std::fs::rename(&tmp_path, &path).map_err(|e| e.to_string())?;
        Ok(())
    }
    // ─── Collections ───

    pub fn load_collections(&self) -> Vec<Collection> {
        self.read_json("collections").unwrap_or_default()
    }

    pub fn save_collections(&self, collections: &[Collection]) -> Result<(), String> {
        self.write_json("collections", collections)
    }

    // ─── Trash ───

    pub fn load_trash(&self) -> Vec<TrashItem> {
        self.read_json("trash").unwrap_or_default()
    }

    pub fn save_trash(&self, trash: &[TrashItem]) -> Result<(), String> {
        self.write_json("trash", trash)
    }

    // ─── Providers ───

    /// Infer model capabilities from its name (mirrors frontend inferCapabilities)
    fn infer_capabilities(name: &str) -> Vec<String> {
        let lower = name.to_lowercase();
        let mut caps = Vec::new();
        // Image generation models
        if lower.contains("dall-e")
            || lower.contains("cogview")
            || lower.contains("wanx")
            || lower.contains("candy")
            || lower.contains("image")
            || (lower.starts_with("sd") && lower.len() <= 4)
        {
            caps.push("image".to_string());
        }
        // Text/chat models — exclude known non-chat model types
        let non_chat = ["embedding", "speech", "tts", "stt", "whisper", "moderation", "rerank", "transcription"];
        if !non_chat.iter().any(|t| lower.contains(t)) {
            caps.push("chat".to_string());
        }
        if caps.is_empty() {
            caps.push("chat".to_string());
        }
        caps
    }

    pub fn load_providers(&self) -> Vec<Provider> {
        let path = self.data_dir.join("providers.json");
        if !path.exists() {
            return Vec::new();
        }
        let content = match std::fs::read_to_string(&path) {
            Ok(c) => c,
            Err(_) => return Vec::new(),
        };
        // Try new format first (Vec<Provider> with ModelEntry)
        if let Ok(mut providers) = serde_json::from_str::<Vec<Provider>>(&content) {
            // Re-infer capabilities to fix any migration artifacts
            for p in &mut providers {
                for m in &mut p.models {
                    let expected = Self::infer_capabilities(&m.id);
                    if m.capabilities != expected {
                        m.capabilities = expected;
                    }
                }
            }
            return providers;
        }
        // Fallback: old format where models was Vec<String>
        #[derive(Deserialize)]
        struct OldProvider {
            id: String,
            label: String,
            kind: String,
            base_url: Option<String>,
            api_key: Option<String>,
            models: Vec<String>,
            enabled: bool,
            builtin: bool,
        }
        if let Ok(old_providers) = serde_json::from_str::<Vec<OldProvider>>(&content) {
            let providers: Vec<Provider> = old_providers.into_iter().map(|old| {
                let models = old.models.into_iter().map(|name| {
                    let caps = Self::infer_capabilities(&name);
                    let image_config = if caps.contains(&"image".to_string()) {
                        Some(ImageModelConfig {
                            sizes: vec!["1024x1024".into(), "1792x1024".into(), "1024x1792".into()],
                            supports_quality: true,
                            supports_style: true,
                        })
                    } else {
                        None
                    };
                    ModelEntry {
                        id: name,
                        capabilities: caps,
                        image_config,
                    }
                }).collect();
                Provider {
                    id: old.id,
                    label: old.label,
                    kind: old.kind,
                    base_url: old.base_url,
                    api_key: old.api_key,
                    models,
                    enabled: old.enabled,
                    builtin: old.builtin,
                }
            }).collect();
            // Write back in new format
            let _ = self.write_json("providers", &providers);
            return providers;
        }
        Vec::new()
    }

    pub fn save_providers(&self, providers: &[Provider]) -> Result<(), String> {
        self.write_json("providers", providers)
    }

    // ─── Settings ───

    pub fn load_settings(&self) -> AppSettings {
        self.read_json("settings").unwrap_or(AppSettings {
            theme: "dark".into(),
            theme_style: "graphite".into(),
            font_family: "system".into(),
            text_size: "default".into(),
            draw_model: String::new(),
            draw_style: "vivid".into(),
            draw_size: "1024x1024".into(),
            draw_count: 3,
            draw_negative_prompt: String::new(),
            vector_model_enabled: false,
        })
    }

    pub fn save_settings(&self, settings: &AppSettings) -> Result<(), String> {
        self.write_json("settings", settings)
    }
    // ─── AI Config ───

    pub fn save_ai_config(&self, config: &AiConfig) -> Result<(), String> {
        self.write_json("ai_config", config)
    }

    pub fn load_ai_config(&self) -> Option<AiConfig> {
        self.read_json("ai_config").ok()
    }


    // ─── Platform Config ───

    pub fn load_platform_configs(&self) -> Vec<PlatformConfig> {
        self.read_json("platforms").unwrap_or_default()
    }

    pub fn save_platform_configs(&self, configs: &[PlatformConfig]) -> Result<(), String> {
        self.write_json("platforms", configs)
    }

    // ─── Publish Records ───

    pub fn load_publish_records(&self) -> Vec<PublishRecord> {
        self.read_json("publish_records").unwrap_or_default()
    }

    pub fn save_publish_records(&self, records: &[PublishRecord]) -> Result<(), String> {
        self.write_json("publish_records", records)
    }


    // ─── Article content ───

    /// Save article Markdown content. Returns error on failure.
    pub fn save_article_content(&self, id: &str, content: &str) -> Result<(), String> {
        let path = self.articles_dir.join(format!("{}.md", id));
        std::fs::write(&path, content).map_err(|e| format!("保存文章失败: {}", e))
    }

    /// Load article Markdown content. Returns None if not found.
    // ─── Writing Skills ───

    pub fn load_writing_skills(&self) -> Vec<WritingSkill> {
        self.read_json("writing_skills").unwrap_or_default()
    }

    pub fn save_writing_skills(&self, skills: &[WritingSkill]) -> Result<(), String> {
        self.write_json("writing_skills", skills)
    }
    pub fn load_custom_themes(&self) -> Vec<serde_json::Value> {
        self.read_json("custom_themes").unwrap_or_default()
    }

    pub fn save_custom_themes(&self, themes: &[serde_json::Value]) -> Result<(), String> {
        self.write_json("custom_themes", themes)
    }



    pub fn load_article_content(&self, id: &str) -> Option<String> {
        let path = self.articles_dir.join(format!("{}.md", id));
        if path.exists() {
            std::fs::read_to_string(&path).ok()
        } else {
            None
        }
    }

    /// Delete article file.
    pub fn delete_article_content(&self, id: &str) -> Result<(), String> {
        let path = self.articles_dir.join(format!("{}.md", id));
        if path.exists() {
            std::fs::remove_file(&path).map_err(|e| format!("删除文章失败: {}", e))
        } else {
            Ok(())
        }
    }

    // ─── ArticleDocument (v2.1.0, individual .json) ───

    pub fn save_article_document(&self, doc: &ArticleDocument) -> Result<(), String> {
        let path = self.documents_dir.join(format!("{}.json", doc.id));
        let tmp_path = self.documents_dir.join(format!("{}.json.tmp", doc.id));
        let content = serde_json::to_string_pretty(doc).map_err(|e| e.to_string())?;
        std::fs::write(&tmp_path, &content).map_err(|e| e.to_string())?;
        let f = std::fs::File::open(&tmp_path).map_err(|e| e.to_string())?;
        f.sync_all().map_err(|e| e.to_string())?;
        drop(f);
        std::fs::rename(&tmp_path, &path).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn load_article_document(&self, id: &str) -> Option<ArticleDocument> {
        let path = self.documents_dir.join(format!("{}.json", id));
        if path.exists() {
            std::fs::read_to_string(&path)
                .ok()
                .and_then(|c| serde_json::from_str(&c).ok())
        } else {
            None
        }
    }

    pub fn delete_article_document(&self, id: &str) -> Result<(), String> {
        let path = self.documents_dir.join(format!("{}.json", id));
        if path.exists() {
            std::fs::remove_file(&path).map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    // ─── Article metadata (individual .meta.json) ───

    pub fn save_article_meta(&self, meta: &ArticleMeta) -> Result<(), String> {
        let path = self.articles_dir.join(format!("{}.meta.json", meta.id));
        let content = serde_json::to_string_pretty(meta).map_err(|e| e.to_string())?;
        std::fs::write(&path, content).map_err(|e| e.to_string())
    }

    pub fn load_article_meta(&self, id: &str) -> Option<ArticleMeta> {
        let path = self.articles_dir.join(format!("{}.meta.json", id));
        if path.exists() {
            std::fs::read_to_string(&path)
                .ok()
                .and_then(|c| serde_json::from_str(&c).ok())
        } else {
            None
        }
    }

    pub fn delete_article_meta(&self, id: &str) -> Result<(), String> {
        let path = self.articles_dir.join(format!("{}.meta.json", id));
        if path.exists() {
            std::fs::remove_file(&path).map_err(|e| e.to_string())
        } else {
            Ok(())
        }
    }

    /// List all article IDs with existing content files
    #[allow(dead_code)]
    pub fn list_article_ids(&self) -> Vec<String> {
        let mut ids = Vec::new();
        if let Ok(entries) = std::fs::read_dir(&self.articles_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if let Some(ext) = path.extension() {
                    if ext == "md" {
                        if let Some(stem) = path.file_stem() {
                            ids.push(stem.to_string_lossy().to_string());
                        }
                    }
                }
            }
        }
        ids
    }


    // ─── Series Plan (Multi-series) ───

    /// Save/upsert a series plan into the collection's plan array
    pub fn save_series_plan(&self, collection_id: &str, plan: &SeriesPlan) -> Result<(), String> {
        let mut enriched = plan.clone();
        for i in 0..enriched.articles.len() {
            enriched.articles[i].previous_article_id = i.checked_sub(1).and_then(|j| enriched.articles[j].article_id.clone());
            enriched.articles[i].next_article_id = if i + 1 < enriched.articles.len() {
                enriched.articles[i + 1].article_id.clone()
            } else {
                None
            };
        }
        let mut plans = self.load_all_series_plans(collection_id);
        let idx = plans.iter().position(|p| p.id == enriched.id);
        if let Some(i) = idx {
            plans[i] = enriched;
        } else {
            plans.push(enriched);
        }
        self.write_series_plans(collection_id, &plans)
    }

    /// Load a single series plan by id
    pub fn load_series_plan(&self, collection_id: &str, series_id: &str) -> Option<SeriesPlan> {
        self.load_all_series_plans(collection_id)
            .into_iter()
            .find(|p| p.id == series_id)
    }

    /// Load all series plans for a collection
    pub fn load_all_series_plans(&self, collection_id: &str) -> Vec<SeriesPlan> {
        let path = self.data_dir.join(format!("series_{}.json", collection_id));
        if !path.exists() {
            return Vec::new();
        }
        // Try reading as array first
        if let Ok(content) = std::fs::read_to_string(&path) {
            // Try array format
            if let Ok(plans) = serde_json::from_str::<Vec<SeriesPlan>>(&content) {
                return plans;
            }
            // Fallback: migrate old single-plan format
            if let Ok(plan) = serde_json::from_str::<SeriesPlan>(&content) {
                let plans = vec![plan];
                let _ = self.write_series_plans(collection_id, &plans);
                return plans;
            }
        }
        Vec::new()
    }

    /// Write all series plans for a collection (replaces entire array)
    fn write_series_plans(&self, collection_id: &str, plans: &[SeriesPlan]) -> Result<(), String> {
        let path = self.data_dir.join(format!("series_{}.json", collection_id));
        let content = serde_json::to_string_pretty(plans).map_err(|e| e.to_string())?;
        std::fs::write(&path, content).map_err(|e| e.to_string())
    }

    /// Save all series plans at once (replaces entire array)
    pub fn save_all_series_plans(&self, collection_id: &str, plans: &[SeriesPlan]) -> Result<(), String> {
        self.write_series_plans(collection_id, plans)
    }

    /// Delete a single series plan by id
    pub fn delete_series_plan(&self, collection_id: &str, series_id: &str) -> Result<(), String> {
        let mut plans = self.load_all_series_plans(collection_id);
        let before = plans.len();
        plans.retain(|p| p.id != series_id);
        if plans.len() == before {
            return Ok(()); // nothing to delete
        }
        if plans.is_empty() {
            // Remove file entirely if no plans left
            let path = self.data_dir.join(format!("series_{}.json", collection_id));
            let _ = std::fs::remove_file(&path);
            Ok(())
        } else {
            self.write_series_plans(collection_id, &plans)
        }
    }


    // ─── Future index paths ───

    /// Path to the index directory (for future vector/full-text search)
    #[allow(dead_code)]
    pub fn index_dir(&self) -> &PathBuf {
        &self._index_dir
    }

    /// Path to the codegraph directory (for future code analysis)
    #[allow(dead_code)]
    pub fn codegraph_dir(&self) -> &PathBuf {
        &self._codegraph_dir
    }

    /// Root data directory path
    pub fn data_dir(&self) -> &PathBuf {
        &self.data_dir
    }

    /// Path to the articles directory
    pub fn articles_dir(&self) -> &PathBuf {
        &self.articles_dir
    }
}

// ─── Blueprint ───

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct OutlineSection {
    pub id: String,
    pub title: String,
    pub level: u32,
    pub description: Option<String>,
    pub target_word_count: Option<u32>,
    pub status: String,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ArticleBlueprint {
    pub working_title: String,
    pub description: String,
    pub target_word_count: Option<u32>,
    pub tone: Option<String>,
    pub target_audience: Option<String>,
    pub cover_image: Option<String>,
    pub phase: String,
    pub tags: Vec<String>,
    pub outline: Vec<OutlineSection>,
    pub updated_at: u64,
    pub style_id: Option<String>,
    pub action_id: Option<String>,
}

impl DataStore {
    pub fn save_blueprint(&self, id: &str, blueprint: &ArticleBlueprint) -> Result<(), String> {
        let path = self.articles_dir.join(format!("{}.blueprint.json", id));
        let content = serde_json::to_string_pretty(blueprint).map_err(|e| e.to_string())?;
        std::fs::write(&path, content).map_err(|e| e.to_string())
    }

    pub fn load_blueprint(&self, id: &str) -> Option<ArticleBlueprint> {
        let path = self.articles_dir.join(format!("{}.blueprint.json", id));
        if path.exists() {
            std::fs::read_to_string(&path)
                .ok()
                .and_then(|c| serde_json::from_str(&c).ok())
        } else {
            None
        }
    }

    pub fn delete_blueprint(&self, id: &str) -> Result<(), String> {
        let path = self.articles_dir.join(format!("{}.blueprint.json", id));
        if path.exists() {
            std::fs::remove_file(&path).map_err(|e| e.to_string())
        } else {
            Ok(())
        }
    }
}
