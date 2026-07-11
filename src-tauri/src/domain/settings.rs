// ─── Settings 领域类型 ───

use serde::{Deserialize, Serialize};

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

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AiConfig {
    pub default_model: Option<String>,
    pub effort: String,
    pub max_tokens: u32,
}
