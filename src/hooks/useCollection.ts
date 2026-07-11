// ─── useCollection — 合集操作 Hook ───

import { useState, useCallback } from "react";
import type { Collection, TrashItem } from "../domain";
import { CollectionService } from "../services/CollectionService";

export function useCollection(service: CollectionService) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [trash, setTrash] = useState<TrashItem[]>([]);

  const refresh = useCallback(async () => {
    const cols = await service.list();
    setCollections(cols);
  }, [service]);

  const createCollection = useCallback(async (title: string) => {
    const col = await service.create(title);
    await refresh();
    return col;
  }, [service, refresh]);

  return { collections, trash, refresh, createCollection };
}
