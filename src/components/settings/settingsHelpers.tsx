// settingsHelpers.ts — 设置面板共享常量与辅助函数
import type { ThemeStyle } from "../../lib/theme/theme";
import type { ReactNode } from "react";
import {
  Sparkles, Edit3, Languages, Maximize2, Search,
  PenTool, ListChecks, FileText, RotateCw,
  BookOpen, Hash, MessageSquare, Quote,
} from "lucide-react";
import type { TextSize } from "../../lib/theme/textSize";
import type { FontFamily } from "../../lib/theme/fontFamily";

/* ─── Tab definitions ─── */
export type SettingsTab = "general" | "editor" | "models" | "shortcuts" | "styles" | "themes" | "platforms" | "about";

/* ─── Skill icons & labels ─── */
export const SKILL_ICONS: Record<string, ReactNode> = {
  "polish": <Sparkles size={13} />,
  "rewrite": <Edit3 size={13} />,
  "translate": <Languages size={13} />,
  "expand": <Maximize2 size={13} />,
  "analysis": <Search size={13} />,
  "continue-writing": <PenTool size={13} />,
  "proofread": <ListChecks size={13} />,
  "summary": <FileText size={13} />,
  "outline": <ListChecks size={13} />,
  "paraphrase": <RotateCw size={13} />,
  "academic": <BookOpen size={13} />,
  "creative": <PenTool size={13} />,
  "headline": <Hash size={13} />,
  "keyword-extract": <Search size={13} />,
  "readability": <MessageSquare size={13} />,
  "citation": <Quote size={13} />,
  "blog": <FileText size={13} />,
  "novel": <BookOpen size={13} />,
  "email": <MessageSquare size={13} />,
};

export const SKILL_LABELS: Record<string, string> = {
  "continue-writing":"续写","rewrite":"改写","polish":"润色","translate":"翻译",
  "academic":"学术写作","creative":"创意写作","summary":"摘要","outline":"大纲",
  "expand":"扩写","paraphrase":"同义改写","proofread":"校对",
  "blog":"博客","novel":"小说","headline":"标题","email":"邮件",
  "keyword-extract":"关键词","readability":"可读性","citation":"引用",
};

export const PRIMARY_SKILLS = ["polish","rewrite","translate","expand","analysis"];

/* ─── Style helpers ─── */
export const STYLE_LABELS: Record<ThemeStyle, string> = {
  graphite: "石墨",
  aurora: "极光",
  slate: "石板",
  carbon: "碳灰",
  nocturne: "夜曲",
  amber: "琥珀",
};

export const STYLE_COLORS: Record<ThemeStyle, string> = {
  graphite: "linear-gradient(120deg,#ff6a3d,#ff9a52)",
  aurora: "linear-gradient(120deg,#8b7cff,#b07cff 42%,#38d6e6)",
  slate: "linear-gradient(120deg,#4d8df6,#3b82f6)",
  carbon: "linear-gradient(120deg,#2dd4bf,#22d3ee)",
  nocturne: "linear-gradient(120deg,#818cf8,#a78bfa)",
  amber: "linear-gradient(120deg,#d4632f,#de7a4b)",
};

/* ─── Helper functions ─── */
export function MoonIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export function textSizeLabel(s: TextSize): string {
  return { small: "小", default: "中", large: "大", xlarge: "特大" }[s] ?? s;
}

export function fontFamilyLabel(f: FontFamily): string {
  return { system: "系统", yahei: "微软雅黑", pingfang: "苹方", noto: "Noto", serif: "衬线", custom: "自定义" }[f] ?? f;
}

export function themeStyleTag(style: ThemeStyle): string {
  return { graphite: "默认", aurora: "冷调", slate: "商务", carbon: "科技", nocturne: "深邃", amber: "复古" }[style] ?? "";
}

export function themeStyleDesc(style: ThemeStyle): string {
  return {
    graphite: "暖橙色调，纸墨感，适合通用写作",
    aurora: "紫蓝色调，沉稳专业，适合学术/商务",
    slate: "冷静理性，适合技术文档",
    carbon: "青绿色调，安静护眼，适合长时写作",
    nocturne: "靛紫色调，优雅深邃，适合创意写作",
    amber: "暖橙复古，适合随笔/博客",
  }[style] ?? "";
}
