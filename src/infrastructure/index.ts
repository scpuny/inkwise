// infrastructure/index.ts — 基础设施接口统一导出
export type { AIProvider, ChatMessage, ChatOptions } from "./AIProvider";
export type { DocumentStore } from "./DocumentStore";
export type { EventBus } from "./EventBus";
export { TauriDocumentStore } from "./TauriDocumentStore";
export { TauriAIProvider } from "./TauriAIProvider";
