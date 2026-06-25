/**
 * renderer.ts — Markdown → HTML 渲染器（单一定义）
 *
 * 唯一导出 markdownToHtml()，供预览组件、导出模块共用。
 * 保证编辑器预览、成品导出、各平台展示的 HTML 结构完全一致。
 */
import hljs from "./highlight";

// ─── Helpers ───

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function inlineHtml(s: string): string {
  let r = escapeHtml(s);
  r = r.replace(/`([^`]+)`/g, "<code>$1</code>");
  r = r.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  r = r.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  r = r.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m: string, alt: string, src: string) =>
    `<figure><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" />${alt ? `<figcaption>${escapeHtml(alt)}</figcaption>` : ""}</figure>`
  );
  r = r.replace(/\[([^\]]*)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return r;
}

/**
 * Format highlighted code for WeChat-friendly output.
 * Moves inter‑span whitespace into spans, converts newlines to <br/>, spaces to &nbsp;.
 */
function formatCodeHtml(html: string): string {
  let s = html;
  s = s.replace(/(<span[^>]*>[^<]*<\/span>)(\s+)(<span[^>]*>[^<]*<\/span>)/g,
    (_, s1: string, sp: string, s2: string) => s1 + s2.replace(/^(<span[^>]*>)/, "$1" + sp));
  s = s.replace(/(\s+)(<span[^>]*>)/g, (_, sp: string, spn: string) => spn.replace(/^(<span[^>]*>)/, "$1" + sp));
  s = s.replace(/\t/g, "    ");
  s = s.replace(/\r?\n/g, "<br/>");
  s = s.replace(/(>[^<]+)|(^[^<]+)/g, (str: string) => str.replace(/\s/g, "&nbsp;"));
  return s;
}

const macDots = '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="12" viewBox="0 0 36 12" style="display:block;margin-bottom:6px"><circle cx="6" cy="6" r="4" fill="#ff5f56"/><circle cx="18" cy="6" r="4" fill="#ffbd2e"/><circle cx="30" cy="6" r="4" fill="#27c93f"/></svg>';

// ─── Main ───

/**
 * 将 Markdown 正文转换为 HTML。
 *
 * 支持：代码块（hljs 高亮）、标题 1‑6、引用、无序/有序列表、
 * 水平线、段落、行内代码/粗体/斜体、图片、链接。
 */
export function markdownToHtml(content: string): string {
  const lines = content.split("\n");
  const out: string[] = [];
  let inCode = false, inBlockquote = false;
  let codeBuf: string[] = [];
  let inPara = false, inUList = false, inOList = false, olCounter = 0;

  function closePara() { if (inPara) { out.push("</p>\n"); inPara = false; } }
  function closeBq() { if (inBlockquote) { out.push("</blockquote>\n"); inBlockquote = false; } }
  function closeLists() { if (inUList) { out.push("</ul>\n"); inUList = false; } if (inOList) { out.push("</ol>\n"); inOList = false; } }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trimEnd();

    // ── Fenced code block ──
    if (/^```/.test(trimmed)) {
      closePara(); closeLists();
      if (inCode) {
        let lang = codeBuf.length > 0 ? codeBuf[0].trim() : "";
        if (lang && hljs.getLanguage(lang)) codeBuf.shift(); else lang = "";
        const code = codeBuf.join("\n");
        const hCode = lang
          ? formatCodeHtml(hljs.highlight(code, { language: lang }).value)
          : formatCodeHtml(escapeHtml(code));
        out.push(`<pre class="hljs"><span class="mac-dots">${macDots}</span><code class="language-${lang || "plaintext"}">${hCode}</code></pre>\n`);
        codeBuf = []; inCode = false;
      } else {
        inCode = true;
        codeBuf = [trimmed.slice(3).trim()];
      }
      continue;
    }
    if (inCode) { codeBuf.push(raw); continue; }

    // ── Blank line ──
    if (/^\s*$/.test(raw)) { closePara(); closeLists(); continue; }

    // ── Close blockquote if line isn't continuation ──
    if (inBlockquote && !trimmed.startsWith(">")) closeBq();

    // ── Horizontal rule ──
    if (/^---\s*$/.test(trimmed) || /^\*\*\*\s*$/.test(trimmed)) { closePara(); closeLists(); out.push("<hr />\n"); continue; }

    // ── Headings ──
    const hMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (hMatch) {
      closePara(); closeLists();
      const lv = hMatch[1].length;
      const text = hMatch[2].trim();
      const anchor = text.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-+|-+$/g, "") || `h-${i}`;
      out.push(`<h${lv} id="${anchor}">${inlineHtml(text)}</h${lv}>\n`);
      continue;
    }

    // ── Blockquote ──
    const bqMatch = trimmed.match(/^>\s*(.*)$/);
    if (bqMatch) {
      if (!inBlockquote) { closePara(); closeLists(); out.push("<blockquote>\n"); inBlockquote = true; }
      const bqContent = bqMatch[1];
      if (bqContent) { closePara(); out.push(`<p>${inlineHtml(bqContent)}</p>\n`); }
      continue;
    }

    // ── Unordered list ──
    const ulMatch = trimmed.match(/^[-*+]\s+(.*)$/);
    if (ulMatch) {
      closePara();
      if (!inUList) { out.push("<ul>\n"); inUList = true; }
      out.push(`<li>\u2022 ${inlineHtml(ulMatch[1])}</li>\n`);
      continue;
    }

    // ── Ordered list ──
    const olMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (olMatch) {
      closePara();
      if (!inOList) { out.push("<ol>\n"); inOList = true; olCounter = 0; }
      out.push(`<li>${++olCounter}. ${inlineHtml(olMatch[1])}</li>\n`);
      continue;
    }

    // ── Paragraph ──
    if (inUList || inOList) closeLists();
    if (!inPara) { out.push("<p>"); inPara = true; } else { out.push("<br />\n"); }
    out.push(inlineHtml(trimmed));
  }

  closePara(); closeBq(); closeLists();
  if (inCode) {
    const code = codeBuf.join("\n");
    out.push(`<pre class="hljs"><code>${formatCodeHtml(escapeHtml(code))}</code></pre>\n`);
  }
  return out.join("");
}
