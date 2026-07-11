// ─── Skill 领域类型 ───

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

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
    pub configs: HashMap<String, PhaseConfig>,
    pub context_sources: Vec<ContextSource>,
    pub dimensions: Vec<StyleDimension>,
    pub example_text: Option<String>,
    pub builtin: bool,
    pub created_at: u64,
    pub updated_at: u64,
    pub style_id: Option<String>,
    pub action_id: Option<String>,
}
