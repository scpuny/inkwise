# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Vite dev server (browser mode — AI features unavailable)
npm run build            # Vite production build
npm run typecheck        # TypeScript strict type checking
npm run tauri:dev        # Tauri desktop dev (full AI features)
npm run tauri:build      # Tauri production build
npx playwright test      # Run all Playwright tests
npx playwright test -- -g "test name"  # Run a single test
```

Browser mode (`npm run dev`) is for UI development only — AI features require the Tauri Rust backend.

## Architecture

### Dual-environment pattern

The app runs in two modes: **browser** (Vite, for UI dev) and **Tauri desktop** (full functionality). All Tauri IPC calls must use the bridge layer at `src/lib/bridge/tauri.ts`:

- `isTauriEnv()` — check if running in Tauri
- `tryInvoke(cmd, args)` — call a Tauri command, throws in browser mode
- `invokeOrFallback(cmd, args, fallback)` — call with a browser fallback

Tauri commands are listed as `TauriCommands` enum in `src/lib/bridge/tauri.ts`. Each command is registered in `src-tauri/src/lib.rs` via `generate_handler![]`.

### Frontend structure (`src/`)

| Path | Purpose |
|---|---|
| `components/` | React components grouped by domain (agent/, collections/, common/, editor/, series/, settings/, sidebar/) |
| `lib/` | Utilities organized by domain: `ai/`, `article/`, `bridge/`, `editor/`, `events/`, `export/`, `markdown/`, `storage/`, `styles/`, `theme/`, `utils/` |
| `store/` | Zustand stores: `appStore.ts` (UI state), `editorStore.ts` (editor config), `themeStore.ts` (theme preferences) |
| `pages/MainEditorPage.tsx` | Single-page app root — all state lifted here, passed down via props |
| `styles.css` | Single ~6000-line CSS file, BEM naming, CSS variable theming |
| `App.tsx` | Root: MemoryRouter + AgentProvider + MainEditorPage |

### Rust backend (`src-tauri/src/`)

| File | Responsibility |
|---|---|
| `lib.rs` | All Tauri commands, AppState (Mutex-guarded DataStore + Database), plugin setup |
| `store.rs` | JSON file persistence (legacy path), article CRUD, settings, providers, blueprints, series plans |
| `db.rs` | SQLite with FTS5 full-text search (new path), schema version migration |
| `ai.rs` | AI provider routing (OpenAI/Anthropic/DeepSeek), streaming + tool calling |
| `skill.rs` | Skill system: Markdown-based skill files with frontmatter, builtin skills, install/delete |
| `agent.rs` | Agent execution: orchestrates skill runs with tool calls and streaming |
| `publisher.rs` / `platform/wechat.rs` | WeChat official account publishing (access token → upload media → draft → publish) |
| `project_indexer.rs` | Local directory scanning (tree-sitter parsing, directory tree, key file reading) |

### State management

- **Zustand stores** for UI state (panels open/closed, active article/collection, theme, editor preferences)
- **Rust DataStore** (JSON files at `app_data_dir/data/*.json`) for collections, articles, settings, providers
- **SQLite** (`~/.inkwise/data/inkwise.db`) with FTS5 for full-text search — dual-writes during migration
- **ArticleContext** (`src/lib/article/ArticleContext.ts`) for per-article style persistence in localStorage
- **Event bus** (`src/lib/events/`) — mitt-based, used for cross-component communication (collections-changed, outline-navigate, plan events)

### Key conventions

- **CSS**: Single `styles.css`, BEM naming (`.block__element--modifier`), all colors via CSS variables, no inline styles except dynamic CSS vars
- **Theme**: 6 visual styles × 3 modes (auto/dark/light), 4 text sizes, 6 font presets. Adding a style requires updating `THEME_STYLES` in `theme.ts`, `styleLabels` in `ThemePicker.tsx`, and CSS variables in `styles.css`
- **Event bus**: Events defined in `src/lib/events/events.ts`, emit via `emit(name, payload)`, subscribe via `on(name, handler)` which returns an unsubscribe function
- **AI providers**: Add new provider by updating `ProviderKind` type, `BUILTIN_PROVIDERS` list, and `defaultModels()` in the frontend, plus routing in Rust `ai.rs`
- **Skills**: Markdown files with frontmatter. Builtin skills defined in both Rust `skill.rs` `builtin_skills()` and frontend `skill.ts`. Skills support inline and subagent execution modes, context injection sources, and Alt+1~5 hotkeys
- **Publishing**: Each platform gets a branch in `publisher.rs`, follows token → media → draft → publish flow, returns `PublishResult`
- **Git**: Prefer new commits over amend, no forced pushes, no bypassing hooks

## 开发工作流（强制规则）

### v2.0.0 开发规范

1. **每完成一个功能点**，必须先更新 `docs/plan/TRACKING.md`：
   - 状态改为 🟢
   - 填写完成日期
   - 更新底部统计看板的完成数字
2. **更新后立即提交 Git**：
   - 提交信息格式：`feat: [功能编号] 功能描述`
   - 示例：`feat: 1.1.1 loadCollections统一入口`
3. **只有提交后才能开始下一个功能点**
4. **功能开发顺序**：严格按照 `docs/plan/TRACKING.md` 的 Sprint 划分顺序执行，
   不可跳 Sprint。每个 Sprint 完成后更新 INDEX.md 中的状态并打 tag
5. **Sprint 完成检查**：标注该 Sprint 所有功能点为 🟢 后，打版本 tag：
   - Sprint 1 → `v2.0.0-alpha`
   - Sprint 2 → `v2.0.0-beta`
   - Sprint 3 → `v2.0.0-rc`
   - Sprint 4 → `v2.0.0`
