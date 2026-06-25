import { useMemo } from "react";
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
// Aliases
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("py", python);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("shell", bash);
hljs.registerLanguage("txt", plaintext);

/** Convert Markdown string to HTML */
export function markdownToHtml(content: string): string {
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

  for (const raw of lines) {
    // Code blocks
    if (raw.trimStart().startsWith("```")) {
      closePara(); closeLists();
      if (inCode) {
        let lang = "";
        if (codeBuf.length > 0 && !codeBuf[0].includes("```")) {
          const candidate = codeBuf[0].trim();
          if (hljs.getLanguage(candidate)) {
            lang = candidate;
            codeBuf.shift();
          }
        }
        const code = codeBuf.join("\n");
        const hCode = (lang && hljs.getLanguage(lang))
    ? hljs.highlight(code, { language: lang }).value
    : escapeHtml(code);
out.push(`<pre><code${lang ? ` class="hljs language-${lang}"` : ' class="hljs"'}>${hCode}</code></pre>\n`);
        codeBuf = [];
      } else {
        // First ``` line - the rest after ``` is the language
        const rest = raw.trimStart().slice(3).trim();
        if (rest) codeBuf.push(rest);
      }
      inCode = !inCode;
      continue;
    }
    if (inCode) { codeBuf.push(raw); continue; }

    const trimmed = raw.trim();

    // Empty line
    if (!trimmed) { closePara(); closeBlockquote(); closeLists(); continue; }

    // Headings
    if (trimmed.startsWith("# ")) { closePara(); closeLists(); out.push(`<h1>${inlineHtml(trimmed.slice(2))}</h1>\n`); continue; }
    if (trimmed.startsWith("## ")) { closePara(); closeLists(); out.push(`<h2>${inlineHtml(trimmed.slice(3))}</h2>\n`); continue; }
    if (trimmed.startsWith("### ")) { closePara(); closeLists(); out.push(`<h3>${inlineHtml(trimmed.slice(4))}</h3>\n`); continue; }
    if (trimmed.startsWith("#### ")) { closePara(); closeLists(); out.push(`<h4>${inlineHtml(trimmed.slice(5))}</h4>\n`); continue; }
    if (trimmed.startsWith("##### ")) { closePara(); closeLists(); out.push(`<h5>${inlineHtml(trimmed.slice(6))}</h5>\n`); continue; }
    if (trimmed.startsWith("###### ")) { closePara(); closeLists(); out.push(`<h6>${inlineHtml(trimmed.slice(7))}</h6>\n`); continue; }

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

    // Horizontal rule
    if (trimmed === "---" || trimmed === "***" || trimmed === "___") { closePara(); closeLists(); out.push("<hr />\n"); continue; }

    // Unordered list
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const item = (trimmed.startsWith("- ") ? trimmed.slice(2) : trimmed.slice(2));
      closePara();
      if (!inBlockquote) { closeBlockquote(); }
      if (!inUList) { closeLists(); out.push("<ul>\n"); inUList = true; }
      out.push(`  <li>${inlineHtml(item)}</li>\n`);
      continue;
    }

    // Ordered list
    const olMatch = trimmed.match(/^\d+\.\s+(.+)/);
    if (olMatch) {
      closePara();
      if (!inBlockquote) { closeBlockquote(); }
      if (!inOList) { closeLists(); out.push("<ol>\n"); inOList = true; }
      out.push(`  <li>${inlineHtml(olMatch[1])}</li>\n`);
      continue;
    }

    // Paragraph
    if (!inBlockquote) { closeBlockquote(); } closeLists();
    if (!inParagraph) { out.push("<p>"); inParagraph = true; }
    else { out.push("<br />\n"); }
    out.push(inlineHtml(raw));
  }

  // Close remaining open tags
  if (inParagraph) out.push("</p>\n");
  if (inBlockquote) out.push("</blockquote>\n");
  if (inUList) out.push("</ul>\n");
  if (inOList) out.push("</ol>\n");
  if (inCode && codeBuf.length > 0) {
    let lang = "";
        if (codeBuf.length > 0 && !codeBuf[0].includes("```")) {
          const candidate = codeBuf[0].trim();
          if (hljs.getLanguage(candidate)) {
            lang = candidate;
            codeBuf.shift();
          }
        }
    const code = codeBuf.join("\n");
    const hCode = (lang && hljs.getLanguage(lang))
    ? hljs.highlight(code, { language: lang }).value
    : escapeHtml(code);
out.push(`<pre><code${lang ? ` class="hljs language-${lang}"` : ' class="hljs"'}>${hCode}</code></pre>\n`);
  }

  return out.join("");
}

interface ArticlePreviewProps {
  content: string;
}

export function ArticlePreview({ content }: ArticlePreviewProps) {
  const html = useMemo(() => markdownToHtml(content), [content]);

  return <div className="article-preview" dangerouslySetInnerHTML={{ __html: html }} />;
}

function inlineHtml(text: string): string {
  let s = escapeHtml(text);
  s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');
  s = s.replace(/\[([^\]]*)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>");
  s = s.replace(/~~(.+?)~~/g, "<del>$1</del>");
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  return s;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
