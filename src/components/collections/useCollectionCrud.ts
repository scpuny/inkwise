// useCollectionCrud.ts — shared collection CRUD state & handlers
// ponytail: extracted from ArticleManager + DocPicker to eliminate duplicate inline CRUD
import { useState, useCallback } from "react";
import {
  loadCollections, saveCollections, addCollection,
  renameCollection, removeCollection, updateCollection,
  browserLoad, genId, type Collection
} from "../../lib/storage/collections";
import { isTauriEnv, tryInvoke, TauriCommands } from "../../lib/bridge/tauri";

export function useCollectionCrud() {
  const [collections, setCollections] = useState<Collection[]>([]);

  const loadCols = useCallback(async () => {
    const cols = await loadCollections();
    setCollections(cols);
    return cols;
  }, []);

  const reloadFromStorage = useCallback(() => {
    const cols = browserLoad<Collection[]>("inkwise-collections", []);
    setCollections(cols);
    return cols;
  }, []);

  const handleAddCollection = useCallback(async (title: string): Promise<Collection | null> => {
    if (!title.trim()) return null;
    const col = await addCollection(title.trim());
    setCollections(prev => [...prev, col]);
    return col;
  }, []);

  const handleRenameCollection = useCallback(async (id: string, title: string) => {
    if (!title.trim()) return;
    await renameCollection(id, title.trim());
    setCollections(prev => prev.map(c => c.id === id ? { ...c, title: title.trim() } : c));
    if (isTauriEnv()) {
      try { await tryInvoke(TauriCommands.RenameCollectionDb, { id, title: title.trim() }); } catch {}
    }
  }, []);

  const handleDeleteCollection = useCallback(async (id: string) => {
    const idx = collections.findIndex(c => c.id === id);
    if (idx < 0) return;
    const updated = [...collections];
    updated.splice(idx, 1);
    await saveCollections(updated);
    setCollections(updated);
    if (isTauriEnv()) {
      try { await tryInvoke(TauriCommands.DeleteCollectionDb, { id }); } catch {}
    }
  }, [collections]);

  const handleSaveCollection = useCallback(async (
    title: string, description: string, coverImage: string, linkedFolder?: string,
    editingId?: string | null,
  ) => {
    if (editingId) {
      await updateCollection(editingId, {
        title,
        description: description || undefined,
        coverImage: coverImage || undefined,
        linkedFolder: linkedFolder || undefined,
      });
      setCollections(prev => prev.map(c => c.id === editingId ? { ...c, title, description: description || undefined, coverImage: coverImage || undefined, linkedFolder: linkedFolder || undefined } : c));
    } else {
      const all = await loadCollections();
      const col: Collection = { id: genId(), title, description: description || undefined, coverImage: coverImage || undefined, linkedFolder: linkedFolder || undefined, articles: [], createdAt: Date.now() };
      all.push(col);
      await saveCollections(all);
      setCollections(all);
      if (isTauriEnv()) { try { await tryInvoke(TauriCommands.CreateCollectionDb, { title, linkedFolder: linkedFolder || null }); } catch {} }
    }
  }, []);

  return {
    collections, setCollections,
    loadCols, reloadFromStorage,
    handleAddCollection, handleRenameCollection,
    handleDeleteCollection, handleSaveCollection,
  };
}
