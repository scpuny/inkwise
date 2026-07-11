// ─── Collection / Series 领域类型 ───

use serde::{Deserialize, Serialize};

use super::ArticleMeta;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Collection {
    pub id: String,
    pub title: String,
    pub created_at: u64,
    pub linked_folder: Option<String>,
    pub articles: Vec<ArticleMeta>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SeriesPlan {
    pub id: String,
    pub title: String,
    pub skill_id: Option<String>,
    pub style_id: Option<String>,
    pub action_id: Option<String>,
    pub tone: Option<String>,
    pub target_audience: Option<String>,
    pub created_at: u64,
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
