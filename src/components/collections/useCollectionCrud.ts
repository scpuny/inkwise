// useCollectionCrud.ts — shared collection CRUD state & handlers
// ponytail: extracted from ArticleManager + DocPicker to eliminate duplicate inline CRUD
import { useState, useCallback } from "react";
import {
  loadCollections, saveCollections, addCollection,
  renameCollection, removeCollection, updateCollection,
  genId, type Collection
} from "../../lib/storage/collections";
import { isTauriEnv, tryInvoke, TauriCommands } from "../../lib/bridge/tauri";
import { emit } from "../../lib/events/eventBus";
import { useToastStore } from "../../store/toastStore";

export function useCollectionCrud() {
  const [collections, setCollections] = useState<Collection[]>([]);

  const loadCols = useCallback(async () => {
    const cols = await loadCollections();
    setCollections(cols);
    return cols;
  }, []);


  const handleAddCollection = useCallback(async (title: string): Promise<Collection | null> => {
    if (!title.trim()) return null;
    const col = await addCollection(title.trim());
    setCollections(prev => [...prev, col]);
    emit("collections-changed");
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
    const addToast = useToastStore.getState().addToast;
    try {
      await removeCollection(id);
      // 重新加载合集列表
      const updated = await loadCollections();
      setCollections(updated);
      emit("collections-changed");
      addToast({ type: "success", message: "合集已删除（含所有子文章）" });
    } catch (e) {
      addToast({ type: "error", message: "删除合集失败：" + (e as Error).message });
    }
  }, []);

  const handleSaveCollection = useCallback(async (
    title: string, description: string, coverImage: string, linkedFolder?: string,
    editingId?: string | null,
  ) => {
    const addToast = useToastStore.getState().addToast;
    try {
      if (editingId) {
        await updateCollection(editingId, {
          title,
          description: description || undefined,
          coverImage: coverImage || undefined,
          linkedFolder: linkedFolder || undefined,
        });
        setCollections(prev => prev.map(c => c.id === editingId ? { ...c, title, description: description || undefined, coverImage: coverImage || undefined, linkedFolder: linkedFolder || undefined } : c));
        addToast({ type: "success", message: "合集已更新" });
      } else {
        const all = await loadCollections();
        const col: Collection = { id: genId(), title, description: description || undefined, coverImage: coverImage || undefined, linkedFolder: linkedFolder || undefined, articles: [], createdAt: Date.now() };
        all.push(col);
        await saveCollections(all);
        setCollections(all);
        emit("collections-changed");
        if (isTauriEnv()) { try { await tryInvoke(TauriCommands.CreateCollectionDb, { title, linkedFolder: linkedFolder || null }); } catch {} }
        addToast({ type: "success", message: "合集已创建" });
      }
    } catch (e) {
      addToast({ type: "error", message: "保存合集失败：" + (e as Error).message });
    }
  }, []);

  return {
    collections, setCollections,
    loadCols,
    handleAddCollection, handleRenameCollection,
    handleDeleteCollection, handleSaveCollection,
  };
}
