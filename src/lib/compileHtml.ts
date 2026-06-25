import juice from "juice";
import { getSelectedCodeThemeId, getCodeTheme } from "./editorStyles";
import { getSelectedArticleThemeId, getThemeById } from "./articleThemes";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import css from "highlight.js/lib/languages/css";
import json from "highlight.js/lib/languages/json";
import bash from "highlight.js/lib/languages/bash";
import xml from "highlight.js/lib/languages/xml";
import sql from "highlight.js/lib/languages/sql";
import markdown from "highlight.js/lib/languages/markdown";
import plaintext from "highlight.js/lib/languages/plaintext";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import diff from "highlight.js/lib/languages/diff";
import go from "highlight.js/lib/languages/go";
import graphql from "highlight.js/lib/languages/graphql";
import ini from "highlight.js/lib/languages/ini";
import java from "highlight.js/lib/languages/java";
import kotlin from "highlight.js/lib/languages/kotlin";
import less from "highlight.js/lib/languages/less";
import lua from "highlight.js/lib/languages/lua";
import makefile from "highlight.js/lib/languages/makefile";
import objectivec from "highlight.js/lib/languages/objectivec";
import perl from "highlight.js/lib/languages/perl";
import php from "highlight.js/lib/languages/php";
import phpTemplate from "highlight.js/lib/languages/php-template";
import pythonRepl from "highlight.js/lib/languages/python-repl";
import r from "highlight.js/lib/languages/r";
import ruby from "highlight.js/lib/languages/ruby";
import rust from "highlight.js/lib/languages/rust";
import scss from "highlight.js/lib/languages/scss";
import swift from "highlight.js/lib/languages/swift";
import vbnet from "highlight.js/lib/languages/vbnet";
import wasm from "highlight.js/lib/languages/wasm";
import yaml from "highlight.js/lib/languages/yaml";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("css", css);
hljs.registerLanguage("json", json);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("plaintext", plaintext);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("py", python);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("shell", bash);
hljs.registerLanguage("txt", plaintext);

/** Resolve var(--accent, fallback) and color-mix() to concrete hex colors */
function resolveCssColors(css: string, accentColor: string): string {
  const accent = accentColor || "#0969da";
  let result = css;
  // Resolve var(--accent, #xxx) to actual color
  result = result.replace(/var\(--accent-fg,\s*([^)]+)\)/g, "$1");
  result = result.replace(/var\(--accent,\s*([^)]+)\)/g, accent);
  result = result.replace(/var\(--accent\)/g, accent);
  // Resolve color-mix(in srgb, <color> <pct>%, transparent) - blend over white
  // color-mix with transparent: blend accent over white
  result = result.replace(/color-mix\(in srgb,\s*([^\s]+)\s+(\d+)%,\s*transparent\)/g, (_m: string, color: string, pct: string) => {
    const hex = color.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16), g = parseInt(hex.substring(2, 4), 16), b = parseInt(hex.substring(4, 6), 16);
    const alpha = parseInt(pct) / 100;
    return "#" + [r,g,b].map(c => Math.round(c * alpha + 255 * (1 - alpha)).toString(16).padStart(2,"0")).join("");
  });
  // color-mix with currentColor: just use accent color directly
  result = result.replace(/color-mix\(in srgb,\s*([^\s]+)\s+\d+%,\s*currentColor\)/g, "$1");
  return result;
}
hljs.registerLanguage("c", c);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("csharp", csharp);
hljs.registerLanguage("diff", diff);
hljs.registerLanguage("go", go);
hljs.registerLanguage("graphql", graphql);
hljs.registerLanguage("ini", ini);
hljs.registerLanguage("java", java);
hljs.registerLanguage("kotlin", kotlin);
hljs.registerLanguage("less", less);
hljs.registerLanguage("lua", lua);
hljs.registerLanguage("makefile", makefile);
hljs.registerLanguage("objectivec", objectivec);
hljs.registerLanguage("perl", perl);
hljs.registerLanguage("php", php);
hljs.registerLanguage("php-template", phpTemplate);
hljs.registerLanguage("python-repl", pythonRepl);
hljs.registerLanguage("r", r);
hljs.registerLanguage("ruby", ruby);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("scss", scss);
hljs.registerLanguage("swift", swift);
hljs.registerLanguage("vbnet", vbnet);
hljs.registerLanguage("wasm", wasm);
hljs.registerLanguage("yaml", yaml);

/**
 * Convert markdown to HTML using the same renderer as ArticlePreview.
 */
function markdownToHtml(content: string): string {
  const lines = content.split("\n");
  const out: string[] = [];
  let inCode = false, inBlockquote = false;
  let codeBuf: string[] = [];
  let inParagraph = false;
  let inUList = false;
  let inOList = false;

  function closePara() {
    if (inParagraph) { out.push("</p>\n"); inParagraph = false; }
  }
  function closeBlockquote() { if (inBlockquote) { out.push("</blockquote>\n"); inBlockquote = false; } }
  function closeLists() {
    if (inUList) { out.push("</ul>\n"); inUList = false; }
    if (inOList) { out.push("</ol>\n"); inOList = false; }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimEnd();

    // Fenced code block
    if (/^```/.test(trimmed)) {
      closePara(); closeLists();
      if (inCode) {
        let lang = codeBuf.length > 0 ? codeBuf[0].trim() : "";
        if (lang && hljs.getLanguage(lang)) {
          codeBuf.shift();
        } else {
          lang = "";
        }
        const code = codeBuf.join("\n");
        const hCode = (lang && hljs.getLanguage(lang))
    ? hljs.highlight(code, { language: lang }).value
    : escapeHtml(code);
out.push(`<pre><code${lang ? ` class="hljs language-${lang}"` : ' class="hljs"'}>${hCode}</code></pre>\n`);
        codeBuf = [];
        inCode = false;
      } else {
        inCode = true;
        codeBuf = [trimmed.slice(3).trim()];
      }
      continue;
    }
    if (inCode) { codeBuf.push(line); continue; }

    // Blank line - close open elements
    if (/^\s*$/.test(line)) {
      closePara(); closeLists();
      continue;
    }

    // --- Block-level elements ---

    // Horizontal rule
    if (/^---\s*$/.test(trimmed) || /^\*\*\*\s*$/.test(trimmed)) {
      closePara(); closeLists();
      out.push("<hr />\n");
      continue;
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      closePara(); closeLists();
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();
      const anchor = text.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-+|-+$/g, "") || `heading-${i}`;
      out.push(`<h${level} id="${anchor}">${inlineHtml(text)}</h${level}>\n`);
      continue;
    }

    // Blockquote
    const bqMatch = trimmed.match(/^>\s*(.*)$/);
    if (bqMatch) {
      if (!inBlockquote) { closePara(); closeLists(); out.push("<blockquote>\n"); inBlockquote = true; }
      const bqContent = bqMatch[1];
      if (bqContent) {
        closePara(); out.push(`<p>${inlineHtml(bqContent)}</p>\n`);
      }
      continue;
    }

    // Unordered list
    const ulMatch = trimmed.match(/^[-*+]\s+(.*)$/);
    if (ulMatch) {
      closePara();
      if (!inUList) { out.push("<ul>\n"); inUList = true; }
      out.push(`<li>${inlineHtml(ulMatch[1])}</li>\n`);
      continue;
    }

    // Ordered list
    const olMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (olMatch) {
      closePara();
      if (!inOList) { out.push("<ol>\n"); inOList = true; }
      out.push(`<li>${inlineHtml(olMatch[1])}</li>\n`);
      continue;
    }

    // Regular paragraph
    if (inUList || inOList) { closeLists(); }
    if (!inParagraph) { out.push("<p>"); inParagraph = true; }
    else { out.push("<br />\n"); }
    out.push(inlineHtml(trimmed));
  }

  closePara(); closeLists();
  if (inCode) {
    let lang = codeBuf.length > 0 ? codeBuf[0].trim() : "";
    if (lang && hljs.getLanguage(lang)) {
      codeBuf.shift();
    } else {
      lang = "";
    }
    const code = codeBuf.join("\n");
    out.push(`<pre><code${lang ? ` class="language-${lang}"` : ""}>${escapeHtml(code)}</code></pre>\n`);
  }

  return out.join("");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function inlineHtml(s: string): string {
  let result = escapeHtml(s);
  // Inline code
  result = result.replace(/`([^`]+)`/g, "<code>$1</code>");
  // Bold
  result = result.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // Italic
  result = result.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  // Images
  result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m: string, alt: string, src: string) => {
    // Keep markdown image syntax for base64 / local images; wrap in figure
    return `<figure><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" />${alt ? `<figcaption>${escapeHtml(alt)}</figcaption>` : ""}</figure>`;
  });
  // Links
  result = result.replace(/\[([^\]]*)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return result;
}

/** Collect CSS from templates and localStorage overrides */
function collectPublishCss(): string {
  const cssParts: string[] = [];

  // Template CSS (from localStorage)
  const templateId = localStorage.getItem("editor-style-template") || "default";
  const allTemplates = loadTemplates();
  const template = allTemplates.find((t: any) => t.id === templateId);
  if (template) {
    const scoped = template.css
      .replace(/\bbody\b(?=\s*\{)/g, ".article-body")
      .replace(/^\s*([^{}]+?)\s*\{/gm, (_m: string, sel: string) => {
        return sel.split(",").map((s: string) => {
          const t = s.trim();
          if (t.startsWith(".article-body") || t.startsWith("&") || t.startsWith("@") || t.startsWith(":")) return t;
          return ".article-body " + t;
        }).join(", ") + " {";
      });
    cssParts.push(scoped);
  }

  // Article theme CSS (use same key as editor — aiwriter-selected-article-theme)
  const themeId = getSelectedArticleThemeId();
  const theme = getThemeById(themeId);
  if (theme) {
    cssParts.push(buildThemeCss(theme.vars));
  }

  // Text style overrides
  const firstLineIndent = localStorage.getItem("first-line-indent") === "true";
  const justifyAlign = localStorage.getItem("justify-align") === "true";
  const textStyleRules: string[] = [];
  if (firstLineIndent) {
    textStyleRules.push(".article-body p:not(li p) { text-indent: 2em !important; }");
  }
  if (justifyAlign) {
    textStyleRules.push(".article-body { text-align: justify !important; }");
    textStyleRules.push(".article-body p:not(li p) { text-align: justify !important; }");
  }
  if (textStyleRules.length > 0) {
    cssParts.push(textStyleRules.join("\n"));
  }

  // Heading decorations (new per-level config)
  const headingConfig: Record<string, string[]> = (() => { try { return JSON.parse(localStorage.getItem("heading-deco-config") || "{}") || {}; } catch { return {}; } })();
  const headingEntries = Object.entries(headingConfig).filter(([, v]) => v.length > 0);
  if (headingEntries.length > 0) {
    for (const [hl, decos] of headingEntries) {
      const sel = `.article-body ${hl}`;
      const parts: string[] = [];
      const extra: string[] = [];
      if (decos.includes("underline")) parts.push("border-bottom: 2px solid currentColor !important; padding-bottom: 6px;");
      if (decos.includes("overline")) parts.push("border-top: 2px solid currentColor !important; padding-top: 6px;");
      if (decos.includes("left-bar")) parts.push("border-left: 4px solid color-mix(in srgb, var(--accent, #0969da) 70%, currentColor) !important; padding-left: 14px;");
      if (decos.includes("right-bar")) parts.push("border-right: 4px solid currentColor !important; padding-right: 14px;");
      if (decos.includes("bg-block")) parts.push("background: color-mix(in srgb, var(--accent, #0969da) 12%, transparent) !important; padding: 4px 10px; border-radius: 6px; display: inline-block;");
      if (decos.includes("left-icon")) {
        parts.push("position: relative; padding-left: 1.6em;");
        extra.push(`${sel}::before { content: "\u258e"; position: absolute; left: 0; color: currentColor; font-size: 1.2em; font-weight: 700; }`);
      }
      if (decos.includes("badge")) parts.push("background: var(--accent, #0969da) !important; color: var(--accent-fg, #fff) !important; padding: 2px 12px; border-radius: 12px; display: inline-block; font-size: 0.85em;");
      if (parts.length > 0) {
        cssParts.push(`${sel} { ${parts.join(" ")} }\n${extra.join("\n")}`);
      }
    }
  }

  // Background pattern
  const bgPattern = localStorage.getItem("bg-pattern") || "";
  if (bgPattern) {
    const bgColor = theme?.vars?.bgColor || "#ffffff";
    const bgPatterns: Record<string, string> = {
      grid: `.article-body { background-color: ${bgColor} !important; background-image: linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(0deg, rgba(0,0,0,0.04) 1px, transparent 1px) !important; background-size: 20px 20px !important; }`,
      dots: `.article-body { background-color: ${bgColor} !important; background-image: radial-gradient(circle, rgba(0,0,0,0.08) 1px, transparent 1px) !important; background-size: 16px 16px !important; }`,
      stripes: `.article-body { background-color: ${bgColor} !important; background-image: repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.03) 10px, rgba(0,0,0,0.03) 11px) !important; }`,
    };
    if (bgPatterns[bgPattern]) cssParts.push(bgPatterns[bgPattern]);
  }

  // Accent color (from editor-accent-color) — defines --article-accent for var() references in template CSS
  const accentColor = localStorage.getItem("editor-accent-color") || "";
  if (accentColor) {
    cssParts.push(`.article-body {
  --article-accent: ${accentColor};
  --accent: ${accentColor};
}
.article-body blockquote { border-left: 4px solid ${accentColor} !important; }
.article-body a { color: ${accentColor} !important; text-decoration-color: ${accentColor} !important; }
.article-body code:not(pre code) { color: ${accentColor} !important; background: color-mix(in srgb, ${accentColor} 8%, transparent) !important; }
.article-body th { background: ${accentColor} !important; color: var(--accent-fg, #fff) !important; }
.article-body ::selection { background: color-mix(in srgb, ${accentColor} 30%, transparent) !important; }
.article-body strong,
.article-body b { color: ${accentColor} !important; display: inline !important; }`);
  }

  // Code theme CSS
  const cThemeId = getSelectedCodeThemeId();
  const cTheme = getCodeTheme(cThemeId);
  if (cTheme) {
    const codeThemeCss = cTheme.css
      .replace(/body(?=\s*\{)/g, ".article-body")
      .replace(/^\s*([^{}]+?)\s*\{/gm, (_m: string, sel: string) => {
        return sel.split(",").map((s: string) => {
          const t = s.trim();
          if (t.startsWith(".article-body") || t.startsWith("&") || t.startsWith("@") || t.startsWith(":") || t.startsWith(".")) return t;
          return ".article-body " + t;
        }).join(", ") + " {";
      });
    cssParts.push(codeThemeCss);
  }

  // Code block base styles (macOS style dots)
  const macosCodeBlock = localStorage.getItem("macos-code-block") === "true";
  if (macosCodeBlock) {
    cssParts.push(`
pre { background: #f5f5f5 !important; border-radius: 8px !important; padding: 16px !important; position: relative !important; padding-top: 36px !important; margin: 1em 0 !important; overflow-x: auto !important; border: 1px solid #e0e0e0 !important; }
pre::before { content: '' !important; position: absolute !important; top: 12px !important; left: 12px !important; width: 40px !important; height: 10px !important; background: radial-gradient(circle, #ff5f56 6px, transparent 6px), radial-gradient(circle, #ffbd2e 6px, transparent 6px), radial-gradient(circle, #27c93f 6px, transparent 6px) !important; background-size: 10px 10px !important; background-position: 0 0, 14px 0, 28px 0 !important; background-repeat: no-repeat !important; }
`);
  } else {
    cssParts.push(`
pre { background: #f5f5f5 !important; border-radius: 6px !important; padding: 14px !important; margin: 1em 0 !important; overflow-x: auto !important; border: 1px solid #e0e0e0 !important; }
`);
  }
  cssParts.push(`
pre code { background: transparent !important; padding: 0 !important; font-size: 13px !important; font-family: "SF Mono", Consolas, "Courier New", monospace !important; }
`);

  return cssParts.join("\n\n");
}

function loadTemplates(): any[] {
  try {
    const raw = localStorage.getItem("editor-style-templates");
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function buildThemeCss(vars: any): string {
  const fontFam = vars.fontFamily || "-apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";
  const fontSize = vars.fontSize || 16;
  const lineH = vars.lineHeight || 1.75;
  const txtColor = vars.textColor || "#333";
  const bgC = vars.bgColor || "#fff";
  const maxW = vars.maxWidth || 720;
  const headColor = vars.headingColor || "inherit";
  const linkC = vars.linkColor || "#0969da";
  const cBg = vars.codeBg || "#f0f0f0";
  const cTxt = vars.codeText || "#333";
  const bqBorder = vars.blockquoteBorder || "#ddd";
  const bqBg = vars.blockquoteBg || "#f9f9f9";
  const pgGap = vars.paragraphGap || "0.5em";
  return `.article-body {
  font-family: ${fontFam};
  font-size: ${fontSize}px;
  line-height: ${lineH};
  color: ${txtColor};
  max-width: ${maxW}px;
  margin: 0 auto;
  padding: 24px 20px;
  background: ${bgC};
}
.article-body p, .article-body li, .article-body blockquote, .article-body td, .article-body th {
  font-family: ${fontFam};
  font-size: ${fontSize}px;
  line-height: ${lineH};
  color: ${txtColor};
}
.article-body h1, .article-body h2, .article-body h3, .article-body h4 {
  color: ${headColor};
  margin: 1.2em 0 0.5em;
  line-height: 1.3;
}
.article-body strong { color: ${headColor}; }
.article-body a { color: ${linkC}; }
.article-body p { margin: 0 0 ${pgGap}; }
.article-body code {
  background: ${cBg};
  color: ${cTxt};
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.9em;
  font-family: "SF Mono", Consolas, "Courier New", monospace;
}
.article-body pre { background: ${cBg}; color: ${cTxt}; padding: 12px 16px; overflow-x: auto; border-radius: 4px; }
.article-body pre code { padding: 0; background: none; }
.article-body blockquote {
  border-left: 3px solid ${bqBorder};
  background: ${bqBg};
  margin: 1em 0;
  padding: 0.8em 1.2em;
  border-radius: 0 6px 6px 0;
}
.article-body blockquote p { margin: 0; }
.article-body img { max-width: 100%; border-radius: 4px; margin: 1em auto; display: block; }
.article-body figcaption { text-align: center; color: ${txtColor}; opacity: 0.6; font-size: 0.85em; margin-top: 4px; }
.article-body table { width: 100%; border-collapse: collapse; margin: 1em 0; }
.article-body th, .article-body td { border: 1px solid #d0d7de; padding: 6px 10px; text-align: left; }
.article-body th { background: #f0f2f5; font-weight: 600; }
.article-body hr { border: none; border-top: 1px solid #eee; margin: 1.5em 0; }
.article-body ul, .article-body ol { padding-left: 1.2em; margin: 0.5em 0; }
.article-body li { margin: 0.3em 0; }
`;
}

/**
 * Build complete inlined HTML for publishing using juice.
 * Converts markdown → HTML, applies all template/theme CSS, runs juice to inline styles.
 */
export async function compileToInlinedHtml(markdown: string): Promise<string> {
  // 1. Convert markdown to HTML
  const bodyHtml = markdownToHtml(markdown);

  // 2. Collect all CSS
  const cssText = collectPublishCss();

  // Resolve CSS variables and color-mix for maximum platform compatibility
  const accentColor = localStorage.getItem("editor-accent-color") || "";
  const resolvedCss = resolveCssColors(cssText, accentColor);

  // 3. Build HTML with wrapper for juice
  const fontFamily =
    localStorage.getItem("article-font-family") ||
    "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif";
  const fontColor = localStorage.getItem("article-text-color") || "#2b2b2b";

  const htmlWithCss = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8">
<style>${resolvedCss}</style>
</head>
<body class="article-body">
${bodyHtml}
</body>
</html>`;

  // 4. Run juice to inline all CSS
  const inlined = await juice(htmlWithCss, {
    inlinePseudoElements: true,
    preserveImportant: true,
    removeStyleTags: true,
    preserveMediaQueries: false,
  });

  // 5. Extract body content (style tags already removed by juice)
  const bodyMatch = inlined.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const bodyContent = bodyMatch ? bodyMatch[1].trim() : inlined;

  // Fix WeChat compatibility: strip !important from inline styles
  const cleanedContent = bodyContent
    .replace(/\s*!important\s*/g, " ")
    .replace(/\sclass="[^"]*"/g, "");
  // 6. Wrap in outer div with font settings as fallback
  return `<div style="font-family:${fontFamily};word-break:break-word;color:${fontColor};">${cleanedContent}</div>`;
}
