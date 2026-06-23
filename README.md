<div align="center">
  <img src="./public/inkwise-icon.svg" width="100" alt="InkWise Logo" />
  <h1>InkWise 墨智 — AI 写作助手</h1>

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

> 沉浸式桌面写作应用 · 富文本 & Markdown 双模编辑 · AI 辅助写作

InkWise 墨智是一款面向中文写作者的桌面端应用，提供流畅的沉浸式编辑体验与智能写作辅助。基于 React 19 + TypeScript + Tauri 2 + Rust 构建，支持接入多种 AI 提供商，内置专栏规划、多平台发布、全文检索与项目上下文索引。

---

## 功能特性

- **双模编辑器** — 富文本与 Markdown 源码模式实时切换，基于 TipTap 3 (ProseMirror) 内核
- **AI 辅助写作** — 续写、改写、润色、翻译、摘要、创意写作，支持流式生成与内联建议
- **多 AI 提供商** — 内置 OpenAI / Anthropic / DeepSeek，支持自定义兼容 API
- **Skill 技能系统** — 可扩展的 Markdown 技能文件，自定义 AI 写作行为
- **专栏规划** — 系列文章规划与管理，分阶段写作流程（初稿→修改→润色→终稿）
- **多平台发布** — 一键发布到微信公众号、今日头条等平台
- **全文检索** — SQLite FTS5 全文搜索，实时检索文章内容
- **项目上下文索引** — 本地目录扫描，注入项目结构信息增强 AI 理解
- **主题系统** — 6 种视觉风格 × 3 种主题模式（自动/深色/浅色）
- **快捷键** — Alt+1~5 快速执行 AI 技能，Cmd+K 命令面板

## 快速开始

### 环境要求

- Node.js ≥ 18
- Rust ≥ 1.77.2
- Tauri CLI 2.x（`cargo install tauri-cli --version "^2"`）

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/scpuny/inkwise.git
cd inkwise

# 安装前端依赖
npm install

# 浏览器模式开发（AI 功能不可用）
npm run dev

# Tauri 桌面模式开发
npm run tauri:dev

# 生产构建
npm run tauri:build

# 类型检查
npm run typecheck
```

## 技术栈

| 层 | 技术 |
|---|---|
| 前端框架 | React 19 + TypeScript 6 + Vite 6 |
| 编辑内核 | TipTap 3 (ProseMirror) |
| 桌面壳 | Tauri 2 (Rust) |
| 后端语言 | Rust (edition 2021) |
| 数据库 | SQLite (rusqlite, FTS5) |
| HTTP 客户端 | reqwest 0.12 |
| 图标 | lucide-react |
| 样式 | 单文件 CSS，CSS 变量 + BEM |

## 项目结构

```
inkwise/
├── src/                     # React 前端
│   ├── components/          # 40+ 组件
│   └── lib/                 # 工具库
├── src-tauri/               # Rust 后端
│   └── src/
│       ├── store.rs         # JSON 持久化
│       ├── db.rs            # SQLite 持久层 + FTS5
│       ├── ai.rs            # AI API 调用
│       ├── skill.rs         # Skill 管理
│       ├── agent.rs         # Agent 执行
│       ├── publisher.rs     # 多平台发布
│       └── project_indexer.rs # 项目索引
├── public/inkwise-icon.svg  # 应用图标
├── DESIGN.md                # 设计文档
├── AGENT.md                 # 开发指南（AI Agent 用）
└── LICENSE                  # MIT 协议
```

## 许可

[MIT](LICENSE) © 2026 Scpuny
