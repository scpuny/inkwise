/**
 * ArticlePreview.tsx — 文章预览（编辑器终稿面板）
 *
 * 使用 src/lib/markdown/renderer.ts 中的单一 markdownToHtml。
 * Mermaid 图表异步渲染为 SVG（MutationObserver 兜底确保 DOM 就绪后渲染）。
 */
import { useEffect, useMemo, useRef } from "react";
import { markdownToHtml } from "../../lib/markdown/renderer";

interface ArticlePreviewProps {
  content: string;
}

export function ArticlePreview({ content }: ArticlePreviewProps) {
  const containerRef = useRef<HTMLElement>(null);
  const renderedRef = useRef(false);
  const html = useMemo(() => markdownToHtml(content), [content]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;

    async function renderMermaid() {
      const blocks = el!.querySelectorAll(".mermaid");
      if (blocks.length === 0) return;

      // 1) load mermaid lib
      let mm: any;
      try {
        const mod = await import("mermaid");
        mm = mod.default || mod;
        mm.initialize({ startOnLoad: false });
      } catch (e) {
        if (!cancelled) {
          blocks.forEach((b) => {
            const div = b as HTMLElement;
            div.innerHTML =
              `<pre class="mermaid-fallback"><code>${(div.textContent || "").replace(/</g, "&lt;")}</code></pre>`;
          });
        }
        return;
      }
      if (cancelled || !mm) return;

      // 2) render each block
      for (let i = 0; i < blocks.length; i++) {
        if (cancelled) break;
        const div = blocks[i] as HTMLElement;
        if (div.querySelector("svg")) continue; // already rendered

        const code = (div.getAttribute("data-code") || div.textContent || "").trim();
        if (!code) continue;

        try {
          const { svg } = await mm.render("mermaid-" + Date.now() + "-" + i, code);
          if (cancelled) break;
          div.innerHTML = svg;
          div.classList.add("mermaid-rendered");
        } catch (e) {
          const fallback = div.getAttribute("data-code") || div.textContent || "";
          div.innerHTML =
            `<pre class="mermaid-fallback"><code>${fallback.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>`;
        }
      }
    }

    renderMermaid();
    renderedRef.current = true;

    // MutationObserver 兜底：如果后续 DOM 更新引入了新的 .mermaid 元素，自动渲染
    const observer = new MutationObserver(() => {
      if (cancelled) return;
      const newBlocks = el.querySelectorAll(".mermaid:not(.mermaid-rendered)");
      if (newBlocks.length > 0) {
        renderMermaid();
      }
    });
    observer.observe(el, { childList: true, subtree: true });

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [html]);

  return <section ref={containerRef} className="article-preview" dangerouslySetInnerHTML={{ __html: html }} />;
}
