// types.ts — 集合/文章/系列/项目上下文 类型定义
// 严格匹配原始 collections.ts 定义，确保所有消费端兼容

export type Article = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
  description?: string;
  tags?: string[];
  phase?: string;
  blueprint?: string;
};

export type Collection = {
  id: string;
  title: string;
  description?: string;
  coverImage?: string;
  articles: Article[];
  createdAt: number;
  linkedFolder?: string;
};

export type SeriesPlan = {
  id: string;
  title: string;
  createdAt: number;
  tone?: string;
  targetAudience?: string;
  skillId?: string;
  styleId?: string;
  actionId?: string;
  articles: SeriesArticle[];
  description?: string;
  totalArticles?: number;
  updatedAt?: number;
};

export type SeriesArticle = {
  id: string;
  title: string;
  description: string;
  targetWordCount?: number;
  status: "planned" | "outlining" | "writing" | "reviewing" | "complete" | "draft" | "published";
  articleId?: string;
  previousArticleId?: string;
  nextArticleId?: string;
  order?: number;
};

export type TrashItem = {
  id: string;
  title: string;
  collectionId: string;
  collectionTitle: string;
  deletedAt: number;
  articleId?: string;
  originalCollectionId?: string;
  phase?: string;
};

// ── Project Context types (Tauri IPC) ──

export interface ProjectContext {
  name: string;
  rootPath: string;
  primaryLanguage: string | null;
  files?: FileNode[];
  structure: FileNode[];
  summary: ProjectSummary;
  configs: ConfigFile[];
  configFiles?: ConfigFile[];
  symbols: SymbolInfo[];
  imports: ImportEdge[];
  codegraphAvailable: boolean;
}

export interface FileNode {
  name: string;
  path: string;
  isDir: boolean;
  language?: string | null;
  size?: number;
  children?: FileNode[];
  type?: "file" | "directory";
}

export interface ProjectSummary {
  totalFiles: number;
  totalDirs: number;
  totalLines: number;
  languages: LanguageStat[];
  topFiles: FileInfo[];
}

export interface LanguageStat {
  language: string;
  count: number;
  lines?: number;
  name?: string;
  files?: number;
  percentage?: number;
}

export interface FileInfo {
  path: string;
  language: string | null;
  lines: number;
  size: number;
}

export interface ConfigFile {
  name: string;
  content?: string;
  truncated?: boolean;
  path?: string;
  type?: string;
}

export interface SymbolInfo {
  name: string;
  kind: string;
  filePath?: string;
  file?: string;
  line: number;
  isExported?: boolean;
  docstring?: string | null;
  signature?: string | null;
}

export interface ImportEdge {
  source: string;
  target: string;
  kind?: string;
  from?: string;
  to?: string;
}

export interface FileContent {
  path: string;
  content: string;
  language?: string;
  error?: string;
}

export interface SearchResult {
  articleId: string;
  collectionId: string;
  collectionTitle: string;
  title: string;
  matchType: "title" | "content";
  snippet?: string;
  score: number;
}
