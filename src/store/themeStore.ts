// themeStore.ts — 外观偏好集中管理（基于 Zustand）
// 替代 App.tsx 中的 themeStyle / themeMode / textSize / fontFamily 分散 state

import { create } from "zustand";
import {
  applyTheme, getTheme, getThemeStyle, persistTheme,
  type Theme, type ThemeStyle,
} from "../lib/theme/theme";
import {
  applyTextSize, getTextSize, type TextSize,
} from "../lib/theme/textSize";
import {
  applyFontFamily, getFontFamily, type FontFamily,
} from "../lib/theme/fontFamily";

/* ───────────── Theme Store ───────────── */

export interface ThemeState {
  themeStyle: ThemeStyle;
  themeMode: Theme;
  textSize: TextSize;
  fontFamily: FontFamily;
}

export interface ThemeActions {
  setThemeStyle: (style: ThemeStyle) => void;
  setThemeMode: (mode: Theme) => void;
  setTextSize: (size: TextSize) => void;
  setFontFamily: (font: FontFamily) => void;
}

export const useThemeStore = create<ThemeState & ThemeActions>((set) => ({
  themeStyle: getThemeStyle(),
  themeMode: getTheme(),
  textSize: getTextSize(),
  fontFamily: getFontFamily(),

  setThemeStyle: (style) => {
    set({ themeStyle: style });
    applyTheme(getTheme(), style);
  },
  setThemeMode: (mode) => {
    set({ themeMode: mode });
    applyTheme(mode, getThemeStyle());
    persistTheme(mode, getThemeStyle());
  },
  setTextSize: (size) => {
    set({ textSize: size });
    applyTextSize(size);
  },
  setFontFamily: (font) => {
    set({ fontFamily: font });
    applyFontFamily(font);
  },
}));
