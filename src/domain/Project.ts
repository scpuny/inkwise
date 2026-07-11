// ─── 项目上下文领域类型 ───
// 纯数据定义，不含业务逻辑

export interface FileNode {
  name: string;
  path: string;
  isDir: boolean;
  language?: string | null;
  size?: number;
  children?: FileNode[];
  type?: "file" | "directory";
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

export interface ProjectSummary {
  totalFiles: number;
  totalDirs: number;
  totalLines: number;
  languages: LanguageStat[];
  topFiles: FileInfo[];
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
