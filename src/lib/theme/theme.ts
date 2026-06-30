// theme.ts — appearance management, mirrors Reasonix pattern.
// data-theme: "auto" | "light" | "dark"
// data-theme-style: "graphite" | "aurora" | "slate" | "carbon" | "nocturne" | "amber"

export type Theme = "auto" | "light" | "dark";
export type ResolvedTheme = Exclude<Theme, "auto">;

export const THEME_STYLES = [
  "graphite",
  "aurora",
  "slate",
  "carbon",
  "nocturne",
  "amber",
] as const;

export type ThemeStyle = (typeof THEME_STYLES)[number];

const DEFAULT_THEME_STYLE: ThemeStyle = "graphite";
const DEFAULT_THEME: Theme = "dark";

export const THEME_KEY = "inkwise-theme";
export const STYLE_KEY = "inkwise-theme-style";

let currentTheme: Theme = DEFAULT_THEME;
let currentThemeStyle: ThemeStyle = DEFAULT_THEME_STYLE;

export function normalizeThemePreference(value: unknown): Theme {
  if (typeof value !== "string") return DEFAULT_THEME;
  switch (value) {
    case "auto": return "auto";
    case "light": return "light";
    case "dark": return "dark";
    default: return DEFAULT_THEME;
  }
}

export function normalizeThemeStyle(value: string | undefined): ThemeStyle {
  if (!value) return DEFAULT_THEME_STYLE;
  if ((THEME_STYLES as readonly string[]).includes(value)) return value as ThemeStyle;
  return DEFAULT_THEME_STYLE;
}

export function getTheme(): Theme {
  return currentTheme;
}

export function getResolvedTheme(theme: Theme = getTheme()): ResolvedTheme {
  if (theme === "light" || theme === "dark") return theme;
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: light)").matches) return "light";
  return "dark";
}

export function getThemeStyle(): ThemeStyle {
  return currentThemeStyle;
}

export function applyTheme(theme: Theme, style: ThemeStyle = getThemeStyle()): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  if (theme === "auto") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);

  currentTheme = theme;
  currentThemeStyle = style;
  root.setAttribute("data-theme-style", style);
}

export function readLegacyPreference(): { theme: Theme; style: ThemeStyle; hasValue: boolean } {
  if (typeof localStorage === "undefined") return { theme: DEFAULT_THEME, style: DEFAULT_THEME_STYLE, hasValue: false };
  try {
    const rawTheme = localStorage.getItem(THEME_KEY);
    const rawStyle = localStorage.getItem(STYLE_KEY);
    const hasValue = rawTheme !== null || rawStyle !== null;
    const theme = rawTheme ? normalizeThemePreference(rawTheme) : DEFAULT_THEME;
    const style = normalizeThemeStyle(rawStyle ?? undefined);
    return { theme, style, hasValue };
  } catch {
    return { theme: DEFAULT_THEME, style: DEFAULT_THEME_STYLE, hasValue: false };
  }
}

export function persistTheme(theme: Theme, style: ThemeStyle): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(THEME_KEY, theme);
    localStorage.setItem(STYLE_KEY, style);
  } catch { /* ignore */ }
}

export function initTheme(): void {
  const pref = readLegacyPreference();
  if (pref.hasValue) {
    applyTheme(pref.theme, pref.style);
  } else {
    applyTheme(DEFAULT_THEME, DEFAULT_THEME_STYLE);
  }
}
