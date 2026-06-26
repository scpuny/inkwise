// textSize.ts — mirrors Reasonix pattern
// data-text-size: "small" | "default" | "large" | "xlarge"

export const TEXT_SIZES = ["small", "default", "large", "xlarge"] as const;
export type TextSize = (typeof TEXT_SIZES)[number];
export const DEFAULT_TEXT_SIZE: TextSize = "default";

const TEXT_SIZE_KEY = "inkwise-text-size";

export function isTextSize(value: unknown): value is TextSize {
  return typeof value === "string" && (TEXT_SIZES as readonly string[]).includes(value);
}

export function nextTextSize(current: TextSize, delta: -1 | 1): TextSize {
  const index = TEXT_SIZES.indexOf(current);
  const nextIndex = Math.min(TEXT_SIZES.length - 1, Math.max(0, index + delta));
  return TEXT_SIZES[nextIndex];
}

export function getTextSize(): TextSize {
  if (typeof localStorage === "undefined") return DEFAULT_TEXT_SIZE;
  const stored = localStorage.getItem(TEXT_SIZE_KEY);
  return isTextSize(stored) ? stored : DEFAULT_TEXT_SIZE;
}

export function applyTextSize(size: TextSize): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (size === DEFAULT_TEXT_SIZE) root.removeAttribute("data-text-size");
  else root.setAttribute("data-text-size", size);
  try { localStorage.setItem(TEXT_SIZE_KEY, size); } catch { /* still applies */ }
}

export function initTextSize(): void { applyTextSize(getTextSize()); }
