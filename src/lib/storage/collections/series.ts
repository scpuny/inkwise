// series.ts — 系列文章计划管理
import type { SeriesPlan } from "./types";
import { genId, browserLoad, browserSave } from "./internal";
import { isTauriEnv, tryInvoke, TauriCommands } from "../../bridge/tauri";

export function generateSeriesId(): string {
  return genId();
}

const OLD_SERIES_KEY = (id: string) => `series_plan:${id}`;
const NEW_SERIES_KEY = (id: string) => `series_plans:${id}`;

export async function saveSeriesPlan(collectionId: string, plan: SeriesPlan): Promise<void> {
  // Legacy format
  localStorage.setItem(OLD_SERIES_KEY(collectionId), JSON.stringify(plan));
  // New multi-format
  const all = await loadAllSeriesPlans(collectionId);
  const idx = all.findIndex((p) => p.id === plan.id);
  if (idx >= 0) all[idx] = plan;
  else all.push(plan);
  browserSave(NEW_SERIES_KEY(collectionId), all);
}

export async function loadAllSeriesPlans(collectionId: string): Promise<SeriesPlan[]> {
  // Check new multi-format
  const all = browserLoad<SeriesPlan[]>(NEW_SERIES_KEY(collectionId), []);
  if (all.length > 0) return all;

  // Migrate legacy
  const legacy = browserLoad<SeriesPlan | null>(OLD_SERIES_KEY(collectionId), null);
  if (legacy) {
    legacy.id = legacy.id || genId();
    browserSave(NEW_SERIES_KEY(collectionId), [legacy]);
    localStorage.removeItem(OLD_SERIES_KEY(collectionId));
    return [legacy];
  }
  return [];
}

export async function loadSeriesPlan(collectionId: string, seriesId: string): Promise<SeriesPlan | null> {
  const all = await loadAllSeriesPlans(collectionId);
  return all.find((p) => p.id === seriesId) ?? null;
}

export async function deleteSeriesPlan(collectionId: string, seriesId: string): Promise<void> {
  const all = await loadAllSeriesPlans(collectionId);
  const filtered = all.filter((p) => p.id !== seriesId);
  if (filtered.length > 0) {
    browserSave(NEW_SERIES_KEY(collectionId), filtered);
  } else {
    localStorage.removeItem(NEW_SERIES_KEY(collectionId));
    localStorage.removeItem(OLD_SERIES_KEY(collectionId));
  }
  // Tauri 后端清理
  try {
    if (isTauriEnv()) {
      await tryInvoke(TauriCommands.DeleteSeriesPlan, { collectionId, seriesId });
    }
  } catch { console.warn("[deleteSeriesPlan] backend cleanup failed (non-critical)"); }
  // 🔮 向量分块清理（Sprint 3 实现后启用）
  // try { await vectorIndexer.deleteCollectionChunks("series:" + seriesId); } catch { /* ignore */ }
}
