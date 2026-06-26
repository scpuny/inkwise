// internal.ts — 内部辅助函数（不对外导出）
export function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function browserLoad<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

export function browserSave<T>(key: string, data: T): void {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
}
