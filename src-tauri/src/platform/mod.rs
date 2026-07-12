//! 多平台发布模块
//!
//! 每个平台实现 `Platform` trait，提供统一的发布接口。
//! Token 管理通过全局缓存 + 拦截器模式自动处理。

pub mod wechat;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

// ─── Token 全局缓存 ───
// Key: "{platform_id}:{app_id}", Value: (access_token, expires_at_epoch_secs)

fn token_cache() -> &'static Mutex<HashMap<String, (String, u64)>> {
    static CACHE: OnceLock<Mutex<HashMap<String, (String, u64)>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn cache_key(platform_id: &str, app_id: &str) -> String {
    format!("{}:{}", platform_id, app_id)
}

/// 获取缓存的 token（5 分钟安全余量内有效）
pub fn get_cached_token(platform_id: &str, app_id: &str) -> Option<String> {
    let cache = token_cache().lock().ok()?;
    let key = cache_key(platform_id, app_id);
    let (token, expires_at) = cache.get(&key)?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    if *expires_at > now + 300 {
        Some(token.clone())
    } else {
        None
    }
}

/// 缓存 token
pub fn set_cached_token(platform_id: &str, app_id: &str, token: String, expires_in_secs: u64) {
    if let Ok(mut cache) = token_cache().lock() {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let key = cache_key(platform_id, app_id);
        cache.insert(key, (token, now + expires_in_secs));
    }
}

// ─── 统一类型 ───

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PublishOptions {
    pub title: Option<String>,
    pub cover_image: Option<String>,
    pub summary: Option<String>,
    pub declare_original: bool,
    pub allow_reprint: bool,
    pub chargeable: bool,
    pub author: Option<String>,
    pub content_source_url: Option<String>,
    pub pic_crop_235_1: Option<String>,
    pub pic_crop_1_1: Option<String>,
    pub product_key: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PublishResult {
    pub success: bool,
    pub platform_article_id: Option<String>,
    pub platform_url: Option<String>,
    pub error_message: Option<String>,
    pub is_draft: bool,
}

// ─── Platform trait ───

/// 统一平台接口。
/// 每个平台（微信、头条等）实现此 trait，调用方无需关心 token 管理等细节。
pub trait Platform: Send {
    /// 平台标识（如 "wechat"、"toutiao"）
    fn platform_id(&self) -> &str;
    /// App ID
    fn app_id(&self) -> &str;
    /// App Secret
    fn app_secret(&self) -> &str;

    /// 确保有有效的 access_token，过期则自动刷新。
    /// 返回 token 字符串引用。
    async fn ensure_token(&mut self) -> Result<String, String>;

    /// 上传正文图片，返回 CDN URL。
    async fn upload_image(&mut self, image_path: &str) -> Result<String, String>;
    /// 上传永久素材，返回 media_id（用于封面等）。
    async fn upload_image_as_material(&mut self, image_path: &str) -> Result<String, String>;

    /// 创建草稿，返回 media_id。
    async fn create_draft(
        &mut self,
        title: &str,
        html: &str,
        thumb_media_id: &str,
        digest: &str,
        author: &str,
        pic_crop_235_1: Option<&str>,
        pic_crop_1_1: Option<&str>,
        product_key: Option<&str>,
    ) -> Result<String, String>;

    /// 发布草稿，返回 publish_id。
    async fn publish_draft(&mut self, media_id: &str) -> Result<String, String>;

    /// 完整发布流程：上传封面和正文图片 → 创建草稿 → 发布（或仅存草稿）。
    async fn publish(
        &mut self,
        article_dir: &str,
        markdown: &str,
        styled_html: &str,
        options: &PublishOptions,
        action: &str,
    ) -> Result<PublishResult, String>;
}
