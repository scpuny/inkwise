// importExport.ts — Markdown file import/export for both Tauri and browser modes.

import { isTauriEnv, tryInvoke } from "./tauri";
import { addArticle } from "./collections";
import { saveArticleContent, loadArticleContent } from "./articles";

export interface ImportResult {
  success: boolean;
  articleId?: string;
  fileName?: string;
  error?: string;
}

export interface ExportResult {
  success: boolean;
  path?: string;
  error?: string;
}

// ─── Import ───

/**
 * Open a file dialog to import .md files and create new articles.
 * Returns the imported article ID(s).
 */
export async function importMarkdown(
  collectionId: string,
): Promise<ImportResult[]> {
  if (isTauriEnv()) {
    return importMarkdownTauri(collectionId);
  }
  return importMarkdownBrowser(collectionId);
}

async function importMarkdownTauri(
  collectionId: string,
): Promise<ImportResult[]> {
  try {
    // Open file dialog for .md files
    const selected = await tryInvoke<string | string[]>("dialog_open", {
      filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
      multiple: true,
    });

    if (!selected) return [{ success: false, error: "未选择文件" }];

    const files = Array.isArray(selected) ? selected : [selected];
    const results: ImportResult[] = [];

    for (const filePath of files) {
      try {
        // Read file content via Tauri fs plugin
        const content = await tryInvoke<string>("fs_read_text_file", {
          path: filePath,
        });

        // Extract filename without extension as title
        const fileName = filePath.split("/").pop() || "未命名";
        const title = fileName.replace(/\.md$/i, "").replace(/\.markdown$/i, "");

        // Create article and save content
        const article = await addArticle(collectionId, title);
        if (article) {
          await saveArticleContent(article.id, content);
          results.push({
            success: true,
            articleId: article.id,
            fileName,
          });
        }
      } catch (e: any) {
        results.push({
          success: false,
          fileName: filePath,
          error: `读取失败: ${e?.message || e}`,
        });
      }
    }

    return results;
  } catch (e: any) {
    return [{ success: false, error: `导入失败: ${e?.message || e}` }];
  }
}

async function importMarkdownBrowser(
  collectionId: string,
): Promise<ImportResult[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".md,.markdown";
    input.multiple = true;

    input.onchange = async () => {
      const files = input.files;
      if (!files || files.length === 0) {
        resolve([{ success: false, error: "未选择文件" }]);
        return;
      }

      const results: ImportResult[] = [];
      for (const file of files) {
        try {
          const content = await file.text();
          const title = file.name.replace(/\.md$/i, "").replace(/\.markdown$/i, "");
          const article = await addArticle(collectionId, title);
          if (article) {
            await saveArticleContent(article.id, content);
            results.push({
              success: true,
              articleId: article.id,
              fileName: file.name,
            });
          }
        } catch (e: any) {
          results.push({
            success: false,
            fileName: file.name,
            error: `读取失败: ${e?.message || e}`,
          });
        }
      }
      resolve(results);
    };

    input.oncancel = () => {
      resolve([{ success: false, error: "取消导入" }]);
    };

    input.click();
  });
}

// ─── Export ───

/**
 * Export article content as a Markdown file.
 */
export async function exportMarkdown(
  articleId: string,
  title: string,
): Promise<ExportResult> {
  const content = await loadArticleContent(articleId);
  if (!content) {
    return { success: false, error: "文章内容为空" };
  }

  if (isTauriEnv()) {
    return exportMarkdownTauri(content, title);
  }
  return exportMarkdownBrowser(content, title);
}

async function exportMarkdownTauri(
  content: string,
  title: string,
): Promise<ExportResult> {
  try {
    const savePath = await tryInvoke<string>("dialog_save", {
      filters: [{ name: "Markdown", extensions: ["md"] }],
      defaultPath: `${title}.md`,
    });

    if (!savePath) return { success: false, error: "未选择保存路径" };

    await tryInvoke("fs_write_text_file", {
      path: savePath,
      contents: content,
    });

    return { success: true, path: savePath };
  } catch (e: any) {
    return { success: false, error: `导出失败: ${e?.message || e}` };
  }
}

async function exportMarkdownBrowser(
  content: string,
  title: string,
): Promise<ExportResult> {
  try {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: `导出失败: ${e?.message || e}` };
  }
}

/** Copy article content as Markdown to clipboard. */
export async function copyAsMarkdown(articleId: string): Promise<boolean> {
  const content = await loadArticleContent(articleId);
  if (!content) return false;

  try {
    await navigator.clipboard.writeText(content);
    return true;
  } catch {
    // Fallback for older browsers
    const textarea = document.createElement("textarea");
    textarea.value = content;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    return true;
  }
}

// ─── PDF Export (Print-to-PDF) ───

/**
 * Export article content as PDF using the browser's print-to-PDF capability.
 * Opens the system print dialog with "Save as PDF" as the default option.
 */
export async function exportPDF(
  articleId: string,
  title: string,
): Promise<ExportResult> {
  const content = await loadArticleContent(articleId);
  if (!content) {
    return { success: false, error: "文章内容为空" };
  }

  try {
    // Get the active style template CSS for rendering
    const { getSelectedTemplateId, getTemplate } = await import("./editorStyles");
    const templateId = getSelectedTemplateId();
    const template = getTemplate(templateId);

    // Build the print content with proper styling
    const styleCss = template?.css || "";
    // Replace body selector with .print-body for scoping
    const scopedStyle = styleCss.replace(/\bbody\b/g, ".print-body");

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      return { success: false, error: "无法打开打印窗口（请允许弹出窗口）" };
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <meta charset="utf-8">
        <style>
          ${scopedStyle}
          @page {
            margin: 20mm 25mm;
            size: A4;
          }
          @media print {
            body { margin: 0; padding: 0; }
          }
          .print-body {
            max-width: 820px;
            margin: 0 auto;
            padding: 20px 32px;
          }
          .print-header {
            text-align: center;
            font-size: 12px;
            color: #999;
            padding-bottom: 20px;
            border-bottom: 1px solid #eee;
            margin-bottom: 20px;
          }
          .print-footer {
            text-align: center;
            font-size: 11px;
            color: #999;
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px solid #eee;
          }
          img { max-width: 100%; }
          pre { white-space: pre-wrap; word-break: break-all; }
        </style>
      </head>
      <body>
        <div class="print-body">
          <div class="print-header">${escapeHtml(title)}</div>
          ${renderMarkdownToHTML(content)}
          <div class="print-footer">由 AI 写作助手生成 · ${new Date().toLocaleDateString("zh-CN")}</div>
        </div>
        <script>
          window.onload = function() {
            window.print();
            // Close after print dialog is dismissed
            setTimeout(function() { window.close(); }, 500);
          };
        <\/script>
      </body>
      </html>
    `);
    printWindow.document.close();

    return { success: true };
  } catch (e: any) {
    return { success: false, error: `PDF 导出失败: ${e?.message || e}` };
  }
}
export async function exportAsHtml(articleId: string, title: string): Promise<ExportResult> {
  const content = await loadArticleContent(articleId);
  if (!content) {
    return { success: false, error: "文章内容为空" };
  }

  // Use the currently selected editor style template for HTML export
  const { getTemplate, getSelectedTemplateId } = await import("./editorStyles");
  const templateId = getSelectedTemplateId();
  const template = getTemplate(templateId);
  const styleCss = template?.css || "";
  // Scope the CSS to .article-body instead of body for standalone HTML
  const scopedStyle = styleCss.replace(/\bbody\b/g, ".article-body");

  const htmlContent = renderMarkdownToHTML(content);
  const fullHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>${scopedStyle}</style></head>
<body style="margin:0">
<div class="article-body">${htmlContent}</div>
</body></html>`;

  if (isTauriEnv()) {
    return exportHtmlTauri(fullHtml, title);
  }
  return exportHtmlBrowser(fullHtml, title);
}

async function exportHtmlTauri(html: string, title: string): Promise<ExportResult> {
  try {
    const savePath = await tryInvoke<string>("dialog_save", {
      filters: [{ name: "HTML", extensions: ["html"] }],
      defaultPath: `${title}.html`,
    });
    if (!savePath) return { success: false, error: "未选择保存路径" };
    await tryInvoke("fs_write_text_file", { path: savePath, contents: html });
    return { success: true, path: savePath };
  } catch (e: any) {
    return { success: false, error: `导出失败: ${e?.message || e}` };
  }
}

async function exportHtmlBrowser(html: string, title: string): Promise<ExportResult> {
  try {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: `导出失败: ${e?.message || e}` };
  }
}


/** Minimal HTML-escape to prevent XSS in the print window */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Very basic Markdown → HTML renderer for PDF export */
function renderMarkdownToHTML(md: string): string {
  let html = escapeHtml(md);
  // Code blocks (```lang\n...\n```)
  html = html.replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/g, (_, code) => {
    return '<pre><code>' + code + '</code></pre>';
  });
  // Inline code
  html = html.replace(/<code>([^<]*)<\/code>/g, '<code>$1</code>');
  // Headings
  html = html.replace(/<h([1-6])>([^<]*)<\/h([1-6])>/g, '<h$1>$2</h$1>');
  // Bold and italic
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // Line breaks
  html = html.replace(/\n/g, '<br>');
  return html;
}
