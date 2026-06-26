// articleVersions.ts — 文章版本历史（自动快照 + 回滚）
// 每次保存前自动拍快照，保留最近 30 个版本

const MAX_VERSIONS = 30;
const VERSION_PREFIX = "version:";
const INDEX_KEY = "version-index:";

export interface VersionEntry {
  id: string;       // timestamp as string
  articleId: string;
  createdAt: number;
  summary: string;  // brief preview (first line of content)
  charCount: number;
}

export interface VersionDetail extends VersionEntry {
  content: string;
}

// ─── Internal helpers ───

function listKey(id: string) { return VERSION_PREFIX + INDEX_KEY + id; }
function contentKey(id: string, ts: string) { return VERSION_PREFIX + id + ":" + ts; }

function loadIndex(articleId: string): VersionEntry[] {
  try {
    const raw = localStorage.getItem(listKey(articleId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveIndex(articleId: string, entries: VersionEntry[]) {
  try {
    localStorage.setItem(listKey(articleId), JSON.stringify(entries));
  } catch { /* ignore */ }
}

// ─── Public API ───

/** Take a snapshot BEFORE content changes. Call this before saveArticleContent. */
export async function saveVersionSnapshot(articleId: string, content: string): Promise<void> {
  if (!articleId || !content) return;
  const entries = loadIndex(articleId);

  // Skip duplicate (same content as last version)
  if (entries.length > 0) {
    const last = entries[0];
    const lastContent = await loadVersionContent(articleId, last.id);
    if (lastContent === content) return;
  }

  const now = Date.now();
  const id = String(now);
  const firstLine = content.split("\n")[0].replace(/^#\s*/, "").slice(0, 60);
  const entry: VersionEntry = {
    id,
    articleId,
    createdAt: now,
    summary: firstLine || "(空内容)",
    charCount: content.length,
  };

  // Save content
  try {
    localStorage.setItem(contentKey(articleId, id), content);
  } catch { return; }

  // Prepend to index, trim to MAX_VERSIONS (keep newest)
  entries.unshift(entry);
  if (entries.length > MAX_VERSIONS) {
    const removed = entries.splice(MAX_VERSIONS);
    // Clean up old content
    for (const r of removed) {
      try { localStorage.removeItem(contentKey(articleId, r.id)); } catch { /* ignore */ }
    }
  }
  saveIndex(articleId, entries);
}

/** Get version list (newest first) */
export async function getVersionHistory(articleId: string): Promise<VersionEntry[]> {
  return loadIndex(articleId);
}

/** Load content for a specific version */
export async function loadVersionContent(articleId: string, versionId: string): Promise<string | null> {
  try {
    return localStorage.getItem(contentKey(articleId, versionId));
  } catch { return null; }
}

/** Restore article to a specific version (returns content to set) */
export async function restoreVersion(articleId: string, versionId: string): Promise<string | null> {
  const content = await loadVersionContent(articleId, versionId);
  if (content === null) return null;
  // Snapshot current content before restore
  const currentRaw = localStorage.getItem(`article:${articleId}`);
  if (currentRaw) {
    await saveVersionSnapshot(articleId, currentRaw);
  }
  return content;
}

/** Delete all versions for an article (cleanup on article delete) */
export async function deleteAllVersions(articleId: string): Promise<void> {
  const entries = loadIndex(articleId);
  for (const e of entries) {
    try { localStorage.removeItem(contentKey(articleId, e.id)); } catch { /* ignore */ }
  }
  try { localStorage.removeItem(listKey(articleId)); } catch { /* ignore */ }
}
