//! 微信公众号平台实现

use super::*;
use base64::engine::Engine as _;
use serde::Deserialize;
use serde_json::json;
use std::path::Path;

// ─── 微信 API 响应类型 ───

#[derive(Debug, Deserialize)]
struct TokenResponse {
    access_token: Option<String>,
    expires_in: Option<u64>,
    errcode: Option<i64>,
    errmsg: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UploadResponse {
    url: Option<String>,
    media_id: Option<String>,
    errcode: Option<i64>,
    errmsg: Option<String>,
}

#[derive(Debug, Deserialize)]
struct DraftResponse {
    media_id: Option<String>,
    errcode: Option<i64>,
    errmsg: Option<String>,
}

#[derive(Debug, Deserialize)]
struct PublishResponse {
    publish_id: Option<String>,
    errcode: Option<i64>,
    errmsg: Option<String>,
}


/// 微信错误码中文描述
fn wechat_error_description(code: i64, default_msg: &str) -> String {
    match code {
        0 => "成功",
        -1 => "系统繁忙，请稍后重试",
        40001 => "AppSecret 错误或 access_token 无效",
        40002 => "凭据类型无效",
        40003 => "OpenID 无效",
        40004 => "媒体文件类型无效",
        40005 => "文件类型无效",
        40006 => "文件大小超出限制",
        40007 => "媒体文件 ID 无效",
        40008 => "消息类型无效",
        40009 => "图片尺寸超出限制",
        40013 => "AppID 无效",
        40014 => "access_token 无效",
        40164 => "IP 地址不在白名单中，请检查微信公众平台 IP 白名单配置",
        40035 => "参数错误",
        40060 => "文章标题长度超出限制",
        40061 => "文章封面图片 ID 无效",
        40062 => "文章正文长度超出限制",
        40063 => "文章摘要长度超出限制",
        40064 => "文章作者长度超出限制",
        40065 => "文章内容不符合预期",
        40066 => "文章正文包含不安全内容",
        40067 => "文章评论功能参数错误",
        40068 => "文章付费阅读参数错误",
        41001 => "缺少 access_token 参数",
        41002 => "缺少 appid 参数",
        41004 => "缺少 secret 参数",
        41005 => "缺少多媒体文件数据",
        41006 => "缺少 media_id 参数",
        42001 => "access_token 超时",
        43001 => "需要 GET 请求",
        43002 => "需要 POST 请求",
        43003 => "需要 HTTPS 请求",
        44001 => "多媒体文件为空",
        44002 => "POST 的数据包为空",
        44003 => "图文消息内容为空",
        45001 => "多媒体文件大小超出限制",
        45002 => "消息内容超出限制",
        45003 => "标题字段超出限制",
        45004 => "描述字段超出限制",
        45009 => "接口调用超过频率限制",
        45011 => "API 调用已被封禁",
        45023 => "文章内容超出限制",
        45024 => "文章图片数量超出限制",
        45025 => "文章内外部链接数量超出限制",
        46001 => "不存在媒体数据",
        47001 => "解析 JSON/XML 内容错误",
        48001 => "api 功能未授权",
        48002 => "用户未关注该公众号",
        48004 => "api 接口被封禁",
        50001 => "用户未关注该公众号",
        88000 => "无效的草稿 media_id",
        88001 => "草稿已被删除",
        88002 => "草稿已被发布",
        88003 => "草稿已被修改",
        88004 => "草稿发布失败",
        88005 => "草稿已存在发布任务",
        88006 => "草稿不存在",
        88007 => "草稿 media_id 与平台不匹配",
        88008 => "草稿内容不符合预期",
        88009 => "草稿内容包含不安全内容",
        88010 => "草稿的 author 字段无效",
        88011 => "草稿的 digest 字段无效",
        88012 => "草稿的 content 字段无效",
        88013 => "草稿的 content 字段超出长度限制",
        88014 => "草稿的 title 字段无效",
        88015 => "草稿的 title 字段超出长度限制",
        88016 => "草稿的 thumb_media_id 无效",
        88017 => "草稿的 need_open_comment 无效",
        88018 => "草稿的 only_fans_can_comment 无效",
        88019 => "草稿的 pic_crop 参数错误",
        88020 => "草稿的 product_info 参数错误",
        88021 => "草稿的 product_key 错误",
        _ => return default_msg.to_string(),
    }.to_string()
}

const API_BASE: &str = "https://api.weixin.qq.com/cgi-bin";

// ─── WeChat 平台 ───

pub struct WeChat {
    platform_id: &'static str,
    app_id: String,
    app_secret: String,
    current_token: Option<String>,
}

impl WeChat {
    pub fn new(app_id: String, app_secret: String) -> Self {
        Self { platform_id: "wechat", app_id, app_secret, current_token: None }
    }
}

impl Platform for WeChat {
    fn platform_id(&self) -> &str { self.platform_id }
    fn app_id(&self) -> &str { &self.app_id }
    fn app_secret(&self) -> &str { &self.app_secret }

    async fn ensure_token(&mut self) -> Result<String, String> {
        if let Some(token) = get_cached_token(self.platform_id, &self.app_id) {
            self.current_token = Some(token.clone());
            return Ok(token);
        }
        let url = format!(
            "{}/token?grant_type=client_credential&appid={}&secret={}",
            API_BASE, self.app_id, self.app_secret
        );
        let resp: TokenResponse = reqwest::get(&url)
            .await.map_err(|e| format!("请求微信 token 失败: {}", e))?
            .json().await.map_err(|e| format!("解析 token 响应失败: {}", e))?;
        if let Some(code) = resp.errcode { if code != 0 {
            return Err(format!("获取 token 失败 ({}) {}", code, wechat_error_description(code, &resp.errmsg.unwrap_or_default())));
        }}
        let token = resp.access_token.ok_or("token 为空")?;
        let expires_in = resp.expires_in.unwrap_or(7200);
        set_cached_token(self.platform_id, &self.app_id, token.clone(), expires_in);
        self.current_token = Some(token.clone());
        Ok(token)
    }

    async fn upload_image(&mut self, image_path: &str) -> Result<String, String> {
        let token = self.ensure_token().await?;
        let path = Path::new(image_path);
        if !path.exists() {
            return Err(format!("图片文件不存在: {}", image_path));
        }
        let file_bytes = std::fs::read(path).map_err(|e| format!("读取图片失败: {}", e))?;
        let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("image.png").to_string();
        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("png");
        let mime = mime_for_extension(ext);
        let url = format!("{}/media/uploadimg?access_token={}", API_BASE, token);
        let part = reqwest::multipart::Part::bytes(file_bytes)
            .file_name(file_name).mime_str(mime)
            .map_err(|e| format!("创建 multipart 失败: {}", e))?;
        let form = reqwest::multipart::Form::new().part("media", part);
        let resp: UploadResponse = reqwest::Client::new()
            .post(&url).multipart(form).send().await
            .map_err(|e| format!("上传图片失败: {}", e))?
            .json().await.map_err(|e| format!("解析上传响应失败: {}", e))?;
        if let Some(code) = resp.errcode { if code != 0 {
            return Err(format!("上传图片失败 ({}) {}", code, wechat_error_description(code, &resp.errmsg.unwrap_or_default())));
        }}
        resp.url.ok_or("上传图片返回 URL 为空".into())
    }

    async fn upload_image_as_material(&mut self, image_path: &str) -> Result<String, String> {
        let token = self.ensure_token().await?;
        let path = Path::new(image_path);
        if !path.exists() {
            return Err(format!("图片文件不存在: {}", image_path));
        }
        let file_bytes = std::fs::read(path).map_err(|e| format!("读取图片失败: {}", e))?;
        let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("image.png").to_string();
        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("png");
        let mime = mime_for_extension(ext);
        let url = format!("{}/material/add_material?access_token={}&type=image", API_BASE, token);
        let part = reqwest::multipart::Part::bytes(file_bytes)
            .file_name(file_name).mime_str(mime)
            .map_err(|e| format!("创建 multipart 失败: {}", e))?;
        let form = reqwest::multipart::Form::new().part("media", part);
        let resp: UploadResponse = reqwest::Client::new()
            .post(&url).multipart(form).send().await
            .map_err(|e| format!("上传素材失败: {}", e))?
            .json().await.map_err(|e| format!("解析素材响应失败: {}", e))?;
        if let Some(code) = resp.errcode { if code != 0 {
            return Err(format!("上传素材失败 ({}) {}", code, wechat_error_description(code, &resp.errmsg.unwrap_or_default())));
        }}
        resp.media_id.ok_or("上传素材返回 media_id 为空".into())
    }

    async fn create_draft(
        &mut self, title: &str, html: &str, thumb_media_id: &str,
        digest: &str, author: &str,
        pic_crop_235_1: Option<&str>, pic_crop_1_1: Option<&str>, product_key: Option<&str>,
    ) -> Result<String, String> {
        let token = self.ensure_token().await?;
        let url = format!("{}/draft/add?access_token={}", API_BASE, token);
        let mut article = json!({
            "title": title, "content": html,
            "thumb_media_id": thumb_media_id,
            "need_open_comment": 0, "only_fans_can_comment": 0,
        });
        if !digest.is_empty() { article["digest"] = json!(digest); }
        if !author.is_empty() { article["author"] = json!(author); }
        if let Some(crop) = pic_crop_235_1 { if !crop.is_empty() { article["pic_crop_235_1"] = json!(crop); }}
        if let Some(crop) = pic_crop_1_1 { if !crop.is_empty() { article["pic_crop_1_1"] = json!(crop); }}
        if let Some(key) = product_key { if !key.is_empty() {
            article["product_info"] = json!({ "footer_product_info": { "product_key": key } });
        }}
        let body = json!({ "articles": [article] });
        let resp: DraftResponse = reqwest::Client::new()
            .post(&url).json(&body).send().await
            .map_err(|e| format!("创建草稿失败: {}", e))?
            .json().await.map_err(|e| format!("解析草稿响应失败: {}", e))?;
        if let Some(code) = resp.errcode { if code != 0 {
            return Err(format!("创建草稿失败 ({}) {}", code, wechat_error_description(code, &resp.errmsg.unwrap_or_default())));
        }}
        resp.media_id.ok_or("创建草稿返回 media_id 为空".into())
    }

    async fn publish_draft(&mut self, media_id: &str) -> Result<String, String> {
        let token = self.ensure_token().await?;
        let url = format!("{}/draft/publish?access_token={}", API_BASE, token);
        let body = json!({ "media_id": media_id });
        let resp: PublishResponse = reqwest::Client::new()
            .post(&url).json(&body).send().await
            .map_err(|e| format!("发布草稿失败: {}", e))?
            .json().await.map_err(|e| format!("解析发布响应失败: {}", e))?;
        if let Some(code) = resp.errcode { if code != 0 {
            return Err(format!("发布失败 ({}) {}", code, wechat_error_description(code, &resp.errmsg.unwrap_or_default())));
        }}
        resp.publish_id.ok_or("发布返回 publish_id 为空".into())
    }

    async fn publish(
        &mut self, article_dir: &str, markdown: &str,
        styled_html: &str, options: &PublishOptions, action: &str,
    ) -> Result<PublishResult, String> {
        // 上传封面（支持本地文件路径和 base64 data URL）
        log::info!("[publish] cover_image: {:?}", options.cover_image);
        let thumb_media_id = if let Some(ref cover) = options.cover_image {
            if cover.starts_with("data:") {
                // base64 data URL → 临时文件 → 上传为永久素材
                match save_base64_to_temp(cover) {
                    Some(temp_path) => {
                        let result = self.upload_image_as_material(&temp_path).await;
                        let _ = std::fs::remove_file(&temp_path);
                        match result {
                            Ok(mid) => { log::info!("[publish] 封面 media_id: {}", mid); mid },
                            Err(e) => { log::error!("上传 base64 封面失败: {}", e); String::new() }
                        }
                    }
                    None => { log::error!("解析 base64 封面失败"); String::new() }
                }
            } else if cover.starts_with("asset://localhost/") {
                // asset:// URL → 解码为本地路径 → 上传为永久素材
                match asset_url_to_path(cover) {
                    Some(local_path) => {
                        if Path::new(&local_path).exists() {
                            match self.upload_image_as_material(&local_path).await {
                                Ok(mid) => { log::info!("[publish] asset 封面 media_id: {}", mid); mid },
                                Err(e) => { log::error!("上传 asset 封面失败: {}", e); String::new() }
                            }
                        } else {
                            log::error!("asset 封面文件不存在: {} -> {}", cover, local_path);
                            String::new()
                        }
                    }
                    None => { log::error!("解析 asset 封面 URL 失败: {}", cover); String::new() }
                }
            } else {
                let p = Path::new(cover);
                if p.exists() {
                    match self.upload_image_as_material(cover).await {
                        Ok(mid) => { log::info!("[publish] 封面 media_id: {}", mid); mid },
                        Err(e) => { log::error!("上传封面失败: {}", e); String::new() }
                    }
                } else { String::new() }
            }
        } else { String::new() };

        // 从正文取第一张图片作为封面兜底
        let thumb_media_id = if thumb_media_id.is_empty() {
            let images = extract_images(markdown);
            if let Some(first_img) = images.first() {
                log::info!("[publish] 从正文取封面: {}", first_img);
                let img_path = if first_img.starts_with("asset://localhost/") {
                    asset_url_to_path(first_img).unwrap_or_default()
                } else if Path::new(first_img).is_absolute() {
                    first_img.clone()
                } else { format!("{}/{}", article_dir, first_img) };
                if !img_path.is_empty() && Path::new(&img_path).exists() {
                    self.upload_image_as_material(&img_path).await.unwrap_or_default()
                } else { String::new() }
            } else { String::new() }
        } else { thumb_media_id };

        if thumb_media_id.is_empty() {
            return Err("无法获取封面 media_id，请确保正文中包含至少一张本地图片，或从正文中选择一张作为封面".into());
        }

        // 确定最终 HTML：优先用前端处理好的 styled_html
        let final_html = if !styled_html.is_empty() {
            upload_html_images(self, article_dir, styled_html).await
        } else {
            let mut processed_markdown = markdown.to_string();
            let local_images = extract_images(&processed_markdown);
            let mut image_mappings: Vec<(String, String)> = Vec::new();
            for img_path in &local_images {
                let full_path = if Path::new(img_path).is_absolute() {
                    img_path.clone()
                } else {
                    let dir = if article_dir.is_empty() { "".into() } else { format!("{}/", article_dir) };
                    format!("{}{}", dir, img_path)
                };
                if Path::new(&full_path).exists() {
                    match self.upload_image(&full_path).await {
                        Ok(cdn_url) => image_mappings.push((img_path.clone(), cdn_url)),
                        Err(e) => log::warn!("skip img {}: {}", img_path, e),
                    }
                } else { log::error!("img not found: {}", full_path); }
            }
            if !image_mappings.is_empty() {
                processed_markdown = replace_image_urls(&processed_markdown, &image_mappings);
            }
            markdown_to_wechat_html(&processed_markdown)
        };

        let digest = options.summary.clone().unwrap_or_else(|| extract_digest(markdown, 120));
        let author = options.author.as_deref().unwrap_or("");
        let article_title = options.title.clone().unwrap_or_else(|| extract_title(markdown));

        // 清理 HTML：微信不支持 style/script 标签、base64 图片、!important
        let clean_html = sanitize_wechat_html(&final_html);
        log::info!("[publish] HTML 长度: {} chars", clean_html.len());
        log::info!("[publish] 含 style 标签: {}", clean_html.contains("<style"));
        log::info!("[publish] 含 script 标签: {}", clean_html.contains("<script"));
        log::info!("[publish] 文章标题: {}", article_title);
        log::info!("[publish] thumb_media_id: {}", thumb_media_id);
        if clean_html.len() > 200 {
            let preview: String = clean_html.chars().take(200).collect();
            log::info!("[publish] HTML 前 200 字: {:?}", preview);
            let tail: String = clean_html.chars().rev().take(200).collect::<Vec<_>>().into_iter().rev().collect();
            log::info!("[publish] HTML 后 200 字: {:?}", tail);
        }

        let media_id = self.create_draft(
            &article_title, &clean_html, &thumb_media_id, &digest, author,
            options.pic_crop_235_1.as_deref(),
            options.pic_crop_1_1.as_deref(),
            options.product_key.as_deref(),
        ).await?;

        if action == "publish" {
            match self.publish_draft(&media_id).await {
                Ok(publish_id) => Ok(PublishResult {
                    success: true, platform_article_id: Some(publish_id),
                    platform_url: None, error_message: None, is_draft: false,
                }),
                Err(e) => Ok(PublishResult {
                    success: true, platform_article_id: Some(media_id),
                    platform_url: None,
                    error_message: Some(format!("草稿已创建，发布失败: {}", e)),
                    is_draft: true,
                }),
            }
        } else {
            Ok(PublishResult {
                success: true, platform_article_id: Some(media_id),
                platform_url: None, error_message: None, is_draft: true,
            })
        }
    }
}

/// 验证微信凭证是否有效
pub async fn verify_credentials(app_id: &str, app_secret: &str) -> Result<bool, String> {
    let mut wechat = WeChat::new(app_id.to_string(), app_secret.to_string());
    wechat.ensure_token().await.map(|_| true)
}

// ─── HTML 图片上传（支持本地路径和 base64）───

/// 将 asset://localhost/ URL 解码为本地文件路径
fn asset_url_to_path(url: &str) -> Option<String> {
    let path = url.strip_prefix("asset://localhost/")?;
    // URL 解码：%2F -> /, %20 -> 空格, etc.
    let mut decoded = String::with_capacity(path.len());
    let mut chars = path.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '%' {
            let hex: String = chars.by_ref().take(2).collect();
            if let Ok(byte) = u8::from_str_radix(&hex, 16) {
                decoded.push(byte as char);
            } else {
                decoded.push('%');
                decoded.push_str(&hex);
            }
        } else {
            decoded.push(c);
        }
    }
    Some(decoded)
}

/// 上传 HTML 中的本地/base64 图片并替换为微信 CDN URL
async fn upload_html_images(wechat: &mut WeChat, article_dir: &str, html: &str) -> String {
    let mut result = html.to_string();
    let mut replacements: Vec<(String, String)> = Vec::new();

    let mut search_from = 0;
    while let Some(start) = result[search_from..].find("<img") {
        let tag_start = search_from + start;
        if let Some(src_start) = result[tag_start..].find("src=\"") {
            let value_start = tag_start + src_start + 5;
            if let Some(value_end) = result[value_start..].find('"') {
                let src = &result[value_start..value_start + value_end];
                if src.starts_with("data:") {
                    // base64 -> 临时文件 -> 上传
                    if let Some(temp_path) = save_base64_to_temp(src) {
                        match wechat.upload_image(&temp_path).await {
                            Ok(cdn_url) => replacements.push((src.to_string(), cdn_url)),
                            Err(e) => log::warn!("skip base64 img: {}", e),
                        }
                        let _ = std::fs::remove_file(&temp_path);
                    }
                } else if src.starts_with("asset://localhost/") {
                    // asset:// URL (Tauri generated images) -> 解码为本地路径 -> 上传
                    if let Some(local_path) = asset_url_to_path(src) {
                        if Path::new(&local_path).exists() {
                            match wechat.upload_image(&local_path).await {
                                Ok(cdn_url) => replacements.push((src.to_string(), cdn_url)),
                                Err(e) => log::warn!("skip asset img {}: {}", src, e),
                            }
                        } else {
                            log::error!("asset img not found: {} -> {}", src, local_path);
                        }
                    }
                } else if !src.starts_with("http://") && !src.starts_with("https://") {
                    // 本地文件
                    let full_path = if Path::new(src).is_absolute() {
                        src.to_string()
                    } else { format!("{}/{}", article_dir, src) };
                    if Path::new(&full_path).exists() {
                        match wechat.upload_image(&full_path).await {
                            Ok(cdn_url) => replacements.push((src.to_string(), cdn_url)),
                            Err(e) => log::warn!("skip HTML img {}: {}", src, e),
                        }
                    }
                }
                // http/https 远程图片：跳过
                search_from = value_start + value_end;
                continue;
            }
        }
        search_from = tag_start + 4;
    }

    replacements.sort_by(|a, b| b.0.len().cmp(&a.0.len()));
    for (original, cdn_url) in &replacements {
        result = result.replace(&format!("src=\"{}\"", original), &format!("src=\"{}\"", cdn_url));
    }
    result
}

/// 将 base64 data URL 解码并保存到临时文件
fn save_base64_to_temp(data_url: &str) -> Option<String> {
    let (meta, b64) = data_url.split_once(',')?;
    let ext = if meta.contains("/png") { "png" }
              else if meta.contains("/jpeg") || meta.contains("/jpg") { "jpg" }
              else if meta.contains("/gif") { "gif" }
              else if meta.contains("/webp") { "webp" }
              else { "png" };
    let bytes = base64::engine::general_purpose::STANDARD.decode(b64.as_bytes()).ok()?;
    let dir = std::env::temp_dir();
    let file_name = format!("wechat_img_{}.{}",
        std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).ok()?.as_nanos(),
        ext);
    let path = dir.join(&file_name);
    std::fs::write(&path, &bytes).ok()?;
    Some(path.to_string_lossy().to_string())
}

// ─── HTML 清理 ───

/// 清理 HTML 使其符合微信要求：
/// - 移除 <style> 和 <script> 标签
/// - 移除 base64 图片标签
/// - 移除 !important
/// - 移除 class 和 id 属性（微信可能不识别）
fn sanitize_wechat_html(html: &str) -> String {
    let mut result = String::new();
    let mut rest = html;
    while !rest.is_empty() {
        // 跳过 <style> 标签块
        if let Some(style_start) = rest.find("<style") {
            result.push_str(&rest[..style_start]);
            if let Some(style_end) = rest[style_start..].find("</style>") {
                rest = &rest[style_start + style_end + 8..];
                continue;
            }
        }
        // 跳过 <script> 标签块
        if let Some(script_start) = rest.find("<script") {
            result.push_str(&rest[..script_start]);
            if let Some(script_end) = rest[script_start..].find("</script>") {
                rest = &rest[script_start + script_end + 9..];
                continue;
            }
        }
        // 跳过 base64 图片
        if let Some(img_start) = rest.find("<img") {
            if let Some(gt) = rest[img_start..].find(">") {
                let tag = &rest[img_start..=img_start + gt];
                if tag.contains("src=\"data:") || tag.contains("src='data:") {
                    result.push_str(&rest[..img_start]);
                    rest = &rest[img_start + gt + 1..];
                    continue;
                }
            }
        }
        // 复制下个字符
        let c = rest.chars().next().unwrap();
        result.push(c);
        rest = &rest[c.len_utf8()..];
    }
    // 移除 <a> 标签（微信草稿不允许外部链接，保留文本内容）
    // 先移除 </a> 闭合标签（保留文本）
    while let Some(pos) = result.find("</a>") {
        result.replace_range(pos..pos + 4, "");
    }
    // 再移除 <a ...> 开标签
    loop {
        if let Some(start) = result.find("<a") {
            if let Some(end) = result[start..].find('>') {
                result.replace_range(start..start + end + 1, "");
                continue;
            }
        }
        break;
    }
    // 移除 !important
    result = result.replace("!important", "");
    // 移除 color-mix(...) — 可能有嵌套括号
    while result.contains("color-mix(") {
        if let Some(start) = result.find("color-mix(") {
            let mut depth = 0;
            let mut end = start;
            for (i, c) in result[start..].char_indices() {
                if c == '(' { depth += 1; }
                else if c == ')' { depth -= 1; if depth == 0 { end = start + i + 1; break; } }
            }
            result.replace_range(start..end, "transparent");
        }
    }
    // 移除 var(--...) CSS 变量引用
    while result.contains("var(--") {
        if let Some(start) = result.find("var(--") {
            if let Some(end) = result[start..].find(')') {
                // Check if there's a fallback: var(--accent, #xxx)
                if let Some(comma) = result[start..end].find(',') {
                    let fallback = result[start + comma + 1..start + end].trim().to_string();
                    if !fallback.is_empty() {
                        result.replace_range(start..start + end + 1, &fallback);
                    } else {
                        result.replace_range(start..start + end + 1, "inherit");
                    }
                } else {
                    result.replace_range(start..start + end + 1, "inherit");
                }
            }
        }
    }
    result
}

// ─── 辅助函数 ───

fn extract_images(markdown: &str) -> Vec<String> {
    let mut images = Vec::new();
    for line in markdown.lines() {
        let trimmed = line.trim();
        if let Some(rest) = trimmed.strip_prefix("![") {
            if let Some(end) = rest.find("](") {
                if let Some(url_end) = rest[end + 2..].find(')') {
                    images.push(rest[end + 2..end + 2 + url_end].to_string());
                }
            }
        }
    }
    images
}

fn replace_image_urls(markdown: &str, mappings: &[(String, String)]) -> String {
    let mut result = markdown.to_string();
    for (original, replacement) in mappings {
        result = result.replace(original, replacement);
    }
    result
}

fn extract_title(markdown: &str) -> String {
    for line in markdown.lines() {
        if let Some(title) = line.trim().strip_prefix("# ") {
            return title.to_string();
        }
    }
    "无标题".to_string()
}

fn extract_digest(markdown: &str, max_len: usize) -> String {
    let mut plain = String::new();
    for line in markdown.lines() {
        let t = line.trim();
        if t.starts_with('#') || t.starts_with("```") || t.starts_with("> ") { continue; }
        if t.starts_with("![") || t.starts_with('[') || t.is_empty() { continue; }
        plain.push_str(t); plain.push(' ');
        if plain.len() >= max_len { break; }
    }
    let cleaned: String = plain.chars().take(max_len).collect();
    if cleaned.len() >= max_len {
        format!("{}...", &cleaned[..max_len.saturating_sub(3)])
    } else { cleaned.trim().to_string() }
}

fn mime_for_extension(ext: &str) -> &'static str {
    match ext.to_lowercase().as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        _ => "image/png",
    }
}

// ─── Markdown → 微信公众号简易 HTML（兜底用）───

pub fn markdown_to_wechat_html(markdown: &str) -> String {
    let mut html = String::new();
    let mut in_code_block = false;
    let mut code_block_content = String::new();
    let mut in_paragraph = false;
    let mut in_list = false;
    let mut in_olist = false;

    for raw in markdown.lines() {
        if raw.trim().starts_with("```") {
            if in_code_block {
                html.push_str(&format!("<pre><code>{}</code></pre>\n", html_escape(&code_block_content)));
                code_block_content.clear(); in_code_block = false;
            } else { flush_block(&mut html, &mut in_paragraph, &mut in_list, &mut in_olist); in_code_block = true; }
            continue;
        }
        if in_code_block {
            if !code_block_content.is_empty() { code_block_content.push('\n'); }
            code_block_content.push_str(raw); continue;
        }

        let trimmed = raw.trim();
        if trimmed == "---" || trimmed == "***" || trimmed == "___" {
            flush_block(&mut html, &mut in_paragraph, &mut in_list, &mut in_olist);
            html.push_str("<hr>\n"); continue;
        }
        if trimmed.is_empty() { flush_block(&mut html, &mut in_paragraph, &mut in_list, &mut in_olist); continue; }
        if let Some(rest) = trimmed.strip_prefix("# ") {
            flush_block(&mut html, &mut in_paragraph, &mut in_list, &mut in_olist);
            html.push_str(&format!("<h2>{}</h2>\n", inline_to_html(rest))); continue;
        }
        if let Some(rest) = trimmed.strip_prefix("## ") {
            flush_block(&mut html, &mut in_paragraph, &mut in_list, &mut in_olist);
            html.push_str(&format!("<h3>{}</h3>\n", inline_to_html(rest))); continue;
        }
        if let Some(rest) = trimmed.strip_prefix("### ") {
            flush_block(&mut html, &mut in_paragraph, &mut in_list, &mut in_olist);
            html.push_str(&format!("<h4>{}</h4>\n", inline_to_html(rest))); continue;
        }
        if trimmed.starts_with("> ") || trimmed == ">" {
            let content = trimmed.strip_prefix("> ").unwrap_or("");
            flush_block(&mut html, &mut in_paragraph, &mut in_list, &mut in_olist);
            html.push_str(&format!("<blockquote><p>{}</p></blockquote>\n", inline_to_html(content))); continue;
        }
        if trimmed.starts_with("- ") || trimmed.starts_with("* ") || trimmed.starts_with("+ ") {
            let content = trimmed.strip_prefix("- ").or_else(|| trimmed.strip_prefix("* ")).or_else(|| trimmed.strip_prefix("+ ")).unwrap_or(trimmed);
            if !in_list { html.push_str("<ul>\n"); in_list = true; }
            html.push_str(&format!("<li>{}</li>\n", inline_to_html(content))); continue;
        }
        if let Some(rest) = trimmed.strip_prefix(|c: char| c.is_ascii_digit()) {
            if let Some(content) = rest.strip_prefix(". ") {
                if !in_olist { html.push_str("<ol>\n"); in_olist = true; }
                html.push_str(&format!("<li>{}</li>\n", inline_to_html(content))); continue;
            }
        }
        flush_list_raw(&mut html, &mut in_list, &mut in_olist);
        if !in_paragraph { html.push_str("<p>"); in_paragraph = true; }
        html.push_str(&inline_to_html(raw));
    }
    flush_block(&mut html, &mut in_paragraph, &mut in_list, &mut in_olist);
    if in_code_block {
        html.push_str(&format!("<pre><code>{}</code></pre>\n", html_escape(&code_block_content)));
    }
    html
}

fn flush_block(html: &mut String, in_paragraph: &mut bool, in_list: &mut bool, in_olist: &mut bool) {
    if *in_paragraph { html.push_str("</p>\n"); *in_paragraph = false; }
    flush_list_raw(html, in_list, in_olist);
}

fn flush_list_raw(html: &mut String, in_list: &mut bool, in_olist: &mut bool) {
    if *in_list { html.push_str("</ul>\n"); *in_list = false; }
    if *in_olist { html.push_str("</ol>\n"); *in_olist = false; }
}

fn inline_to_html(text: &str) -> String {
    let mut result = String::new();
    let mut chars = text.chars().peekable();
    while let Some(c) = chars.next() {
        match c {
            '`' => {
                let mut code = String::new();
                while let Some(&n) = chars.peek() { if n == '`' { chars.next(); break; } code.push(n); chars.next(); }
                result.push_str(&format!("<code>{}</code>", html_escape(&code)));
            }
            '[' => {
                let mut t = String::new();
                while let Some(&n) = chars.peek() { if n == ']' { chars.next(); break; } t.push(n); chars.next(); }
                if chars.peek() == Some(&'(') {
                    chars.next();
                    let mut url = String::new();
                    while let Some(&n) = chars.peek() { if n == ')' { chars.next(); break; } url.push(n); chars.next(); }
                    result.push_str(&format!("<a href=\"{}\">{}</a>", html_escape(&url), t));
                } else { result.push('['); result.push_str(&t); }
            }
            '!' => {
                if chars.peek() == Some(&'[') {
                    chars.next(); let mut alt = String::new();
                    while let Some(&n) = chars.peek() { if n == ']' { chars.next(); break; } alt.push(n); chars.next(); }
                    if chars.peek() == Some(&'(') {
                        chars.next(); let mut url = String::new();
                        while let Some(&n) = chars.peek() { if n == ')' { chars.next(); break; } url.push(n); chars.next(); }
                        result.push_str(&format!("<img src=\"{}\" alt=\"{}\" />", html_escape(&url), alt));
                    } else { result.push_str(&format!("[{}]", alt)); }
                }
            }
            '*' => {
                let mut n = 1;
                while chars.peek() == Some(&'*') { chars.next(); n += 1; }
                if n >= 2 {
                    let mut inner = String::new();
                    let saved = chars.clone();
                    while let Some(&next) = chars.peek() {
                        if next == '*' {
                            let mut end = 1; chars.next();
                            while chars.peek() == Some(&'*') { chars.next(); end += 1; }
                            if end >= 2 { break; }
                            chars = saved.clone();
                        }
                        inner.push(chars.next().unwrap());
                    }
                    result.push_str(&format!("<strong>{}</strong>", inner));
                } else {
                    let mut inner = String::new();
                    while let Some(&n) = chars.peek() { if n == '*' { chars.next(); break; } inner.push(n); chars.next(); }
                    if inner.is_empty() { result.push('*'); } else { result.push_str(&format!("<em>{}</em>", inner)); }
                }
            }
            _ => result.push(c),
        }
    }
    result
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;")
}
