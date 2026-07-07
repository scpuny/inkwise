# 12 — 完整功能地图与业务逻辑审核

> 关联: 所有 plan/ 文档 | 本文档列出 InkWise 的全部功能、数据流、已知缺陷

---

## 一、功能全景图

```
用户界面层
┌─────────────────────────────────────────────────────────────┐
│  Sidebar     EditorPane          AgentPanel    FinalPage    │
│  文集树      编辑器              AI 侧栏      成品发布页   │
│  大纲        Toolbar             聊天历史                 │
│  搜索        内联工具栏          审阅面板                  │
│              Mermaid                                      │
├─────────────────────────────────────────────────────────────┤
│  弹窗/面板                                                    │
│  蓝图编辑器  系列规划器   文章管理器   发布对话框   预览      │
│  设置面板    命令面板    项目浏览器   版本历史    Picker     │
├─────────────────────────────────────────────────────────────┤
│  底层引擎层                                                  │
│  Markdown→HTML  CSS 收集/解析/内联  Mermaid 导出    │
│  localStorage  StorageEngine  Tauri Bridge            │
├─────────────────────────────────────────────────────────────┤
│  Rust 后端层                                                │
│  Store(JSON)  DB(SQLite)  AI(HTTP)  Skill  Agent  WeChat │
│  ProjectIndexer  ImageGen  FileWatcher                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、按业务域逐功能审查

### 【核心域 1：文章生命周期】

#### 1.1 创建文章
```
前端: addArticle() → crud.ts → Tauri IPC → lib.rs → store.rs (collections.json)
     → 同时 localStorage 写入缓存
     → 创建默认 blueprint (createDefaultBlueprint)
     → 自动保存到 {id}.blueprint.json
```

#### 1.2 编辑文章
```
前端: EditorContent (TipTap) → autoSave (useArticleLifecycle 3s 防抖)
     → saveArticleContent(id, content) → Rust {id}.md
     → saveArticleMeta(meta) → Rust {id}.meta.json
     → 保存前自动拍版本快照 → localStorage "version:{id}:{timestamp}"
     → 保存文章级别的样式配置 → localStorage "article-style-config:{id}"
     → 保存时检查 isTauriEnv → Tauri IPC / localStorage 降级
```

**🔴 缺陷**：`saveArticleContent` 同时写 Rust JSON 和 localStorage，如果 Rust 写入失败但 localStorage 写入成功，下次加载时两者不一致。

#### 1.3 删除文章 / 回收站
```
trashArticle(collectionId, articleId):
  → 从 collections.articles 移除 → 移到 trash list
  → deleteArticleContent(id) → 删 {id}.md
  → deleteAllVersions(id) → 删 localStorage 版本
  → 清理 plan-draft-{id}
  → ❌ 不删 SQLite (delete_article_db 未调用)
  → ❌ 不删 blueprint JSON

permanentlyDeleteArticle(trashId):
  → 从 trash list 移除
  → ❌ 不删 SQLite
  → ❌ 不删向量索引

restoreArticle(trashId):
  → 从 trash list 移回 collections.articles
  → 内容/meta/版本无法恢复（已物理删除）
```

**🔴 缺陷**：删除不可逆——`trashArticle` 已物理删除 `{id}.md`，回收站只是恢复了元信息，内容回不来。而且 `permanentlyDeleteArticle` 不级联 SQLite。

#### 1.4 文章版本历史
```
saveVersionSnapshot() → 每次保存前自动调用
  → 存到 localStorage "version:{articleId}:{timestamp}"
  → 索引 "version-index:{articleId}" → 最多 30 条
  → 重复内容跳过

loadVersions() → 读索引
loadVersionContent() → 读具体版本
restoreVersion() → 覆盖当前内容
deleteAllVersions() → 删除文章时调用
```

**🟡 缺陷**：版本存在 localStorage，不存 Rust。Tauri 模式下如果用户清浏览器数据就全丢了。

#### 1.5 文章蓝图 (Blueprint)
```
saveBlueprint(id, blueprint) → Tauri IPC → {id}.blueprint.json / localStorage
loadBlueprint(id) → 同上
deleteBlueprint(id) → 删除文章时调用

Blueprint 字段:
  workingTitle, description, tone, targetAudience
  targetWordCount, tags, phase (planning|writing|reviewing|complete)
  outline: OutlineSection[]  含 id/title/level/description/status
  skillId?: string          ← ⚠️ 可选的!
```

**🔴 缺陷**：`skillId` 是 optional。文章生成时如果没记录 skillId，后面审阅时就不知道按什么风格评价。见 12-skill-business-redesign.md。

#### 1.6 文章分阶段写作
```
ArticlePhase: planning → writing → reviewing → complete

planning 阶段:
  plan.ts: generateTitle() → generateDescription() → generateOutline() → generateTags()
  每一步调 AI API，用当前选中的 WritingSkill 的 configs

writing 阶段:
  agentEngine.ts: 按 outline 逐章节生成
  支持 tool calling (read_project_files 等)
  流式输出 → onToken 回调 → 更新 EditorPane

reviewing 阶段:
  articleReview.ts: generateArticleReview() → 5 维度硬编码评审
  applyOptimization() → 根据评审建议重写
```

**🔴 缺陷**：`plan.ts` 生成时不强制写入 `skillId`，生成后切换 writing skill 不会更新已有的内容风格。见 12-skill-business-redesign.md。

---

### 【核心域 2：AI 写作与 Agent】

#### 2.1 AI 提供商管理
```
providerModels.ts:
  getProvidersSync / saveProvider / deleteProvider
  内置: OpenAI / Anthropic / DeepSeek
  自定义: 任意 OpenAI 兼容 API

globalAIConfig.ts:
  resolveModel() / saveGlobalAIConfig()
  持久化: localStorage "inkwise-ai-config" + Rust providers.json
```

**🟡 缺陷**：provider 配置既存 localStorage 又存 Rust JSON，两套不同步。用户在设置页修改后，有时旧配置还在 localStorage 里。

#### 2.2 AI API 调用 (前端 ai.ts)
```
sendChat()          → invoke("chat_stream") → Rust ai.rs → HTTP
sendChatStream()    → 同上，流式返回
sendChatWithTools() → invoke("chat_stream") + 前端 tool loop

Tool calling (agentEngine.ts):
  read_project_files → tryInvoke(ReadProjectFiles)
  list_project_files → 从 getProjectContext 的 structure 中查找
  search_project_files → 同上，文件名匹配
  → 最多 20 轮工具调用
```

**🟡 缺陷**：前端 `agentEngine.ts` 实现了完整的 tool calling loop，但 Rust `agent.rs` 也有一套 agent 执行逻辑。两套实现互相重复，且前端 tool loop 不经过 Rust agent。见 09-skill-system-review.md。

#### 2.3 AI 插图生成 (draw.ts)
```
extractImageKeywords(content, count)
  → AI 分析文章，按章节提取绘图关键词
  → 每组: section_title + keywords (英文) + alt_text (中文)
  → JSON.parse() 解析

saveImage(articleId, keywordData)
  → 遍历每组 → 调 Rust image_gen.rs → HTTP DALL·E
  → 保存图片到本地 → 插入文章对应位置
```

**🟡 缺陷**：`saveImage` 函数名存在但实际未完整实现，图片保存流程不完整。`image_gen.rs` 只支持 DALL·E，不支持本地图片模型。

#### 2.4 文章审阅 (articleReview.ts)
```
generateArticleReview(articleId, content)
  → 5 个硬编码维度：开头/结构/内容/表达/格式
  → 每个维度评级 优/良/差 + 建议
  → 存储: localStorage "article_review:{articleId}"
  → JSON.parse() 解析 AI 返回

applyOptimization(articleId, content, review)
  → 收集有建议的维度 → 调 AI 重写
  → 返回完整文章

saveArticleReview / loadArticleReview
  → localStorage 持久化
```

**🔴 缺陷 1**：5 个维度硬编码，不感知当前写作风格——"自媒体爆款"和"学术严谨"用同一套评价标准，不合理。

**🔴 缺陷 2**：审阅结果存 localStorage，不从 Rust。跨设备丢失。

**🟡 缺陷 3**：`applyOptimization` 一次性重写全篇文章，不支持逐段修复。

#### 2.5 AI 写作会话历史
```
session.ts:
  saveSessions(articleId, sessions) → localStorage "sessions:{articleId}"
  loadSessions(articleId) → 恢复
  deleteSessions(articleId) → 删除
  → 只保存 agent/command 模式（不保存 inline/ghost）
  → 最多 50 条
```

**🟡 缺陷**：存在 localStorage，不跨设备。

---

### 【核心域 3：合集与项目关联】

#### 3.1 合集 CRUD
```
collections/crud.ts:
  addCollection → renameCollection → removeCollection
  updateCollection (title/description/coverImage/linkedFolder)
  loadCollections → saveCollections
  
  seedIfEmpty() → 首次创建示例文集
  forceSync() → 强制从 Rust 同步
  数据流: tryInvoke(GetCollections) → Rust → localStorage 缓存
```

**🔴 缺陷**：`removeCollection` 不删子文章，子文章变成孤儿数据。见 02-deletion-cascade.md。

#### 3.2 项目目录关联
```
linkCollectionFolder(collectionId, path):
  → collection.linkedFolder = path
  → getProjectContext(path) 全量扫描
  → storeProjectFileTree() 缓存文件树到 localStorage
  → exploreProjectForCollection() 后台 AI 项目分析

unlinkCollectionFolder:
  → linkedFolder = undefined
  → 清理 localStorage 缓存 (folder_index / insights / fileTree)
  → 清理所有 plan-draft

getProjectContext(path):
  → tryInvoke(GetProjectContext) → Rust scan_project()
  → return ProjectContext { structure, summary, symbols, ... }

getProjectContextText(path):
  → build_context_text() → 项目摘要文本 → 注入 AI prompt
```

**🔴 缺陷**：`scan_project` 不支持增量，每次全量遍历。见 03-incremental-scanning.md。

#### 3.3 项目文件浏览
```
ProjectExplorer / ProjectFileTree:
  → 显示项目的文件目录树（从 storeProjectFileTree 缓存读取）
  → 点击文件 → AI 分析
  → 关联合集后主区域显示浏览面板
```

---

### 【核心域 4：系列规划】

#### 4.1 系列文章规划
```
series.ts:
  saveSeriesPlan(collectionId, plan):
    → localStorage "series_plan:{collectionId}" (旧)
    → localStorage "series_plans:{collectionId}" (新多值)
    → 自动迁移旧格式

  loadAllSeriesPlans / loadSeriesPlan / deleteSeriesPlan

  SeriesPlan: id, title, tone, targetAudience
    articles: SeriesArticle[]
    → 每个 article 有 articleId? / previousArticleId / nextArticleId / status
    → status: planned | outlining | writing | reviewing | complete | draft | published
```

**🔴 缺陷**：`deleteSeriesPlan` 只清理 localStorage，不清理关联文章的 `ArticleBlueprint.skillId` 引用，也不清理以后要加的向量索引。

---

### 【核心域 5：多平台发布】

#### 5.1 发布到微信
```
前端 (PublishDialog):
  → 用户填写发布选项（声明原创、允许转载、付费等）
  → publishArticle() → tryInvoke(PublishToPlatform)
  → 异步等待发布结果

Rust (wechat.rs):
  publish():
    → ensure_token() → 缓存/刷新 access_token
    → 编译 HTML：WeChat 专用 inline styles + 语义 class
    → upload_image() → 上传正文图片到微信 CDN
    → upload_image_as_material() → 上传封面为永久素材
    → create_draft() → POST draft/add → 返回 media_id
    → publish_draft() → POST draft/publish → 返回 publish_id
    → return PublishResult

  完整错误码覆盖: 60+ 微信错误码中文描述
  智能 token 管理: 5 分钟安全余量提前刷新
```

**🟡 缺陷**：目前只支持微信公众号一个平台。头条等其他平台预留了 `Platform` trait (platform/mod.rs) 但未实现。

#### 5.2 发布历史
```
getPublishHistory(articleId) → localStorage / Rust
savePublishRecords(records) → 持久化
PublishRecord: id, articleId, platform, status, publishedAt, platformUrl
```

---

### 【核心域 6：主题与样式】

#### 6.1 UI 主题 (theme.ts)
```
6 种风格 × 3 种模式：
  themeStyle: graphite | aurora | slate | carbon | nocturne | amber
  themeMode: auto | dark | light

存储: localStorage "inkwise-theme" + "inkwise-theme-style"
使用: data-theme 和 data-theme-style CSS 属性
```

#### 6.2 文章排版主题 (articleThemes.ts)
```
25 个预设主题，分 7 个平台
  general: 14 个 (极简白/纸墨/暗色护眼/典雅/现代/暖陶米白/靛粉/杂志红...)
  wechat: 3 个   zhihu: 3 个   toutiao: 2 个
  medium/jianshu/csdn: 各 1 个

每个主题: ArticleThemeVars { fontFamily, fontSize, lineHeight, ...15+ CSS 变量 }
自定义主题: localStorage "inkwise-custom-article-themes"
选中主题: localStorage "inkwise-selected-article-theme"

CSS 渲染管线:
  collectPublishCss() → 收集模板/主题/代码/装饰/颜色等 → 
  resolveCssColors() → 解析 CSS 变量 → 
  inlineCss() / inlineCssFull() → juice 内联 → 
  bodyHtml with inline styles
```

**🔴 缺陷**：见 10-theme-system-review.md（类型不一致、平台分布不均、BASE_VARS 散布、无类型约束、不与技能关联）

#### 6.3 编辑器样式 (editorStyles.ts)
```
1585 行超大文件，包含：
  → 编辑器配置（字号/行距/最大宽度）
  → 样式模板（6 个模板）
  → 代码主题（10+ 从 highlight.js 加载）
  → 标题装饰配置
  → 文章样式导入导出（ArticleContext）
  → 首行缩进/两端对齐
  → 背景图案
  → macOS 代码块风格
  全部通过 localStorage 存储
```

**🔴 缺陷**：`editorStyles.ts` 1585 行，职责太多。应从 1585 行拆分为 `config.ts` + `templates.ts` + `themes.ts` + `importExport.ts`。

---

### 【核心域 7：导出系统】

#### 7.1 Markdown → HTML 管线
```
markdownToHtml(content) → markdown/renderer.ts
  → 手写解析器（非 markdown-it 等库）
  → 支持: 代码高亮/hljs、标题、引用、列表、图片、链接、Mermaid 占位
  → 专为微信/导出场景定制

编译路径:
  markdown → markdownToHtml → collectPublishCss → resolveCssColors → inlineCss → renderWechatHtml
```

**🟡 缺陷**：手写 markdown 解析器相比 `markdown-it` 等成熟库，维护成本高、易遗漏 edge case（嵌套引用、表格等）。

#### 7.2 通用 HTML 导出
```
compileToInlinedHtml(markdown):
  → markdownToHtml → renderMermaidInHtml → collectPublishCss → 
  → resolveCssColors → inlineCssFull → 通用清理 → HTML
```

#### 7.3 微信 HTML 导出
```
compileToWechatHtml(markdown, themeId):
  → markdownToHtml → renderMermaidInHtml → collectPublishCss(wechat) →
  → resolveCssColors → inlineCss → addStyledClasses → renderWechatHtml
  → 额外: li 处理 / 代码块 white-space 修复 / 首行缩进处理
```

#### 7.4 复制到剪贴板
```
copyAsHtml / copyAsWechatHtml:
  → 编译 → 写入系统剪贴板 (HTML 格式)
  → Tauri: plugin:clipboard-manager
  → 浏览器: navigator.clipboard.write()
```

#### 7.5 导入 Markdown 文件
```
importMarkdown(collectionId):
  → Tauri: dialog_open (文件选择器) → fs_read_text_file → addArticle + saveArticleContent
  → 浏览器: <input type="file"> → FileReader
```

#### 7.6 Mermaid 导出渲染
```
renderMermaidInHtml(html):
  → 查询所有 .mermaid 元素 → mermaid.render() 生成 SVG
  → 替换占位 div → 返回完整 HTML
```

---

### 【核心域 8：搜索】

#### 8.1 前端搜索 (search.ts)
```
searchArticleTitles(collections, query):
  → 内存搜索, 匹配 article.title
  → 评分: 完全匹配 100 > 前缀匹配 80 > 包含 50 > 分词 30
  → 同步

searchArticleContent(collections, query):
  → 异步, 读取每篇文章内容 → indexOf() 匹配
  → 返回 snippet (命中位置前后 30-40 字)
  → 慢 (读到所有文章内容)
```

#### 8.2 SQLite FTS5 全文搜索 (db.rs)
```
search_articles_db(query, limit):
  → SELECT snippet(articles_fts, ...) FROM articles_fts WHERE content MATCH ?
  → 速度快，支持中文分词
```

**🟡 缺陷**：前端 `search.ts` 和 Rust SQLite `search_articles_db` 两套搜索实现。前端不从 SQLite 搜索，而是自己遍历。SQLite 只被外部调用或调试接口使用。

---

### 【核心域 9：代码扫描】

#### 9.1 项目目录扫描
```
scan_project(path, force_rescan) → project_indexer.rs
  → build_file_tree(dir, 5) → 5 层深目录树
  → collect_summary() → 语言分布统计
  → read_configs() → 关键配置文件
  → 符号提取: tree-sitter (ts/js/rs) / 正则降级 (其他)
  → 导入关系提取
  → CodeGraph 数据读取 (可选)

  增量: FileHashCache + CodeGraph file_hashes
  运行时: spawn_folder_watcher (notify crate, 仅 .ts/.rs/.js, 2s debounce)
```

**🔴 缺陷**：见 03-incremental-scanning.md（无启动检测）、04-query-ast.md（手写 AST 遍历非 Query）。

#### 9.2 CodeGraph 集成
```
read_codegraph_data(db_path):
  → 读取 nodes 表：符号定义 (name/kind/file_path/line/docstring...)
  → 读取 edges 表：调用链 (import/calls/contains)
  → 优先 FileHashCache
  不存在则静默跳过
```

---

### 【核心域 10：设置与快捷键】

#### 10.1 设置面板
```
AppearanceSection: 主题风格/主题模式/字号/字体
EditorSection: 编辑器配置
ModelsSection: AI 提供商/模型
WritingStylesSection: 写作技能管理
QuickSkillsSection: 快速技能配置
PlatformsSection: 发布平台配置
SkillsSection: Rust skill 管理 (安装/删除/启用)
ShortcutsSection: 快捷键一览
StorageSection: 数据导出/导入/路径
ThemesSection: 文章主题选择
AboutSection: 版本信息
```

#### 10.2 快捷键
```
Alt+1~5: 快速执行 AI 技能
Cmd+K: 命令面板
Cmd+Enter: 发送 AI 指令
全局快捷键: tauri-plugin-global-shortcut
```

---

### 【核心域 11：状态管理】

```
Zustand stores:
  panelStore:      面板开关 + 布局状态 (10+ 布尔值)
  editorStore:     编辑器配置 (fontSize/fontFamily/lineHeight/...)
  themeStore:      主题状态 (mode/style)
  articleStore:    当前文章/合集/系列规划器状态

React Context:
  AgentContext:    AI 面板状态 + 执行方法
  ArticleContext:  文章级样式状态
```

---

## 三、跨域数据流问题汇总

### 数据流 1：写文章 → 合入系列规划

```
当前: seriesPlan.articles[].articleId = articleId
      但如果删除文章或删除系列，双方互不知道
```

**问题**：系列规划和文章之间只有脆弱的 `articleId` 引用，没有双向约束或级联。

### 数据流 2：项目扫描 → AI 注入

```
当前: getProjectContextText() → 全量项目摘要 → AI prompt
      没有按意图裁剪
```

**问题**：所有项目上下文一股脑塞给 AI。见 06-context-planner.md。

### 数据流 3：文章主题 → 发布渲染

```
当前: collectPublishCss() 收集所有样式
      → 文章主题 CSS + 模板 CSS + 代码主题 CSS + ...
      → juice 内联
      → 发布
```

**问题**：文章主题、编辑器样式、代码主题三者来源不同但最后合并渲染，如果某个来源取不到值（localStorage 没设），渲染结果会缺样式。

### 数据流 4：技能 → 生成 → 审阅 → 修复

```
当前: 
  选择 WritingSkill → 分阶段生成 → 5 维度审阅 → 全量重写
  skillId 在 blueprint 中可选，审阅不感知 skill
```

**问题**：风格选择在首步生效，后续审阅和修复阶段不再感知。见 12-skill-business-redesign.md。

---

## 四、总结：最关键的 5 个业务逻辑缺陷

| 优先级 | 缺陷 | 影响 | 对应文档 |
|--------|------|------|---------|
| **P0** | "风格"和"动作"混淆为一个 skill，文章绑定风格后后续操作不知道风格 | 所有 AI 操作的风格一致性 | 12-skill-business-redesign.md |
| **P0** | 三套存储不同步（Rust JSON / localStorage / SQLite），删除级联遗漏 | 数据丢失/孤儿数据 | 01-data-consistency, 02-deletion-cascade |
| **P0** | 关 app 后文件变更无法检测，依赖运行时 watcher | 项目变更完全丢失 | 03-incremental-scanning |
| **P1** | 审阅 5 维度硬编码，不感知风格；修复只能全量不能逐段 | 审阅结果对写作无实际帮助 | 12-skill-business-redesign |
| **P1** | markdown 手写解析器 + 编辑器/样式/主题 1585 行大文件 | 维护困难、bug 多 | 11-architecture-restructure |
