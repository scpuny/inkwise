// useCollectionCrud.ts — shared collection CRUD state & handlers
// ponytail: extracted from ArticleManager + DocPicker to eliminate duplicate inline CRUD
import { useState, useCallback } from "react";
import { useCollection } from "../../hooks/useCollection";
import type { Collection } from "../../domain";
import { isTauriEnv, tryInvoke, TauriCommands } from "../../lib/bridge/tauri";
import { emit } from "../../lib/events/eventBus";
import { useToastStore } from "../../store/toastStore";

export function useCollectionCrud() {
  const {
    collections,
    loadCollections: loadCollectionsHook,
    createCollection,
    renameCollection,
    removeCollection,
    updateCollection,
  } = useCollection();

  const loadCols = useCallback(async () => {
    const cols = await loadCollectionsHook();
    return cols;
  }, [loadCollectionsHook]);

  const handleAddCollection = useCallback(async (title: string): Promise<Collection | null> => {
    if (!title.trim()) return null;
    const col = await createCollection(title.trim());
    emit("collections-changed");
    return col;
  }, [createCollection]);

  const handleRenameCollection = useCallback(async (id: string, title: string) => {
    if (!title.trim()) return;
    await renameCollection(id, title.trim());
    if (isTauriEnv()) {
      try { await tryInvoke(TauriCommands.RenameCollectionDb, { id, title: title.trim() }); } catch {}
    }
  }, [renameCollection]);

  const handleDeleteCollection = useCallback(async (id: string) => {
    const addToast = useToastStore.getState().addToast;
    try {
      await removeCollection(id);
      emit("collections-changed");
      addToast({ type: "success", message: "合集已删除（含所有子文章）" });
    } catch (e) {
      addToast({ type: "error", message: "删除合集失败：" + (e as Error).message });
    }
  }, [removeCollection]);

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
        addToast({ type: "success", message: "合集已更新" });
      } else {
        const col = await createCollection(title);
        // Patch additional fields after creation
        if (description || coverImage || linkedFolder) {
          await updateCollection(col.id, {
            description: description || undefined,
            coverImage: coverImage || undefined,
            linkedFolder: linkedFolder || undefined,
          });
        }
        emit("collections-changed");
        if (isTauriEnv()) {
          try { await tryInvoke(TauriCommands.CreateCollectionDb, { title, linkedFolder: linkedFolder || null }); } catch {}
        }
        addToast({ type: "success", message: "合集已创建" });
      }
    } catch (e) {
      addToast({ type: "error", message: "保存合集失败：" + (e as Error).message });
    }
  }, [createCollection, updateCollection]);

  return {
    collections,
    loadCols,
    handleAddCollection, handleRenameCollection,
    handleDeleteCollection, handleSaveCollection,
  };
}
