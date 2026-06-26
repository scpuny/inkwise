// Collection/article data model — persisted via Tauri backend or localStorage

import { isTauriEnv, tryInvoke, invokeOrFallback, TauriCommands } from "../bridge/tauri";

export type Article = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
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
  articles: SeriesArticle[];
};

export type SeriesArticle = {
  id: string;
  title: string;
  description: string;
  targetWordCount?: number;
  status: "planned" | "outlining" | "writing" | "reviewing" | "complete";
  articleId?: string;
  previousArticleId?: string;
  nextArticleId?: string;
};

export type TrashItem = {
  id: string;
  title: string;
  collectionId: string;
  collectionTitle: string;
  deletedAt: number;
};

const COLLECTIONS_KEY = "aiwriter-collections";
const TRASH_KEY = "aiwriter-trash";
const SEEDED_KEY = "aiwriter-seeded-v1";

let nextId = Date.now();
export function genId(): string {
  return `id_${(nextId++).toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Tauri ↔ frontend type bridge ───

/**
 * Tauri's Collection uses `articleIds` (id list only).
 * Frontend's Collection uses `articles` (full objects).
 * These functions convert between the two representations.
 */
function fromTauriCollection(raw: Record<string, unknown>): Collection {
  return {
    id: (raw.id as string) ?? "",
    title: (raw.title as string) ?? "",
    createdAt: Number(raw.createdAt ?? raw.created_at ?? 0),
    linkedFolder: (raw.linkedFolder as string) ?? (raw.linked_folder as string) ?? undefined,
    articles: Array.isArray(raw.articles)
      ? (raw.articles as Record<string, unknown>[]).map((a) => ({
          id: (a.id as string) ?? "",
          title: (a.title as string) ?? "无标题",
          createdAt: Number(a.createdAt ?? a.created_at ?? 0),
          updatedAt: Number(a.updatedAt ?? a.updated_at ?? 0),
        }))
      : [],
  };
}

function toTauriCollection(c: Collection): Record<string, unknown> {
  return {
    id: c.id,
    title: c.title,
    createdAt: c.createdAt,
    linkedFolder: c.linkedFolder ?? null,
    articles: c.articles.map((a) => ({
      id: a.id,
      title: a.title,
      collectionId: c.id,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    })),
  };
}

// ─── Internal storage helpers ───

function browserLoad<T>(key: string, fallback: T): T {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function browserSave<T>(key: string, data: T): void {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* ignore */ }
}

/* ─── Seed data on first launch ─── */
export function seedIfEmpty(): void {
  if (typeof localStorage === "undefined") return;
  if (localStorage.getItem(SEEDED_KEY)) return;

  const autumnId = genId();
  const nightId = genId();
  const coffeeId = genId();

  const essayCol: Collection = {
    id: genId(),
    title: "随笔",
    description: "生活中的点滴感悟与随想",
    articles: [
      { id: autumnId, title: "秋日的午后", createdAt: Date.now() - 86400000 * 3, updatedAt: Date.now() - 86400000 },
      { id: nightId, title: "城市夜景漫步", createdAt: Date.now() - 86400000 * 7, updatedAt: Date.now() - 86400000 * 2 },
      { id: coffeeId, title: "一杯咖啡的时间", createdAt: Date.now() - 86400000 * 14, updatedAt: Date.now() - 86400000 * 5 },
    ],
    createdAt: Date.now() - 86400000 * 30,
  };

  const reactId = genId();
  const cssId = genId();

  const techCol: Collection = {
    id: genId(),
    title: "技术博客",
    description: "技术文章与编程经验分享",
    articles: [
      { id: reactId, title: "React 状态管理演进", createdAt: Date.now() - 86400000 * 10, updatedAt: Date.now() - 86400000 * 3 },
      { id: cssId, title: "CSS 容器查询指南", createdAt: Date.now() - 86400000 * 20, updatedAt: Date.now() - 86400000 * 8 },
    ],
    createdAt: Date.now() - 86400000 * 60,
  };

  browserSave(COLLECTIONS_KEY, [essayCol, techCol]);

  // Save initial seed content
  const seedArticles = [
    { id: autumnId, content: [
      "# 秋日的午后", "",
      "午后的阳光透过窗帘，在书桌上洒下温柔的光影。空气中漂着茶香，远处传来几声鸟鸣。", "",
      "秋日是一年中最温柔的时节，不冷也不热，刚刚好。",
    ].join("\n") },
    { id: nightId, content: [
      "# 城市夜景漫步", "",
      "夜幕降临，城市的蝎虹灯次第亮起。沿着江边漫步，看着对岸的灯火在水面上抖动。", "",
      "白天的喧嚣逐渐远去，夜晚的城市显现出另一种生命力。",
    ].join("\n") },
    { id: coffeeId, content: [
      "# 一杯咖啡的时间", "",
      "咖啡馆里漂着烘焙豆子的香气。一杯热美式放在面前，升腾的热气画出柔和的曲线。", "",
      "有时候，生活需要的不是更多，而是一杯咖啡的时间。",
    ].join("\n") },
    { id: reactId, content: [
      "# React 状态管理演进", "",
      "React 的状态管理经历了从简单到复杂，再回归简洁的演变过程。", "",
      "从最早的 setState，到 Redux 时代，再到 Context + Hooks，最后到原子化状态管理，每一步都是对前一种方案的反思与进化。",
    ].join("\n") },
    { id: cssId, content: [
      "# CSS 容器查询指南", "",
      "容器查询（Container Queries）允许我们基于父容器的尺寸来调整样式，而非只能依赖视口宽度。", "",
      "这是 CSS 响应式设计的重大进步，让组件级响应式变得可行。",
    ].join("\n") },
  ];
  for (const { id, content: text } of seedArticles) {
    try { localStorage.setItem("article:" + id, text); } catch {}
  }
  localStorage.setItem(SEEDED_KEY, "1");
}

/* ─── Collections ─── */
export async function loadCollections(): Promise<Collection[]> {
  if (isTauriEnv()) {
    try {
      const raw = await invokeOrFallback(TauriCommands.GetCollections, undefined, () => browserLoad(COLLECTIONS_KEY, []));
      if (Array.isArray(raw)) {
        return (raw as Record<string, unknown>[]).map(fromTauriCollection);
      }
      return [];
    } catch {
      return browserLoad<Collection[]>(COLLECTIONS_KEY, []);
    }
  }
  return browserLoad<Collection[]>(COLLECTIONS_KEY, []);
}

export async function saveCollections(collections: Collection[]): Promise<void> {
  browserSave(COLLECTIONS_KEY, collections);
  if (isTauriEnv()) {
    const tauriCols = collections.map(toTauriCollection);
    try { await invokeOrFallback(TauriCommands.SetCollections, { collections: tauriCols }, () => {}); } catch { /* fallback to localStorage */ }
  }
}

export async function addCollection(title: string): Promise<Collection> {
  const c: Collection = { id: genId(), title, articles: [], createdAt: Date.now() };
  const all = await loadCollections();
  all.push(c);
  await saveCollections(all);
  return c;
}

export async function renameCollection(id: string, title: string): Promise<void> {
  const all = await loadCollections();
  const c = all.find((x) => x.id === id);
  if (c) { c.title = title; await saveCollections(all); }
}

export async function removeCollection(id: string): Promise<void> {
  const all = await loadCollections();
  await saveCollections(all.filter((c) => c.id !== id));
}

export async function addArticle(collectionId: string, title: string): Promise<Article | null> {
  const all = await loadCollections();
  const c = all.find((x) => x.id === collectionId);
  if (!c) return null;
  const a: Article = { id: genId(), title, createdAt: Date.now(), updatedAt: Date.now() };
  c.articles.push(a);
  await saveCollections(all);
  return a;
}

export async function renameArticle(collectionId: string, articleId: string, title: string): Promise<void> {
  const all = await loadCollections();
  const c = all.find((x) => x.id === collectionId);
  if (!c) return;
  const a = c.articles.find((x) => x.id === articleId);
  if (a) { a.title = title; a.updatedAt = Date.now(); await saveCollections(all); }
}

export async function trashArticle(collectionId: string, articleId: string): Promise<void> {
  const all = await loadCollections();
  const c = all.find((x) => x.id === collectionId);
  if (!c) return;
  const idx = c.articles.findIndex((x) => x.id === articleId);
  if (idx === -1) return;
  const [article] = c.articles.splice(idx, 1);
  const trash = await loadTrash();
  trash.push({ id: article.id, title: article.title, collectionId, collectionTitle: c.title, deletedAt: Date.now() });
  await saveTrash(trash);
  await saveCollections(all);
}

/* ─── Trash ─── */
export async function loadTrash(): Promise<TrashItem[]> {
  if (isTauriEnv()) {
    try {
      const raw = await invokeOrFallback(TauriCommands.GetTrash, undefined, () => browserLoad(TRASH_KEY, []));
      return Array.isArray(raw) ? (raw as TrashItem[]) : [];
    } catch {
      return browserLoad(TRASH_KEY, []);
    }
  }
  return browserLoad(TRASH_KEY, []);
}

export async function saveTrash(items: TrashItem[]): Promise<void> {
  browserSave(TRASH_KEY, items);
  if (isTauriEnv()) {
    try { await invokeOrFallback(TauriCommands.SetTrash, { trash: items }, () => {}); } catch { /* fallback to localStorage */ }
  }
}

export async function restoreArticle(trashId: string): Promise<void> {
  const trash = await loadTrash();
  const idx = trash.findIndex((t) => t.id === trashId);
  if (idx === -1) return;
  const item = trash[idx];
  trash.splice(idx, 1);
  await saveTrash(trash);
  const all = await loadCollections();
  let c = all.find((x) => x.id === item.collectionId);
  if (!c) {
    c = { id: item.collectionId, title: item.collectionTitle, articles: [], createdAt: Date.now() };
    all.push(c);
  }
  c.articles.push({ id: item.id, title: item.title, createdAt: item.deletedAt, updatedAt: item.deletedAt });
  await saveCollections(all);
}

export async function permanentlyDeleteArticle(trashId: string): Promise<void> {
  const trash = await loadTrash();
  await saveTrash(trash.filter((t) => t.id !== trashId));
}

export async function emptyTrash(): Promise<void> {
  await saveTrash([]);
}

/* ─── Folder linking ─── */

export async function unlinkCollectionFolder(collectionId: string): Promise<void> {
  const all = await loadCollections();
  const c = all.find((x) => x.id === collectionId);
  if (!c) return;
  c.linkedFolder = undefined;
  await saveCollections(all);
}

export async function getCollectionFolderContext(collectionId: string): Promise<string> {
  const all = await loadCollections();
  const c = all.find((x) => x.id === collectionId);
  if (!c?.linkedFolder) return "";

  // Try cached index first
  const cacheKey = "folder_index:" + c.id;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      // Use cache if less than 1 hour old
      if (parsed.timestamp && Date.now() - parsed.timestamp < 3600000) {
        return parsed.content || "";
      }
    }
  } catch {}

  // Build fresh index (Tauri mode)
  if (isTauriEnv()) {
    try {
      const ctx = await invokeOrFallback<string>(TauriCommands.BuildFolderIndex, { path: c.linkedFolder }, () => "");
      if (ctx) {
        // Cache it
        try {
          localStorage.setItem(cacheKey, JSON.stringify({ content: ctx, timestamp: Date.now() }));
        } catch {}
        return ctx;
      }
    } catch { return ""; }
  }
  return "";
}



/* ─── Project context (IPC) ─── */

export interface ProjectContext {
  name: string;
  rootPath: string;
  primaryLanguage: string | null;
  structure: FileNode[];
  summary: ProjectSummary;
  configs: ConfigFile[];
  symbols: SymbolInfo[];
  imports: ImportEdge[];
  codegraphAvailable: boolean;
}

export interface FileNode {
  name: string;
  path: string;
  isDir: boolean;
  language: string | null;
  size: number;
  children: FileNode[];
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
  lines: number;
}

export interface FileInfo {
  path: string;
  language: string | null;
  lines: number;
  size: number;
}

export interface ConfigFile {
  name: string;
  content: string;
  truncated: boolean;
}

export interface SymbolInfo {
  name: string;
  kind: string;
  filePath: string;
  line: number;
  isExported: boolean;
  docstring: string | null;
  signature: string | null;
}

export interface ImportEdge {
  source: string;
  target: string;
  kind: string;
}

export async function linkCollectionFolder(collectionId: string, path: string): Promise<ProjectContext> {
  if (isTauriEnv()) {
    return invokeOrFallback<ProjectContext>('link_collection_folder', { collectionId, path }, () => {
      throw new Error('Tauri 环境不可用');
    });
  }
  throw new Error('浏览器环境下不支持目录关联');
}

export async function getProjectContext(path: string): Promise<ProjectContext> {
  if (isTauriEnv()) {
    return invokeOrFallback<ProjectContext>('get_project_context', { path }, () => {
      throw new Error('Tauri 环境不可用');
    });
  }
  throw new Error('浏览器环境下不支持项目扫描');
}

export async function getProjectContextText(path: string): Promise<string> {
  if (isTauriEnv()) {
    return invokeOrFallback<string>('get_project_context_text', { path }, () => '');
  }
  return '';
}

export async function rescanProjectFolder(path: string): Promise<ProjectContext> {
  if (isTauriEnv()) {
    return invokeOrFallback<ProjectContext>('rescan_project_folder', { path }, () => {
      throw new Error('Tauri 环境不可用');
    });
  }
  throw new Error('浏览器环境下不支持项目扫描');
}

/** 读取项目中指定文件列表的实际源码内容 */
export interface FileContent {
  path: string;
  content: string;
  size: number;
  truncated?: boolean;
  error?: string;
}

export async function readProjectFiles(path: string, files: string[]): Promise<FileContent[]> {
  if (!isTauriEnv() || files.length === 0) return [];
  try {
    return await tryInvoke<FileContent[]>(TauriCommands.ReadProjectFiles, { path, files });
  } catch {
    return [];
  }
}

/**
 * 从项目文件树中筛选与文章关键词匹配的文件，并读取其源码。
 * keywords: 文章标题 + 大纲中的关键词
 * tree: 项目文件树
 * projectPath: 项目根路径
 */
export async function findAndReadRelevantFiles(
  keywords: string[],
  tree: FileNode[],
  projectPath: string,
  maxFiles: number = 6,
): Promise<{ matchedFiles: string[]; sourceCode: string }> {
  if (!keywords.length || !tree.length) return { matchedFiles: [], sourceCode: '' };

  // 展平文件树，收集所有文件
  const allFiles: { path: string; name: string; score: number }[] = [];
  function walk(nodes: FileNode[], dirPath: string = '') {
    for (const node of nodes) {
      if (node.isDir) {
        walk(node.children || [], dirPath + node.name + '/');
      } else {
        const lower = node.name.toLowerCase();
        let score = 0;
        for (const kw of keywords) {
          if (lower.includes(kw.toLowerCase())) score += 10;
          // 优先匹配配置文件和源代码文件
          if (/\.(java|kt|ts|js|py|go|rs|yml|yaml|xml|properties|conf)$/i.test(node.name)) {
            if (lower.includes(kw.toLowerCase())) score += 5;
          }
        }
        if (score > 0) {
          allFiles.push({ path: dirPath + node.name, name: node.name, score });
        }
      }
    }
  }
  walk(tree);

  // 按匹配度排序，取 top N
  allFiles.sort((a, b) => b.score - a.score);
  const selected = allFiles.slice(0, maxFiles);
  if (selected.length === 0) return { matchedFiles: [], sourceCode: '' };

  const filePaths = selected.map(f => f.path);
  const contents = await readProjectFiles(projectPath, filePaths);
  
  let sourceCode = '';
  for (const file of contents) {
    if (file.content && !file.error) {
      sourceCode += `
### ${file.path}
\`\`\`
${file.content}
\`\`\`
`;
    }
  }

  return {
    matchedFiles: filePaths,
    sourceCode,
  };
}

let _seriesIdCounter = 0;
export function generateSeriesId(): string {
  _seriesIdCounter++;
  return `series_${Date.now()}_${_seriesIdCounter}`;
}

/** 旧 key → 新 key 迁移 */
const OLD_SERIES_KEY = (id: string) => `series_plan:${id}`;
const NEW_SERIES_KEY = (id: string) => `series_plans:${id}`;

export async function saveSeriesPlan(collectionId: string, plan: SeriesPlan): Promise<void> {
  // 自动计算前后文章引用关系
  for (let i = 0; i < plan.articles.length; i++) {
    plan.articles[i].previousArticleId = i > 0 ? (plan.articles[i - 1].articleId || undefined) : undefined;
    plan.articles[i].nextArticleId = i < plan.articles.length - 1 ? (plan.articles[i + 1].articleId || undefined) : undefined;
  }
  try {
    // Load existing plans, upsert by plan.id
    let plans: SeriesPlan[] = [];
    const raw = localStorage.getItem(NEW_SERIES_KEY(collectionId));
    if (raw) {
      try { plans = JSON.parse(raw); } catch {}
    }
    const idx = plans.findIndex(p => p.id === plan.id);
    if (idx >= 0) {
      plans[idx] = plan;
    } else {
      plans.push(plan);
    }
    localStorage.setItem(NEW_SERIES_KEY(collectionId), JSON.stringify(plans));
    // Clean up old single-plan key
    localStorage.removeItem(OLD_SERIES_KEY(collectionId));
  } catch {}
  if (isTauriEnv()) {
    try {
      // Send full plans array to Rust backend
      const raw = localStorage.getItem(NEW_SERIES_KEY(collectionId));
      if (raw) {
        const allPlans = JSON.parse(raw);
        await invokeOrFallback<void>(TauriCommands.SaveAllSeriesPlans, { collectionId, plans: allPlans }, () => {});
      }
    } catch {}
  }
}

export async function loadAllSeriesPlans(collectionId: string): Promise<SeriesPlan[]> {
  try {
    // Try new multi-plan key first
    const raw = localStorage.getItem(NEW_SERIES_KEY(collectionId));
    if (raw) return JSON.parse(raw) as SeriesPlan[];
    // Fallback: migrate old single-plan key
    const oldRaw = localStorage.getItem(OLD_SERIES_KEY(collectionId));
    if (oldRaw) {
      const oldPlan = JSON.parse(oldRaw) as SeriesPlan;
      // If old plan has no id, assign one
      if (!oldPlan.id) oldPlan.id = generateSeriesId();
      const plans = [oldPlan];
      localStorage.setItem(NEW_SERIES_KEY(collectionId), JSON.stringify(plans));
      localStorage.removeItem(OLD_SERIES_KEY(collectionId));
      return plans;
    }
  } catch {}
  // Tauri backend as fallback — load single plan and migrate
  if (isTauriEnv()) {
    try {
      const plans = await invokeOrFallback<SeriesPlan[]>(TauriCommands.LoadAllSeriesPlans, { collectionId }, () => []);
      if (plans.length > 0) {
        try { localStorage.setItem(NEW_SERIES_KEY(collectionId), JSON.stringify(plans)); } catch {}
        return plans;
      }
      // Fallback to old single-plan command
      const oldPlan = await invokeOrFallback<SeriesPlan | null>(TauriCommands.LoadSeriesPlan, { collectionId }, () => null);
      if (oldPlan) {
        if (!oldPlan.id) oldPlan.id = generateSeriesId();
        const arr = [oldPlan];
        try { localStorage.setItem(NEW_SERIES_KEY(collectionId), JSON.stringify(arr)); } catch {}
        return arr;
      }
    } catch {}
  }
  return [];
}

export async function loadSeriesPlan(collectionId: string, seriesId: string): Promise<SeriesPlan | null> {
  const plans = await loadAllSeriesPlans(collectionId);
  return plans.find(p => p.id === seriesId) || null;
}

export async function deleteSeriesPlan(collectionId: string, seriesId: string): Promise<void> {
  try {
    const raw = localStorage.getItem(NEW_SERIES_KEY(collectionId));
    if (raw) {
      const plans = JSON.parse(raw) as SeriesPlan[];
      const filtered = plans.filter(p => p.id !== seriesId);
      if (filtered.length > 0) {
        localStorage.setItem(NEW_SERIES_KEY(collectionId), JSON.stringify(filtered));
      } else {
        localStorage.removeItem(NEW_SERIES_KEY(collectionId));
      }
      localStorage.removeItem(OLD_SERIES_KEY(collectionId));
    }
  } catch {}
  if (isTauriEnv()) {
    try {
      // Send updated plans array
      const raw = localStorage.getItem(NEW_SERIES_KEY(collectionId));
      if (raw) {
        const allPlans = JSON.parse(raw);
        await invokeOrFallback<void>(TauriCommands.SaveAllSeriesPlans, { collectionId, plans: allPlans }, () => {});
      } else {
        await invokeOrFallback<void>(TauriCommands.DeleteSeriesPlan, { collectionId }, () => {});
      }
    } catch {}
  }
}

/* ─── Search ─── */

export interface SearchResult {
  articleId: string;
  collectionId: string;
  collectionTitle: string;
  title: string;
  matchType: "title" | "content";
  snippet?: string;
  score: number;
}

/**
 * Search articles by title across all collections.
 * Returns results sorted by relevance (exact match first, then prefix, then substring).
 */
export function searchArticleTitles(collections: Collection[], query: string): SearchResult[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase().trim();
  const results: SearchResult[] = [];

  for (const col of collections) {
    for (const article of col.articles) {
      const titleLower = article.title.toLowerCase();
      let score = 0;
      let matchType: "title" | "content" = "title";

      if (titleLower === q) {
        score = 100;
      } else if (titleLower.startsWith(q)) {
        score = 80;
      } else if (titleLower.includes(q)) {
        score = 50;
      } else if (q.length >= 2 && titleLower.split(/[\s\u4e00-\u9fff]+/).some((w) => w.startsWith(q) || q.startsWith(w))) {
        score = 30;
      } else {
        continue;
      }

      results.push({
        articleId: article.id,
        collectionId: col.id,
        collectionTitle: col.title,
        title: article.title,
        matchType,
        score,
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

/**
 * Search article content. Loads content for each article and searches.
 * This is async because it reads from storage. Only searches articles whose titles
 * didn't already match perfectly (to avoid duplication).
 */
export async function searchArticleContent(
  collections: Collection[],
  query: string,
  excludeIds: Set<string> = new Set(),
): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  const q = query.toLowerCase().trim();
  const results: SearchResult[] = [];

  for (const col of collections) {
    for (const article of col.articles) {
      if (excludeIds.has(article.id)) continue;

      try {
        const { loadArticleContent } = await import("./articles");
        const content = await loadArticleContent(article.id);
        if (!content) continue;

        const contentLower = content.toLowerCase();
        const idx = contentLower.indexOf(q);
        if (idx === -1) continue;

        // Generate snippet around the match
        const start = Math.max(0, idx - 30);
        const end = Math.min(content.length, idx + q.length + 40);
        let snippet = content.slice(start, end);
        if (start > 0) snippet = "…" + snippet;
        if (end < content.length) snippet = snippet + "…";

        results.push({
          articleId: article.id,
          collectionId: col.id,
          collectionTitle: col.title,
          title: article.title,
          matchType: "content",
          snippet,
          score: 20,
        });
      } catch {
        // Skip if content can't be loaded
      }
    }
  }

  return results;
}
