/**
 * resolver.ts — CSS 变量 / color-mix 解析
 *
 * 将 var(--accent, fallback) 和 color-mix() 解析为具体十六进制颜色值。
 * 专为微信等不支持 CSS 变量的平台提供兼容。
 */

/**
 * 解析 CSS 文本中的自定义属性和 color-mix() 函数。
 * @param css         原始 CSS
 * @param accentColor 主题强调色（如 "#0969da"）
 */
export function resolveCssColors(css: string, accentColor: string): string {
  const accent = accentColor || "#0969da";
  let result = css;

  // 解析 var(--accent-fg, #xxx)
  result = result.replace(/var\(--accent-fg,\s*([^)]+)\)/g, "$1");
  // 解析 var(--accent, #xxx) → accent 色
  result = result.replace(/var\(--accent,\s*([^)]+)\)/g, accent);
  result = result.replace(/var\(--accent\)/g, accent);

  // 解析 color-mix(in srgb, <color> <pct>%, transparent) — 在白色背景上混合
  result = result.replace(
    /color-mix\(in srgb,\s*([^\s]+)\s+(\d+)%,\s*transparent\)/g,
    (_m: string, color: string, pct: string) => {
      const hex = color.replace("#", "");
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      const alpha = parseInt(pct) / 100;
      const blend = (c: number) => Math.round(c * alpha + 255 * (1 - alpha));
      return "#" + [r, g, b].map(c => blend(c).toString(16).padStart(2, "0")).join("");
    },
  );

  // 解析 color-mix with currentColor → 直接用 accent
  result = result.replace(
    /color-mix\(in srgb,\s*([^\s]+)\s+\d+%,\s*currentColor\)/g,
    "$1",
  );

  return result;
}
