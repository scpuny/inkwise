# AI 写作助手 — Agent 指南

> 本文件为 AI 编码助手（如 Codex）提供项目上下文和开发指南。

---

## 项目概况

AI 写作助手（AiWriter）是一个桌面端中文写作应用，基于 React 19 + TypeScript + Tauri 2 构建，使用 TipTap 3 富文本编辑器内核，支持接入多种 AI 提供商辅助写作。

---

## 开发命令

```bash
npm run dev              # Vite 开发服务器（浏览器模式）
npm run build            # Vite 生产构建
npm run typecheck        # TypeScript 类型检查
npm run tauri:dev        # Tauri 桌面开发模式
npm run tauri:build      # Tauri 生产构建
```

---

## 关键约定

### 双环境兼容

- 所有数据操作必须通过 `invokeOrFallback()` 模式兼容浏览器和 Tauri 两种环境
- `lib/tauri.ts` 提供了 `isTauriEnv()`、`tryInvoke()`、`invokeOrFallback()` 三个核心函数
- 浏览器模式下 AI 功能不可用，需返回清晰的提示信息

### 样式规范

- 单文件 CSS（`src/styles.css`），不使用 CSS-in-JS 或 CSS 模块
- BEM 命名：`.block__element--modifier`
- CSS 变量驱动主题：所有颜色/尺寸通过变量引用
- 新增组件时直接在 `styles.css` 底部追加，按 BEM 规则命名

### 主题系统

- 6 种风格（graphite/aurora/slate/carbon/nocturne/amber） × 3 种模式（auto/dark/light）
- 添加新风格时需同步更新：`THEME_STYLES`（`theme.ts`）、`styleLabels` / `styleColors`（`ThemePicker.tsx`）、CSS 变量（`styles.css`）
- 字号预设：small/default/large/xlarge，通过 `data-text-size` 属性控制
- 字体预设：system/yahei/pingfang/noto/serif/custom，通过 `data-font-family` 属性控制

### 数据持久化

- **Tauri 模式**: Rust `DataStore` 将数据写入 `app_data_dir/data/*.json`，文章内容存为 `articles/{id}.md`
- **浏览器模式**: 所有数据通过 `localStorage` 存储，Key 前缀 `aiwriter-`
- 文章内容 Key 格式: `article:{id}`，元数据 Key 格式: `meta:{id}`
- 新增数据模型时需同时实现 Rust 端（`store.rs`）和前端端（对应 `lib/` 文件）的读写逻辑

### AI 提供商

- 内置开源箱：OpenAI、Anthropic、DeepSeek
- 自定义提供商需遵循 OpenAI 兼容 API 格式
- 新增提供商类型时需更新：`ProviderKind` 类型、`BUILTIN_PROVIDERS` 列表、`defaultModels()` 函数（前端）、以及 Rust 端 `ai.rs` 的路由逻辑
- API Key 仅存储在本地配置文件中，不发送到第三方

### Skill 系统

- Skill 是 Markdown 文件，头部包含 `---` frontmatter 元数据
- 内置 Skill 定义在 Rust `skill.rs` 的 `builtin_skills()` 函数中
- 新增内置 Skill 需同时更新 Rust `builtin_skills()` 和前端 `getFallbackSkills()`
- Skill 可通过 UI 安装（写入 `{data_dir}/skills/{name}/SKILL.md`）

---

## 代码规范

### TypeScript

- 严格模式启用（`strict: true`）
- 使用 `useCallback` / `useEffect` / `useRef` 等 React Hooks
- 类型定义放在 `lib/types.ts` 或模块头部，避免内联 `any`
- 文件名小写字母 + 连字符（kebab-case）

### Rust

- 所有 Tauri 命令函数使用 `#[tauri::command]` 属性宏
- `DataStore` 是唯一的持久化入口，通过 `Mutex<DataStore>` 在 `AppState` 中共享
- 新命令需在 `lib.rs` 的 `generate_handler![]` 宏中注册
- 错误处理统一返回 `Result<T, String>` 类型

### CSS

- 禁止在组件中使用内联样式（`style={{}}` 仅用于动态 CSS 变量）
- 颜色值必须引用 CSS 变量（`var(--fg)`），禁止硬编码色值
- 字号使用 `var(--text-*)` 变量族
- 尊重 `prefers-reduced-motion`

---

## 项目结构

```
AiWriter/
├── index.html                # 入口 HTML
├── vite.config.ts            # Vite 配置
├── tsconfig.json             # TypeScript 配置
├── package.json              # 前端依赖
├── src/
│   ├── main.tsx              # React 入口
│   ├── App.tsx               # 根布局
│   ├── styles.css            # 全局样式（单文件）
│   ├── components/           # React 组件
│   │   ├── Sidebar.tsx
│   │   ├── CollectionTree.tsx
│   │   ├── OutlinePanel.tsx
│   │   ├── EditorPane.tsx
│   │   ├── EditorContent.tsx      # TipTap 编辑器核心
│   │   ├── Toolbar.tsx
│   │   ├── AIBar.tsx
│   │   ├── AIDock.tsx
│   │   ├── SettingsPanel.tsx      # 全功能设置面板
│   │   ├── ThemePicker.tsx
│   │   ├── StatusBar.tsx
│   │   ├── StartupSplash.tsx
│   │   ├── ContextMenu.tsx
│   │   ├── PopoverMenu.tsx
│   │   ├── IntentMenu.tsx
│   │   └── InlineConfirmButton.tsx
│   └── lib/                 # 工具库
│       ├── types.ts
│       ├── tauri.ts         # Tauri IPC 桥接
│       ├── theme.ts
│       ├── textSize.ts
│       ├── fontFamily.ts
│       ├── collections.ts   # 合集/文章 CRUD
│       ├── articles.ts      # 文章内容持久化
│       ├── ai.ts            # AI 聊天 API
│       ├── providerModels.ts
│       ├── skill.ts         # Skill 系统
│       └── editorStyles.ts  # 编辑器样式模板
├── src-tauri/
│   ├── Cargo.toml           # Rust 依赖
│   ├── tauri.conf.json      # Tauri 配置
│   ├── src/
│   │   ├── main.rs          # Rust 入口
│   │   ├── lib.rs           # 命令注册、AppState
│   │   ├── store.rs         # 数据持久化
│   │   ├── ai.rs            # AI API 调用
│   │   ├── skill.rs         # Skill 管理
│   │   └── agent.rs         # Agent 执行
│   └── icons/               # 应用图标
├── DESIGN.md                # 设计文档（本文）
├── AGENT.md                 # Agent 指南（本文）
├── AI写作助手-UI设计方案.md  # UI 设计参考
└── dist/                    # 构建输出
```

---

## 常见开发场景

### 添加新组件

1. 在 `src/components/` 下创建文件
2. 类型定义优先放在组件文件顶部或 `lib/types.ts`
3. 样式追加到 `src/styles.css` 底部
4. 如果组件需要全局状态，在 `App.tsx` 中管理并通过 props 下传
5. 确保 Tauri 相关操作使用 `invokeOrFallback` 包裹

### 添加新的 AI 提供商

1. 前端 `providerModels.ts` 的 `ProviderKind` 类型 + `BUILTIN_PROVIDERS` 列表
2. 前端 `providerModels.ts` 的 `defaultModels()` 函数
3. Rust `ai.rs` 的 `chat_completion()` 路由逻辑
4. Rust `store.rs` 的 `Provider` 结构体（如需新增字段）

### 添加内置 Skill

1. Rust `skill.rs` 的 `builtin_skills()` 函数
2. 前端 `skill.ts` 的 `getFallbackSkills()` 函数
3. 前端 `AIBar.tsx` 的 `skillDisplayLabel()` 函数（如需要中文显示名）

---

## 参考资源

- [Tauri 2 文档](https://v2.tauri.app)
- [TipTap 3 文档](https://tiptap.dev)
- [Reasonix](https://github.com/yetone/reasonix) — UI 风格参考
- CSS 变量体系详见 `src/styles.css` 顶部
- 完整数据模型详见 `src-tauri/src/store.rs` 和 `src/lib/types.ts`
