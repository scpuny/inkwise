// Editor style templates — complete CSS themes for Markdown rendering
// Each template is a full CSS stylesheet that styles all Markdown elements.
// When exporting/copying, this CSS is used to produce styled HTML.

export interface EditorStyleTemplate {
  id: string;
  name: string;
  builtIn: boolean;
  disabled?: boolean;
  /** Complete CSS stylesheet for Markdown rendering */
  css: string;
  /** Preview description */
  desc: string;
}

// ─── Built-in templates ───

const BUILTIN_TEMPLATES: EditorStyleTemplate[] = [
  {
    id: "default",
    name: "默认",
    builtIn: true,
    desc: "简洁清晰，适合各类写作场景",
    css: `/* 默认主题 */
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif; font-size: 15px; line-height: 1.75; color: #1e1e1e; max-width: 820px; margin: 0 auto; padding: 40px 32px; }
h1 { font-size: 28px; font-weight: 700; margin: 1.2em 0 0.6em; line-height: 1.3; }
h2 { font-size: 22px; font-weight: 700; margin: 1em 0 0.5em; line-height: 1.35; }
h3 { font-size: 18px; font-weight: 650; margin: 1em 0 0.5em; }
h4 { font-size: 15px; font-weight: 650; margin: 0.8em 0 0.4em; }
p { margin: 0 0 1.25em; }
a { color: #0969da; text-decoration: underline; }
blockquote { margin: 1em 0; padding: 0.5em 1em; border-left: 4px solid #d0d7de; color: #656d76; background: #f6f8fa; border-radius: 0 6px 6px 0; }
blockquote p { margin: 0; }
ul, ol { padding-left: 24px; margin: 0.5em 0; }
li { margin-bottom: 0.25em; }
code { font-family: "SF Mono", "Cascadia Code", "JetBrains Mono", "Fira Code", Consolas, monospace; font-size: 0.92em; background: #f0f0f0; padding: 2px 6px; border-radius: 4px; }
pre { background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 8px; padding: 16px; overflow-x: auto; margin: 1em 0; }
pre code { background: transparent; padding: 0; font-size: 13px; }
table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 14px; }
th, td { border: 1px solid #d0d7de; padding: 8px 12px; text-align: left; }
th { background: #f6f8fa; font-weight: 600; }
hr { border: none; border-top: 1px solid #d0d7de; margin: 1.5em 0; }
img { max-width: 100%; border-radius: 6px; margin: 1em 0; }
.task-list-item { list-style: none; }
.task-list-item input[type="checkbox"] { margin-right: 6px; }`,
  },
  {
    id: "github",
    name: "GitHub",
    builtIn: true,
    desc: "GitHub Markdown 风格，开发者熟悉的味道",
    css: `/* GitHub Markdown 主题 */
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"; font-size: 16px; line-height: 1.6; color: #1F2328; max-width: 820px; margin: 0 auto; padding: 40px 32px; }
h1 { font-size: 2em; font-weight: 600; margin: 0.67em 0; padding-bottom: 0.3em; border-bottom: 1px solid #d0d7de; }
h2 { font-size: 1.5em; font-weight: 600; margin: 0.83em 0; padding-bottom: 0.3em; border-bottom: 1px solid #d0d7de; }
h3 { font-size: 1.25em; font-weight: 600; margin: 1em 0 0.5em; }
h4 { font-size: 1em; font-weight: 600; margin: 1em 0 0.5em; }
h5 { font-size: 0.875em; font-weight: 600; margin: 1em 0 0.5em; }
h6 { font-size: 0.85em; font-weight: 600; margin: 1em 0 0.5em; color: #656d76; }
p { margin: 0 0 1em; }
a { color: #0969da; text-decoration: none; }
a:hover { text-decoration: underline; }
blockquote { margin: 1em 0; padding: 0 1em; border-left: 0.25em solid #d0d7de; color: #656d76; }
blockquote p { margin: 0; }
ul, ol { padding-left: 2em; margin: 0 0 1em; }
li { margin-bottom: 0.25em; }
code { font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace; font-size: 0.85em; background: rgba(175,184,193,0.2); padding: 0.2em 0.4em; border-radius: 6px; }
pre { font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace; font-size: 0.85em; background: #f6f8fa; border-radius: 6px; padding: 16px; overflow-x: auto; margin: 1em 0; line-height: 1.45; }
pre code { background: transparent; padding: 0; font-size: inherit; }
table { width: 100%; border-collapse: collapse; margin: 1em 0; }
th, td { border: 1px solid #d0d7de; padding: 6px 13px; text-align: left; }
th { background: #f6f8fa; font-weight: 600; }
tr:nth-child(even) { background: #f6f8fa; }
hr { border: none; border-top: 1px solid #d0d7de; margin: 1.5em 0; }
img { max-width: 100%; border-radius: 6px; }
ul.contains-task-list { padding-left: 0; }
.task-list-item { list-style: none; margin-left: 0; }
.task-list-item input[type="checkbox"] { margin: 0 0.5em 0 0; }`,
  },
  {
    id: "typora-dark",
    name: "Typora 深色",
    builtIn: true,
    desc: "深色护眼，适合夜间写作",
    css: `/* Typora 深色主题 */
body { font-family: "PingFang SC", "Noto Sans SC", "Microsoft YaHei", -apple-system, sans-serif; font-size: 15px; line-height: 1.8; color: #d4d4d4; background: #1e1e1e; max-width: 820px; margin: 0 auto; padding: 40px 32px; }
h1 { font-size: 26px; font-weight: 700; margin: 1.2em 0 0.5em; color: #e0e0e0; }
h2 { font-size: 22px; font-weight: 700; margin: 1em 0 0.5em; color: #e0e0e0; border-bottom: 1px solid #333; padding-bottom: 0.3em; }
h3 { font-size: 18px; font-weight: 650; margin: 1em 0 0.5em; color: #e0e0e0; }
h4 { font-size: 15px; font-weight: 650; margin: 0.8em 0 0.4em; color: #d0d0d0; }
p { margin: 0 0 1.25em; }
a { color: #6cb6ff; text-decoration: underline; }
blockquote { margin: 1em 0; padding: 0.5em 1em; border-left: 4px solid #565656; color: #9a9a9a; background: #2a2a2a; border-radius: 0 6px 6px 0; }
blockquote p { margin: 0; }
ul, ol { padding-left: 24px; margin: 0.5em 0; }
li { margin-bottom: 0.25em; }
code { font-family: "SF Mono", "Cascadia Code", "JetBrains Mono", "Fira Code", Consolas, monospace; font-size: 0.92em; background: #2d2d2d; padding: 2px 6px; border-radius: 4px; color: #ce9178; }
pre { background: #252526; border: 1px solid #333; border-radius: 8px; padding: 16px; overflow-x: auto; margin: 1em 0; }
pre code { background: transparent; padding: 0; font-size: 13px; color: #d4d4d4; }
table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 14px; }
th, td { border: 1px solid #333; padding: 8px 12px; text-align: left; }
th { background: #2a2a2a; font-weight: 600; color: #e0e0e0; }
td { color: #d4d4d4; }
tr:nth-child(even) td { background: #252525; }
hr { border: none; border-top: 1px solid #333; margin: 1.5em 0; }
img { max-width: 100%; border-radius: 6px; filter: brightness(0.9); }
.task-list-item { list-style: none; }
.task-list-item input[type="checkbox"] { margin-right: 6px; filter: invert(0.8); }`,
  },
  {
    id: "academic",
    name: "学术",
    builtIn: true,
    desc: "衬线字体，两端对齐，适合论文与正式文档",
    css: `/* 学术主题 */
body { font-family: "Noto Serif SC", "Source Han Serif SC", STSong, Georgia, "Times New Roman", serif; font-size: 15px; line-height: 1.8; color: #222; max-width: 820px; margin: 0 auto; padding: 48px 40px; }
h1 { font-size: 24px; font-weight: 600; margin: 1.5em 0 0.8em; text-align: center; }
h2 { font-size: 20px; font-weight: 600; margin: 1.2em 0 0.6em; }
h3 { font-size: 17px; font-weight: 600; margin: 1em 0 0.5em; }
h4 { font-size: 15px; font-weight: 600; margin: 0.8em 0 0.4em; }
p { margin: 0 0 1em; text-align: justify; text-indent: 2em; }
a { color: #2563eb; text-decoration: underline; }
blockquote { margin: 1em 0; padding: 0.5em 1.2em; border-left: 3px solid #4b5563; color: #555; background: #f9fafb; border-radius: 0 6px 6px 0; }
blockquote p { margin: 0; text-indent: 0; }
ul, ol { padding-left: 24px; margin: 0.5em 0; }
li { margin-bottom: 0.25em; }
code { font-family: "SF Mono", "Cascadia Code", "JetBrains Mono", Consolas, monospace; font-size: 0.9em; background: #f3f4f6; padding: 2px 6px; border-radius: 3px; }
pre { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 14px 16px; overflow-x: auto; margin: 1em 0; }
pre code { background: transparent; padding: 0; font-size: 13px; }
table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 14px; }
th, td { border: 1px solid #d1d5db; padding: 6px 12px; text-align: left; }
th { background: #f3f4f6; font-weight: 600; }
hr { border: none; border-top: 1px solid #d1d5db; margin: 2em 0; }
img { max-width: 100%; border-radius: 4px; margin: 1em 0; }
.task-list-item { list-style: none; }`,
  },
  {
    id: "minimal",
    name: "极简",
    builtIn: true,
    desc: "大量留白，干净清爽，适合阅读与写作",
    css: `/* 极简主题 */
body { font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif; font-size: 16px; line-height: 2; color: #2c2c2c; max-width: 720px; margin: 0 auto; padding: 48px 24px; }
h1 { font-size: 28px; font-weight: 500; margin: 2em 0 0.8em; letter-spacing: -0.01em; }
h2 { font-size: 22px; font-weight: 500; margin: 1.8em 0 0.6em; letter-spacing: -0.01em; }
h3 { font-size: 18px; font-weight: 500; margin: 1.5em 0 0.5em; }
h4 { font-size: 16px; font-weight: 500; margin: 1.2em 0 0.4em; }
p { margin: 0 0 1.5em; }
a { color: #2563eb; text-decoration: none; font-weight: 500; }
a:hover { text-decoration: underline; }
blockquote { margin: 1.5em 0; padding: 0.5em 1.2em; border-left: 2px solid #cbd5e1; color: #64748b; }
blockquote p { margin: 0; }
ul, ol { padding-left: 24px; margin: 0.5em 0; }
li { margin-bottom: 0.3em; }
code { font-family: "SF Mono", "Cascadia Code", "JetBrains Mono", Consolas, monospace; font-size: 0.9em; background: #f1f5f9; padding: 2px 6px; border-radius: 3px; }
pre { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 16px; overflow-x: auto; margin: 1.5em 0; }
pre code { background: transparent; padding: 0; font-size: 13px; }
table { width: 100%; border-collapse: collapse; margin: 1.5em 0; }
th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; }
th { background: #f8fafc; font-weight: 500; }
hr { border: none; border-top: 1px solid #e2e8f0; margin: 2em 0; }
img { max-width: 100%; border-radius: 4px; margin: 1.5em 0; }
.task-list-item { list-style: none; }`,
  },  {
    id: "news",
    name: "新闻体",
    builtIn: true,
    desc: "报刊新闻风格，严谨工整",
    css: `/* 新闻体主题 */
body { font-family: 'Noto Serif SC', 'Source Han Serif SC', Georgia, 'Times New Roman', serif; font-size: 16px; line-height: 1.85; color: #222; max-width: 780px; margin: 0 auto; padding: 40px 32px; }
h1 { font-size: 28px; font-weight: 700; margin: 1.2em 0 0.5em; line-height: 1.25; text-align: center; }
h2 { font-size: 22px; font-weight: 700; margin: 1.2em 0 0.4em; border-left: 4px solid #c00; padding-left: 12px; }
h3 { font-size: 18px; font-weight: 700; margin: 1em 0 0.4em; }
p { margin: 0 0 1.2em; text-indent: 2em; }
h2 + p, h3 + p { text-indent: 0; }
a { color: #c00; text-decoration: none; }
a:hover { text-decoration: underline; }
blockquote { margin: 1em 0; padding: 0.8em 1.2em; border-left: 3px solid #c00; color: #555; background: #f9f9f9; border-radius: 0 4px 4px 0; }
blockquote p { margin: 0; text-indent: 0; }
ul, ol { padding-left: 28px; margin: 0.5em 0; }
li { margin-bottom: 0.3em; }
code { font-family: 'SF Mono', Consolas, monospace; font-size: 0.9em; background: #f5f5f5; padding: 2px 5px; border-radius: 3px; }
pre { background: #f8f8f8; border: 1px solid #ddd; border-radius: 4px; padding: 14px; overflow-x: auto; margin: 1em 0; }
pre code { background: transparent; padding: 0; font-size: 13px; }
table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 14px; }
th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
th { background: #f8f8f8; font-weight: 600; }
hr { border: none; border-top: 1px solid #ddd; margin: 1.5em 0; }
img { max-width: 100%; border-radius: 4px; margin: 1em 0; }`,
  },
  {
    id: "literary",
    name: "文艺风",
    builtIn: true,
    desc: "文艺清新，阅读感舒适",
    css: `/* 文艺风主题 */
body { font-family: 'KaiTi', 'STKaiti', 'Noto Serif SC', serif; font-size: 16px; line-height: 2; color: #333; max-width: 720px; margin: 0 auto; padding: 40px 40px; }
h1 { font-size: 26px; font-weight: 400; margin: 1.5em 0 0.8em; line-height: 1.3; letter-spacing: 2px; text-align: center; color: #333; }
h2 { font-size: 20px; font-weight: 500; margin: 1.2em 0 0.5em; letter-spacing: 1px; color: #444; }
h3 { font-size: 17px; font-weight: 500; margin: 1em 0 0.4em; }
p { margin: 0 0 1.4em; text-indent: 2em; line-height: 2; }
a { color: #6b4c3b; text-decoration: underline; text-underline-offset: 3px; }
blockquote { margin: 1.2em 0; padding: 0.8em 1.5em; border-left: 3px solid #c4a882; color: #666; background: #faf8f5; border-radius: 0 6px 6px 0; }
blockquote p { margin: 0; text-indent: 0; }
ul, ol { padding-left: 28px; margin: 0.5em 0; }
li { margin-bottom: 0.4em; }
code { font-family: 'SF Mono', Consolas, monospace; font-size: 0.88em; background: #f5f0eb; padding: 2px 6px; border-radius: 3px; color: #8b5e3c; }
pre { background: #faf8f5; border: 1px solid #e8e0d6; border-radius: 6px; padding: 16px; overflow-x: auto; margin: 1.2em 0; }
pre code { background: transparent; padding: 0; font-size: 13px; color: #333; }
table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 14px; }
th, td { border: 1px solid #e0d6c8; padding: 8px 12px; text-align: left; }
th { background: #faf8f5; font-weight: 500; }
hr { border: none; border-top: 1px solid #e0d6c8; margin: 2em 0; }
img { max-width: 100%; border-radius: 6px; margin: 1em 0; }`,
  },
  {
    id: "minimal",
    name: "极简风",
    builtIn: true,
    desc: "极简干净，少即是多",
    css: `/* 极简风主题 */
body { font-family: -apple-system, 'PingFang SC', 'Noto Sans SC', sans-serif; font-size: 15px; line-height: 1.8; color: #2c2c2c; max-width: 700px; margin: 0 auto; padding: 48px 32px; }
h1 { font-size: 24px; font-weight: 300; margin: 1.5em 0 0.6em; letter-spacing: 1px; color: #111; }
h2 { font-size: 18px; font-weight: 500; margin: 1.2em 0 0.4em; color: #222; }
h3 { font-size: 15px; font-weight: 600; margin: 1em 0 0.3em; text-transform: uppercase; letter-spacing: 1px; color: #555; }
p { margin: 0 0 1.2em; }
a { color: #333; text-decoration: none; border-bottom: 1px solid #ccc; }
a:hover { border-bottom-color: #333; }
blockquote { margin: 1em 0; padding: 0.5em 1.2em; border-left: 2px solid #999; color: #666; }
blockquote p { margin: 0; }
ul, ol { padding-left: 20px; margin: 0.5em 0; }
li { margin-bottom: 0.2em; }
code { font-family: 'SF Mono', Consolas, monospace; font-size: 0.85em; color: #555; }
pre { background: #f8f8f8; border-radius: 4px; padding: 14px; overflow-x: auto; margin: 1em 0; }
pre code { background: transparent; padding: 0; font-size: 13px; }
table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 14px; }
th, td { border: 1px solid #eee; padding: 6px 12px; text-align: left; }
th { background: #fafafa; font-weight: 500; }
hr { border: none; border-top: 1px solid #eee; margin: 2em 0; }
img { max-width: 100%; border-radius: 4px; margin: 1em 0; }`,
  },
  {
    id: "wechat",
    name: "公众号风",
    builtIn: true,
    desc: "微信公众号排版风格，适合传播",
    css: `/* 公众号风主题 */
body { font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Noto Sans SC', 'Microsoft YaHei', sans-serif; font-size: 15px; line-height: 1.75; color: #333; max-width: 680px; margin: 0 auto; padding: 32px 24px; }
h1 { font-size: 22px; font-weight: 700; margin: 1.2em 0 0.5em; text-align: center; color: #111; }
h2 { font-size: 18px; font-weight: 700; margin: 1em 0 0.4em; background: linear-gradient(to right, #f8f8f8, transparent); padding: 8px 12px; border-radius: 4px; }
h3 { font-size: 16px; font-weight: 650; margin: 0.8em 0 0.3em; }
p { margin: 0 0 1em; font-size: 15px; letter-spacing: 0.5px; }
a { color: #07c160; text-decoration: none; }
blockquote { margin: 1em 0; padding: 0.6em 1em; border-left: 3px solid #07c160; color: #555; background: #f6fdf9; border-radius: 0 4px 4px 0; }
blockquote p { margin: 0; }
ul, ol { padding-left: 22px; margin: 0.5em 0; }
li { margin-bottom: 0.25em; }
code { font-family: 'SF Mono', Consolas, monospace; font-size: 0.88em; background: #f0f0f0; padding: 2px 5px; border-radius: 3px; }
pre { background: #f7f7f7; border-radius: 6px; padding: 14px; overflow-x: auto; margin: 1em 0; }
pre code { background: transparent; padding: 0; font-size: 13px; }
table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 14px; }
th, td { border: 1px solid #e8e8e8; padding: 8px 12px; text-align: left; }
th { background: #f7f7f7; font-weight: 600; }
hr { border: none; border-top: 1px solid #eee; margin: 1.5em 0; }
img { max-width: 100%; border-radius: 4px; margin: 0.8em 0; }`,
  },
  {
    id: "tech",
    name: "技术风",
    builtIn: true,
    desc: "技术文档风格，适合开发博客",
    css: `/* 技术风主题 */
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.7; color: #24292f; max-width: 860px; margin: 0 auto; padding: 40px 32px; }
h1 { font-size: 26px; font-weight: 600; margin: 1em 0 0.5em; border-bottom: 1px solid #d0d7de; padding-bottom: 8px; }
h2 { font-size: 20px; font-weight: 600; margin: 1em 0 0.4em; border-bottom: 1px solid #d0d7de; padding-bottom: 6px; }
h3 { font-size: 16px; font-weight: 600; margin: 0.8em 0 0.3em; }
p { margin: 0 0 1em; }
a { color: #0969da; text-decoration: none; }
a:hover { text-decoration: underline; }
blockquote { margin: 1em 0; padding: 0.5em 1em; border-left: 4px solid #d0d7de; color: #57606a; background: #f6f8fa; border-radius: 0 6px 6px 0; }
blockquote p { margin: 0; }
ul, ol { padding-left: 24px; margin: 0.5em 0; }
li { margin-bottom: 0.2em; }
code { font-family: 'SF Mono', 'Cascadia Code', Consolas, monospace; font-size: 0.88em; background: rgba(175,184,193,0.15); padding: 3px 6px; border-radius: 4px; }
pre { background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 6px; padding: 16px; overflow-x: auto; margin: 1em 0; }
pre code { background: transparent; padding: 0; font-size: 13px; }
table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 14px; }
th, td { border: 1px solid #d0d7de; padding: 8px 12px; text-align: left; }
th { background: #f6f8fa; font-weight: 600; }
hr { border: none; border-top: 1px solid #d0d7de; margin: 1.5em 0; }
img { max-width: 100%; border-radius: 6px; margin: 1em 0; }
.task-list-item { list-style: none; }
.task-list-item input[type='checkbox'] { margin-right: 6px; }`,
  },
  {
    id: "elegant",
    name: "典雅风",
    builtIn: true,
    desc: "典雅庄重，适合正式文章",
    css: `/* 典雅风主题 */
body { font-family: 'Noto Serif SC', 'Source Han Serif SC', 'Times New Roman', Georgia, serif; font-size: 16px; line-height: 1.9; color: #2c2c2c; max-width: 740px; margin: 0 auto; padding: 48px 40px; background: #fefcf8; }
h1 { font-size: 28px; font-weight: 400; margin: 1.5em 0 0.6em; letter-spacing: 2px; color: #1a1a1a; text-align: center; }
h2 { font-size: 20px; font-weight: 500; margin: 1.3em 0 0.4em; letter-spacing: 1px; color: #333; }
h3 { font-size: 17px; font-weight: 600; margin: 1em 0 0.3em; color: #444; }
p { margin: 0 0 1.4em; text-indent: 2em; }
h2 + p, h3 + p, h1 + p { text-indent: 0; }
a { color: #8b5e3c; text-decoration: underline; text-underline-offset: 2px; }
blockquote { margin: 1.2em 0; padding: 0.8em 1.5em; border-left: 3px solid #c4a882; color: #666; background: #f9f6f0; border-radius: 0 6px 6px 0; font-style: italic; }
blockquote p { margin: 0; text-indent: 0; }
ul, ol { padding-left: 28px; margin: 0.5em 0; }
li { margin-bottom: 0.3em; }
code { font-family: 'SF Mono', Consolas, monospace; font-size: 0.88em; background: #f3efe8; padding: 2px 6px; border-radius: 3px; color: #8b5e3c; }
pre { background: #f9f6f0; border: 1px solid #e8e0d6; border-radius: 6px; padding: 16px; overflow-x: auto; margin: 1.2em 0; }
pre code { background: transparent; padding: 0; font-size: 13px; color: #2c2c2c; }
table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 14px; }
th, td { border: 1px solid #e0d6c8; padding: 8px 14px; text-align: left; }
th { background: #f9f6f0; font-weight: 500; }
hr { border: none; border-top: 1px solid #e0d6c8; margin: 2em 0; }
img { max-width: 100%; border-radius: 4px; margin: 1em 0; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }`,
  },
  {
    id: "orange-heart",
    name: "橙心",
    builtIn: true,
    desc: "温暖橙色系，阳光活力",
    css: `/* 橙心主题 */
body { font-family: -apple-system, "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif; font-size: 15px; line-height: 1.75; color: #333; max-width: 820px; margin: 0 auto; padding: 40px 32px; }
h1 { font-size: 26px; font-weight: 700; margin: 1.2em 0 0.5em; color: #e67e22; }
h2 { font-size: 20px; font-weight: 700; margin: 1em 0 0.4em; border-left: 4px solid #d35400; padding-left: 12px; color: #d35400; }
h3 { font-size: 17px; font-weight: 650; margin: 0.8em 0 0.3em; color: #e67e22; }
p { margin: 0 0 1.2em; }
a { color: #e67e22; text-decoration: none; }
a:hover { text-decoration: underline; }
blockquote { margin: 1em 0; padding: 0.8em 1.2em; border-left: 4px solid #d35400; color: #666; background: #fef9f0; border-radius: 0 6px 6px 0; }
blockquote p { margin: 0; }
ul, ol { padding-left: 24px; margin: 0.5em 0; }
li { margin-bottom: 0.25em; }
code { font-family: "SF Mono", Consolas, monospace; font-size: 0.9em; background: #fef5e7; padding: 2px 6px; border-radius: 4px; color: #d35400; }
pre { background: #fef5e7; border: 1px solid #fdebd0; border-radius: 6px; padding: 14px; overflow-x: auto; margin: 1em 0; }
pre code { background: transparent; padding: 0; font-size: 13px; color: #333; }
table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 14px; }
th, td { border: 1px solid #fdebd0; padding: 8px 12px; text-align: left; }
th { background: #fef5e7; font-weight: 600; }

hr { border: none; border-top: 1px solid #fdebd0; margin: 1.5em 0; }
img { max-width: 100%; border-radius: 4px; margin: 1em 0; }`,
  },

  {
    id: "purple-grace",
    name: "姹紫",
    builtIn: true,
    desc: "紫色系主题，优雅大气",
    css: `/* 姹紫主题 */
body { font-family: -apple-system, "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif; font-size: 15px; line-height: 1.75; color: #333; max-width: 820px; margin: 0 auto; padding: 40px 32px; }
h1 { font-size: 26px; font-weight: 700; margin: 1.2em 0 0.5em; color: #8e44ad; }
h2 { font-size: 20px; font-weight: 700; margin: 1em 0 0.4em; border-left: 4px solid #7d3c98; padding-left: 12px; color: #7d3c98; }
h3 { font-size: 17px; font-weight: 650; margin: 0.8em 0 0.3em; color: #8e44ad; }
p { margin: 0 0 1.2em; }
a { color: #8e44ad; text-decoration: none; }
a:hover { text-decoration: underline; }
blockquote { margin: 1em 0; padding: 0.8em 1.2em; border-left: 4px solid #7d3c98; color: #666; background: #f5eef8; border-radius: 0 6px 6px 0; }
blockquote p { margin: 0; }
ul, ol { padding-left: 24px; margin: 0.5em 0; }
li { margin-bottom: 0.25em; }
code { font-family: "SF Mono", Consolas, monospace; font-size: 0.9em; background: #f4ecf7; padding: 2px 6px; border-radius: 4px; color: #7d3c98; }
pre { background: #f4ecf7; border: 1px solid #e8daef; border-radius: 6px; padding: 14px; overflow-x: auto; margin: 1em 0; }
pre code { background: transparent; padding: 0; font-size: 13px; color: #333; }
table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 14px; }
th, td { border: 1px solid #e8daef; padding: 8px 12px; text-align: left; }
th { background: #f4ecf7; font-weight: 600; }

hr { border: none; border-top: 1px solid #e8daef; margin: 1.5em 0; }
img { max-width: 100%; border-radius: 4px; margin: 1em 0; }`,
  },

  {
    id: "fresh-green",
    name: "嫩青",
    builtIn: true,
    desc: "清新嫩绿色调，自然舒适",
    css: `/* 嫩青主题 */
body { font-family: -apple-system, "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif; font-size: 15px; line-height: 1.75; color: #333; max-width: 820px; margin: 0 auto; padding: 40px 32px; }
h1 { font-size: 26px; font-weight: 700; margin: 1.2em 0 0.5em; color: #27ae60; }
h2 { font-size: 20px; font-weight: 700; margin: 1em 0 0.4em; border-left: 4px solid #1e8449; padding-left: 12px; color: #1e8449; }
h3 { font-size: 17px; font-weight: 650; margin: 0.8em 0 0.3em; color: #27ae60; }
p { margin: 0 0 1.2em; }
a { color: #27ae60; text-decoration: none; }
a:hover { text-decoration: underline; }
blockquote { margin: 1em 0; padding: 0.8em 1.2em; border-left: 4px solid #1e8449; color: #666; background: #eafaf1; border-radius: 0 6px 6px 0; }
blockquote p { margin: 0; }
ul, ol { padding-left: 24px; margin: 0.5em 0; }
li { margin-bottom: 0.25em; }
code { font-family: "SF Mono", Consolas, monospace; font-size: 0.9em; background: #eafaf1; padding: 2px 6px; border-radius: 4px; color: #1e8449; }
pre { background: #eafaf1; border: 1px solid #d5f5e3; border-radius: 6px; padding: 14px; overflow-x: auto; margin: 1em 0; }
pre code { background: transparent; padding: 0; font-size: 13px; color: #333; }
table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 14px; }
th, td { border: 1px solid #d5f5e3; padding: 8px 12px; text-align: left; }
th { background: #eafaf1; font-weight: 600; }

hr { border: none; border-top: 1px solid #d5f5e3; margin: 1.5em 0; }
img { max-width: 100%; border-radius: 4px; margin: 1em 0; }`,
  },

  {
    id: "green-meaning",
    name: "绿意",
    builtIn: true,
    desc: "深绿色系，沉稳有生机",
    css: `/* 绿意主题 */
body { font-family: -apple-system, "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif; font-size: 15px; line-height: 1.75; color: #333; max-width: 820px; margin: 0 auto; padding: 40px 32px; }
h1 { font-size: 26px; font-weight: 700; margin: 1.2em 0 0.5em; color: #1a7a3a; }
h2 { font-size: 20px; font-weight: 700; margin: 1em 0 0.4em; border-left: 4px solid #145a32; padding-left: 12px; color: #145a32; }
h3 { font-size: 17px; font-weight: 650; margin: 0.8em 0 0.3em; color: #1a7a3a; }
p { margin: 0 0 1.2em; }
a { color: #1a7a3a; text-decoration: none; }
a:hover { text-decoration: underline; }
blockquote { margin: 1em 0; padding: 0.8em 1.2em; border-left: 4px solid #145a32; color: #666; background: #e8f8f0; border-radius: 0 6px 6px 0; }
blockquote p { margin: 0; }
ul, ol { padding-left: 24px; margin: 0.5em 0; }
li { margin-bottom: 0.25em; }
code { font-family: "SF Mono", Consolas, monospace; font-size: 0.9em; background: #e8f8f0; padding: 2px 6px; border-radius: 4px; color: #145a32; }
pre { background: #e8f8f0; border: 1px solid #a9dfbf; border-radius: 6px; padding: 14px; overflow-x: auto; margin: 1em 0; }
pre code { background: transparent; padding: 0; font-size: 13px; color: #333; }
table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 14px; }
th, td { border: 1px solid #a9dfbf; padding: 8px 12px; text-align: left; }
th { background: #e8f8f0; font-weight: 600; }

hr { border: none; border-top: 1px solid #a9dfbf; margin: 1.5em 0; }
img { max-width: 100%; border-radius: 4px; margin: 1em 0; }`,
  },

  {
    id: "red-crimson",
    name: "红绯",
    builtIn: true,
    desc: "红色系，热情醒目",
    css: `/* 红绯主题 */
body { font-family: -apple-system, "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif; font-size: 15px; line-height: 1.75; color: #333; max-width: 820px; margin: 0 auto; padding: 40px 32px; }
h1 { font-size: 26px; font-weight: 700; margin: 1.2em 0 0.5em; color: #c0392b; }
h2 { font-size: 20px; font-weight: 700; margin: 1em 0 0.4em; border-left: 4px solid #a93226; padding-left: 12px; color: #a93226; }
h3 { font-size: 17px; font-weight: 650; margin: 0.8em 0 0.3em; color: #c0392b; }
p { margin: 0 0 1.2em; }
a { color: #c0392b; text-decoration: none; }
a:hover { text-decoration: underline; }
blockquote { margin: 1em 0; padding: 0.8em 1.2em; border-left: 4px solid #a93226; color: #666; background: #fdedec; border-radius: 0 6px 6px 0; }
blockquote p { margin: 0; }
ul, ol { padding-left: 24px; margin: 0.5em 0; }
li { margin-bottom: 0.25em; }
code { font-family: "SF Mono", Consolas, monospace; font-size: 0.9em; background: #fdedec; padding: 2px 6px; border-radius: 4px; color: #a93226; }
pre { background: #fdedec; border: 1px solid #f5b7b1; border-radius: 6px; padding: 14px; overflow-x: auto; margin: 1em 0; }
pre code { background: transparent; padding: 0; font-size: 13px; color: #333; }
table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 14px; }
th, td { border: 1px solid #f5b7b1; padding: 8px 12px; text-align: left; }
th { background: #fdedec; font-weight: 600; }

hr { border: none; border-top: 1px solid #f5b7b1; margin: 1.5em 0; }
img { max-width: 100%; border-radius: 4px; margin: 1em 0; }`,
  },

  {
    id: "blue-clear",
    name: "蓝莹",
    builtIn: true,
    desc: "清澈蓝色调，冷静专业",
    css: `/* 蓝莹主题 */
body { font-family: -apple-system, "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif; font-size: 15px; line-height: 1.75; color: #333; max-width: 820px; margin: 0 auto; padding: 40px 32px; }
h1 { font-size: 26px; font-weight: 700; margin: 1.2em 0 0.5em; color: #2980b9; }
h2 { font-size: 20px; font-weight: 700; margin: 1em 0 0.4em; border-left: 4px solid #1f618d; padding-left: 12px; color: #1f618d; }
h3 { font-size: 17px; font-weight: 650; margin: 0.8em 0 0.3em; color: #2980b9; }
p { margin: 0 0 1.2em; }
a { color: #2980b9; text-decoration: none; }
a:hover { text-decoration: underline; }
blockquote { margin: 1em 0; padding: 0.8em 1.2em; border-left: 4px solid #1f618d; color: #666; background: #eaf2f8; border-radius: 0 6px 6px 0; }
blockquote p { margin: 0; }
ul, ol { padding-left: 24px; margin: 0.5em 0; }
li { margin-bottom: 0.25em; }
code { font-family: "SF Mono", Consolas, monospace; font-size: 0.9em; background: #eaf2f8; padding: 2px 6px; border-radius: 4px; color: #1f618d; }
pre { background: #eaf2f8; border: 1px solid #aed6f1; border-radius: 6px; padding: 14px; overflow-x: auto; margin: 1em 0; }
pre code { background: transparent; padding: 0; font-size: 13px; color: #333; }
table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 14px; }
th, td { border: 1px solid #aed6f1; padding: 8px 12px; text-align: left; }
th { background: #eaf2f8; font-weight: 600; }

hr { border: none; border-top: 1px solid #aed6f1; margin: 1.5em 0; }
img { max-width: 100%; border-radius: 4px; margin: 1em 0; }`,
  },

  {
    id: "blue-green",
    name: "兰青",
    builtIn: true,
    desc: "蓝绿色调，雅致清新",
    css: `/* 兰青主题 */
body { font-family: -apple-system, "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif; font-size: 15px; line-height: 1.75; color: #333; max-width: 820px; margin: 0 auto; padding: 40px 32px; }
h1 { font-size: 26px; font-weight: 700; margin: 1.2em 0 0.5em; color: #16a085; }
h2 { font-size: 20px; font-weight: 700; margin: 1em 0 0.4em; border-left: 4px solid #117a65; padding-left: 12px; color: #117a65; }
h3 { font-size: 17px; font-weight: 650; margin: 0.8em 0 0.3em; color: #16a085; }
p { margin: 0 0 1.2em; }
a { color: #16a085; text-decoration: none; }
a:hover { text-decoration: underline; }
blockquote { margin: 1em 0; padding: 0.8em 1.2em; border-left: 4px solid #117a65; color: #666; background: #e8f8f5; border-radius: 0 6px 6px 0; }
blockquote p { margin: 0; }
ul, ol { padding-left: 24px; margin: 0.5em 0; }
li { margin-bottom: 0.25em; }
code { font-family: "SF Mono", Consolas, monospace; font-size: 0.9em; background: #e8f8f5; padding: 2px 6px; border-radius: 4px; color: #117a65; }
pre { background: #e8f8f5; border: 1px solid #a3e4d7; border-radius: 6px; padding: 14px; overflow-x: auto; margin: 1em 0; }
pre code { background: transparent; padding: 0; font-size: 13px; color: #333; }
table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 14px; }
th, td { border: 1px solid #a3e4d7; padding: 8px 12px; text-align: left; }
th { background: #e8f8f5; font-weight: 600; }

hr { border: none; border-top: 1px solid #a3e4d7; margin: 1.5em 0; }
img { max-width: 100%; border-radius: 4px; margin: 1em 0; }`,
  },

  {
    id: "golden-mountain",
    name: "山吹",
    builtIn: true,
    desc: "金黄色调，温暖灿烂",
    css: `/* 山吹主题 */
body { font-family: -apple-system, "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif; font-size: 15px; line-height: 1.75; color: #333; max-width: 820px; margin: 0 auto; padding: 40px 32px; }
h1 { font-size: 26px; font-weight: 700; margin: 1.2em 0 0.5em; color: #d4a017; }
h2 { font-size: 20px; font-weight: 700; margin: 1em 0 0.4em; border-left: 4px solid #b7950b; padding-left: 12px; color: #b7950b; }
h3 { font-size: 17px; font-weight: 650; margin: 0.8em 0 0.3em; color: #d4a017; }
p { margin: 0 0 1.2em; }
a { color: #d4a017; text-decoration: none; }
a:hover { text-decoration: underline; }
blockquote { margin: 1em 0; padding: 0.8em 1.2em; border-left: 4px solid #b7950b; color: #666; background: #fef9e7; border-radius: 0 6px 6px 0; }
blockquote p { margin: 0; }
ul, ol { padding-left: 24px; margin: 0.5em 0; }
li { margin-bottom: 0.25em; }
code { font-family: "SF Mono", Consolas, monospace; font-size: 0.9em; background: #fef9e7; padding: 2px 6px; border-radius: 4px; color: #b7950b; }
pre { background: #fef9e7; border: 1px solid #f9e79f; border-radius: 6px; padding: 14px; overflow-x: auto; margin: 1em 0; }
pre code { background: transparent; padding: 0; font-size: 13px; color: #333; }
table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 14px; }
th, td { border: 1px solid #f9e79f; padding: 8px 12px; text-align: left; }
th { background: #fef9e7; font-weight: 600; }

hr { border: none; border-top: 1px solid #f9e79f; margin: 1.5em 0; }
img { max-width: 100%; border-radius: 4px; margin: 1em 0; }`,
  },

  {
    id: "frontpeak",
    name: "前端之巅同款",
    builtIn: true,
    desc: "前端技术博客经典风格",
    css: `/* 前端之巅主题 */
body { font-family: -apple-system, "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif; font-size: 15px; line-height: 1.75; color: #333; max-width: 820px; margin: 0 auto; padding: 40px 32px; }
h1 { font-size: 26px; font-weight: 700; margin: 1.2em 0 0.5em; color: #e96900; }
h2 { font-size: 20px; font-weight: 700; margin: 1em 0 0.4em; border-left: 4px solid #c06; padding-left: 12px; color: #c06; }
h3 { font-size: 17px; font-weight: 650; margin: 0.8em 0 0.3em; color: #e96900; }
p { margin: 0 0 1.2em; }
a { color: #e96900; text-decoration: none; }
a:hover { text-decoration: underline; }
blockquote { margin: 1em 0; padding: 0.8em 1.2em; border-left: 4px solid #c06; color: #666; background: #fff8f0; border-radius: 0 6px 6px 0; }
blockquote p { margin: 0; }
ul, ol { padding-left: 24px; margin: 0.5em 0; }
li { margin-bottom: 0.25em; }
code { font-family: "SF Mono", Consolas, monospace; font-size: 0.9em; background: #fff5e6; padding: 2px 6px; border-radius: 4px; color: #c06; }
pre { background: #fff5e6; border: 1px solid #eee; border-radius: 6px; padding: 14px; overflow-x: auto; margin: 1em 0; }
pre code { background: transparent; padding: 0; font-size: 13px; color: #333; }
table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 14px; }
th, td { border: 1px solid #eee; padding: 8px 12px; text-align: left; }
th { background: #fafafa; font-weight: 600; }

hr { border: none; border-top: 1px solid #eee; margin: 1.5em 0; }
img { max-width: 100%; border-radius: 4px; margin: 1em 0; }`,
  },

  {
    id: "geek-dark",
    name: "极客黑",
    builtIn: true,
    desc: "深色背景，代码极客风格",
    css: `/* 极客黑主题 */
body { font-family: -apple-system, "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif; font-size: 15px; line-height: 1.75; color: #d4d4d4; max-width: 820px; margin: 0 auto; padding: 40px 32px; background: #1e1e1e; }
h1 { font-size: 26px; font-weight: 700; margin: 1.2em 0 0.5em; color: #569cd6; }
h2 { font-size: 20px; font-weight: 700; margin: 1em 0 0.4em; border-left: 4px solid #4ec9b0; padding-left: 12px; color: #4ec9b0; }
h3 { font-size: 17px; font-weight: 650; margin: 0.8em 0 0.3em; color: #569cd6; }
p { margin: 0 0 1.2em; color: #d4d4d4; }
a { color: #569cd6; text-decoration: none; }
a:hover { text-decoration: underline; }
blockquote { margin: 1em 0; padding: 0.8em 1.2em; border-left: 4px solid #4ec9b0; color: #666; background: #2d2d2d; border-radius: 0 6px 6px 0; }
blockquote p { margin: 0; }
ul, ol { padding-left: 24px; margin: 0.5em 0; }
li { margin-bottom: 0.25em; color: #d4d4d4; }
code { font-family: "SF Mono", Consolas, monospace; font-size: 0.9em; background: #3c3c3c; padding: 2px 6px; border-radius: 4px; color: #4ec9b0; }
pre { background: #3c3c3c; border: 1px solid #3c3c3c; border-radius: 6px; padding: 14px; overflow-x: auto; margin: 1em 0; }
pre code { background: transparent; padding: 0; font-size: 13px; color: #d4d4d4; }
table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 14px; }
th, td { border: 1px solid #3c3c3c; padding: 8px 12px; text-align: left; }
th { background: #2d2d2d; font-weight: 600; color: #d4d4d4; }
td { color: #d4d4d4; }
hr { border: none; border-top: 1px solid #3c3c3c; margin: 1.5em 0; }
img { max-width: 100%; border-radius: 4px; margin: 1em 0; }`,
  },

  {
    id: "rose-purple",
    name: "蔷薇紫",
    builtIn: true,
    desc: "蔷薇紫色，浪漫温柔",
    css: `/* 蔷薇紫主题 */
body { font-family: -apple-system, "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif; font-size: 15px; line-height: 1.75; color: #333; max-width: 820px; margin: 0 auto; padding: 40px 32px; background: #fef9ff; }
h1 { font-size: 26px; font-weight: 700; margin: 1.2em 0 0.5em; color: #d56e8e; }
h2 { font-size: 20px; font-weight: 700; margin: 1em 0 0.4em; border-left: 4px solid #c45a7c; padding-left: 12px; color: #c45a7c; }
h3 { font-size: 17px; font-weight: 650; margin: 0.8em 0 0.3em; color: #d56e8e; }
p { margin: 0 0 1.2em; }
a { color: #d56e8e; text-decoration: none; }
a:hover { text-decoration: underline; }
blockquote { margin: 1em 0; padding: 0.8em 1.2em; border-left: 4px solid #c45a7c; color: #666; background: #fdf0f5; border-radius: 0 6px 6px 0; }
blockquote p { margin: 0; }
ul, ol { padding-left: 24px; margin: 0.5em 0; }
li { margin-bottom: 0.25em; }
code { font-family: "SF Mono", Consolas, monospace; font-size: 0.9em; background: #fdf0f5; padding: 2px 6px; border-radius: 4px; color: #c45a7c; }
pre { background: #fdf0f5; border: 1px solid #f5d6e0; border-radius: 6px; padding: 14px; overflow-x: auto; margin: 1em 0; }
pre code { background: transparent; padding: 0; font-size: 13px; color: #333; }
table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 14px; }
th, td { border: 1px solid #f5d6e0; padding: 8px 12px; text-align: left; }
th { background: #fdf0f5; font-weight: 600; }

hr { border: none; border-top: 1px solid #f5d6e0; margin: 1.5em 0; }
img { max-width: 100%; border-radius: 4px; margin: 1em 0; }`,
  },

  {
    id: "cute-green",
    name: "萌绿",
    builtIn: true,
    desc: "明亮嫩绿，活泼可爱",
    css: `/* 萌绿主题 */
body { font-family: -apple-system, "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif; font-size: 15px; line-height: 1.75; color: #333; max-width: 820px; margin: 0 auto; padding: 40px 32px; }
h1 { font-size: 26px; font-weight: 700; margin: 1.2em 0 0.5em; color: #58d68d; }
h2 { font-size: 20px; font-weight: 700; margin: 1em 0 0.4em; border-left: 4px solid #2ecc71; padding-left: 12px; color: #2ecc71; }
h3 { font-size: 17px; font-weight: 650; margin: 0.8em 0 0.3em; color: #58d68d; }
p { margin: 0 0 1.2em; }
a { color: #58d68d; text-decoration: none; }
a:hover { text-decoration: underline; }
blockquote { margin: 1em 0; padding: 0.8em 1.2em; border-left: 4px solid #2ecc71; color: #666; background: #eafaf1; border-radius: 0 6px 6px 0; }
blockquote p { margin: 0; }
ul, ol { padding-left: 24px; margin: 0.5em 0; }
li { margin-bottom: 0.25em; }
code { font-family: "SF Mono", Consolas, monospace; font-size: 0.9em; background: #eafaf1; padding: 2px 6px; border-radius: 4px; color: #2ecc71; }
pre { background: #eafaf1; border: 1px solid #abebc6; border-radius: 6px; padding: 14px; overflow-x: auto; margin: 1em 0; }
pre code { background: transparent; padding: 0; font-size: 13px; color: #333; }
table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 14px; }
th, td { border: 1px solid #abebc6; padding: 8px 12px; text-align: left; }
th { background: #eafaf1; font-weight: 600; }

hr { border: none; border-top: 1px solid #abebc6; margin: 1.5em 0; }
img { max-width: 100%; border-radius: 4px; margin: 1em 0; }`,
  },

  {
    id: "fullstack-blue",
    name: "全栈蓝",
    builtIn: true,
    desc: "全栈蓝，沉稳专业",
    css: `/* 全栈蓝主题 */
body { font-family: -apple-system, "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif; font-size: 15px; line-height: 1.75; color: #333; max-width: 820px; margin: 0 auto; padding: 40px 32px; }
h1 { font-size: 26px; font-weight: 700; margin: 1.2em 0 0.5em; color: #1a5276; }
h2 { font-size: 20px; font-weight: 700; margin: 1em 0 0.4em; border-left: 4px solid #1a5276; padding-left: 12px; color: #1a5276; }
h3 { font-size: 17px; font-weight: 650; margin: 0.8em 0 0.3em; color: #1a5276; }
p { margin: 0 0 1.2em; }
a { color: #2471a3; text-decoration: none; }
a:hover { text-decoration: underline; }
blockquote { margin: 1em 0; padding: 0.8em 1.2em; border-left: 4px solid #1a5276; color: #666; background: #eaf2f8; border-radius: 0 6px 6px 0; }
blockquote p { margin: 0; }
ul, ol { padding-left: 24px; margin: 0.5em 0; }
li { margin-bottom: 0.25em; }
code { font-family: "SF Mono", Consolas, monospace; font-size: 0.9em; background: #eaf2f8; padding: 2px 6px; border-radius: 4px; color: #1a5276; }
pre { background: #eaf2f8; border: 1px solid #aed6f1; border-radius: 6px; padding: 14px; overflow-x: auto; margin: 1em 0; }
pre code { background: transparent; padding: 0; font-size: 13px; color: #333; }
table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 14px; }
th, td { border: 1px solid #aed6f1; padding: 8px 12px; text-align: left; }
th { background: #eaf2f8; font-weight: 600; }

hr { border: none; border-top: 1px solid #aed6f1; margin: 1.5em 0; }
img { max-width: 100%; border-radius: 4px; margin: 1em 0; }`,
  },

  {
    id: "minimal-dark",
    name: "极简黑",
    builtIn: true,
    desc: "极简深色风格，低调高级",
    css: `/* 极简黑主题 */
body { font-family: -apple-system, "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif; font-size: 15px; line-height: 1.75; color: #d4d4d4; max-width: 820px; margin: 0 auto; padding: 40px 32px; background: #1e1e1e; }
h1 { font-size: 26px; font-weight: 700; margin: 1.2em 0 0.5em; color: #ffffff; }
h2 { font-size: 20px; font-weight: 700; margin: 1em 0 0.4em; border-left: 4px solid #cccccc; padding-left: 12px; color: #cccccc; }
h3 { font-size: 17px; font-weight: 650; margin: 0.8em 0 0.3em; color: #ffffff; }
p { margin: 0 0 1.2em; color: #d4d4d4; }
a { color: #bbbbbb; text-decoration: none; }
a:hover { text-decoration: underline; }
blockquote { margin: 1em 0; padding: 0.8em 1.2em; border-left: 4px solid #cccccc; color: #666; background: #222; border-radius: 0 6px 6px 0; }
blockquote p { margin: 0; }
ul, ol { padding-left: 24px; margin: 0.5em 0; }
li { margin-bottom: 0.25em; color: #d4d4d4; }
code { font-family: "SF Mono", Consolas, monospace; font-size: 0.9em; background: #2a2a2a; padding: 2px 6px; border-radius: 4px; color: #cccccc; }
pre { background: #2a2a2a; border: 1px solid #333; border-radius: 6px; padding: 14px; overflow-x: auto; margin: 1em 0; }
pre code { background: transparent; padding: 0; font-size: 13px; color: #d4d4d4; }
table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 14px; }
th, td { border: 1px solid #333; padding: 8px 12px; text-align: left; }
th { background: #222; font-weight: 600; color: #d4d4d4; }
td { color: #d4d4d4; }
hr { border: none; border-top: 1px solid #333; margin: 1.5em 0; }
img { max-width: 100%; border-radius: 4px; margin: 1em 0; }`,
  },

  {
    id: "orange-blue",
    name: "橙蓝风",
    builtIn: true,
    desc: "橙蓝撞色，现代动感",
    css: `/* 橙蓝风主题 */
body { font-family: -apple-system, "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif; font-size: 15px; line-height: 1.75; color: #333; max-width: 820px; margin: 0 auto; padding: 40px 32px; }
h1 { font-size: 26px; font-weight: 700; margin: 1.2em 0 0.5em; color: #e67e22; }
h2 { font-size: 20px; font-weight: 700; margin: 1em 0 0.4em; border-left: 4px solid #2980b9; padding-left: 12px; color: #2980b9; }
h3 { font-size: 17px; font-weight: 650; margin: 0.8em 0 0.3em; color: #e67e22; }
p { margin: 0 0 1.2em; }
a { color: #e67e22; text-decoration: none; }
a:hover { text-decoration: underline; }
blockquote { margin: 1em 0; padding: 0.8em 1.2em; border-left: 4px solid #2980b9; color: #666; background: #f0f8ff; border-radius: 0 6px 6px 0; }
blockquote p { margin: 0; }
ul, ol { padding-left: 24px; margin: 0.5em 0; }
li { margin-bottom: 0.25em; }
code { font-family: "SF Mono", Consolas, monospace; font-size: 0.9em; background: #fef5e7; padding: 2px 6px; border-radius: 4px; color: #2980b9; }
pre { background: #fef5e7; border: 1px solid #eee; border-radius: 6px; padding: 14px; overflow-x: auto; margin: 1em 0; }
pre code { background: transparent; padding: 0; font-size: 13px; color: #333; }
table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 14px; }
th, td { border: 1px solid #eee; padding: 8px 12px; text-align: left; }
th { background: #fafafa; font-weight: 600; }

hr { border: none; border-top: 1px solid #eee; margin: 1.5em 0; }
img { max-width: 100%; border-radius: 4px; margin: 1em 0; }`,
  },
];

// ─── Persistence ───

const STORAGE_KEY = "editor-style-templates";
const SELECTED_KEY = "editor-style-template-id";

export function getBuiltinTemplates(): EditorStyleTemplate[] {
  return BUILTIN_TEMPLATES;
}

export function getAllTemplates(): EditorStyleTemplate[] {
  const builtin = BUILTIN_TEMPLATES;
  const custom = loadCustomTemplates();
  const disabledIds = loadDisabledIds();
  const all = [...builtin, ...custom];
  return all.map((t) => ({
    ...t,
    disabled: t.disabled || disabledIds.has(t.id),
  }));
}

function loadDisabledIds(): Set<string> {
  try {
    const raw = localStorage.getItem("editor-style-disabled");
    return new Set<string>(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export function getTemplate(id: string): EditorStyleTemplate | undefined {
  return getAllTemplates().find((t) => t.id === id);
}

export function getSelectedTemplateId(): string {
  try {
    return localStorage.getItem(SELECTED_KEY) || "default";
  } catch {
    return "default";
  }
}

export function getEnabledTemplates(): EditorStyleTemplate[] {
  return getAllTemplates().filter((t) => !t.disabled);
}

export function toggleTemplateEnabled(id: string): void {
  const all = getAllTemplates();
  const t = all.find((t) => t.id === id);
  if (!t) return;
  t.disabled = !t.disabled;
  const customs = all.filter((t) => !t.builtIn);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customs));
  } catch { /* ignore */ }
  const disabledKey = "editor-style-disabled";
  try {
    const disabled = JSON.parse(localStorage.getItem(disabledKey) || "[]");
    const set = new Set<string>(disabled);
    if (t.disabled) set.add(id);
    else set.delete(id);
    localStorage.setItem(disabledKey, JSON.stringify([...set]));
  } catch { /* ignore */ }
}

export function setSelectedTemplateId(id: string): void {
  try {
    localStorage.setItem(SELECTED_KEY, id);
  } catch { /* ignore */ }
}

export function saveCustomTemplate(template: EditorStyleTemplate): void {
  const customs = loadCustomTemplates();
  const idx = customs.findIndex((t) => t.id === template.id);
  if (idx >= 0) {
    customs[idx] = template;
  } else {
    customs.push(template);
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customs));
  } catch { /* ignore */ }
}

export function deleteCustomTemplate(id: string): void {
  const customs = loadCustomTemplates().filter((t) => t.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customs));
  } catch { /* ignore */ }
}

function loadCustomTemplates(): EditorStyleTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const templates: EditorStyleTemplate[] = raw ? JSON.parse(raw) : [];
    // Migrate old object-format css to string format
    return templates.map((t) => {
      if (typeof t.css === "object" && !Array.isArray(t.css)) {
        const obj = t.css as Record<string, string>;
        t.css = Object.entries(obj).map(([k, v]) => `${k}: ${v}`).join(";\n") + ";";
      }
      return t;
    });
  } catch {
    return [];
  }
}

// ─── Temporary style tag injection (for editor preview) ───

let styleTag: HTMLStyleElement | null = null;

export function applyEditorStyle(template: EditorStyleTemplate): void {
  // Create or update a <style> tag that scopes the template CSS to .tiptap
  if (!styleTag) {
    styleTag = document.createElement("style");
    styleTag.id = "editor-template-style";
    document.head.appendChild(styleTag);
  }
  // Scope ALL selectors to .tiptap — prefix each selector group with ".tiptap "
  // while preserving the root body → .tiptap mapping
  const scoped = template.css
    .replace(/\bbody\b(?=\s*\{)/g, ".tiptap")
    .replace(/^\s*([^{}]+?)\s*\{/gm, (match, selectors) => {
      const prefixed = selectors
        .split(",")
        .map((s: string) => {
          const trimmed = s.trim();
          // Already scoped or a pseudo-selector/keyframe
          if (trimmed.startsWith(".tiptap") || trimmed.startsWith("&") || trimmed.startsWith("@") || trimmed.startsWith(":")) return trimmed;
          return ".tiptap " + trimmed;
        })
        .join(", ");
      return " " + prefixed + " {";
    });
  styleTag.textContent = scoped;
}

export function resetEditorStyle(): void {
  if (styleTag) {
    styleTag.remove();
    styleTag = null;
  }
}

// ─── Heading numbering in content (modifies actual markdown) ───

export function addHeadingNumbers(markdown: string): string {
  let h1Count = 0;
  return markdown.split('\n').map(line => {
    const match = line.match(/^(#{1,2})\s+(.+)$/);
    if (!match) return line;
    const level = match[1].length;
    const text = match[2];

    // Strip existing numbering
    const cleanText = text.replace(/^(\d+\.?)+\s+/, '');

    if (level === 1) {
      // h1 (article title) - no numbering
      return '# ' + cleanText;
    }
    // h2 only gets flat numbering starting from 1
    if (level === 2) {
      h1Count++;
      return '## ' + h1Count + '. ' + cleanText;
    }
    return line;
  }).join('\n');
}

export function stripHeadingNumbers(markdown: string): string {
  return markdown.split('\n').map(line => {
    const match = line.match(/^(#{1,6})\s+(\d+\.?)+\s+(.+)$/);
    if (!match) return line;
    return match[1] + ' ' + match[3];
  }).join('\n');
}


// ─── Code theme (highlight.js based) ───

export interface CodeTheme {
  id: string;
  name: string;
  desc: string;
  /** CSS for <pre> and <code> background/text colors */
  css: string;
}

const CODE_THEMES: CodeTheme[] = [
  {
    id: "atom-one-light",
    name: "Atom One Light",
    desc: "清爽明亮，适合浅色主题",
    css: `pre { background: #fafafa !important; color: #383a42 !important; }
pre code.hljs { background: #fafafa; color: #383a42; }
.hljs-comment,.hljs-quote{color:#a0a1a7;font-style:italic}
.hljs-doctag,.hljs-keyword,.hljs-formula{color:#a626a4}
.hljs-section,.hljs-name,.hljs-selector-tag,.hljs-deletion,.hljs-subst{color:#e45649}
.hljs-literal{color:#0184bb}
.hljs-string,.hljs-regexp,.hljs-addition,.hljs-attribute,.hljs-meta .hljs-string{color:#50a14f}
.hljs-attr,.hljs-variable,.hljs-template-variable,.hljs-type,.hljs-selector-class,.hljs-selector-attr,.hljs-selector-pseudo,.hljs-number{color:#986801}
.hljs-symbol,.hljs-bullet,.hljs-link,.hljs-meta,.hljs-selector-id,.hljs-title{color:#4078f2}
.hljs-built_in,.hljs-title.class_,.hljs-class .hljs-title{color:#c18401}
.hljs-emphasis{font-style:italic}
.hljs-strong{font-weight:bold}
.hljs-link{text-decoration:underline}`,
  },
  {
    id: "atom-one-dark",
    name: "Atom One Dark",
    desc: "经典深色，护眼耐看",
    css: `pre { background: #282c34 !important; color: #abb2bf !important; }
pre code.hljs { background: #282c34; color: #abb2bf; }
.hljs-comment,.hljs-quote{color:#5c6370;font-style:italic}
.hljs-doctag,.hljs-keyword,.hljs-formula{color:#c678dd}
.hljs-section,.hljs-name,.hljs-selector-tag,.hljs-deletion,.hljs-subst{color:#e06c75}
.hljs-literal{color:#56b6c2}
.hljs-string,.hljs-regexp,.hljs-addition,.hljs-attribute,.hljs-meta .hljs-string{color:#98c379}
.hljs-attr,.hljs-variable,.hljs-template-variable,.hljs-type,.hljs-selector-class,.hljs-selector-attr,.hljs-selector-pseudo,.hljs-number{color:#d19a66}
.hljs-symbol,.hljs-bullet,.hljs-link,.hljs-meta,.hljs-selector-id,.hljs-title{color:#61afef}
.hljs-built_in,.hljs-title.class_,.hljs-class .hljs-title{color:#e5c07b}
.hljs-emphasis{font-style:italic}
.hljs-strong{font-weight:bold}
.hljs-link{text-decoration:underline}`,
  },
  {
    id: "github",
    name: "GitHub",
    desc: "GitHub 官方浅色代码风格",
    css: `pre { background: #f6f8fa !important; color: #1f2328 !important; }
pre code.hljs { background: #f6f8fa; color: #1f2328; }
.hljs-comment,.hljs-quote{color:#656d76;font-style:italic}
.hljs-doctag,.hljs-keyword{color:#cf222e}
.hljs-section,.hljs-name,.hljs-selector-tag,.hljs-deletion,.hljs-subst{color:#953800}
.hljs-literal{color:#0550ae}
.hljs-string,.hljs-regexp,.hljs-addition,.hljs-attribute,.hljs-meta .hljs-string{color:#116329}
.hljs-attr,.hljs-variable,.hljs-template-variable,.hljs-type,.hljs-selector-class,.hljs-selector-attr,.hljs-selector-pseudo,.hljs-number{color:#953800}
.hljs-symbol,.hljs-bullet,.hljs-link,.hljs-meta,.hljs-selector-id,.hljs-title{color:#0550ae}
.hljs-built_in,.hljs-title.class_,.hljs-class .hljs-title{color:#8250df}
.hljs-emphasis{font-style:italic}
.hljs-strong{font-weight:bold}
.hljs-link{text-decoration:underline}`,
  },
  {
    id: "github-dark",
    name: "GitHub Dark",
    desc: "GitHub 官方深色代码风格",
    css: `pre { background: #0d1117 !important; color: #e6edf3 !important; }
pre code.hljs { background: #0d1117; color: #e6edf3; }
.hljs-comment,.hljs-quote{color:#8b949e;font-style:italic}
.hljs-doctag,.hljs-keyword{color:#ff7b72}
.hljs-section,.hljs-name,.hljs-selector-tag,.hljs-deletion,.hljs-subst{color:#ffa198}
.hljs-literal{color:#79c0ff}
.hljs-string,.hljs-regexp,.hljs-addition,.hljs-attribute,.hljs-meta .hljs-string{color:#a5d6ff}
.hljs-attr,.hljs-variable,.hljs-template-variable,.hljs-type,.hljs-selector-class,.hljs-selector-attr,.hljs-selector-pseudo,.hljs-number{color:#d2a8ff}
.hljs-symbol,.hljs-bullet,.hljs-link,.hljs-meta,.hljs-selector-id,.hljs-title{color:#79c0ff}
.hljs-built_in,.hljs-title.class_,.hljs-class .hljs-title{color:#ffa657}
.hljs-emphasis{font-style:italic}
.hljs-strong{font-weight:bold}
.hljs-link{text-decoration:underline}`,
  },
  {
    id: "monokai",
    name: "Monokai",
    desc: "Sublime Text 经典配色",
    css: `pre { background: #272822 !important; color: #f8f8f2 !important; }
pre code.hljs { background: #272822; color: #f8f8f2; }
.hljs-comment,.hljs-quote{color:#75715e}
.hljs-doctag,.hljs-keyword,.hljs-selector-tag,.hljs-literal,.hljs-deletion{color:#f92672}
.hljs-section,.hljs-name,.hljs-selector-id,.hljs-selector-class,.hljs-title,.hljs-template-variable,.hljs-variable{color:#a6e22e}
.hljs-attr,.hljs-number,.hljs-built_in,.hljs-type{color:#ae81ff}
.hljs-string,.hljs-regexp,.hljs-addition,.hljs-attribute{color:#e6db74}
.hljs-symbol,.hljs-bullet{color:#66d9ef}
.hljs-emphasis{font-style:italic}
.hljs-strong{font-weight:bold}
.hljs-link{text-decoration:underline}`,
  },
  {
    id: "vs2015",
    name: "VS2015",
    desc: "Visual Studio 深色代码主题",
    css: `pre { background: #1e1e1e !important; color: #d4d4d4 !important; }
pre code.hljs { background: #1e1e1e; color: #d4d4d4; }
.hljs-comment,.hljs-quote{color:#6a9955;font-style:italic}
.hljs-doctag,.hljs-keyword,.hljs-formula{color:#569cd6}
.hljs-section,.hljs-name,.hljs-selector-tag,.hljs-deletion,.hljs-subst{color:#f44747}
.hljs-literal{color:#569cd6}
.hljs-string,.hljs-regexp,.hljs-addition,.hljs-attribute,.hljs-meta .hljs-string{color:#ce9178}
.hljs-attr,.hljs-variable,.hljs-template-variable,.hljs-type,.hljs-selector-class,.hljs-selector-attr,.hljs-selector-pseudo,.hljs-number{color:#b5cea8}
.hljs-symbol,.hljs-bullet,.hljs-link,.hljs-meta,.hljs-selector-id,.hljs-title{color:#dcdcaa}
.hljs-built_in,.hljs-title.class_,.hljs-class .hljs-title{color:#4ec9b0}
.hljs-emphasis{font-style:italic}
.hljs-strong{font-weight:bold}
.hljs-link{text-decoration:underline}`,
  },
  {
    id: "dracula",
    name: "Dracula",
    desc: "吸血鬼经典暗色主题",
    css: `pre { background: #282a36 !important; color: #f8f8f2 !important; }
pre code.hljs { background: #282a36; color: #f8f8f2; }
.hljs-comment,.hljs-quote{color:#6272a4}
.hljs-doctag,.hljs-keyword,.hljs-formula,.hljs-selector-tag{color:#ff79c6}
.hljs-section,.hljs-name,.hljs-deletion,.hljs-subst{color:#ff5555}
.hljs-literal{color:#8be9fd}
.hljs-string,.hljs-regexp,.hljs-addition,.hljs-attribute,.hljs-meta .hljs-string{color:#f1fa8c}
.hljs-attr,.hljs-variable,.hljs-template-variable,.hljs-type,.hljs-selector-class,.hljs-selector-attr,.hljs-selector-pseudo,.hljs-number{color:#50fa7b}
.hljs-symbol,.hljs-bullet,.hljs-link,.hljs-meta,.hljs-selector-id,.hljs-title{color:#bd93f9}
.hljs-built_in,.hljs-title.class_,.hljs-class .hljs-title{color:#8be9fd}
.hljs-emphasis{font-style:italic}
.hljs-strong{font-weight:bold}
.hljs-link{text-decoration:underline}`,
  },
  {
    id: "nord",
    name: "Nord",
    desc: "北欧极简风格，柔和舒适",
    css: `pre { background: #2e3440 !important; color: #d8dee9 !important; }
pre code.hljs { background: #2e3440; color: #d8dee9; }
.hljs-comment,.hljs-quote{color:#4c566a;font-style:italic}
.hljs-doctag,.hljs-keyword,.hljs-formula{color:#81a1c1}
.hljs-section,.hljs-name,.hljs-selector-tag,.hljs-deletion,.hljs-subst{color:#bf616a}
.hljs-literal{color:#81a1c1}
.hljs-string,.hljs-regexp,.hljs-addition,.hljs-attribute,.hljs-meta .hljs-string{color:#a3be8c}
.hljs-attr,.hljs-variable,.hljs-template-variable,.hljs-type,.hljs-selector-class,.hljs-selector-attr,.hljs-selector-pseudo,.hljs-number{color:#d08770}
.hljs-symbol,.hljs-bullet,.hljs-link,.hljs-meta,.hljs-selector-id,.hljs-title{color:#88c0d0}
.hljs-built_in,.hljs-title.class_,.hljs-class .hljs-title{color:#8fbcbb}
.hljs-emphasis{font-style:italic}
.hljs-strong{font-weight:bold}
.hljs-link{text-decoration:underline}`,
  },
  {
    id: "solarized-light",
    name: "Solarized Light",
    desc: "暖色调护眼浅色主题",
    css: `pre { background: #fdf6e3 !important; color: #586e75 !important; }
pre code.hljs { background: #fdf6e3; color: #586e75; }
.hljs-comment,.hljs-quote{color:#93a1a1;font-style:italic}
.hljs-doctag,.hljs-keyword,.hljs-formula,.hljs-selector-tag{color:#859900}
.hljs-section,.hljs-name,.hljs-deletion,.hljs-subst{color:#dc322f}
.hljs-literal{color:#2aa198}
.hljs-string,.hljs-regexp,.hljs-addition,.hljs-attribute,.hljs-meta .hljs-string{color:#2aa198}
.hljs-attr,.hljs-variable,.hljs-template-variable,.hljs-type,.hljs-selector-class,.hljs-selector-attr,.hljs-selector-pseudo,.hljs-number{color:#cb4b16}
.hljs-symbol,.hljs-bullet,.hljs-link,.hljs-meta,.hljs-selector-id,.hljs-title{color:#268bd2}
.hljs-built_in,.hljs-title.class_,.hljs-class .hljs-title{color:#b58900}
.hljs-emphasis{font-style:italic}
.hljs-strong{font-weight:bold}
.hljs-link{text-decoration:underline}`,
  },
  {
    id: "solarized-dark",
    name: "Solarized Dark",
    desc: "暖色调护眼深色主题",
    css: `pre { background: #002b36 !important; color: #839496 !important; }
pre code.hljs { background: #002b36; color: #839496; }
.hljs-comment,.hljs-quote{color:#586e75;font-style:italic}
.hljs-doctag,.hljs-keyword,.hljs-formula,.hljs-selector-tag{color:#859900}
.hljs-section,.hljs-name,.hljs-deletion,.hljs-subst{color:#dc322f}
.hljs-literal{color:#2aa198}
.hljs-string,.hljs-regexp,.hljs-addition,.hljs-attribute,.hljs-meta .hljs-string{color:#2aa198}
.hljs-attr,.hljs-variable,.hljs-template-variable,.hljs-type,.hljs-selector-class,.hljs-selector-attr,.hljs-selector-pseudo,.hljs-number{color:#cb4b16}
.hljs-symbol,.hljs-bullet,.hljs-link,.hljs-meta,.hljs-selector-id,.hljs-title{color:#268bd2}
.hljs-built_in,.hljs-title.class_,.hljs-class .hljs-title{color:#b58900}
.hljs-emphasis{font-style:italic}
.hljs-strong{font-weight:bold}
.hljs-link{text-decoration:underline}`,
  },
  {
    id: "one-dark-pro",
    name: "One Dark Pro",
    desc: "VSCode 默认深色，清晰护眼",
    css: `pre { background: #1e2127 !important; color: #abb2bf !important; }
pre code.hljs { background: #1e2127; color: #abb2bf; }
.hljs-comment,.hljs-quote{color:#5c6370;font-style:italic}
.hljs-doctag,.hljs-keyword,.hljs-formula{color:#c678dd}
.hljs-section,.hljs-name,.hljs-selector-tag,.hljs-deletion,.hljs-subst{color:#e06c75}
.hljs-literal{color:#56b6c2}
.hljs-string,.hljs-regexp,.hljs-addition,.hljs-attribute,.hljs-meta .hljs-string{color:#98c379}
.hljs-attr,.hljs-variable,.hljs-template-variable,.hljs-type,.hljs-selector-class,.hljs-selector-attr,.hljs-selector-pseudo,.hljs-number{color:#d19a66}
.hljs-symbol,.hljs-bullet,.hljs-link,.hljs-meta,.hljs-selector-id,.hljs-title{color:#61afef}
.hljs-built_in,.hljs-title.class_,.hljs-class .hljs-title{color:#e5c07b}
.hljs-emphasis{font-style:italic}
.hljs-strong{font-weight:bold}
.hljs-link{text-decoration:underline}`,
  },
  {
    id: "tokyo-night",
    name: "Tokyo Night",
    desc: "东京夜景，紫蓝色调炫酷主题",
    css: `pre { background: #1a1b26 !important; color: #a9b1d6 !important; }
pre code.hljs { background: #1a1b26; color: #a9b1d6; }
.hljs-comment,.hljs-quote{color:#565f89;font-style:italic}
.hljs-doctag,.hljs-keyword,.hljs-formula{color:#bb9af7}
.hljs-section,.hljs-name,.hljs-selector-tag,.hljs-deletion,.hljs-subst{color:#f7768e}
.hljs-literal{color:#7dcfff}
.hljs-string,.hljs-regexp,.hljs-addition,.hljs-attribute,.hljs-meta .hljs-string{color:#9ece6a}
.hljs-attr,.hljs-variable,.hljs-template-variable,.hljs-type,.hljs-selector-class,.hljs-selector-attr,.hljs-selector-pseudo,.hljs-number{color:#ff9e64}
.hljs-symbol,.hljs-bullet,.hljs-link,.hljs-meta,.hljs-selector-id,.hljs-title{color:#7aa2f7}
.hljs-built_in,.hljs-title.class_,.hljs-class .hljs-title{color:#e0af68}
.hljs-emphasis{font-style:italic}
.hljs-strong{font-weight:bold}
.hljs-link{text-decoration:underline}`,
  },
  {
    id: "gruvbox-light",
    name: "Gruvbox Light",
    desc: "复古暖黄，仿纸质阅读感",
    css: `pre { background: #fbf1c7 !important; color: #3c3836 !important; }
pre code.hljs { background: #fbf1c7; color: #3c3836; }
.hljs-comment,.hljs-quote{color:#928374;font-style:italic}
.hljs-doctag,.hljs-keyword,.hljs-formula{color:#9d0006}
.hljs-section,.hljs-name,.hljs-selector-tag,.hljs-deletion,.hljs-subst{color:#9d0006}
.hljs-literal{color:#076678}
.hljs-string,.hljs-regexp,.hljs-addition,.hljs-attribute,.hljs-meta .hljs-string{color:#79740e}
.hljs-attr,.hljs-variable,.hljs-template-variable,.hljs-type,.hljs-selector-class,.hljs-selector-attr,.hljs-selector-pseudo,.hljs-number{color:#8f3f71}
.hljs-symbol,.hljs-bullet,.hljs-link,.hljs-meta,.hljs-selector-id,.hljs-title{color:#076678}
.hljs-built_in,.hljs-title.class_,.hljs-class .hljs-title{color:#b57614}
.hljs-emphasis{font-style:italic}
.hljs-strong{font-weight:bold}
.hljs-link{text-decoration:underline}`,
  },
  {
    id: "gruvbox-dark",
    name: "Gruvbox Dark",
    desc: "复古暗色，温暖护眼",
    css: `pre { background: #282828 !important; color: #ebdbb2 !important; }
pre code.hljs { background: #282828; color: #ebdbb2; }
.hljs-comment,.hljs-quote{color:#928374;font-style:italic}
.hljs-doctag,.hljs-keyword,.hljs-formula{color:#fb4934}
.hljs-section,.hljs-name,.hljs-selector-tag,.hljs-deletion,.hljs-subst{color:#fb4934}
.hljs-literal{color:#83a598}
.hljs-string,.hljs-regexp,.hljs-addition,.hljs-attribute,.hljs-meta .hljs-string{color:#b8bb26}
.hljs-attr,.hljs-variable,.hljs-template-variable,.hljs-type,.hljs-selector-class,.hljs-selector-attr,.hljs-selector-pseudo,.hljs-number{color:#d3869b}
.hljs-symbol,.hljs-bullet,.hljs-link,.hljs-meta,.hljs-selector-id,.hljs-title{color:#83a598}
.hljs-built_in,.hljs-title.class_,.hljs-class .hljs-title{color:#fabd2f}
.hljs-emphasis{font-style:italic}
.hljs-strong{font-weight:bold}
.hljs-link{text-decoration:underline}`,
  },
  {
    id: "material-palenight",
    name: "Material Palenight",
    desc: "Material 紫灰色调，优雅耐看",
    css: `pre { background: #292d3e !important; color: #a6accd !important; }
pre code.hljs { background: #292d3e; color: #a6accd; }
.hljs-comment,.hljs-quote{color:#676e95;font-style:italic}
.hljs-doctag,.hljs-keyword,.hljs-formula{color:#c792ea}
.hljs-section,.hljs-name,.hljs-selector-tag,.hljs-deletion,.hljs-subst{color:#f07178}
.hljs-literal{color:#82aaff}
.hljs-string,.hljs-regexp,.hljs-addition,.hljs-attribute,.hljs-meta .hljs-string{color:#c3e88d}
.hljs-attr,.hljs-variable,.hljs-template-variable,.hljs-type,.hljs-selector-class,.hljs-selector-attr,.hljs-selector-pseudo,.hljs-number{color:#f78c6c}
.hljs-symbol,.hljs-bullet,.hljs-link,.hljs-meta,.hljs-selector-id,.hljs-title{color:#82aaff}
.hljs-built_in,.hljs-title.class_,.hljs-class .hljs-title{color:#ffcb6b}
.hljs-emphasis{font-style:italic}
.hljs-strong{font-weight:bold}
.hljs-link{text-decoration:underline}`,
  },
];

const CODE_THEME_STORAGE_KEY = "editor-code-theme-id";

export function getAllCodeThemes(): CodeTheme[] {
  return CODE_THEMES;
}

export function getCodeTheme(id: string): CodeTheme | undefined {
  return CODE_THEMES.find((t) => t.id === id);
}

export function getSelectedCodeThemeId(): string {
  try {
    return localStorage.getItem(CODE_THEME_STORAGE_KEY) || "atom-one-light";
  } catch {
    return "atom-one-light";
  }
}

export function setSelectedCodeTheme(id: string): void {
  try {
    localStorage.setItem(CODE_THEME_STORAGE_KEY, id);
  } catch {
    // ignore
  }
}

export function applyCodeTheme(themeId: string): void {
  const theme = getCodeTheme(themeId);
  if (!theme) return;
  let tag = document.getElementById("editor-code-theme-style") as HTMLStyleElement;
  if (!tag) {
    tag = document.createElement("style");
    tag.id = "editor-code-theme-style";
    document.head.appendChild(tag);
  }
  tag.textContent = theme.css;
}

export function applyTextStyle(firstLineIndent: boolean, justifyAlign: boolean): void {
  let tag = document.getElementById("editor-text-style") as HTMLStyleElement;
  if (!tag) {
    tag = document.createElement("style");
    tag.id = "editor-text-style";
    document.head.appendChild(tag);
  }
  const rules: string[] = [];
  if (firstLineIndent) {
    rules.push(`.editor-container .tiptap p { text-indent: 2em !important; }`);
  }
  if (justifyAlign) {
    rules.push(`.editor-container .tiptap.ProseMirror { text-align: justify !important; }`);
    rules.push(`.editor-container .tiptap p { text-align: justify !important; }`);
  }
  tag.textContent = rules.join("\n");
}

export function applyHeadingDecorations(headingLevel: string, decos: string[]): void {
  let tag = document.getElementById("editor-heading-deco") as HTMLStyleElement;
  if (!tag) {
    tag = document.createElement("style");
    tag.id = "editor-heading-deco";
    document.head.appendChild(tag);
  }
  if (!headingLevel || decos.length === 0) {
    tag.textContent = "";
    return;
  }
  const sel = `.editor-container .tiptap ${headingLevel}`;
  const parts: string[] = [];
  const extraCss: string[] = [];
  if (decos.includes('underline')) parts.push(`border-bottom: 2px solid var(--accent) !important; padding-bottom: 6px;`);
  if (decos.includes('overline')) parts.push(`border-top: 2px solid var(--accent) !important; padding-top: 6px;`);
  if (decos.includes('left-bar')) parts.push(`border-left: 4px solid var(--accent) !important; padding-left: 14px;`);
  if (decos.includes('right-bar')) parts.push(`border-right: 4px solid var(--accent) !important; padding-right: 14px;`);
  if (decos.includes('bg-block')) parts.push(`background: color-mix(in srgb, var(--accent) 12%, transparent) !important; padding: 4px 10px; border-radius: 6px; display: inline-block;`);
  if (decos.includes('left-icon')) {
    parts.push(`position: relative; padding-left: 1.6em;`);
    extraCss.push(`${sel}::before { content: '▎'; position: absolute; left: 0; color: var(--accent); font-size: 1.2em; font-weight: 700; }`);
  }
  if (decos.includes('badge')) parts.push(`background: var(--accent) !important; color: #fff !important; padding: 2px 12px; border-radius: 12px; display: inline-block; font-size: 0.85em;`);
  tag.textContent = parts.length > 0 ? `${sel} { ${parts.join(' ')} }\n${extraCss.join('\n')}` : "";
}

export function applyBgPattern(pattern: string): void {
  let tag = document.getElementById("editor-bg-pattern") as HTMLStyleElement;
  if (!tag) {
    tag = document.createElement("style");
    tag.id = "editor-bg-pattern";
    document.head.appendChild(tag);
  }
  const patterns: Record<string, string> = {
    'grid': `.editor-container .tiptap.ProseMirror { background-image: linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(0deg, rgba(0,0,0,0.04) 1px, transparent 1px); background-size: 20px 20px; }`,
    'dots': `.editor-container .tiptap.ProseMirror { background-image: radial-gradient(circle, rgba(0,0,0,0.08) 1px, transparent 1px); background-size: 16px 16px; }`,
    'stripes': `.editor-container .tiptap.ProseMirror { background-image: repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.03) 10px, rgba(0,0,0,0.03) 11px); }`,
  };
  tag.textContent = patterns[pattern] || "";
}

export function applyMacosCodeBlockStyle(enabled: boolean): void {
  let tag = document.getElementById("editor-macos-codeblock-style") as HTMLStyleElement;
  if (!tag) {
    tag = document.createElement("style");
    tag.id = "editor-macos-codeblock-style";
    document.head.appendChild(tag);
  }
  if (!enabled) {
    tag.textContent = "";
    return;
  }
  tag.textContent = `.editor-container .tiptap pre {
  position: relative;
  border-radius: 10px;
  box-shadow: 0 6px 16px rgba(0,0,0,0.18);
  padding-top: 36px !important;
  overflow: hidden;
  margin-top: 1.2em;
  margin-bottom: 1.2em;
}
.editor-container .tiptap pre::before {
  content: "";
  display: block;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 28px;
  background: #2b2b2b;
  border-radius: 10px 10px 0 0;
  z-index: 1;
}
.editor-container .tiptap pre::after {
  content: "";
  position: absolute;
  top: 9px;
  left: 12px;
  width: 40px;
  height: 10px;
  z-index: 2;
  pointer-events: none;
  background:
    radial-gradient(circle at 5px 5px, #ff5f57 5px, transparent 5px),
    radial-gradient(circle at 19px 5px, #ffbd2e 5px, transparent 5px),
    radial-gradient(circle at 33px 5px, #28c840 5px, transparent 5px);
}`;
}

