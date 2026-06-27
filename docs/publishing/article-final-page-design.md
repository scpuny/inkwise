# 成品页面与第三方发布 — 设计文档

> 版本: v2.0
> 日期: 2026-06-27
> 状态: 已实现（v1.2.0-v1.4.0）

---

## 一、概述

为 Inkwise 增加文章完成后的成品预览页面（ArticleFinalPage），并支持向第三方平台（微信公众号优先）发布文章。

### 核心流程

```
写作完成 (phase === "complete")
       │
       ▼
点击文章 → 进入成品页面 (ArticleFinalPage)
       │
       ├── [返回编辑] → 切换到 EditorPane 继续修改
       │
       └── [发布] → PublishDialog → 选择平台 → 配置选项 → 发布
                          │
                          ├── 上传图片到平台 CDN
                          ├── 创建草稿 (draft/add)
                          └── [用户确认] → 发布草稿 (draft/publish)
```

### 完成标准

1. 用户点击已完成文章，展示成品页面（非编辑器）
2. 成品页面左侧展示文章信息 + 蓝图进度 + 发布状态
3. 成品页面右侧展示文章 Markdown 渲染的阅读视图
4. 设置面板中可配置第三方平台的 appId / appSecret
5. 支持半自动发布：创建草稿 → 用户确认 → 正式发布
6. 文章内的图片自动上传到平台 CDN 并替换引用

---

## 二、成品页面（ArticleFinalPage）

### 2.1 触发条件与路由

- **触发**：侧边栏点击文章时，判断 `blueprint.phase === "complete"` → 渲染 `ArticleFinalPage`
- **切换编辑**：页面顶栏"返回编辑"按钮 → 暂时将 phase 切回 `"reviewing"` → 渲染 `EditorPane`
- **无文章时**：`ArticleFinalPage` 不渲染，保持现有 StartupSplash

### 2.2 组件结构

```
ArticleFinalPage
├── FinalTopBar                  ← 顶栏操作区
│   ├── 返回编辑按钮
│   ├── 发布按钮（有未发布平台时高亮）
│   └── 更多操作（下拉菜单）
│       ├── 标记为未完成
│       └── 导出 Markdown
│
├── FinalBody (两栏 flex/grid)
│   ├── FinalSidePanel (左侧, ~280px)
│   │   ├── ArticleInfoPanel        ← 文章基本信息
│   │   │   ├── 标题
│   │   │   ├── 字数 / 创建时间 / 更新时间
│   │   │   ├── 标签列表
│   │   │   └── 封面图预览
│   │   │
│   │   ├── BlueprintProgress       ← 写作蓝图进度
│   │   │   ├── 各章节状态列表（✅ 已完成）
│   │   │   └── 总进度条
│   │   │
│   │   └── PublishStatusPanel      ← 各平台发布状态
│   │       ├── 微信公众号: 已发布 / 草稿 / 未发布
│   │       └── 今日头条: 未发布
│   │
│   └── ArticlePreview (右侧, flex: 1)  ← 文章只读预览
│       ├── 封面图（顶部大图，可选）
│       ├── Markdown 渲染内容
│       │   ├── 标题层级 (h1-h6)
│       │   ├── 粗体 / 斜体 / 删除线
│       │   ├── 代码块 (语法高亮)
│       │   ├── 引用
│       │   ├── 有序/无序列表
│       │   ├── 图片 (渲染为实际图片)
│       │   ├── 链接
│       │   └── 表格
│       └── 底部元信息（字数统计等）
│
└── PublishDialog (模态框)        ← 发布流程
    ├── 平台选择
    ├── 发布选项配置
    └── 执行发布
```

### 2.3 App.tsx 路由修改

```tsx
// 现有逻辑
{hasActiveArticle && activeArticleId ? (
  blueprint?.phase === "complete"
    ? <ArticleFinalPage ... />      // ← 新增
    : <EditorPane ... />
) : (
  <StartupSplash />
)}
```

---

## 三、图片处理方案

### 3.1 文章内图片处理流程

```
文章 Markdown 内容
  ↓
正则 /!\[.*?\]\((.*?)\)/g 提取所有图片路径
  ↓
遍历图片路径:
  ├── 本地相对路径 (./images/foo.png)
  │   └── 拼接文章所在目录 → 读取文件
  ├── 本地绝对路径 (/Users/.../foo.png)
  │   └── 直接读取文件
  └── 远程 URL (https://...)
      └── reqwest 下载到临时文件
  ↓
POST 到微信素材上传接口
  └── POST /cgi-bin/material/add_material?access_token=TOKEN&type=image
      └── form-data: { media: 文件 }
  ↓
获取返回的 URL (微信 CDN 地址)
  ↓
替换 Markdown 中的原图片路径
```

### 3.2 封面图处理

| 步骤 | 说明 |
|------|------|
| 1 | 从文章 Markdown 中提取第一张图片作为默认封面 |
| 2 | 在 `ArticleFinalPage` 封面区域展示预览 |
| 3 | 用户可点击封面区域上传本地图片替换 |
| 4 | 发布时，封面图单独上传 → 获取 `media_id` → 传入草稿参数 |

### 3.3 存储

- 封面图路径存储在 `ArticleBlueprint.coverImage`（已有字段）
- 新上传的封面图复制到 `{data_dir}/articles/{id}_cover.{ext}`

---

## 四、公众号发布适配器

### 4.1 API 清单

| 操作 | 接口 | 方法 |
|------|------|------|
| 获取 access_token | `/cgi-bin/token?grant_type=client_credential&appid={appid}&secret={secret}` | GET |
| 上传永久图片 | `/cgi-bin/material/add_material?access_token={token}&type=image` | POST (form-data) |
| 创建草稿 | `/cgi-bin/draft/add?access_token={token}` | POST |
| 发布草稿 | `/cgi-bin/draft/publish?access_token={token}` | POST |
| 删除草稿 | `/cgi-bin/draft/delete?access_token={token}` | POST |
| 获取合集列表 | `/cgi-bin/material/batchget_material?access_token={token}` | POST |

### 4.2 access_token 管理

```rust
struct WeChatTokenManager {
    access_token: Option<String>,
    expires_at: Option<u64>,  // Unix 时间戳
}

impl WeChatTokenManager {
    /// 获取有效 token，过期自动刷新
    fn get_valid_token(&mut self) -> Result<String, String>;
    
    /// 强制刷新 token
    fn refresh_token(&mut self, app_id: &str, app_secret: &str) -> Result<String, String>;
}
```

### 4.3 发布流程（半自动）

```
用户点击「发布」
  ↓
弹出 PublishDialog
  ├── 平台: [微信公众号] (默认选中已配置的平台)
  ├── 封面: [预览] [更换]
  ├── 摘要: [自动提取前120字] (可编辑)
  ├── ☑ 声明原创
  ├── ☐ 付费阅读
  ├── ☑ 允许转载
  ├── 作者: [________________]
  └── ┌──────────┐ ┌──────────┐
      │ 存入草稿箱 │ │ 直接发布  │
      └──────────┘ └──────────┘
  ↓
用户选择「存入草稿箱」:
  → 执行图片上传 + Markdown 转换
  → 调用 draft/add → 成功 ✓
  → 显示「草稿已创建，可前往公众号后台审核后发布」
  → 发布状态更新为「草稿」

用户选择「直接发布」:
  → 执行图片上传 + Markdown 转换
  → 调用 draft/add → 获取 media_id
  → 调用 draft/publish → 成功 ✓
  → 发布状态更新为「已发布」
  → 记录 publish_record
```

### 4.4 Markdown → 微信 HTML 转换

需完整实现的转换规则:

| Markdown | 微信 HTML |
|----------|-----------|
| `# 标题` | `<h2>标题</h2>`（h1转h2，微信不支持h1） |
| `## 标题` | `<h2>标题</h2>` |
| `### 标题` | `<h3>标题</h3>` |
| `#### 标题` | `<h4>标题</h4>` |
| `**粗体**` | `<strong>粗体</strong>` |
| `*斜体*` | `<em>斜体</em>` |
| `` `code` `` | `<code>code</code>` |
| 代码块 (```) | `<pre><code>...</code></pre>` |
| `> 引用` | `<blockquote><p>引用</p></blockquote>` |
| `- 列表项` | `<ul><li>列表项</li></ul>` |
| `1. 有序项` | `<ol><li>有序项</li></ol>` |
| `[链接](url)` | `<a href="url">链接</a>` |
| `![图](url)` | `<img src="url" />` |
| 表格 | `<table><thead><tr><th>...</th></tr></thead><tbody>...</tbody></table>` |
| `~~删除~~` | `<del>删除</del>` |
| `---` | `<hr />` |
| 换行 | `<p>` 包裹段落，`<br/>` |

转换器实现在 Rust 端（`publisher.rs`），逐行解析 Markdown，根据行首标记类型输出对应 HTML 标签。

---

## 五、Rust 后端设计

### 5.1 新增文件

```
src-tauri/src/
  ├── publisher.rs         ← 发布适配器（核心）
  │   ├── mod.rs 风格:
  │   ├── WeChatPublisher struct
  │   ├── markdown_to_wechat_html()
  │   ├── extract_images_from_markdown()
  │   ├── upload_image()
  │   ├── create_draft()
  │   └── publish_draft()
  │
  ├── platform_config.rs   ← 平台配置管理
  │   ├── PlatformConfig struct
  │   ├── PublishRecord struct
  │   ├── load/save/delete 方法
  │
  └── mod.rs (更新)
```

### 5.2 新增 store 类型

```rust
// store.rs 新增

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PlatformConfig {
    pub id: String,
    pub platform: String,       // "wechat" | "toutiao"
    pub label: String,
    pub app_id: String,
    pub app_secret: String,
    pub access_token: Option<String>,
    pub token_expires_at: Option<u64>,
    pub enabled: bool,
    pub default_settings: Option<PlatformDefaultSettings>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PlatformDefaultSettings {
    pub declare_original: bool,
    pub allow_reprint: bool,
    pub chargeable: bool,
    pub author: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PublishRecord {
    pub id: String,
    pub article_id: String,
    pub platform: String,
    pub platform_article_id: Option<String>,
    pub status: String,             // "draft" | "published" | "failed"
    pub error_message: Option<String>,
    pub published_at: u64,
    pub platform_url: Option<String>,
}

// DataStore 新增方法
impl DataStore {
    pub fn load_platform_configs() -> Vec<PlatformConfig>
    pub fn save_platform_configs(configs: &[PlatformConfig])
    pub fn load_publish_records() -> Vec<PublishRecord>
    pub fn save_publish_records(records: &[PublishRecord])
}
```

### 5.3 新增 Tauri 命令

```rust
// lib.rs 新增命令

// ─── 平台配置 ───
#[tauri::command]
fn get_platform_configs(state) -> Vec<PlatformConfig>

#[tauri::command]
fn save_platform_config(state, config: PlatformConfig) -> Result<(), String>

#[tauri::command]
fn delete_platform_config(state, id: String) -> Result<(), String>

#[tauri::command]
async fn verify_platform_credentials(state, platform: String, app_id: String, app_secret: String) -> Result<bool, String>

// ─── 发布 ───
#[tauri::command]
async fn publish_article_to_platform(
    state,
    article_id: String,
    platform: String,
    options: PublishOptions,       // 前端传入发布选项
    action: String,                // "draft" | "publish"
) -> Result<PublishResult, String>

#[tauri::command]
async fn upload_cover_image_to_platform(
    state,
    article_id: String,
    platform: String,
    image_path: String,
) -> Result<String, String>

// ─── 发布历史 ───
#[tauri::command]
fn get_publish_history(state, article_id: String) -> Vec<PublishRecord>
```

### 5.4 Tauri 权限配置

在 `src-tauri/capabilities/default.json` 中新增 HTTP 请求权限（如需要）。

---

## 六、前端设计

### 6.1 新增/修改文件清单

```
src/
  components/
    ArticleFinalPage.tsx      ← 新增：成品页面主组件
    FinalTopBar.tsx           ← 新增：顶栏操作
    FinalSidePanel.tsx        ← 新增：左侧面板容器
    ArticleInfoPanel.tsx      ← 新增：文章信息
    BlueprintProgress.tsx     ← 新增：蓝图进度
    PublishStatusPanel.tsx    ← 新增：发布状态
    ArticlePreview.tsx        ← 新增：Markdown 渲染预览
    PublishDialog.tsx         ← 新增：发布对话框
    PlatformSettings.tsx      ← 新增：平台配置表单（设置页内）
    
  lib/
    platforms.ts              ← 新增：前端平台配置 CRUD + 发布调用
    
  App.tsx                     ← 修改：路由逻辑 + 成品页面状态
  SettingsPanel.tsx           ← 修改：新增「发布平台」标签页
```

### 6.2 前端调用封装（platforms.ts）

```typescript
// ─── 平台配置 ───

export interface PlatformConfig {
  id: string;
  platform: string;       // "wechat" | "toutiao"
  label: string;
  appId: string;
  appSecret: string;
  enabled: boolean;
  defaultSettings?: {
    declareOriginal: boolean;
    allowReprint: boolean;
    chargeable: boolean;
    author?: string;
  };
}

export interface PublishRecord {
  id: string;
  articleId: string;
  platform: string;
  platformArticleId?: string;
  status: "draft" | "published" | "failed";
  errorMessage?: string;
  publishedAt: number;
  platformUrl?: string;
}

export interface PublishOptions {
  coverImage?: string;         // 封面图路径
  summary?: string;            // 摘要
  declareOriginal: boolean;
  allowReprint: boolean;
  chargeable: boolean;
  author?: string;
}

export interface PublishResult {
  success: boolean;
  platformArticleId?: string;
  platformUrl?: string;
  errorMessage?: string;
  isDraft: boolean;
}

// ─── 函数签名 ───

export async function getPlatformConfigs(): Promise<PlatformConfig[]>
export async function savePlatformConfig(config: PlatformConfig): Promise<void>
export async function deletePlatformConfig(id: string): Promise<void>
export async function verifyPlatformCredentials(platform: string, appId: string, appSecret: string): Promise<boolean>
export async function publishArticle(articleId: string, platform: string, options: PublishOptions, action: "draft" | "publish"): Promise<PublishResult>
export async function getPublishHistory(articleId: string): Promise<PublishRecord[]>
```

### 6.3 PublishDialog 交互状态

```
状态机：

idle → 准备中（上传图片+Markdown转换）
  → 草稿创建中 (calling draft/add)
    → ✅ 草稿创建成功 → 提示用户确认/取消发布
    → ❌ 失败 → 显示错误信息
  → 发布中 (calling draft/publish)
    → ✅ 发布成功 → 跳转到发布结果
    → ❌ 失败 → 显示错误信息
```

---

## 七、设置面板 — 发布平台标签页

在 `SettingsPanel` 新增第三个标签页（现有：外观、接入设置 → 新增：发布平台）。

```
┌─────────────────────────────────────┐
│  [外观] [接入设置] [发布平台]          │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 微信公众号                    │   │
│  │                             │   │
│  │  appId: [________________]  │   │
│  │  appSecret: [______________]│   │
│  │                             │   │
│  │  默认设置:                   │   │
│  │    作者: [________________]  │   │
│  │    ☑ 声明原创               │   │
│  │    ☑ 允许转载               │   │
│  │    ☐ 付费阅读               │   │
│  │                             │   │
│  │  [验证凭据]  ← 调用验证接口  │   │
│  │  状态: ✅ 有效              │   │
│  │                             │   │
│  │  [删除配置]                  │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 今日头条 (待实现)             │   │
│  │  状态: ❌ 未配置              │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

---

## 八、实施步骤

### Phase 1 ✅: 后端基础设施（v1.2.0）

| 步骤 | 内容 | 状态 |
|------|------|------|
| 1.1 | 定义 `PlatformConfig` / `PublishRecord` 类型 | ✅ 已完成 |
| 1.2 | DataStore 新增 load/save 方法 | ✅ 已完成 |
| 1.3 | 注册平台配置 CRUD 的 Tauri 命令 | ✅ 已完成 |
| 1.4 | 前端 `platforms.ts` 调用封装 | ✅ 已完成 |
| 1.5 | 设置面板新增「发布平台」标签页 | ✅ 已完成 |

### Phase 2 ✅: 微信公众号适配器（v1.2.0）

| 步骤 | 内容 | 状态 |
|------|------|------|
| 2.1 | access_token 管理（获取/缓存/刷新） | ✅ 已完成 |
| 2.2 | Markdown → 微信 HTML 转换器 | ✅ 已完成（compileToWechatHtml） |
| 2.3 | 图片提取/上传（本地+远程） | ✅ 已完成 |
| 2.4 | 草稿箱创建 (draft/add) | ✅ 已完成 |
| 2.5 | 草稿发布 (draft/publish) | ✅ 已完成 |
| 2.6 | 注册发布相关 Tauri 命令 | ✅ 已完成 |

### Phase 3 ✅: 成品页面（v1.2.0）

| 步骤 | 内容 | 状态 |
|------|------|------|
| 3.1 | ArticlePreview（Markdown 渲染阅读视图） | ✅ 已完成 |
| 3.2 | FinalSidePanel（文章信息+蓝图+发布状态） | ✅ 已完成 |
| 3.3 | FinalTopBar（顶栏操作） | ✅ 已完成 |
| 3.4 | ArticleFinalPage 组装 | ✅ 已完成 |
| 3.5 | App.tsx 路由切换逻辑 | ✅ 已完成 |

### Phase 4 ✅: 发布交互（v1.2.0-v1.4.0）

| 步骤 | 内容 | 状态 |
|------|------|------|
| 4.1 | PublishDialog 发布对话框 | ✅ 已完成（双列布局） |
| 4.2 | 发布状态面板（各平台状态展示） | ✅ 已完成 |
| 4.3 | 封面图选择和上传交互 | ✅ 已完成 |
| 4.4 | 发布历史记录 | ✅ 已完成（展开详情、草稿链接） |

### v1.4.0 新增发布增强

| 步骤 | 内容 |
|------|------|
| 4.5 | 发布历史点击展开详情（平台 ID、时间、错误信息） |
| 4.6 | 发布结果区域显示草稿链接 |
| 4.7 | 文章超过 20000 字时发布前预警 |
| 4.8 | 微信错误码增加中文可读描述 |

### Phase 5 (待实现/TODO)

| 内容 | 说明 |
|------|------|
| 今日头条适配器 | 平台配置相同，API 不同 |
| 合集发布 | 微信公众号专辑关联 |
| 定时发布 | 指定时间自动发布 |
| 多账号支持 | 同一平台多套凭据 |

---

## 九、技术要点备忘

### 9.1 Markdown 渲染预览

成品页面的右侧预览用现有项目中已引入的 Markdown 渲染库（如有）或 `dangerouslySetInnerHTML` + 简单的 Markdown→HTML 转换（浏览器端用 `marked` 或类似库）。与 Rust 端（用于微信格式转换的）互不干扰。

### 9.2 图片上传时机

图片上传在点击「发布」后、创建草稿前执行。上传成功后将 Markdown 中的图片引用全部替换为微信 CDN URL，再生成最终 HTML。

### 9.3 access_token 有效期

微信 access_token 有效期 2 小时。每次发布前检查令牌是否过期，过期则自动刷新。刷新后的 token 同步保存到 `platforms.json`。

### 9.4 错误处理

| 场景 | 处理 |
|------|------|
| access_token 过期 | 自动刷新后重试 |
| 图片上传失败 | 跳过该图片，不影响文本发布，错误信息中注明 |
| draft/add 接口超时 | 提示用户稍后重试，保留已上传的图片素材 |
| draft/publish 失败 | 提示草稿已保存但发布失败，可前往公众号后台手动发布 |

### 9.5 文件存储结构

```
{data_dir}/
  platforms.json          ← 平台配置列表
  publish_records.json    ← 发布历史记录
  articles/
    {id}.md               ← 文章内容
    {id}.blueprint.json   ← 写作蓝图
    {id}.meta.json        ← 文章元信息
    {id}_cover.*          ← 封面图（用户上传时）
```

---

## 十、未解决问题 / 待确认

1. **Markdown 渲染库**：前端预览用什么库渲染 Markdown？（建议 `react-markdown` 或 `marked`，需确认项目是否已引入）
2. **微信 HTML 格式限制**：微信公众号对 `<pre><code>` 等标签的样式支持有限，需实际测试调优转换规则
3. **Token 并发**：如果同时多个发布操作，access_token 刷新需加锁
4. **图片大小限制**：微信素材接口对图片有大小限制（一般不超过 2MB），超过时应压缩或提示用户
5. **发布频率限制**：微信公众号 API 有调用频率限制（一般 2000次/天），需在错误信息中提示
