// ─── useDocument — 文档操作 Hook ───
// 基层 Hook，计划未来取代 appHooks.ts 中的文档相关逻辑

import { useState, useCallback } from "react";
import type { ArticleDocument } from "../domain";
import type { DocumentStore } from "../infrastructure/DocumentStore";

export function useDocument(store: DocumentStore) {
  const [doc, setDoc] = useState<ArticleDocument | null>(null);
  const [loading, setLoading] = useState(false);

  const loadDocument = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const result = await store.loadDocument(id);
      setDoc(result);
      return result;
    } finally {
      setLoading(false);
    }
  }, [store]);

  const saveDocument = useCallback(async (d: ArticleDocument) => {
    d.updatedAt = Date.now();
    d.version += 1;
    await store.saveDocument(d);
    setDoc(d);
  }, [store]);

  return { doc, loading, loadDocument, saveDocument };
}
