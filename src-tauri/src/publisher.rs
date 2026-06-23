use serde::{Deserialize, Serialize};
use serde_json::json;
use std::path::Path;

// ─── Public types ───

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PublishOptions {
    pub cover_image: Option<String>,
    pub summary: Option<String>,
    pub declare_original: bool,
    pub allow_reprint: bool,
    pub chargeable: bool,
    pub author: Option<String>,
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

// ─── Internal types ───

#[derive(Debug, Deserialize)]
struct WeChatTokenResponse {
    access_token: Option<String>,
    expires_in: Option<u64>,
    errcode: Option<i64>,
    errmsg: Option<String>,
}

#[derive(Debug, Deserialize)]
struct WeChatUploadResponse {
    url: Option<String>,
    media_id: Option<String>,
    errcode: Option<i64>,
    errmsg: Option<String>,
}

#[derive(Debug, Deserialize)]
struct WeChatDraftResponse {
    media_id: Option<String>,
    errcode: Option<i64>,
    errmsg: Option<String>,
}

#[derive(Debug, Deserialize)]
struct WeChatPublishResponse {
    publish_id: Option<String>,
    errcode: Option<i64>,
    errmsg: Option<String>,
}

// ─── Constants ───

const WECHAT_API_BASE: &str = "https://api.weixin.qq.com/cgi-bin";

// ─── Token Management ───

pub async fn get_access_token(app_id: &str, app_secret: &str) -> Result<(String, u64), String> {
    let url = format!(
        "{}/token?grant_type=client_credential&appid={}&secret={}",
        WECHAT_API_BASE, app_id, app_secret
    );

    let resp: WeChatTokenResponse = reqwest::get(&url)
        .await
        .map_err(|e| format!("请求微信 token 失败: {}", e))?
        .json()
        .await
        .map_err(|e| format!("解析 token 响应失败: {}", e))?;

    if let Some(code) = resp.errcode {
        if code != 0 {
            let msg = resp.errmsg.unwrap_or_default();
            return Err(format!("获取 token 失败 ({}) {}", code, msg));
        }
    }

    let token = resp.access_token.ok_or("token 为空")?;
    let expires_in = resp.expires_in.unwrap_or(7200);
    Ok((token, expires_in))
}

pub async fn verify_wechat_credentials(app_id: &str, app_secret: &str) -> Result<bool, String> {
    get_access_token(app_id, app_secret).await.map(|_| true)
}

// ─── Image Upload ───

/// Upload an image to WeChat CDN. Returns the CDN URL.
pub async fn upload_image(token: &str, image_path: &str) -> Result<String, String> {
    let path = Path::new(image_path);
    if !path.exists() {
        return Err(format!("图片文件不存在: {}", image_path));
    }

    let file_bytes = std::fs::read(path).map_err(|e| format!("读取图片失败: {}", e))?;
    let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("image.png").to_string();
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("png");
    let mime = mime_for_extension(ext);

    let url = format!(
        "{}/material/add_material?access_token={}&type=image",
        WECHAT_API_BASE, token
    );

    let part = reqwest::multipart::Part::bytes(file_bytes)
        .file_name(file_name)
        .mime_str(mime)
        .map_err(|e| format!("创建 multipart 失败: {}", e))?;

    let form = reqwest::multipart::Form::new().part("media", part);

    let resp: WeChatUploadResponse = reqwest::Client::new()
        .post(&url)
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("上传图片失败: {}", e))?
        .json()
        .await
        .map_err(|e| format!("解析上传响应失败: {}", e))?;

    if let Some(code) = resp.errcode {
        if code != 0 {
            let msg = resp.errmsg.unwrap_or_default();
            return Err(format!("上传图片失败 ({}) {}", code, msg));
        }
    }

    resp.url.ok_or("上传图片返回 URL 为空".into())
}

/// Upload an image and return media_id (for cover/thumb).
pub async fn upload_image_as_material(token: &str, image_path: &str) -> Result<String, String> {
    let path = Path::new(image_path);
    if !path.exists() {
        return Err(format!("图片文件不存在: {}", image_path));
    }

    let file_bytes = std::fs::read(path).map_err(|e| format!("读取图片失败: {}", e))?;
    let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("image.png").to_string();
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("png");
    let mime = mime_for_extension(ext);

    let url = format!(
        "{}/material/add_material?access_token={}&type=image",
        WECHAT_API_BASE, token
    );

    let part = reqwest::multipart::Part::bytes(file_bytes)
        .file_name(file_name)
        .mime_str(mime)
        .map_err(|e| format!("创建 multipart 失败: {}", e))?;

    let form = reqwest::multipart::Form::new().part("media", part);

    let resp: WeChatUploadResponse = reqwest::Client::new()
        .post(&url)
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("上传素材失败: {}", e))?
        .json()
        .await
        .map_err(|e| format!("解析素材上传响应失败: {}", e))?;

    if let Some(code) = resp.errcode {
        if code != 0 {
            let msg = resp.errmsg.unwrap_or_default();
            return Err(format!("上传素材失败 ({}) {}", code, msg));
        }
    }

    resp.media_id.ok_or("上传素材返回 media_id 为空".into())
}

// ─── Markdown → WeChat HTML ───

pub fn markdown_to_wechat_html(markdown: &str) -> String {
    let mut html = String::new();
    let mut in_code_block = false;
    let mut code_block_content = String::new();
    let mut in_paragraph = false;
    let mut in_list = false;
    let mut in_olist = false;

    let lines: Vec<&str> = markdown.lines().collect();

    for line in &lines {
        let raw = line;

        // Code block
        if raw.trim().starts_with("```") {
            if in_code_block {
                let escaped = html_escape(&code_block_content);
                html.push_str(&format!("<pre><code>{}</code></pre>\n", escaped));
                code_block_content.clear();
                in_code_block = false;
            } else {
                flush_block(&mut html, &mut in_paragraph, &mut in_list, &mut in_olist);
                in_code_block = true;
            }
            continue;
        }

        if in_code_block {
            if !code_block_content.is_empty() {
                code_block_content.push('\n');
            }
            code_block_content.push_str(raw);
            continue;
        }

        // Thematic break
        let trimmed = raw.trim();
        if trimmed == "---" || trimmed == "***" || trimmed == "___" {
            flush_block(&mut html, &mut in_paragraph, &mut in_list, &mut in_olist);
            html.push_str("<hr />\n");
            continue;
        }

        // Empty line
        if trimmed.is_empty() {
            flush_block(&mut html, &mut in_paragraph, &mut in_list, &mut in_olist);
            continue;
        }

        // Headings
        if let Some(rest) = trimmed.strip_prefix("# ") {
            flush_block(&mut html, &mut in_paragraph, &mut in_list, &mut in_olist);
            html.push_str(&format!("<h2>{}</h2>\n", inline_to_html(rest)));
            continue;
        }
        if let Some(rest) = trimmed.strip_prefix("## ") {
            flush_block(&mut html, &mut in_paragraph, &mut in_list, &mut in_olist);
            html.push_str(&format!("<h2>{}</h2>\n", inline_to_html(rest)));
            continue;
        }
        if let Some(rest) = trimmed.strip_prefix("### ") {
            flush_block(&mut html, &mut in_paragraph, &mut in_list, &mut in_olist);
            html.push_str(&format!("<h3>{}</h3>\n", inline_to_html(rest)));
            continue;
        }
        if let Some(rest) = trimmed.strip_prefix("#### ") {
            flush_block(&mut html, &mut in_paragraph, &mut in_list, &mut in_olist);
            html.push_str(&format!("<h4>{}</h4>\n", inline_to_html(rest)));
            continue;
        }
        if let Some(rest) = trimmed.strip_prefix("##### ") {
            flush_block(&mut html, &mut in_paragraph, &mut in_list, &mut in_olist);
            html.push_str(&format!("<h5>{}</h5>\n", inline_to_html(rest)));
            continue;
        }
        if let Some(rest) = trimmed.strip_prefix("###### ") {
            flush_block(&mut html, &mut in_paragraph, &mut in_list, &mut in_olist);
            html.push_str(&format!("<h6>{}</h6>\n", inline_to_html(rest)));
            continue;
        }

        // Blockquote
        if trimmed.starts_with("> ") || trimmed == ">" {
            let content = trimmed.strip_prefix("> ").unwrap_or("");
            flush_block(&mut html, &mut in_paragraph, &mut in_list, &mut in_olist);
            html.push_str(&format!("<blockquote><p>{}</p></blockquote>\n", inline_to_html(content)));
            continue;
        }

        // Unordered list
        if trimmed.starts_with("- ") || trimmed.starts_with("* ") || trimmed.starts_with("+ ") {
            let content = trimmed.strip_prefix("- ")
                .or_else(|| trimmed.strip_prefix("* "))
                .or_else(|| trimmed.strip_prefix("+ "))
                .unwrap_or("");
            flush_paragraph(&mut html, &mut in_paragraph);
            if !in_list {
                flush_list(&mut html, &mut in_olist);
                html.push_str("<ul>\n");
                in_list = true;
            }
            html.push_str(&format!("  <li>{}</li>\n", inline_to_html(content)));
            continue;
        }

        // Ordered list
        if let Some(rest) = trimmed.strip_prefix(|c: char| c.is_ascii_digit()) {
            if let Some(content) = rest.strip_prefix(". ") {
                flush_paragraph(&mut html, &mut in_paragraph);
                if !in_olist {
                    flush_list(&mut html, &mut in_olist);
                    html.push_str("<ol>\n");
                    in_olist = true;
                }
                html.push_str(&format!("  <li>{}</li>\n", inline_to_html(content)));
                continue;
            }
        }

        // Regular paragraph
        flush_list_raw(&mut html, &mut in_list, &mut in_olist);
        if !in_paragraph {
            html.push_str("<p>");
            in_paragraph = true;
        } else {
            html.push_str("<br />\n");
        }
        html.push_str(&inline_to_html(raw));
    }

    // Close remaining open tags
    if in_paragraph {
        html.push_str("</p>\n");
    }
    flush_list_raw(&mut html, &mut in_list, &mut in_olist);
    if in_code_block {
        let escaped = html_escape(&code_block_content);
        html.push_str(&format!("<pre><code>{}</code></pre>\n", escaped));
    }

    html
}

// Separate flush functions to avoid borrow issues
fn flush_block(html: &mut String, in_paragraph: &mut bool, in_list: &mut bool, in_olist: &mut bool) {
    if *in_paragraph {
        html.push_str("</p>\n");
        *in_paragraph = false;
    }
    if *in_list {
        html.push_str("</ul>\n");
        *in_list = false;
    }
    if *in_olist {
        html.push_str("</ol>\n");
        *in_olist = false;
    }
}

fn flush_paragraph(html: &mut String, in_paragraph: &mut bool) {
    if *in_paragraph {
        html.push_str("</p>\n");
        *in_paragraph = false;
    }
}

fn flush_list(html: &mut String, in_olist: &mut bool) {
    if *in_olist {
        html.push_str("</ol>\n");
        *in_olist = false;
    }
}

fn flush_list_raw(html: &mut String, in_list: &mut bool, in_olist: &mut bool) {
    if *in_list {
        html.push_str("</ul>\n");
        *in_list = false;
    }
    if *in_olist {
        html.push_str("</ol>\n");
        *in_olist = false;
    }
}

fn inline_to_html(text: &str) -> String {
    let mut s = text.to_string();

    // Escape HTML first
    s = html_escape(&s);

    // Images: ![alt](url) → <img ... />
    // Use a placeholder approach
    let mut result = String::new();
    let mut rest = s.as_str();
    while let Some(pos) = rest.find("!\\[") {
        result.push_str(&rest[..pos]);
        rest = &rest[pos + 3..];
        // Find closing ](
        if let Some(close_bracket) = rest.find("](") {
            let alt = &rest[..close_bracket];
            rest = &rest[close_bracket + 2..];
            if let Some(close_paren) = rest.find(')') {
                let url = &rest[..close_paren];
                result.push_str(&format!("<img src=\"{}\" alt=\"{}\" />", url, alt));
                rest = &rest[close_paren + 1..];
                continue;
            }
        }
        result.push_str("![");
    }
    result.push_str(rest);
    s = result;

    // Links: [text](url)
    let mut result = String::new();
    let mut rest = s.as_str();
    while let Some(pos) = rest.find('[') {
        // Check if preceded by ! (already handled images)
        if pos > 0 && rest.as_bytes()[pos - 1] == b'!' {
            result.push_str(&rest[..=pos]);
            rest = &rest[pos + 1..];
            continue;
        }
        result.push_str(&rest[..pos]);
        rest = &rest[pos + 1..];
        if let Some(close_bracket) = rest.find(']') {
            let text = &rest[..close_bracket];
            rest = &rest[close_bracket + 1..];
            if rest.starts_with('(') {
                rest = &rest[1..];
                if let Some(close_paren) = rest.find(')') {
                    let url = &rest[..close_paren];
                    result.push_str(&format!("<a href=\"{}\">{}</a>", url, text));
                    rest = &rest[close_paren + 1..];
                    continue;
                }
            }
            result.push('[');
            result.push_str(text);
            result.push(']');
        } else {
            result.push('[');
        }
    }
    result.push_str(rest);
    s = result;

    // Bold: **text**
    {
        let mut r = String::new();
        let mut rest = s.as_str();
        let mut count = 0;
        while let Some(pos) = rest.find("**") {
            if count % 2 == 0 {
                r.push_str(&rest[..pos]);
                r.push_str("<strong>");
            } else {
                r.push_str(&rest[..pos]);
                r.push_str("</strong>");
            }
            rest = &rest[pos + 2..];
            count += 1;
        }
        r.push_str(rest);
        s = r;
    }

    // Strikethrough: ~~text~~
    {
        let mut r = String::new();
        let mut rest = s.as_str();
        let mut count = 0;
        while let Some(pos) = rest.find("~~") {
            if count % 2 == 0 {
                r.push_str(&rest[..pos]);
                r.push_str("<del>");
            } else {
                r.push_str(&rest[..pos]);
                r.push_str("</del>");
            }
            rest = &rest[pos + 2..];
            count += 1;
        }
        r.push_str(rest);
        s = r;
    }

    // Inline code: `code`
    {
        let mut r = String::new();
        let mut rest = s.as_str();
        let mut count = 0;
        while let Some(pos) = rest.find('`') {
            if count % 2 == 0 {
                r.push_str(&rest[..pos]);
                r.push_str("<code>");
            } else {
                r.push_str(&rest[..pos]);
                r.push_str("</code>");
            }
            rest = &rest[pos + 1..];
            count += 1;
        }
        r.push_str(rest);
        s = r;
    }

    s
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
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

// ─── Extract images ───

pub fn extract_images(markdown: &str) -> Vec<String> {
    let mut images = Vec::new();
    let chars: Vec<char> = markdown.chars().collect();
    let len = chars.len();
    let mut i = 0;
    while i + 3 < len {
        if chars[i] == '!' && chars[i + 1] == '[' {
            // Find closing ](
            let mut j = i + 2;
            while j < len && chars[j] != ']' {
                j += 1;
            }
            if j + 1 < len && chars[j] == ']' && chars[j + 1] == '(' {
                j += 2;
                let start = j;
                while j < len && chars[j] != ')' {
                    j += 1;
                }
                if j < len {
                    let path: String = chars[start..j].iter().collect();
                    let trimmed = path.trim().to_string();
                    if !trimmed.is_empty() && !trimmed.starts_with("http://") && !trimmed.starts_with("https://") {
                        images.push(trimmed);
                    }
                    i = j + 1;
                    continue;
                }
            }
        }
        i += 1;
    }
    images
}

pub fn replace_image_urls(markdown: &str, mappings: &[(String, String)]) -> String {
    let mut result = markdown.to_string();
    let mut sorted = mappings.to_vec();
    sorted.sort_by(|a, b| b.0.len().cmp(&a.0.len()));
    for (original, cdn_url) in &sorted {
        let from = format!("]({})", original);
        let to = format!("]({})", cdn_url);
        result = result.replace(&from, &to);
    }
    result
}

// ─── Draft & Publish ───

pub async fn create_draft(
    token: &str,
    title: &str,
    html_content: &str,
    thumb_media_id: &str,
    digest: &str,
    author: &str,
    _declare_original: bool,
) -> Result<String, String> {
    let url = format!("{}/draft/add?access_token={}", WECHAT_API_BASE, token);

    let body = json!({
        "articles": [{
            "title": title,
            "author": author,
            "digest": digest,
            "content": html_content,
            "content_source_url": "",
            "thumb_media_id": thumb_media_id,
            "need_open_comment": 1,
            "only_fans_can_comment": 0,
        }]
    });

    let resp: WeChatDraftResponse = reqwest::Client::new()
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("创建草稿失败: {}", e))?
        .json()
        .await
        .map_err(|e| format!("解析草稿响应失败: {}", e))?;

    if let Some(code) = resp.errcode {
        if code != 0 {
            let msg = resp.errmsg.unwrap_or_default();
            return Err(format!("创建草稿失败 ({}) {}", code, msg));
        }
    }

    resp.media_id.ok_or("创建草稿返回 media_id 为空".into())
}

pub async fn publish_draft(token: &str, media_id: &str) -> Result<String, String> {
    let url = format!("{}/draft/publish?access_token={}", WECHAT_API_BASE, token);

    let body = json!({ "media_id": media_id });

    let resp: WeChatPublishResponse = reqwest::Client::new()
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("发布草稿失败: {}", e))?
        .json()
        .await
        .map_err(|e| format!("解析发布响应失败: {}", e))?;

    if let Some(code) = resp.errcode {
        if code != 0 {
            let msg = resp.errmsg.unwrap_or_default();
            return Err(format!("发布失败 ({}) {}", code, msg));
        }
    }

    resp.publish_id.ok_or("发布返回 publish_id 为空".into())
}

// ─── Full publish flow ───

pub async fn publish_to_wechat(
    _article_id: &str,
    article_dir: &str,
    app_id: &str,
    app_secret: &str,
    markdown: &str,
    options: &PublishOptions,
    action: &str,
) -> Result<PublishResult, String> {
    // 1. Get access token
    let (token, _) = get_access_token(app_id, app_secret).await?;

    let mut processed_markdown = markdown.to_string();

    // 2. Upload cover image and get media_id
    let thumb_media_id = if let Some(ref cover) = options.cover_image {
        let p = Path::new(cover);
        if p.exists() {
            match upload_image_as_material(&token, cover).await {
                Ok(mid) => mid,
                Err(e) => {
                    eprintln!("上传封面失败: {}", e);
                    String::new()
                }
            }
        } else {
            String::new()
        }
    } else {
        // Try first image from markdown as cover
        let images = extract_images(markdown);
        if let Some(first_img) = images.first() {
            let img_path = if Path::new(first_img).is_absolute() {
                first_img.clone()
            } else {
                format!("{}/{}", article_dir, first_img)
            };
            if Path::new(&img_path).exists() {
                match upload_image_as_material(&token, &img_path).await {
                    Ok(mid) => mid,
                    Err(_) => String::new(),
                }
            } else {
                String::new()
            }
        } else {
            String::new()
        }
    };

    // 3. Upload images from markdown, replace with CDN URLs
    let local_images = extract_images(&processed_markdown);
    let mut image_mappings: Vec<(String, String)> = Vec::new();

    for img_path in &local_images {
        let full_path = if Path::new(img_path).is_absolute() {
            img_path.clone()
        } else {
            let dir = if article_dir.is_empty() { "".to_string() } else { format!("{}/", article_dir) };
            format!("{}{}", dir, img_path)
        };

        if Path::new(&full_path).exists() {
            match upload_image(&token, &full_path).await {
                Ok(cdn_url) => {
                    image_mappings.push((img_path.clone(), cdn_url));
                }
                Err(e) => {
                    eprintln!("跳过图片 {}: {}", img_path, e);
                }
            }
        } else {
            eprintln!("图片文件不存在: {}", full_path);
        }
    }

    if !image_mappings.is_empty() {
        processed_markdown = replace_image_urls(&processed_markdown, &image_mappings);
    }

    // 4. Convert to HTML
    let html_content = markdown_to_wechat_html(&processed_markdown);

    // 5. Digest
    let digest = options
        .summary
        .clone()
        .unwrap_or_else(|| extract_digest(markdown, 120));

    // 6. Author
    let author = options.author.as_deref().unwrap_or("");

    // 7. Create draft
    let media_id = create_draft(
        &token,
        &extract_title(markdown),
        &html_content,
        &thumb_media_id,
        &digest,
        author,
        false,
    )
    .await?;

    // 8. Publish or return draft
    if action == "publish" {
        match publish_draft(&token, &media_id).await {
            Ok(publish_id) => Ok(PublishResult {
                success: true,
                platform_article_id: Some(publish_id),
                platform_url: None,
                error_message: None,
                is_draft: false,
            }),
            Err(e) => Ok(PublishResult {
                success: true,
                platform_article_id: Some(media_id),
                platform_url: None,
                error_message: Some(format!("草稿已创建，发布失败: {}", e)),
                is_draft: true,
            }),
        }
    } else {
        Ok(PublishResult {
            success: true,
            platform_article_id: Some(media_id),
            platform_url: None,
            error_message: None,
            is_draft: true,
        })
    }
}

// ─── Helpers ───

fn extract_title(markdown: &str) -> String {
    for line in markdown.lines() {
        let trimmed = line.trim();
        if let Some(title) = trimmed.strip_prefix("# ") {
            return title.to_string();
        }
    }
    "无标题".to_string()
}

fn extract_digest(markdown: &str, max_len: usize) -> String {
    let mut plain = String::new();
    for line in markdown.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('#') || trimmed.starts_with("```") || trimmed.starts_with("> ") {
            continue;
        }
        if trimmed.starts_with("![") || trimmed.starts_with('[') {
            continue;
        }
        if trimmed.is_empty() {
            continue;
        }
        plain.push_str(trimmed);
        plain.push(' ');
        if plain.len() >= max_len {
            break;
        }
    }
    let cleaned: String = plain.chars().take(max_len).collect();
    if cleaned.len() >= max_len {
        format!("{}...", &cleaned[..max_len.saturating_sub(3)])
    } else {
        cleaned.trim().to_string()
    }
}
