export type ThemeStyle = "graphite" | "aurora" | "slate" | "carbon" | "nocturne" | "amber";
export type ThemeMode = "auto" | "light" | "dark";

export type LayoutState = {
  sidebarOpen: boolean;
  aiDockOpen: boolean;
  sidebarWidth: number;
  aiDockWidth: number;
};

export type DocTreeNode = {
  id: string;
  title: string;
  isFolder?: boolean;
  children?: DocTreeNode[];
  active?: boolean;
};

export type SuggestionItem = {
  id: string;
  text: string;
  meta?: string;
};

export type AnalysisData = {
  readability: number;
  sentenceLength: number;
  tone: { label: string; score: number }[];
  keywords: string[];
};

