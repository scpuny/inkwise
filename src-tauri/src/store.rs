use serde::{Deserialize, Serialize};
use std::path::PathBuf;

// ─── Data types ───

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ArticleMeta {
    pub id: String,
    pub collection_id: String,
    pub title: String,
    pub created_at: u64,
    pub updated_at: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Collection {
    pub id: String,
    pub title: String,
    pub created_at: u64,
    /// Full article metadata stored inline for simple load/save.
    pub articles: Vec<ArticleMeta>,
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
    pub models: Vec<String>,
    pub enabled: bool,
    pub builtin: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub theme: String,
    pub theme_style: String,
    pub font_family: String,
    pub text_size: String,
}

// ─── DataStore ───

pub struct DataStore {
    data_dir: PathBuf,
    articles_dir: PathBuf,
    _index_dir: PathBuf,
    _codegraph_dir: PathBuf,
}

impl DataStore {
    pub fn new(app_dir: PathBuf) -> Self {
        let data_dir = app_dir.join("data");
        let articles_dir = data_dir.join("articles");
        let index_dir = data_dir.join("index");
        let codegraph_dir = data_dir.join("codegraph");
        for d in [&data_dir, &articles_dir, &index_dir, &codegraph_dir] {
            std::fs::create_dir_all(d).ok();
        }
        Self {
            data_dir,
            articles_dir,
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
        let content = serde_json::to_string_pretty(data).map_err(|e| e.to_string())?;
        std::fs::write(&path, &content).map_err(|e| e.to_string())
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

    pub fn load_providers(&self) -> Vec<Provider> {
        self.read_json("providers").unwrap_or_default()
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
        })
    }

    pub fn save_settings(&self, settings: &AppSettings) -> Result<(), String> {
        self.write_json("settings", settings)
    }

    // ─── Article content ───

    /// Save article Markdown content. Returns error on failure.
    pub fn save_article_content(&self, id: &str, content: &str) -> Result<(), String> {
        let path = self.articles_dir.join(format!("{}.md", id));
        std::fs::write(&path, content).map_err(|e| format!("保存文章失败: {}", e))
    }

    /// Load article Markdown content. Returns None if not found.
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
