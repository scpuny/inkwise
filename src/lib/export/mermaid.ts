/**
 * mermaid.ts — Mermaid 导出渲染辅助
 *
 * 在导出/复制 HTML 时，将 markdownToHtml 输出的 Mermaid 占位 div
 * 替换为实际渲染的 SVG，确保最终 HTML 包含可显示的图表。
 *
 * 使用 DOM 解析 HTML，通过 mermaid.render() 异步渲染每个图表。
 */

/**
 * 将 HTML 字符串中的 Mermaid 占位 div（class="mermaid"）渲染为 SVG。
 *
 * @param html  markdownToHtml 输出的 HTML（含 mermaid 占位 div）
 * @returns     替换后的 HTML（占位 div → SVG）
 */
export async function renderMermaidInHtml(html: string): Promise<string> {
  // 快速判断是否有 mermaid 占位，避免不必要的 DOM 操作
  if (!html.includes('class="mermaid"') && !html.includes("class='mermaid'")) {
    return html;
  }

  const div = document.createElement("div");
  div.innerHTML = html;

  const mermaidEls = div.querySelectorAll<HTMLElement>(".mermaid");
  if (mermaidEls.length === 0) return html;

  let mermaidMod: any;
  try {
    const mod = await import("mermaid");
    mermaidMod = mod.default || mod;
    mermaidMod.initialize({ startOnLoad: false });
  } catch (e) {
    console.warn("Mermaid 导出渲染: 库加载失败", e);
    // 保持原样，返回未修改的 HTML
    return html;
  }

  for (const el of mermaidEls) {
    // 从 data-code 属性或 textContent 获取图表代码
    const code = (el.getAttribute("data-code") || el.textContent || "").trim();
    if (!code) continue;

    // 跳过已经包含 SVG 的元素（二次调用保护）
    if (el.querySelector("svg")) continue;

    try {
      const { svg } = await mermaidMod.render(
        "mm-export-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
        code,
      );
      const wrapper = document.createElement("div");
      wrapper.className = "mermaid-export";
      wrapper.innerHTML = svg;
      el.replaceWith(wrapper);
    } catch (e) {
      console.warn("Mermaid 导出渲染失败:", e);
      // 失败时保留原始 div（预览模式下会显示代码文本）
    }
  }

  return div.innerHTML;
}
