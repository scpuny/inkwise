<div align="center">
  <img src="https://raw.githubusercontent.com/scpuny/inkwise/main/public/inkwise-icon.png" width="100" alt="InkWise Logo" />
  <h1>InkWise — AI Writing Assistant</h1>

  <p>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="MIT" /></a>
    <a href="https://react.dev"><img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React 19" /></a>
    <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white" alt="TypeScript 6" /></a>
    <a href="https://v2.tauri.app"><img src="https://img.shields.io/badge/Tauri-2-FFC131?logo=tauri&logoColor=white" alt="Tauri 2" /></a>
    <a href="https://www.rust-lang.org"><img src="https://img.shields.io/badge/Rust-1.77-000000?logo=rust&logoColor=white" alt="Rust" /></a>
    <a href="https://tiptap.dev"><img src="https://img.shields.io/badge/TipTap-3-FF6B6B?logo=prosemirror&logoColor=white" alt="TipTap 3" /></a>
    <a href="https://vite.dev"><img src="https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white" alt="Vite 6" /></a>
  </p>
</div>

---

> Immersive desktop writing app · Rich Text & Markdown dual-mode editor · AI-powered writing

InkWise is a desktop writing application designed for Chinese writers, offering a smooth immersive editing experience with intelligent writing assistance. Built with React 19 + TypeScript + Tauri 2 + Rust, it supports multiple AI providers, series planning, multi-platform publishing, full-text search, and project context indexing.

---

## Features

- **Dual-Mode Editor** — Seamless switching between rich text and Markdown source mode, powered by TipTap 3 (ProseMirror)
- **AI Writing Assistance** — Continue writing, rewrite, polish, translate, summarize, and creative writing with streaming output and inline suggestions; 8 built-in writing skills (General/Academic/Creative/Viral/Tech/Copywriting/News/Review) with quick-switch dropdown and dimension progress bars
- **Multiple AI Providers** — Built-in support for OpenAI / Anthropic / DeepSeek, plus custom API-compatible providers
- **Skill System** — Extensible Markdown-based skill files to customize AI writing behavior
- **Article Context (ArticleContext)** — Per-article independent style persistence; switching articles automatically restores corresponding styles
- **Series Planning** — Plan and manage article series with phased writing workflows (draft -> revise -> polish -> final), auto-append sequence numbers to titles
- **Multi-Platform Publishing** — One-click publishing to WeChat Official Accounts, Toutiao, and more; publish history expandable details, draft links, 20K-char warning, Chinese-readable WeChat error codes
- **Full-Text Search** — SQLite FTS5 full-text search with real-time article indexing
- **Project Context Indexing** — Scan local directories to inject project structure into AI context
- **Theme System** — 6 visual styles x 3 theme modes (auto / dark / light)
- **Keyboard Shortcuts** — Alt+1~5 for quick AI skills, Cmd+K command palette

## Quick Start

### Prerequisites

- Node.js >= 18
- Rust >= 1.77.2
- Tauri CLI 2.x (`cargo install tauri-cli --version "^2"`)

### Install & Run

```bash
# Clone the repository
git clone https://github.com/scpuny/inkwise.git
cd inkwise

# Install frontend dependencies
npm install

# Development in browser mode (AI features unavailable)
npm run dev

# Development in Tauri desktop mode
npm run tauri:dev

# Production build
npm run tauri:build

# Type checking
npm run typecheck
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript 6 + Vite 6 |
| Editor Engine | TipTap 3 (ProseMirror) |
| Desktop Shell | Tauri 2 (Rust) |
| Backend | Rust (edition 2021) |
| Database | SQLite (rusqlite, FTS5) |
| HTTP Client | reqwest 0.12 |
| Icons | lucide-react |
| Styling | Single-file CSS, CSS Variables + BEM |

## Project Structure

```
inkwise/
├── src/                     # React frontend
│   ├── components/          # 40+ components
│   └── lib/                 # Utilities
├── src-tauri/               # Rust backend
│   └── src/
│       ├── store.rs         # JSON persistence
│       ├── db.rs            # SQLite persistence + FTS5
│       ├── ai.rs            # AI API calls
│       ├── skill.rs         # Skill management
│       ├── agent.rs         # Agent execution
│       ├── publisher.rs     # Multi-platform publishing (WeChat/Toutiao)
│       └── project_indexer.rs # Project indexing (std fs + tree-sitter)
├── public/inkwise-icon.svg  # App icon
├── docs/                    # Categorized documentation (see docs/README.md)
├── AGENT.md                 # Development guide (for AI agents)
└── LICENSE                  # MIT License
```

## License

[MIT](LICENSE) © 2026 Scpuny
