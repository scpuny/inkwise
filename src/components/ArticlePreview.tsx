import { useMemo } from "react";

/** Convert Markdown string to HTML */
export function markdownToHtml(content: string): string {
  const lines = content.split("\n");
  const out: string[] = [];
  let inCode = false;
  let codeBuf: string[] = [];
  let inParagraph = false;
  let inUList = false;
  let inOList = false;

  function closePara() {
    if (inParagraph) { out.push("</p>\n"); inParagraph = false; }
  }
  function closeLists() {
    if (inUList) { out.push("</ul>\n"); inUList = false; }
    if (inOList) { out.push("</ol>\n"); inOList = false; }
  }

  for (const raw of lines) {
    // Code blocks
    if (raw.trimStart().startsWith("```")) {
      closePara(); closeLists();
      if (inCode) {
        const lang = (codeBuf.length > 0 && !codeBuf[0].includes("```")) ? codeBuf.shift()?.trim() || "" : "";
        const code = codeBuf.join("\n");
        out.push(`<pre><code${lang ? ` class="hljs language-${lang}"` : ' class="hljs"'}>${escapeHtml(code)}</code></pre>\n`);
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
    if (!trimmed) { closePara(); closeLists(); continue; }

    // Headings
    if (trimmed.startsWith("# ")) { closePara(); closeLists(); out.push(`<h1>${inlineHtml(trimmed.slice(2))}</h1>\n`); continue; }
    if (trimmed.startsWith("## ")) { closePara(); closeLists(); out.push(`<h2>${inlineHtml(trimmed.slice(3))}</h2>\n`); continue; }
    if (trimmed.startsWith("### ")) { closePara(); closeLists(); out.push(`<h3>${inlineHtml(trimmed.slice(4))}</h3>\n`); continue; }
    if (trimmed.startsWith("#### ")) { closePara(); closeLists(); out.push(`<h4>${inlineHtml(trimmed.slice(5))}</h4>\n`); continue; }
    if (trimmed.startsWith("##### ")) { closePara(); closeLists(); out.push(`<h5>${inlineHtml(trimmed.slice(6))}</h5>\n`); continue; }
    if (trimmed.startsWith("###### ")) { closePara(); closeLists(); out.push(`<h6>${inlineHtml(trimmed.slice(7))}</h6>\n`); continue; }

    // Blockquote
    if (trimmed.startsWith("> ")) { closePara(); closeLists(); out.push(`<blockquote><p>${inlineHtml(trimmed.slice(2))}</p></blockquote>\n`); continue; }

    // Horizontal rule
    if (trimmed === "---" || trimmed === "***" || trimmed === "___") { closePara(); closeLists(); out.push("<hr />\n"); continue; }

    // Unordered list
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const item = (trimmed.startsWith("- ") ? trimmed.slice(2) : trimmed.slice(2));
      closePara();
      if (!inUList) { closeLists(); out.push("<ul>\n"); inUList = true; }
      out.push(`  <li>${inlineHtml(item)}</li>\n`);
      continue;
    }

    // Ordered list
    const olMatch = trimmed.match(/^\d+\.\s+(.+)/);
    if (olMatch) {
      closePara();
      if (!inOList) { closeLists(); out.push("<ol>\n"); inOList = true; }
      out.push(`  <li>${inlineHtml(olMatch[1])}</li>\n`);
      continue;
    }

    // Paragraph
    closeLists();
    if (!inParagraph) { out.push("<p>"); inParagraph = true; }
    else { out.push("<br />\n"); }
    out.push(inlineHtml(raw));
  }

  // Close remaining open tags
  if (inParagraph) out.push("</p>\n");
  if (inUList) out.push("</ul>\n");
  if (inOList) out.push("</ol>\n");
  if (inCode && codeBuf.length > 0) {
    const lang = (codeBuf.length > 0 && !codeBuf[0].includes("```")) ? codeBuf.shift()?.trim() || "" : "";
    const code = codeBuf.join("\n");
    out.push(`<pre><code${lang ? ` class="hljs language-${lang}"` : ' class="hljs"'}>${escapeHtml(code)}</code></pre>\n`);
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
