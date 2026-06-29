/**
 * MermaidNode.ts — TipTap 自定义节点：Mermaid 图表
 *
 * 在编辑器中直接渲染 Mermaid 图表为 SVG。
 * 双击图表可编辑源码，Ctrl+Enter / 失焦后重新渲染。
 *
 * markdown 集成
 * - parse: 拦截 ```mermaid 代码块，创建 MermaidNode
 * - serialize: 将 MermaidNode 输出为 ```mermaid 代码块
 *
 * 关联模块：
 *   - 注册：src/components/editor/EditorContent.tsx
 *   - 预览：src/components/editor/ArticlePreview.tsx（终稿面板）
 *   - 导出：src/lib/export/mermaid.ts
 */
import { Node, mergeAttributes } from "@tiptap/core";

/**
 * 将 Mermaid 源码渲染为 SVG HTML。
 */
async function renderMermaidSvg(code: string): Promise<string> {
  try {
    const mod = await import("mermaid");
    const mermaid = mod.default || mod;
    mermaid.initialize({ startOnLoad: false });
    const { svg } = await mermaid.render(
      "me-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
      code.trim(),
    );
    return svg;
  } catch (e) {
    console.warn("Mermaid 编辑器渲染失败:", e);
    return `<pre class="mermaid-fallback"><code>${code.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>`;
  }
}

export const MermaidNode = Node.create({
  name: "mermaid",

  priority: 101, // 略高于默认（100），确保优先处理 mermaid 代码块
  markdownTokenName: "code",

  group: "block",

  content: "text*",

  marks: "",

  defining: true,

  isolating: true,

  code: true,

  addAttributes() {
    return {
      language: {
        default: "mermaid",
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-language") || "mermaid",
        renderHTML: (attrs) => ({ "data-language": attrs.language || "mermaid" }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-mermaid-node]",
        getAttrs: () => ({ language: "mermaid" }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(
        { "data-mermaid-node": "", class: "mermaid-editor-node" },
        HTMLAttributes,
      ),
      0,
    ];
  },

  /**
   * Markdown 解析：拦截 ```mermaid 代码块
   */
  parseMarkdown(token: any, helpers: any) {
    // Only handle fenced code blocks with language "mermaid"
    if (
      token.type !== "code" ||
      token.lang !== "mermaid" ||
      (token.raw.startsWith("```") === false && token.raw.startsWith("~~~") === false)
    ) {
      return false; // Let other handlers (e.g., codeBlock) process this
    }
    return helpers.createNode(
      "mermaid",
      { language: "mermaid" },
      token.text ? [helpers.createTextNode(token.text)] : [],
    );
  },

  /**
   * Markdown 序列化：输出为 ```mermaid 代码块
   */
  renderMarkdown(node: any, helpers: any) {
    const lines = ["```mermaid"];
    if (node.textContent) {
      lines.push(node.textContent);
    }
    lines.push("```");
    return lines.join("\n");
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const container = document.createElement("div");
      container.className = "mermaid-editor-wrapper";

      // ─── 图表显示区 ───
      const displayEl = document.createElement("div");
      displayEl.className = "mermaid-editor-display";
      container.appendChild(displayEl);

      // ─── 编辑器（隐藏的 textarea） ───
      const editorEl = document.createElement("textarea");
      editorEl.className = "mermaid-editor-source";
      editorEl.style.display = "none";
      editorEl.spellcheck = false;
      container.appendChild(editorEl);

      // ─── 操作按钮 ───
      const btnGroup = document.createElement("div");
      btnGroup.className = "mermaid-editor-actions";
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "mermaid-editor-btn mermaid-editor-btn--edit";
      editBtn.title = "编辑源码";
      editBtn.innerHTML = "✏️";
      const previewBtn = document.createElement("button");
      previewBtn.type = "button";
      previewBtn.className = "mermaid-editor-btn mermaid-editor-btn--preview";
      previewBtn.title = "预览";
      previewBtn.innerHTML = "🔄";
      previewBtn.style.display = "none";
      btnGroup.appendChild(editBtn);
      btnGroup.appendChild(previewBtn);
      container.appendChild(btnGroup);

      // ── 状态 ──
      let isEditing = false;

      // ── 加载并渲染图表 ──
      async function loadDiagram(code: string) {
        if (!code) {
          displayEl.innerHTML = '<div class="mermaid-editor-empty">点击 ✏️ 编辑 Mermaid 图表</div>';
          return;
        }
        displayEl.innerHTML = "";
        displayEl.classList.add("mermaid-editor-loading");
        displayEl.textContent = "⏳";
        try {
          const svg = await renderMermaidSvg(code);
          displayEl.innerHTML = svg;
        } catch {
          displayEl.innerHTML = `<pre class="mermaid-fallback"><code>${code.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>`;
        } finally {
          displayEl.classList.remove("mermaid-editor-loading");
        }
      }

      // 初始渲染
      loadDiagram(node.textContent || "");

      // ── 切换到编辑模式 ──
      function enterEditMode() {
        if (isEditing) return;
        isEditing = true;
        displayEl.style.display = "none";
        editorEl.style.display = "block";
        editBtn.style.display = "none";
        previewBtn.style.display = "";
        editorEl.value = node.textContent || "";
        editorEl.focus();
      }

      // ── 切换到预览模式 ──
      async function enterPreviewMode() {
        if (!isEditing) return;
        const newCode = editorEl.value;
        const pos = typeof getPos === "function" ? getPos() : undefined;
        if (pos !== undefined && pos >= 0) {
          // Update the node content in the document
          editor.commands.command(({ tr }) => {
            const nodeAtPos = tr.doc.nodeAt(pos);
            if (nodeAtPos && nodeAtPos.type.name === "mermaid") {
              // Replace text content
              const textNode = tr.doc.type.schema.text(newCode);
              tr.replaceWith(pos + 1, pos + nodeAtPos.nodeSize - 1, textNode);
            }
            return true;
          });
        }
        await loadDiagram(newCode);
        isEditing = false;
        displayEl.style.display = "";
        editorEl.style.display = "none";
        editBtn.style.display = "";
        previewBtn.style.display = "none";
      }

      // ── 事件绑定 ──
      editBtn.addEventListener("click", enterEditMode);
      previewBtn.addEventListener("click", enterPreviewMode);
      displayEl.addEventListener("dblclick", enterEditMode);

      editorEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          enterPreviewMode();
        }
        if (e.key === "Escape") {
          isEditing = false;
          displayEl.style.display = "";
          editorEl.style.display = "none";
          editBtn.style.display = "";
          previewBtn.style.display = "none";
        }
      });

      editorEl.addEventListener("blur", () => {
        setTimeout(() => {
          if (isEditing) enterPreviewMode();
        }, 300);
      });

      return {
        dom: container,
        update: (updatedNode) => {
          if (updatedNode.type.name !== "mermaid") return false;
          const code = updatedNode.textContent || "";
          if (!isEditing) {
            const hasSvg = displayEl.querySelector("svg") !== null;
            const fallback = displayEl.querySelector(".mermaid-fallback") !== null;
            if (!hasSvg && !fallback && code) {
              loadDiagram(code);
            }
          }
          return true;
        },
        destroy: () => {
          container.remove();
        },
      };
    };
  },
});
