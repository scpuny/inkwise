// ─── Publish 领域类型 ───

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PlatformConfig {
    pub id: String,
    pub platform: String,
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
    pub status: String,
    pub error_message: Option<String>,
    pub published_at: u64,
    pub platform_url: Option<String>,
}
