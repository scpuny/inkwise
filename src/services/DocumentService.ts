// ─── DocumentService — 文档生命周期服务 ───
// 依赖 DocumentStore 接口，不直接调用 Tauri / localStorage

import type { ArticleDocument, Collection } from "../domain";
import type { DocumentStore } from "../infrastructure/DocumentStore";

export class DocumentService {
  constructor(private readonly store: DocumentStore) {}

  /** 加载或创建文章文档 */
  async loadOrCreate(id: string, collectionId?: string): Promise<ArticleDocument> {
    const existing = await this.store.loadDocument(id);
    if (existing) return existing;

    const doc: ArticleDocument = {
      id,
      collectionId,
      title: "无标题",
      content: "",
      styleId: "general",
      actionId: "action-write",
      phase: "planning",
      outline: [],
      tags: [],
      styleConfig: {
        editorStyleTemplateId: "default",
        lineHeight: 1.75,
        editorFontSize: 15,
        editorMaxWidth: 820,
        editorParagraphGap: 1.25,
        editorFontFamily: "",
        codeThemeId: "atom-one-light",
        macosCodeBlock: false,
        firstLineIndent: false,
        justifyAlign: false,
        headingConfig: {},
        bgPattern: "",
        accentColor: "",
        captionFormat: "",
        customCSS: "",
        articleThemeId: "clean",
      },
      publishRecords: [],
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await this.store.saveDocument(doc);
    return doc;
  }

  /** 保存文档并触发事件 */
  async save(doc: ArticleDocument): Promise<void> {
    doc.updatedAt = Date.now();
    doc.version += 1;
    await this.store.saveDocument(doc);
  }

  /** 更新文档部分字段 */
  async update(id: string, partial: Partial<ArticleDocument>): Promise<ArticleDocument | null> {
    const doc = await this.store.loadDocument(id);
    if (!doc) return null;
    const updated = { ...doc, ...partial, updatedAt: Date.now(), version: doc.version + 1 };
    await this.store.saveDocument(updated);
    return updated;
  }

  /** 归档文章到合集 */
  async archiveToCollection(
    collectionId: string,
    title: string,
  ): Promise<{ collection: Collection; document: ArticleDocument } | null> {
    const collections = await this.store.loadCollections();
    let col = collections.find((c) => c.id === collectionId);
    if (!col) return null;

    const doc = await this.loadOrCreate(`doc_${Date.now()}`, collectionId);
    doc.title = title;
    await this.save(doc);

    col.articles.push({
      id: doc.id,
      title: doc.title,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
    await this.store.saveCollections(collections);

    return { collection: col, document: doc };
  }
}
