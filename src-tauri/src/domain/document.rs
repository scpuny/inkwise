// ─── Document 领域类型 ───

use serde::{Deserialize, Serialize};

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
    pub source: Option<String>,
    pub inspiration: Option<String>,
    pub version: u32,
    pub deleted_at: Option<u64>,
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
pub struct TrashItem {
    pub id: String,
    pub title: String,
    pub collection_id: String,
    pub collection_title: String,
    pub deleted_at: u64,
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
