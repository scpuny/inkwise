// ─── useCollection — 合集 + 回收站 Hook ───
// 封装集合完整 CRUD + 回收站操作
// 通过 DocumentStore 接口访问存储

import { useState, useCallback } from "react";
import type { Collection, TrashItem } from "../domain";
import { TauriDocumentStore } from "../infrastructure/TauriDocumentStore";

const DEFAULT_STORE = new TauriDocumentStore();

export function useCollection(store = DEFAULT_STORE) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [trash, setTrash] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadCollections = useCallback(async () => {
    setLoading(true);
    try {
      const cols = await store.loadCollections();
      setCollections(cols);
      return cols;
    } finally {
      setLoading(false);
    }
  }, [store]);

  const loadTrash = useCallback(async () => {
    const items = await store.loadTrash();
    setTrash(items);
    return items;
  }, [store]);

  const createCollection = useCallback(async (title: string) => {
    const c = await store.createCollection(title);
    setCollections(prev => [...prev, c]);
    return c;
  }, [store]);

  const refresh = useCallback(async () => {
    await Promise.all([loadCollections(), loadTrash()]);
  }, [loadCollections, loadTrash]);

  return { collections, trash, loading, loadCollections, loadTrash, createCollection, refresh };
}
