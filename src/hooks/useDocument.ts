// ─── useDocument — 文档操作 Hook ───
// 封装 ArticleDocument 完整生命周期（加载/保存/创建/删除）
// 通过 DocumentStore 接口访问存储，不依赖具体实现

import { useState, useCallback } from "react";
import type { ArticleDocument, ArticleBlueprint, VersionEntry } from "../domain";
import { TauriDocumentStore } from "../infrastructure/TauriDocumentStore";
import { genId } from "../lib/storage/collections/crud";

const DEFAULT_STORE = new TauriDocumentStore();

export function useDocument(store = DEFAULT_STORE) {
  const [doc, setDoc] = useState<ArticleDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDocument = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await store.loadDocument(id);
      setDoc(result);
      return result;
    } catch (e: any) {
      const msg = e?.message || "加载文档失败";
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [store]);

  const saveDocument = useCallback(async (d: ArticleDocument) => {
    setError(null);
    try {
      d.updatedAt = Date.now();
      d.version = (d.version || 0) + 1;
      await store.saveDocument(d);
      setDoc({ ...d });
      return true;
    } catch (e: any) {
      setError(e?.message || "保存文档失败");
      return false;
    }
  }, [store]);

  const createDocument = useCallback(async (): Promise<ArticleDocument> => {
    const { DEFAULT_STYLE_CONFIG } = await import("../lib/storage/articleDocument");
    const now = Date.now();
    const newDoc: ArticleDocument = {
      id: genId(),
      title: "无标题",
      content: "",
      styleId: "general",
      actionId: "action-write",
      phase: "planning",
      outline: [],
      tags: [],
      styleConfig: DEFAULT_STYLE_CONFIG as any,
      inspiration: "",
      publishRecords: [],
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    setDoc(newDoc);
    return newDoc;
  }, []);

  const deleteDocument = useCallback(async (id: string) => {
    await store.deleteDocument(id);
    if (doc?.id === id) setDoc(null);
  }, [store, doc]);

  const reset = useCallback(() => {
    setDoc(null);
    setError(null);
    setLoading(false);
  }, []);

  // ── 蓝图操作（桥接旧模块） ──
  const loadBlueprint = useCallback(async (articleId: string): Promise<ArticleBlueprint | null> => {
    return store.loadBlueprint(articleId);
  }, [store]);

  const saveBlueprint = useCallback(async (articleId: string, blueprint: ArticleBlueprint) => {
    await store.saveBlueprint(articleId, blueprint);
  }, [store]);

  // ── 版本快照 ──
  const saveVersionSnapshot = useCallback(async (articleId: string, content: string) => {
    await store.saveVersionSnapshot(articleId, content);
  }, [store]);

  // ── 版本历史 ──
  const getVersionHistory = useCallback(async (articleId: string): Promise<VersionEntry[]> => {
    return store.getVersionHistory(articleId);
  }, [store]);

  const loadVersionContent = useCallback(async (articleId: string, versionId: string): Promise<string | null> => {
    return store.loadVersionContent(articleId, versionId);
  }, [store]);

  const restoreVersion = useCallback(async (articleId: string, versionId: string): Promise<string | null> => {
    return store.restoreVersion(articleId, versionId);
  }, [store]);

  // ── 提供商配置 ──
  const getProvidersSync = useCallback(() => {
    return store.getProvidersSync();
  }, [store]);

  // ── 文章内容 ──
  const loadArticleContent = useCallback(async (articleId: string): Promise<string | null> => {
    return store.loadArticleContent(articleId);
  }, [store]);

  const loadArticleMeta = useCallback(async (articleId: string): Promise<{ id: string; collectionId: string; title: string; createdAt: number; updatedAt: number } | null> => {
    return store.loadArticleMeta(articleId);
  }, [store]);

  const saveArticleContent = useCallback(async (articleId: string, content: string) => {
    await store.saveArticleContent(articleId, content);
  }, [store]);

  // ── 数据迁移 ──
  const migrateArticleDocument = useCallback(async (id: string): Promise<ArticleDocument | null> => {
    return store.migrateArticleDocument(id);
  }, [store]);

  return {
    doc, loading, error,
    loadDocument, saveDocument, createDocument, deleteDocument, reset,
    loadBlueprint, saveBlueprint, saveVersionSnapshot, getProvidersSync,
    getVersionHistory, loadVersionContent, restoreVersion,
    loadArticleContent, loadArticleMeta, saveArticleContent,
    migrateArticleDocument,
  };
}
