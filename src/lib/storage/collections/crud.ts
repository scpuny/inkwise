// crud.ts — 集合/文章/回收站 CRUD 操作
import { isTauriEnv, tryInvoke, invokeOrFallback, TauriCommands } from "../../bridge/tauri";
import { initTheme, normalizeThemePreference, normalizeThemeStyle, THEME_KEY, STYLE_KEY } from "../../theme/theme";
import { initTextSize, isTextSize, TEXT_SIZE_KEY } from "../../theme/textSize";
import { initFontFamily, isFontFamily, FONT_FAMILY_KEY } from "../../theme/fontFamily";
import { useThemeStore } from "../../../store/themeStore";
import type { Article, Collection, TrashItem } from "./types";
import { genId, browserLoad, browserSave } from "./internal";

const COLLECTIONS_KEY = "inkwise-collections";
const TRASH_KEY = "inkwise-trash";
const SEEDED_KEY = "inkwise-seeded-v1";

/* ─── 种子数据 ─── */

export function seedIfEmpty(): void {
  if (localStorage.getItem(SEEDED_KEY)) return;
  const existing = browserLoad<Collection[]>(COLLECTIONS_KEY, []);
  if (existing.length > 0) return;
  // In Tauri env, skip demo data — loadCollections will fetch from backend
  if (typeof (window as any)?.__TAURI_INTERNALS__ !== 'undefined') return;
  const now = Date.now();
  const demo: Collection = {
    id: genId(),
    title: "示例文集",
    createdAt: now,
    articles: [
      { id: genId(), title: "欢迎使用 InkWise", createdAt: now, updatedAt: now, phase: "planning_tags" },
      { id: genId(), title: "第二篇文章", createdAt: now, updatedAt: now },
    ],
  };
  localStorage.setItem(COLLECTIONS_KEY, JSON.stringify([demo]));
  localStorage.setItem(SEEDED_KEY, "1");
}

// ── Tauri ↔ frontend type bridge ──

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function fromTauriCollection(raw: Record<string, unknown>): Collection {
  return {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? ""),
    createdAt: Number(raw.created_at ?? raw.createdAt ?? 0),
    articles: Array.isArray(raw.articles) ? raw.articles.map((a: unknown) => {
      if (!isRecord(a)) return null;
      return {
        id: String(a.id ?? ""),
        title: String(a.title ?? ""),
        createdAt: Number(a.created_at ?? a.createdAt ?? 0),
        updatedAt: Number(a.updated_at ?? a.updatedAt ?? 0),
        description: a.description ? String(a.description) : undefined,
        tags: a.tags ? (Array.isArray(a.tags) ? a.tags.map(String) : undefined) : undefined,
        phase: a.phase ? String(a.phase) : undefined,
        blueprint: a.blueprint ? String(a.blueprint) : undefined,
      };
    }).filter(Boolean) as Article[] : [],
    linkedFolder: raw.linkedFolder ? String(raw.linkedFolder) : undefined,
  };
}

function toTauriCollection(c: Collection): Record<string, unknown> {
  return {
    id: c.id,
    title: c.title,
    createdAt: c.createdAt,
    articles: c.articles.map((a) => ({
      id: a.id,
      collectionId: c.id,
      title: a.title,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      phase: a.phase,
      description: a.description,
      tags: a.tags,
      blueprint: a.blueprint,
    })),
    linkedFolder: c.linkedFolder,
  };
}

/* ─── 集合 CRUD ─── */

// ponytail: session-level flags, sync from backend once per app start
let _syncedFromBackend = false;
let _syncedSettings = false;

/** Force a full re-sync from backend on next loadCollections call */
export function forceSync(): void {
  _syncedFromBackend = false;
  _syncedSettings = false;
}

export async function loadCollections(): Promise<Collection[]> {
  // Backend is source of truth — sync on first load in Tauri
  if (!_syncedFromBackend && typeof (window as any)?.__TAURI_INTERNALS__ !== 'undefined') {
    _syncedFromBackend = true;
    try {
      const raw = await tryInvoke<Record<string, unknown>[]>(TauriCommands.GetCollections);
      if (raw) {
        const result = raw.map(fromTauriCollection);
        browserSave(COLLECTIONS_KEY, result);
        console.log('[loadCollections] from backend, count=%d', result.length);
        return result;
      }
      // Backend returned empty — clear stale cache
      browserSave(COLLECTIONS_KEY, []);
      return [];
    } catch (e) {
      console.warn('[loadCollections] GetCollections failed, using cache:', e);
    }
  }
  // Sync appearance settings from backend once per app start
  if (!_syncedSettings && typeof (window as any)?.__TAURI_INTERNALS__ !== 'undefined') {
    _syncedSettings = true;
    trySettingsSync();
  }
  // Cache fast path or non-Tauri fallback
  const local = browserLoad<Collection[]>(COLLECTIONS_KEY, []);
  if (local.length > 0) return local;
  return [];
}

export async function saveCollections(collections: Collection[]): Promise<void> {
  // 原子写入：Rust JSON 是权威源，写入失败则抛异常，不更新缓存
  if (isTauriEnv()) {
    await tryInvoke(TauriCommands.SetCollections, { collections: collections.map(toTauriCollection) });
  }
  // 浏览器模式 或 Rust 写入成功后，更新前端缓存
  browserSave(COLLECTIONS_KEY, collections);
}

export async function addCollection(title: string): Promise<Collection> {
  const all = await loadCollections();
  const c: Collection = { id: genId(), title, createdAt: Date.now(), articles: [] };
  all.push(c);
  await saveCollections(all);
  return c;
}

export async function renameCollection(id: string, title: string): Promise<void> {
  const all = await loadCollections();
  const c = all.find((x) => x.id === id);
  if (c) { c.title = title; await saveCollections(all); }
}

export async function updateCollection(
  id: string,
  data: { title?: string; description?: string; coverImage?: string; linkedFolder?: string }
): Promise<void> {
  // 精确更新合集信息，不触及其他集合和文章
  const all = await loadCollections();
  const c = all.find((x) => x.id === id);
  if (!c) return;
  if (data.title !== undefined) c.title = data.title;
  if (data.description !== undefined) c.description = data.description || undefined;
  if (data.coverImage !== undefined) c.coverImage = data.coverImage || undefined;
  if (data.linkedFolder !== undefined) c.linkedFolder = data.linkedFolder || undefined;
  await saveCollections(all);
}

export async function removeCollection(id: string): Promise<void> {
  const all = await loadCollections();
  const idx = all.findIndex((x) => x.id === id);
  if (idx >= 0) { all.splice(idx, 1); await saveCollections(all); }
}

/* ─── 文章 CRUD ─── */

export async function addArticle(collectionId: string, title: string): Promise<Article | null> {
  const all = await loadCollections();
  const col = all.find((x) => x.id === collectionId);
  if (!col) return null;
  const article: Article = { id: genId(), title, createdAt: Date.now(), updatedAt: Date.now() };
  col.articles.push(article);
  await saveCollections(all);
  return article;
}

export async function renameArticle(collectionId: string, articleId: string, title: string): Promise<void> {
  const all = await loadCollections();
  const a = all.find((x) => x.id === collectionId)?.articles.find((x) => x.id === articleId);
  if (a) { a.title = title; a.updatedAt = Date.now(); await saveCollections(all); }
}

export async function trashArticle(collectionId: string, articleId: string): Promise<void> {
  const all = await loadCollections();
  const col = all.find((x) => x.id === collectionId);
  if (!col) return;
  const idx = col.articles.findIndex((x) => x.id === articleId);
  if (idx === -1) return;
  const [article] = col.articles.splice(idx, 1);
  await saveCollections(all);
  const trash = await loadTrash();
  trash.push({ id: articleId, collectionId, collectionTitle: col.title, title: article.title, deletedAt: Date.now() });
  await saveTrash(trash);

  // Clean up associated data: content, meta, blueprint, versions, localStorage drafts
  try {
    const { deleteArticleContent } = await import("../../storage/articles");
    await deleteArticleContent(articleId);
  } catch { console.warn("[trashArticle] deleteArticleContent failed (non-critical cleanup)"); }
  try {
    const { deleteAllVersions } = await import("../../storage/articleVersions");
    await deleteAllVersions(articleId);
  } catch { console.warn("[trashArticle] deleteAllVersions failed (non-critical cleanup)"); }
  try {
    if (isTauriEnv()) {
      await tryInvoke(TauriCommands.DeleteArticle, { id: articleId });
    }
  } catch { console.warn("[trashArticle] DeleteArticle failed (non-critical cleanup)"); }
  try {
    localStorage.removeItem('plan-draft-' + articleId);
  } catch { console.warn('[trashArticle] remove plan-draft failed (non-critical cleanup)'); }
}

/* ─── 回收站 ─── */

export async function loadTrash(): Promise<TrashItem[]> {
  try { return await tryInvoke<TrashItem[]>(TauriCommands.GetTrash); } catch { console.warn("[loadTrash] GetTrash failed, using localStorage fallback"); }
  return browserLoad<TrashItem[]>(TRASH_KEY, []);
}

export async function saveTrash(items: TrashItem[]): Promise<void> {
  // ponytail: backend is source of truth — write there first, then cache
  try { await tryInvoke(TauriCommands.SetTrash, { items }); } catch { console.warn("[saveTrash] SetTrash failed"); }
  browserSave(TRASH_KEY, items);
}

export async function restoreArticle(trashId: string): Promise<void> {
  const trash = await loadTrash();
  const idx = trash.findIndex((t) => t.id === trashId);
  if (idx === -1) return;
  const [item] = trash.splice(idx, 1);
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

/* ─── 文集文件夹关联 ─── */

// ponytail: sync appearance settings from backend once per session
async function trySettingsSync(): Promise<void> {
  try {
    const s = await tryInvoke<Record<string,string>|null>(TauriCommands.GetSettings);
    if (!s) return;
    let changed = false;
    if (s.theme) { localStorage.setItem(THEME_KEY, s.theme); changed = true; }
    if (s.theme_style) { localStorage.setItem(STYLE_KEY, s.theme_style); changed = true; }
    if (s.text_size) { localStorage.setItem(TEXT_SIZE_KEY, s.text_size); changed = true; }
    if (s.font_family) { localStorage.setItem(FONT_FAMILY_KEY, s.font_family); changed = true; }
    if (changed) {
      initTheme();
      initTextSize();
      initFontFamily();
      // Sync Zustand store so settings panel reflects saved values
      const ts = localStorage.getItem(TEXT_SIZE_KEY);
      const ff = localStorage.getItem(FONT_FAMILY_KEY);
      useThemeStore.setState({
        themeStyle: normalizeThemeStyle(localStorage.getItem(STYLE_KEY) ?? undefined),
        themeMode: normalizeThemePreference(localStorage.getItem(THEME_KEY)),
        ...(isTextSize(ts) ? { textSize: ts } : {}),
        ...(isFontFamily(ff) ? { fontFamily: ff } : {}),
      });
      console.log('[trySettingsSync] synced from backend');
    }
  } catch { /* first launch, no saved settings yet */ }
}

export async function unlinkCollectionFolder(collectionId: string): Promise<void> {
  const all = await loadCollections();
  const c = all.find((x) => x.id === collectionId);
  if (!c) return;
  c.linkedFolder = undefined;
  // Clean up all AI-related cache for this collection
  try { localStorage.removeItem("folder_index:" + collectionId); } catch { console.warn("[unlinkCollectionFolder] remove folder_index cache failed (non-critical)"); }
  try {
    const { clearProjectInsights, clearProjectFileTree } = await import("./projectContext");
    clearProjectInsights(collectionId);
    clearProjectFileTree(collectionId);
  } catch { console.warn("[unlinkCollectionFolder] clearProjectInsights/clearProjectFileTree failed (non-critical)"); }
  // Clean up plan drafts for every article in the collection
  for (const art of c.articles) {
    try { localStorage.removeItem("plan-draft-" + art.id); } catch { console.warn("[unlinkCollectionFolder] remove plan-draft failed (non-critical)"); }
  }
  await saveCollections(all);
}

export async function getCollectionFolderContext(collectionId: string): Promise<string> {
  const all = await loadCollections();
  const c = all.find((x) => x.id === collectionId);
  if (!c?.linkedFolder) return "";
  const cacheKey = "folder_index:" + c.id;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.timestamp && Date.now() - parsed.timestamp < 3600000) return parsed.content || "";
    }
  } catch { /* stale/invalid cache, safe to ignore */ }
  if (isTauriEnv()) {
    try {
      const ctx = await invokeOrFallback<string>(TauriCommands.BuildFolderIndex, { path: c.linkedFolder }, () => "");
      if (ctx) {
        try { localStorage.setItem(cacheKey, JSON.stringify({ content: ctx, timestamp: Date.now() })); } catch { console.warn("[getCollectionFolderContext] localStorage setItem failed (non-critical)"); }
        return ctx;
      }
    } catch { console.warn("[getCollectionFolderContext] BuildFolderIndex failed"); return ""; }
  }
  return "";
}
