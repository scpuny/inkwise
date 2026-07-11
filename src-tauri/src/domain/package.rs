// ─── Package 领域类型（市场/插件系统） ───

use serde::{Deserialize, Serialize};

/// 已安装的包（存入 installed_packages 表）
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InstalledPackage {
    pub id: String,
    pub r#type: String,
    pub name: String,
    pub version: String,
    pub author: Option<String>,
    pub description: Option<String>,
    pub source: String,
    pub source_url: Option<String>,
    pub manifest_json: String,
    pub install_path: Option<String>,
    pub is_enabled: bool,
    pub installed_at: u64,
    pub updated_at: u64,
}
