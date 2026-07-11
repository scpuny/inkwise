// ─── Provider 领域类型 ───

use serde::{Deserialize, Serialize};

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
