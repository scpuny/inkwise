# 插图功能落地方案 — 技术设计文档

> 最后更新: 2026-06-28
> 状态: 设计评审
> 涉及模块: AI / 后端 / 前端 / 存储

---

## 目录

1. [背景与对齐决策](#1-背景与对齐决策)
2. [Provider 层改造](#2-provider-层改造)
3. [Rust 后端：图片生成引擎](#3-rust-后端图片生成引擎)
4. [SQLite 数据层扩展](#4-sqlite-数据层扩展)
5. [图片存储策略](#5-图片存储策略)
6. [前端 UI 改造](#6-前端-ui-改造)
7. [自动配图业务流](#7-自动配图业务流)
8. [图片位置确定算法](#8-图片位置确定算法)
9. [事件与状态管理](#9-事件与状态管理)
10. [文件改动清单](#10-文件改动清单)
11. [向后兼容与迁移](#11-向后兼容与迁移)

---

## 1. 背景与对齐决策

核心现状：主流 LLM 纯文本模型无法出图，不能让用户切换 AI 时割裂体验。需要做**文本写作 + 绘图能力双模块解耦、统一交互**。

### 已确认的架构决策

| 决策项 | 结论 | 理由 |
|---|---|---|
| Provider 模式 | 不新增独立 ImageProvider。`models` 从 `Vec<String>` 升级为 `Vec<ModelEntry>`，每个 entry 带 `capabilities[]` 标注 `"chat"` / `"image"` | 一个 provider（如 OpenAI）同时提供 GPT-4o（chat）和 DALL·E 3（image），不应拆成两个 provider |
| 图文模型独立选择 | AIBar 文本模型下拉与绘图模型下拉完全解耦，各自独立选择 | 用户可能文本用 DeepSeek、绘图用 DALL·E，跨 provider 组合 |
| 插图位置 | 不做文末追加。自动配图按章节结构化插入；手动触发在光标处插入 | 保持图文混排的意义 |
| 图片格式 | 存储和传输一律用 Markdown `![alt](path)`。TipTap 的 `@tiptap/extension-image` + `@tiptap/markdown` 已支持 Rich/Markdown 双向转换 | 零额外工作 |
| 关键词提取 | 配置开关（默认关闭），额外消耗一次 LLM token，用户可见开关 | |
| 本地绘图 | 当前不支持，仅云端 API | 写作者很少用本地模型 |
| 浮动工具栏 | 「生成插图」按钮放入「更多操作」面板，同时边界做 clamp | 常用后可考虑移到主栏 |

---

## 2. Provider 层改造

### 2.1 Rust 结构体变更（`src-tauri/src/store.rs`）

**新增类型：**

```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModelEntry {
    pub id: String,
    /// "chat" | "image" | "chat+image" 组合
    pub capabilities: Vec<String>,
    /// image 模型专用配置（chat 模型此字段为 None）
    pub image_config: Option<ImageModelConfig>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ImageModelConfig {
    /// 支持的尺寸列表，如 ["1024x1024", "1792x1024", "1024x1792"]
    pub sizes: Vec<String>,
    /// DALL·E 3 是否支持 quality 参数 (hd/standard)
    pub supports_quality: bool,
    /// DALL·E 3 是否支持 style 参数 (vivid/natural)
    pub supports_style: bool,
}
```

**原有 Provider 结构体修改：**

```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Provider {
    pub id: String,
    pub label: String,
    pub kind: String,
    pub base_url: Option<String>,
    pub api_key: Option<String>,
    // 改动：Vec<String> → Vec<ModelEntry>
    pub models: Vec<ModelEntry>,
    pub enabled: bool,
    pub builtin: bool,
}
```

### 2.2 前端类型同步（`src/lib/storage/providerModels.ts`）

```typescript
// 新增
export interface ModelEntry {
  id: string;
  capabilities: string[];    // "chat" | "image"
  imageConfig?: ImageModelConfig;
}

export interface ImageModelConfig {
  sizes: string[];
  supportsQuality: boolean;
  supportsStyle: boolean;
}

// Provider 类型 models 字段修改
export type Provider = {
  id: string;
  label: string;
  kind: ProviderKind;
  baseUrl?: string;
  apiKey?: string;
  models: ModelEntry[];     // 原来是 string[]
  enabled: boolean;
  builtin: boolean;
};
```

### 2.3 内置 Provider 默认值改造

`defaultModels(id)` 改为返回 `ModelEntry[]`：

```typescript
function defaultModels(id: string): ModelEntry[] {
  const map: Record<string, ModelEntry[]> = {
    openai: [
      { id: "gpt-4o", capabilities: ["chat"], imageConfig: undefined },
      { id: "gpt-4o-mini", capabilities: ["chat"], imageConfig: undefined },
      {
        id: "dall-e-3",
        capabilities: ["image"],
        imageConfig: {
          sizes: ["1024x1024", "1792x1024", "1024x1792"],
          supportsQuality: true,
          supportsStyle: true,
        },
      },
    ],
    anthropic: [
      { id: "claude-3.5-sonnet", capabilities: ["chat"], imageConfig: undefined },
      { id: "claude-3-haiku", capabilities: ["chat"], imageConfig: undefined },
    ],
    deepseek: [
      { id: "deepseek-chat", capabilities: ["chat"], imageConfig: undefined },
      { id: "deepseek-coder", capabilities: ["chat"], imageConfig: undefined },
    ],
  };
  return map[id] ?? [];
}
```

### 2.4 辅助函数

```typescript
// 从所有启用的 provider 中筛选出支持 image 的模型列表
export function getImageModelsSync(): {
  id: string;
  label: string;
  provider: string;
  config: ImageModelConfig;
}[] {
  const providers = getProvidersSync();
  const result: {
    id: string;
    label: string;
    provider: string;
    config: ImageModelConfig;
  }[] = [];
  for (const p of providers) {
    if (!p.enabled) continue;
    for (const m of p.models) {
      if (m.capabilities.includes("image") && m.imageConfig) {
        result.push({
          id: m.id,
          label: m.id,
          provider: p.label,
          config: m.imageConfig,
        });
      }
    }
  }
  return result;
}
```

---

## 3. Rust 后端：图片生成引擎

### 3.1 新增模块 `src-tauri/src/image_gen.rs`

```rust
use serde::{Deserialize, Serialize};
use std::time::Duration;

/// 绘图请求参数（前端传入）
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageGenRequest {
    pub provider_id: String,
    pub model: String,
    pub prompt: String,
    pub negative_prompt: Option<String>,
    pub size: Option<String>,
    pub quality: Option<String>,    // DALL·E 3: "hd" | "standard"
    pub style: Option<String>,      // DALL·E 3: "vivid" | "natural"
    pub n: Option<u8>,              // 生成数量 (1-5)
}

/// 绘图响应
#[derive(Debug, Serialize, Deserialize)]
pub struct ImageGenResult {
    pub data: Vec<ImageData>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImageData {
    pub b64_json: Option<String>,
    pub url: Option<String>,
    pub revised_prompt: Option<String>,
}
```

### 3.2 分发函数

```rust
pub async fn generate_image(
    client: &reqwest::Client,
    config: &store::ProviderConfig,
    req: &ImageGenRequest,
) -> Result<ImageGenResult, String> {
    match config.kind.as_str() {
        "openai" | "custom" => openai_image_gen(client, config, req).await,
        // 后续扩展：通义万相、文心一格等
        _ => Err(format!("不支持的 provider 类型: {}", config.kind)),
    }
}
```

### 3.3 OpenAI DALL·E 3 实现

```rust
async fn openai_image_gen(
    client: &reqwest::Client,
    config: &store::ProviderConfig,
    req: &ImageGenRequest,
) -> Result<ImageGenResult, String> {
    let url = format!(
        "{}/images/generations",
        config.base_url.trim_end_matches('/')
    );

    let mut body = serde_json::json!({
        "model": req.model,
        "prompt": req.prompt,
        "n": req.n.unwrap_or(1),
        "response_format": "b64_json",
    });
    if let Some(ref size) = req.size {
        body["size"] = serde_json::json!(size);
    }
    if let Some(ref quality) = req.quality {
        body["quality"] = serde_json::json!(quality);
    }
    if let Some(ref style) = req.style {
        body["style"] = serde_json::json!(style);
    }

    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", config.api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .timeout(Duration::from_secs(60))
        .send()
        .await
        .map_err(|e| format!("图片生成请求失败: {}", e))?;

    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|e| format!("读取响应失败: {}", e))?;

    if !status.is_success() {
        return Err(format!("图片 API 错误 ({}): {}\n响应: {}", status, status, text));
    }

    let parsed: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("解析响应失败: {}", e))?;

    let data = parsed["data"]
        .as_array()
        .ok_or("API 返回中缺少 data 字段")?
        .iter()
        .map(|item| ImageData {
            b64_json: item["b64_json"].as_str().map(|s| s.to_string()),
            url: item["url"].as_str().map(|s| s.to_string()),
            revised_prompt: item["revised_prompt"].as_str().map(|s| s.to_string()),
        })
        .collect();

    Ok(ImageGenResult { data })
}
```

### 3.4 Tauri Command + 图片保存（`src-tauri/src/lib.rs`）

```rust
mod image_gen;

/// 生成图片并保存到本地
#[tauri::command]
async fn generate_image(
    state: tauri::State<'_, AppState>,
    provider_id: String,
    model: String,
    prompt: String,
    negative_prompt: Option<String>,
    size: Option<String>,
    quality: Option<String>,
    style: Option<String>,
    n: Option<u8>,
    article_id: String,
    project_folder: Option<String>,
) -> Result<Vec<ImageSavedResult>, String> {
    // 1. 组装 provider 配置
    let (provider_config, client) = {
        let store = state.store.lock().unwrap();
        let providers = store.load_providers();
        let provider = providers
            .iter()
            .find(|p| p.id == provider_id)
            .ok_or_else(|| format!("未找到提供商: {}", provider_id))?
            .clone();
        let config = ProviderConfig {
            id: provider.id,
            kind: provider.kind,
            base_url: provider.base_url.unwrap_or_else(|| {
                "https://api.openai.com/v1".into()
            }),
            api_key: provider.api_key.ok_or("未配置 API Key")?,
            model: model.clone(),
        };
        (config, reqwest::Client::new())
    };

    // 2. 调用图片生成 API
    let req = image_gen::ImageGenRequest {
        provider_id,
        model,
        prompt,
        negative_prompt,
        size,
        quality,
        style,
        n,
    };

    let result = image_gen::generate_image(&client, &provider_config, &req).await?;

    // 3. 图片保存到本地
    save_images_to_disk(&state, &result, &req, &article_id, &project_folder).await
}
```

### 3.5 图片保存逻辑

```rust
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageSavedResult {
    pub local_path: String,
    pub alt_text: String,
    pub revised_prompt: Option<String>,
}

async fn save_images_to_disk(
    state: &tauri::State<'_, AppState>,
    gen_result: &image_gen::ImageGenResult,
    req: &image_gen::ImageGenRequest,
    article_id: &str,
    project_folder: &Option<String>,
) -> Result<Vec<ImageSavedResult>, String> {
    let assets_dir = resolve_assets_dir(state, article_id, project_folder)?;
    std::fs::create_dir_all(&assets_dir)
        .map_err(|e| format!("创建图片目录失败: {}", e))?;

    let mut saved = Vec::new();
    for (i, img) in gen_result.data.iter().enumerate() {
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis();
        let filename = format!("img_{}_{}.png", timestamp, i);
        let filepath = assets_dir.join(&filename);

        if let Some(ref b64) = img.b64_json {
            use base64::Engine;
            let bytes = base64::engine::general_purpose::STANDARD
                .decode(b64)
                .map_err(|e| format!("Base64 解码失败: {}", e))?;
            std::fs::write(&filepath, &bytes)
                .map_err(|e| format!("保存图片失败: {}", e))?;
        } else if let Some(ref url) = img.url {
            let bytes = reqwest::get(url)
                .await
                .map_err(|e| format!("下载图片失败: {}", e))?
                .bytes()
                .await
                .map_err(|e| format!("读取图片响应失败: {}", e))?;
            std::fs::write(&filepath, &bytes)
                .map_err(|e| format!("保存图片失败: {}", e))?;
        }

        let local_path = if let Some(ref folder) = project_folder {
            format!(".inkwise_assets/{}/{}", article_id, filename)
        } else {
            filepath.to_string_lossy().to_string()
        };

        saved.push(ImageSavedResult {
            local_path,
            alt_text: format!("插图 {}", i + 1),
            revised_prompt: img.revised_prompt.clone(),
        });
    }

    Ok(saved)
}

fn resolve_assets_dir(
    state: &tauri::State<'_, AppState>,
    article_id: &str,
    project_folder: &Option<String>,
) -> Result<std::path::PathBuf, String> {
    if let Some(folder) = project_folder {
        Ok(std::path::PathBuf::from(folder)
            .join(".inkwise_assets")
            .join(article_id))
    } else {
        let store = state.store.lock().unwrap();
        Ok(store.articles_dir().join("_assets").join(article_id))
    }
}
```

---

## 4. SQLite 数据层扩展

### 4.1 新增表（`src-tauri/src/db.rs`）

`initialize_schema()` 中新增：

```sql
CREATE TABLE IF NOT EXISTS article_images (
    id          TEXT PRIMARY KEY,
    article_id  TEXT NOT NULL REFERENCES articles(id),
    local_path  TEXT NOT NULL,
    alt_text    TEXT NOT NULL DEFAULT '',
    draw_prompt TEXT NOT NULL DEFAULT '',
    style       TEXT,
    size        TEXT,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_article_images_article
    ON article_images(article_id);
```

### 4.2 数据行类型

```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ArticleImageRow {
    pub id: String,
    pub article_id: String,
    pub local_path: String,
    pub alt_text: String,
    pub draw_prompt: String,
    pub style: Option<String>,
    pub size: Option<String>,
    pub sort_order: i64,
    pub created_at: i64,
}
```

### 4.3 CRUD 方法

```rust
impl Database {
    pub fn save_article_images(&self, images: &[ArticleImageRow]) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        // 先删后插，保证与文章同步
        if let Some(first) = images.first() {
            conn.execute(
                "DELETE FROM article_images WHERE article_id = ?1",
                params![first.article_id],
            )?;
        }
        let mut stmt = conn.prepare(
            "INSERT INTO article_images (id, article_id, local_path, alt_text, draw_prompt, style, size, sort_order, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        )?;
        for img in images {
            stmt.execute(params![
                img.id, img.article_id, img.local_path, img.alt_text,
                img.draw_prompt, img.style, img.size, img.sort_order, img.created_at,
            ])?;
        }
        Ok(())
    }

    pub fn get_article_images(&self, article_id: &str) -> SqlResult<Vec<ArticleImageRow>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, article_id, local_path, alt_text, draw_prompt, style, size, sort_order, created_at
             FROM article_images WHERE article_id = ?1 ORDER BY sort_order ASC",
        )?;
        let rows = stmt.query_map(params![article_id], |row| {
            Ok(ArticleImageRow {
                id: row.get(0)?,
                article_id: row.get(1)?,
                local_path: row.get(2)?,
                alt_text: row.get(3)?,
                draw_prompt: row.get(4)?,
                style: row.get(5)?,
                size: row.get(6)?,
                sort_order: row.get(7)?,
                created_at: row.get(8)?,
            })
        })?;
        rows.collect()
    }

    pub fn delete_article_images(&self, article_id: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "DELETE FROM article_images WHERE article_id = ?1",
            params![article_id],
        )?;
        Ok(())
    }
}
```

### 4.4 FTS5 图文混合检索方案

**不做新 FTS5 表**。将图片描述文本在保存文章时拼入 `description` 字段，复用现有 `articles_fts`：

```rust
pub fn save_article_with_images(
    &self,
    article: &ArticleRow,
    images: &[ArticleImageRow],
) -> SqlResult<()> {
    let img_descs: Vec<String> = images
        .iter()
        .filter(|img| !img.alt_text.is_empty() || !img.draw_prompt.is_empty())
        .map(|img| {
            let text = if !img.alt_text.is_empty() {
                &img.alt_text
            } else {
                &img.draw_prompt[..std::cmp::min(50, img.draw_prompt.len())]
            };
            format!("[图片: {}]", text)
        })
        .collect();

    let mut enriched = article.description.clone();
    if !img_descs.is_empty() {
        if !enriched.is_empty() {
            enriched.push(' ');
        }
        enriched.push_str(&img_descs.join(" "));
    }

    // 使用 enriched 替代 article.description 写入 FTS5
    // 其他字段不变
    // ...
}
```

### 4.5 Tauri Commands

```rust
#[tauri::command]
fn save_article_images(
    state: tauri::State<AppState>,
    images: Vec<db::ArticleImageRow>,
) -> Result<(), String> {
    let db_opt = state.db.lock().unwrap();
    let db = db_opt.as_ref().ok_or("数据库未初始化")?;
    db.save_article_images(&images).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_article_images(
    state: tauri::State<AppState>,
    article_id: String,
) -> Result<Vec<db::ArticleImageRow>, String> {
    let db_opt = state.db.lock().unwrap();
    let db = db_opt.as_ref().ok_or("数据库未初始化")?;
    db.get_article_images(&article_id).map_err(|e| e.to_string())
}
```

---

## 5. 图片存储策略

### 5.1 路径规则

```
情形 1：已绑定项目文件夹（linkedFolder）
  {linkedFolder}/.inkwise_assets/{article_id}/img_{timestamp}_{n}.png

情形 2：未绑定项目（兜底）
  {data_dir}/articles/_assets/{article_id}/img_{timestamp}_{n}.png
```

使用 `.inkwise_assets` 隐藏目录，不污染用户文档目录。

### 5.2 Markdown 引用

文章内容中存储的图片链接格式：

```markdown
![文章标题配图](.inkwise_assets/{article_id}/img_1712345678_0.png)
```

- **编辑器内**：TipTap 自动识别并渲染，无需额外处理
- **导出时**：如需 base64 嵌入或上传发布平台，从相对路径解析出绝对路径再处理

### 5.3 清理

- 删除文章时同步：`DELETE FROM article_images WHERE article_id = ?` + 递归删除对应图片目录
- 图片文件冷热分离：数据库仅存路径，不存图片二进制，保持数据库轻量

---

## 6. 前端 UI 改造

### 6.1 AIBar 新增折叠绘图配置面板（`src/components/agent/AIBar.tsx`）

在现有 composer-meta 区域新增一个可折叠的「插图设置」区块：

```
┌─ AIBar ────────────────────────────────────────────┐
│ [输入框]                                  [发送]   │
│                                                     │
│ ┌─ composer-meta ────────────────────────────────┐  │
│ │ [模型: gpt-4o] [推理: 中] [Token: 2048]         │  │
│ │ [技能: 通用] [更多 ⋯]                           │  │
│ │                                                  │  │
│ │ ── 插图设置 ── [▼ 折叠]                        │  │  ← 新增
│ │  ☐ 自动配图                                      │  │
│ │  绘图模型: [dall-e-3 ▼]                         │  │
│ │  风格:    [科技简约扁平插画 ▼]                   │  │
│ │  尺寸:    [16:9 ▼]                              │  │
│ │  数量:    [3 ▼]                                 │  │
│ │  ─ 高级设置 [展开] ─                            │  │
│ │   负面 prompt: [低画质, 模糊, 畸形...]           │  │
│ └──────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

**状态管理**（延续项目现有模式，不使用新 Context，通过 `window` + eventBus）：

```typescript
// AIBar 内管理绘图配置状态
const [drawEnabled, setDrawEnabled] = useState(false);
const [drawModel, setDrawModel] = useState(() => {
  const models = getImageModelsSync();
  return models.length > 0 ? models[0].id : "";
});
const [drawStyle, setDrawStyle] = useState("科技简约扁平插画");
const [drawSize, setDrawSize] = useState("16:9");
const [drawCount, setDrawCount] = useState(3);
const [drawNegativePrompt, setDrawNegativePrompt] = useState("");

// 状态变化时同步到 window，供业务逻辑读取
useEffect(() => {
  (window as any).__drawConfig = {
    enabled: drawEnabled,
    model: drawModel,
    style: drawStyle,
    size: drawSize,
    count: drawCount,
    negativePrompt: drawNegativePrompt,
  };
}, [drawEnabled, drawModel, drawStyle, drawSize, drawCount, drawNegativePrompt]);
```

**绘图模型下拉**只列出 `getImageModelsSync()` 的模型。选中时需记录 `providerId`，传给 `generate_image` 命令。

### 6.2 InlineToolbar「生成插图」按钮（`src/components/editor/InlineToolbar.tsx`）

在 `secondary` 列表尾部追加：

```tsx
{/* 分隔线 */}
<div className="inline-toolbar__divider" />

{/* 生成插图 */}
<button
  className="inline-toolbar__more-item"
  onClick={() => handleGenerateImage(selectedText, selectionRange)}
  disabled={isProcessing}
  title="生成插图"
>
  🖼️
  <span>生成插图</span>
</button>
```

触发的业务逻辑：

```typescript
const handleGenerateImage = useCallback(
  async (text: string, selRange: { from: number; to: number } | null) => {
    if (!text) return;
    setVisible(false);

    const drawCfg = (window as any).__drawConfig;
    if (!drawCfg?.model) {
      // 提示用户先配置绘图模型
      return;
    }

    const editor = (window as any).editorInstance?.editor;
    const articleId = /* 从 appStore 获取 */;
    const collectionId = /* 从 appStore 获取 */;
    const projectFolder = /* 从 collection 获取 linkedFolder */;

    try {
      const result = await invoke("generate_image", {
        providerId: extractProviderId(drawCfg.model),
        model: drawCfg.model,
        prompt: text + (drawCfg.style ? `, ${drawCfg.style}` : ""),
        negativePrompt: drawCfg.negativePrompt || null,
        size: drawCfg.size,
        n: 1,
        articleId,
        projectFolder,
      });

      if (result && result.length > 0) {
        const img = result[0];
        const markdown = `![${img.altText}](${img.localPath})`;
        // 编辑器光标处插入
        editor?.chain().focus().insertContent(markdown).run();
      }
    } catch (e) {
      console.error("生成插图失败:", e);
    }
  },
  [/* deps */],
);
```

### 6.3 浮动工具栏边界 clamp（`InlineToolbar.tsx`）

位置计算处（第 116-136 行）加 clamp：

```typescript
const toolbarWidth = toolbarRef.current?.offsetWidth || 200;
const minLeft = 8;
const maxLeft = containerRect.width - toolbarWidth - 8;
const clampedLeft = Math.max(minLeft, Math.min(left, maxLeft));

setPosition({
  top: rect.top - containerRect.top - 40,
  left: clampedLeft,
});
```

### 6.4 底部栏常驻按钮

在 AIBar 的 `composer-meta__actions` 区域（与 `MoreHorizontal` 同级）新增：

```tsx
<button
  className="composer-action-trigger"
  title="选中文字生成插图"
  onClick={handleQuickImageGen}
>
  🖼️
</button>
```

`handleQuickImageGen` 读取 `__lastEditorSelection` 获取选中文本，走与 InlineToolbar 相同的生成流程。

---

## 7. 自动配图业务流

### 7.1 完整流程图

```
用户提交写作请求（勾选「自动配图」）
       │
       ▼
 文本 LLM 生成文章 (generateFullArticleWithTools / writeAllSections)
       │
       ▼
 文章保存到 DB
       │
       ├── drawEnabled = false → 流程结束，纯文本
       │
       ▼  drawEnabled = true
 [关键词提取]（额外一次 LLM 调用，提示词固化）
       │
       ▼
 返回 N 组 (keywords, section_title, alt_text)
       │
       ▼
 对每组并发调用 generate_image（N 张图并行生成）
       │
       ▼
 图片保存到本地 .inkwise_assets/
       │
       ▼
 insertImagesIntoArticle() — 结构化插入文章
       │
       ▼
 保存图片记录到 article_images 表
       │
       ▼
 更新文章内容（含图片 Markdown）
       │
       ▼
 编辑器刷新，展示图文混排
```

### 7.2 关键词提取 Prompt（固化，默认用户不可见）

```typescript
const IMAGE_EXTRACT_PROMPT = `你是一个配图策划助手。根据下面这篇文章，提取绘画关键词。

要求：
1. 提取 {{count}} 组关键词，分别适配文章的不同章节
2. 每组包含：
   - section_title: 对应文章中的章节标题（必须与原文完全一致）
   - keywords: 英文绘图关键词，描述画面构图、主体、环境、色调、风格
   - alt_text: 中文简洁描述（用于图片 alt）
3. 按文章出现顺序排列
4. 只输出 JSON 数组，不要多余文字

输出格式：
[
  {"section_title": "引言", "keywords": "...", "alt_text": "..."},
  {"section_title": "核心分析", "keywords": "...", "alt_text": "..."}
]`;
```

### 7.3 与编辑器流程的集成点（`EditorPane.tsx`）

在 `writeAllSections` 成功返回后（第 276-291 行），添加异步回调：

```typescript
// writeAllSections 执行完毕后
if (allSectionsWritten && drawConfig.enabled) {
  autoGenerateImages(articleId, currentContent, collectionId).catch(console.warn);
}

async function autoGenerateImages(
  articleId: string,
  content: string,
  collectionId: string,
) {
  const drawCfg = (window as any).__drawConfig;
  if (!drawCfg?.enabled || !drawCfg?.model) return;

  emit("image-gen-start", { articleId, total: drawCfg.count });

  // 1. LLM 提取配图计划
  const imagePlans = await extractImageKeywords(content, drawCfg.count);

  // 2. 批量生成图片（并行）
  const savedImages = await Promise.all(
    imagePlans.map((plan) =>
      invoke("generate_image", {
        providerId: extractProviderId(drawCfg.model),
        model: drawCfg.model,
        prompt: plan.keywords + (drawCfg.style ? `, ${drawCfg.style}` : ""),
        negativePrompt: drawCfg.negativePrompt || null,
        size: drawCfg.size,
        n: 1,
        articleId,
        projectFolder: /* 从 collection 获取 */,
      }).then((res) => ({
        localPath: res[0].localPath,
        altText: plan.alt_text,
        targetSectionTitle: plan.section_title,
      })),
    ),
  );

  // 3. 插入图片到文章
  const newContent = insertImagesIntoArticle(content, savedImages);
  await saveArticleContent(articleId, newContent);
  contentRef.current = newContent;
  setEditorContent(newContent);

  // 4. 保存图片记录到数据库
  await saveImageRecords(articleId, savedImages);

  emit("image-gen-complete", { articleId, count: savedImages.length });
}
```

> **关键行为**：自动配图在文章生成后异步执行，不阻塞用户进入编辑状态。通过 eventBus 事件通知 UI 更新进度。

### 7.4 `draw.ts` 新增模块（`src/lib/ai/draw.ts`）

```typescript
// draw.ts — 插图自动配图业务逻辑

/**
 * 调用 LLM 提取配图关键词
 */
export async function extractImageKeywords(
  articleContent: string,
  count: number,
): Promise<{ section_title: string; keywords: string; alt_text: string }[]> {
  const provider = getProvider();
  if (!provider) throw new Error("请先配置 AI 提供商");

  const prompt = IMAGE_EXTRACT_PROMPT.replace("{{count}}", String(count));
  const messages: ChatMessage[] = [
    { role: "system", content: prompt },
    { role: "user", content: articleContent.slice(0, 8000) },
  ];

  try {
    const text = await sendChatStream({
      providerId: provider.id,
      model: resolveModel() || provider.models[0],
      messages,
      temperature: 0.3,
      maxTokens: 2000,
    });
    return JSON.parse(extractJson(text));
  } catch {
    // 提取失败时返回空，跳过配图
    return [];
  }
}

/**
 * 将图片插入文章对应章节
 */
export function insertImagesIntoArticle(
  markdown: string,
  images: { path: string; altText: string; targetSectionTitle?: string }[],
): string {
  let result = markdown;
  for (const img of images) {
    if (img.targetSectionTitle) {
      const escaped = img.targetSectionTitle.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&",
      );
      const regex = new RegExp(
        `^(#{1,6})\\s+${escaped}\\s*$`,
        "m",
      );
      const match = regex.exec(result);
      if (match) {
        const imgMarkdown = `\n\n![${img.altText}](${img.path})\n`;
        result = result.replace(match[0], match[0] + imgMarkdown);
        continue;
      }
    }
    // 兜底：插入文末（理论上不应触发）
    result = result + `\n\n![${img.altText}](${img.path})\n`;
  }
  return result;
}

/** 从 LLM 响应中提取 JSON 数组 */
function extractJson(text: string): string {
  const match = text.match(/\[[\s\S]*\]/);
  return match ? match[0] : "[]";
}
```

---

## 8. 图片位置确定算法

### 8.1 按结构化标题匹配（主策略）

```
输入：文章 Markdown + N 组 (section_title, keywords, alt_text)
  │
  ▼
提取所有标题行：/^(#{1,6})\s+(.+)$/gm
  │
  ▼
对每组图片：
  ├── section_title 完全匹配某个标题 → 图片插入该标题行后
  ├── 模糊匹配（包含关系）→ 取匹配度最高的
  └── 无匹配 → 降级到关键词文本匹配
```

### 8.2 按关键词文本匹配（降级策略）

```
对未匹配的图片：
  ↓
在文章中搜索 keywords 中出现的高频词
  ↓
将图片插入到首次出现该词附近的段落之后
  ↓
仍然找不到 → 按顺序均分到文章中段
```

### 8.3 手动模式（模式 B）

- 编辑器中选中文本 → `editor.state.selection` 获取 `{from, to}` → 生成单张图
- `editor.chain().focus().insertContent("![alt](path)").run()`
- 已完整支持，无需额外算法

---

## 9. 事件与状态管理

### 9.1 新增 eventBus 事件（`src/lib/events/events.ts`）

```typescript
export interface ImageGenStartDetail {
  articleId: string;
  total: number;    // 计划生成几张
}

export interface ImageGenProgressDetail {
  articleId: string;
  index: number;
  total: number;
  path: string;
}

export interface ImageGenCompleteDetail {
  articleId: string;
  count: number;    // 实际成功几张
}

// EventBusMap 扩展
"image-gen-start": ImageGenStartDetail;
"image-gen-progress": ImageGenProgressDetail;
"image-gen-complete": ImageGenCompleteDetail;
```

### 9.2 全局绘图配置

```typescript
// 定义在 global.d.ts 或 providerModels.ts
declare global {
  interface Window {
    __drawConfig?: {
      enabled: boolean;
      model: string;
      style: string;
      size: string;
      count: number;
      negativePrompt: string;
    };
  }
}
```

不引入新 React Context，延续项目现有的 `window.*` + eventBus 模式。

---

## 10. 文件改动清单

### Rust 后端（新增 ~450 行，修改 ~50 行）

| 文件 | 改动类型 | 内容 |
|---|---|---|
| `src-tauri/Cargo.toml` | 修改 | 添加 `base64` crate 依赖 |
| `src-tauri/src/store.rs` | 修改 | `Provider.models`: `Vec<String>` → `Vec<ModelEntry>`；新增 `ModelEntry`、`ImageModelConfig` 结构体 |
| `src-tauri/src/image_gen.rs` | **新增** | 图片生成引擎：`generate_image()`, `openai_image_gen()`, 请求/响应结构体 |
| `src-tauri/src/db.rs` | 修改 | `initialize_schema()` 新增 `article_images` 表 + 索引；新增 `ArticleImageRow`、`save_article_images()`、`get_article_images()`、`delete_article_images()` |
| `src-tauri/src/lib.rs` | 修改 | 注册 `mod image_gen`；新增 `generate_image`、`save_article_images`、`get_article_images` 三个 Tauri commands；`ImageSavedResult` 导出 |

### 前端 TypeScript/React（新增 ~200 行，修改 ~150 行）

| 文件 | 改动类型 | 内容 |
|---|---|---|
| `src/lib/storage/providerModels.ts` | 修改 | `Provider.models` 类型改为 `ModelEntry[]`；新增接口；`getImageModelsSync()`；`defaultModels()` 返回 `ModelEntry[]`；`getEnabledModelsSync()` 过滤只返回 `"chat"` 模型；`migrateLegacyModels()` 兼容旧数据 |
| `src/lib/events/events.ts` | 修改 | 新增图片生成事件类型 |
| `src/lib/ai/draw.ts` | **新增** | `extractImageKeywords()`, `insertImagesIntoArticle()`, `autoGenerateImages()` |
| `src/components/agent/AIBar.tsx` | 修改 | 折叠绘图配置面板；状态同步到 `window.__drawConfig`；常驻「生成插图」按钮 |
| `src/components/editor/InlineToolbar.tsx` | 修改 | 「更多操作」中新增「生成插图」按钮；位置计算加 clamp |
| `src/components/editor/EditorPane.tsx` | 修改 | `writeAllSections` 完成后异步调用 `autoGenerateImages()` |

---

## 11. 向后兼容与迁移

### 11.1 Provider 数据迁移

旧格式：`models: string[]`（如 `["gpt-4o", "gpt-4o-mini"]`）

在 `src/lib/storage/providerModels.ts` 的模块初始化时执行转换：

```typescript
function migrateLegacyModels(): void {
  const raw = localStorage.getItem("inkwise:providers");
  if (!raw) return;
  try {
    const providers = JSON.parse(raw) as any[];
    let changed = false;
    for (const p of providers) {
      if (
        Array.isArray(p.models) &&
        p.models.length > 0 &&
        typeof p.models[0] === "string"
      ) {
        p.models = (p.models as string[]).map((id) => ({
          id,
          capabilities: ["chat"],
          imageConfig: undefined,
        }));
        changed = true;
      }
    }
    if (changed) {
      localStorage.setItem("inkwise:providers", JSON.stringify(providers));
    }
  } catch {
    /* ignore */
  }
}
```

Tauri 后端 `load_providers()` 同样检测 `models[0]` 是否为字符串，自动做兼容转换。

### 11.2 纯文本用户不感知

- 不配置绘图模型 → `drawEnabled` 默认 false → `autoGenerateImages` 不触发 → 纯文本写作流程不变
- `article_images` 表对无插图文章保持空行
- 旧 provider 数据自动迁移

### 11.3 降级保障

| 故障场景 | 行为 | 用户感知 |
|---|---|---|
| 绘图 API 调用失败 | 记录错误，不阻塞主流程 | 文章保持纯文本，无图片 |
| 关键词提取失败 | 返回空数组，跳过配图 | 文章保持纯文本 |
| 图片保存磁盘满 | catch 异常，跳过该图 | 少一张图，不崩溃 |
| 未绑定项目文件夹 | 写入兜底路径 | 图片正常保存 |
| 文章删除 | 同步清理图片文件和数据库记录 | 无残留 |

---

## 附：实现顺序建议

```
Phase 1（基础层，可独立测试）:
  1. store.rs: ModelEntry + ImageModelConfig 结构体
  2. providerModels.ts: 类型迁移 + 兼容函数
  3. db.rs: article_images 表 + CRUD 方法
  4. Provider 数据迁移逻辑

Phase 2（图片生成管线）:
  5. image_gen.rs: 图片生成引擎（OpenAI DALL·E 3）
  6. lib.rs: generate_image Tauri command + 图片保存

Phase 3（前端 UI）:
  7. AIBar: 折叠绘图配置面板 + 状态同步
  8. InlineToolbar: 「生成插图」按钮 + clamp
  9. AIBar: 常驻「生成插图」按钮

Phase 4（自动配图业务流）:
  10. draw.ts: 关键词提取 + insertImagesIntoArticle
  11. EditorPane: 自动配图流程集成
  12. eventBus 事件集成

Phase 5（打磨）:
  13. FTS5 图片描述检索验证
  14. 文章删除时清理图片文件
  15. 错误处理和日志完善
```
