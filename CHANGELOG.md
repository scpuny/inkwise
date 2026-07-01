
## v1.10.0 (2026-07-01)

### 新功能
- **合集扫描实时日志** — 右侧面板实时显示 AI 扫描经过（📖读取文件 → ✅完成 → 🧠分析中）
- **扫描操作工具栏** — 重新扫描、停止扫描（AbortController）、规划系列文章按钮
- **扫描日志可折叠** — 扫描进行中实时展开，结果出来后自动折叠，展示分析正文
- **状态栏 AI 状态** — 不再永远显示"空闲"，扫描时显示"分析中…"并带脉冲动画

### 改进
- **单轮 AI 项目分析** — 取消多轮 tool calling（5-8轮），改为 Rust 预读关键文件 + 一次性发给 AI（1轮），扫描耗时从 15-30s 降至 2-4s
- **微信发布支持 asset:// 图片** — AI 生成的 asset://localhost/... 协议图片自动解码为本地路径上传微信 CDN（封面 + 正文图片均支持）

### Bug 修复
- **marked 类型错误** — `marked.parse()` 返回类型 `string | Promise<string>` 导致 `dangerouslySetInnerHTML` 报错

## v1.9.0 (2026-06-29)

### Bug 修复
- **图片生成不显示** — 开启 Tauri asset 协议（`assetProtocol.enable: true`）+ 配置 `$APPDATA/**` scope，修复 `convertFileSrc` 生成的 asset:// URL 无法加载
- **API 400 错误** — 非 DALL-E 模型（如 Agnes）不再发送 `response_format` 参数，该参数仅 DALL-E 模型支持
- **InlineToolbar 点击生成插图无反应** — drawConfig store 初始化自动从 localStorage 恢复模型配置；模型未配置时编辑器底部显示错误提示
- **选中文本插入图片位置错误** — `selection.from === to`（无光标移动）时回退到文档末尾插入
- **AIBar 图片生成失败** — `invokeOrFallback<string[]>` 类型错误（实为 `{localPath, altText}[]`）；选中文本优先作为 prompt；模型自动填充

### 改进
- **绝对路径转 asset URL** — `convertFileSrc` 转换后端返回的本地文件路径为 Tauri asset protocol URL，浏览器可正常加载

### 修复
- 全线 typeof 错误处理加固

## v1.8.0 (2026-06-29)

### 新功能
- **图片生成** — 支持 OpenAI DALL·E 3 / OpenAI 兼容 API 绘图引擎，前端画板集成，图片持久化（article_images SQLite 表），封面图上传
- **Mermaid 图表渲染** — 编辑器内 Mermaid 代码块实时渲染为图表，Markdown/Markdown 导出支持 SVGs
- **写作技能/工具事件 UI 增强** — 阶段进度可见性改善，事件详情可折叠展示

### 安全加固
- **Rust unwrap 全面消除** — 消除 `db.rs` 和 `lib.rs` 中 82 处 `lock().unwrap()` 恐慌风险，全部改为 `map_err` 错误传播
- **JSON 原子写入** — `store.rs` write_json 改为 `tmp + sync_all + rename` 原子模式，防止崩溃导致文件损坏
- **空 catch 块补全** — `crud.ts` 和 `ArticleContext.ts` 中所有空 `catch {}` 添加 `console.warn` 日志输出

### Bug 修复
- **双环境持久化不一致** — `loadCollections()` 改为优先读取 localStorage（可信数据源），Tauri 仅作为迁移回退
- **前后端类型映射补全** — `toTauriCollection` 补全 `phase/description/tags/blueprint` 字段，`fromTauriCollection` 用类型守卫替代 `any`
- **project_indexer 行数统计错误** — `LanguageStat.lines` 使用实际代码行数而非文件计数
- **project_indexer 内存泄漏** — `FileHashCache::get_hash()` 返回 `Option<String>` 消除 `Box::leak`
- **AI max_tokens 硬编码** — Anthropic `max_tokens` 从请求参数传递，移除 4096 固定值
- **agent.rs temperature 映射** — 根据 `skill.effort` 映射 temperature（high→0.3, medium→0.5, default→0.7）
- **SSE 解析去重** — 删除 `parse_sse_line` 中重复的 DeepSeek reasoning 分支

### 重构
- **AI Provider 代码去重** — 抽取 `resolve_provider()` 公共函数，lib.rs 5 个 command 各减少 15-20 行重复代码
- **appStore 状态拆分** — 拆分为 `panelStore`（15 字段）+ `articleStore`（14 字段），`appStore.ts` 保留为 re-export 入口
- **MainEditorPage 拆分** — 750 行 → 332 行，提取 `useKeyboardShortcuts`/`usePanelManager`/`useOutlineNavigation`/`useArticleLifecycle` 四个 hook
- **类型同步清单** — 创建 `docs/type-sync-manifest.md` 维护 Rust/TypeScript 字段对应关系

### 改进
- **写作技能提示词全面升级** — 9 种内置技能（博客/文学/自媒体/教程/商业/新闻/营销/文档/评论）增加开篇要求、结构规则、质量检查环节
- **默认提示词增强** — title/description/outline/tags/writing 默认 prompt 增加双受众考虑（技术开发者 + 内容创作者）、质量自查清单、反面案例
- **工具调用 UI 重构** — 可折叠卡片设计，状态徽章（进行中/完成/错误），写作阶段自动展开，折叠时显示进度摘要

### 新功能
- **系列文章预填标题/简介** — PlanInput 新增 prefilledTitle/prefilledDescription，系列规划生成的标题和简介直接跳过 AI 生成步骤
- **大纲解析增强** — 支持 Markdown 标题（`##`）、无序列表（`-`）、中文编号（`1、`）等多种 AI 输出格式
- **合集自动刷新** — 蓝图阶段变更（开始写作/完成/审阅）时自动触发合集刷新，侧边栏即时同步

### 修复
- 写作/审阅阶段重试不再从头规划，保留已有内容恢复写作
- 文件读取结果摘要增加失败计数
- 全线 typeof 错误处理加固




## v1.7.0 (2026-06-28)

### 新功能
- **合集关联文件夹写文章** — 合集绑定本地项目目录后主区域展示项目浏览面板，左侧目录树 + 右侧 AI 扫描分析
- **AI 项目结构分析** — 关联目录后自动 AI 扫描项目结构，分析结果实时显示在浏览面板右侧
- **目录树可视化** — Rust 预扫描目录结构（5 层），文件树可展开/折叠，配色匹配系统主题
- **项目上下文注入** — 扫描结果 Markdown 渲染为 HTML（marked 库），排版支持列表/代码块/引用
- **合集切换状态隔离** — 多合集各自独立跟踪扫描进度，切换合集不残留

### 改进
- **初始化扫描增强** — Rust 预扫描目录树直接注入 AI 提示词，AI 不再从零探索；maxToolRounds 提升到 8，超时延长到 120s
- **ProjectExplorer 整体视觉重设计** — header 高度 44px 对齐工具栏，左侧目录树 bg-soft 背景，文件树行圆角增大
- **AI 分析输出排版优化** — 段落/列表/代码块/引用/链接全标记渲染

### 修复
- ProjectExplorer 缺失 grid-row/grid-column 导致页面空白（跑到 sidebar logo 背后）
- Tauri invoke 竞态条件（await initPromise）
- 新建文档时未关闭项目浏览面板
- 合集重命名不持久化
- UTF-8 字符串字符边界切片 panic
- projectContext slice 类型安全（非 string 值兜底）
- splash 页面覆盖应用
- 合集切换时探索状态残留

# Changelog

## v1.4.0 (2026-06-27)

### 新功能
- 新增 3 种内置写作技能：营销文案、产品文档、书评影评
- AI 工具栏增加写作风格快速切换下拉菜单
- 技能卡片显示维度进度条可视化
- **ArticleContext 文章级独立上下文管理**：每篇文章独立持久化样式配置，切换文章自动恢复对应样式，StylePanel 读写通过 ctx 完成，消除样式串扰
- 发布历史点击展开详情（平台 ID、时间、错误信息）
- 发布结果区域显示草稿链接
- 文章超过 20000 字时发布前预警
- 微信错误码增加中文可读描述
- CodeGraph 代码图谱搜索面板（需安装 codegraph CLI）

### 改进
- 统一写作 prompt 的标题层级规则，禁止跳级和正文使用 #
- 强调严格遵循 Markdown 语法规范
- 系列文章创建时自动追加序号到标题
- 切换文章时无保存配置则恢复系统默认
- 列表项移除 word-break:keep-all 防止溢出
- **tree-sitter 符号提取**：AST 解析替代正则，支持 TS/TSX/JS/JSX/Rust 源码符号与导入关系提取，docstring 正确关联
- **增量扫描**：SHA-256 文件 hash 缓存，仅扫描变更文件；新增文件系统事件监听（notify-debouncer-mini），文件变更自动更新缓存并通过 Tauri 事件通知前端

### 修复
- composer-intent-menu 缺少 max-height 导致下拉溢出

# Changelog

## v1.3.0 (2026-06-27)

### 修复
- 文章选中态不明显 — 增强选中高亮（22% 强调色背景 + 边框轮廓）
- 系列文章缺少选中态 — 新增 activeArticleId 透传，系列文章也支持选中高亮
- 文章不同阶段图标颜色单一 — 区分 planning（琥珀色）/ writing（强调色）/ reviewing（蓝色）/ complete（绿色）
- 系列规划按钮「生成规划」因 ctxText 保护导致无关联目录时无法使用
- 合集重命名因 React 闭包陷阱导致不生效
- 编辑器关闭后状态栏字数统计未清空 — 新增定时健康检查
- 按 Escape 从成品页退出时未清除文章选中态
- 新建合集无法使用同名 — 移除自动去重逻辑
- 合集合集联动目录图标不显示 — 序列化字段名对齐 camelCase

### 改进
- 存储架构重构：统一的 StorageEngine + Tauri 后端权威 + localStorage 缓存
- 系列规划器新增「系列名称」输入框（选填，留空自动生成）
- 点击预设方向按钮自动填充系列名称
- 文章阶段变更时自动同步系列规划中的对应状态
- 合集列表刷新时自动重载所有文章阶段缓存

## v1.2.0 (2026-06-26)

### 新功能
- 添加 Tauri 启动屏，消除加载阶段白屏
- 启动屏跟随用户主题（暗色/浅色 + 风格样式）
- 工具栏添加侧边栏折叠按钮
- 成品页顶部栏添加「复制HTML」按钮
- 发布对话框双列布局 + 封面图上传/正文选择 + 更多公众号字段

### 修复
- 统一样式管线 & 修复编辑器样式面板设置不生效
- 成品页代码块缺失真正的语法高亮（引入 highlight.js）+ 主题样式修复
- 发布到微信使用 compileToWechatHtml 保持一致，清理外部链接防 64562 错误
- 微信复制兼容：内联样式/主题色/strong标签/代码块hljs剥离/class泄漏等多个修复
- blockquote 多行支持和空行跳过 + 代码块未指定语言修复
- 复制HTML改用 compileToInlinedHtml，解决微信格式问题
- 复制HTML时解析 var(--accent) 和 color-mix() 为实际色值
- 主题色和标题装饰不生效 - 修正 useEffect 依赖数组
- 文章阶段变更为完成时关闭样式面板和 AI 面板
- 新建文章时关闭 AI 面板和样式面板
- 样式面板按钮移到 AI 按钮旁边
- 发布对话框跟随系统主题 + UI 一致性修复

### 杂项
- 补充 highlight.js 常用语言注册（共 40+ 种语言）
- 发布对话框视觉打磨 — 圆角/阴影/悬停动效/选中标识
