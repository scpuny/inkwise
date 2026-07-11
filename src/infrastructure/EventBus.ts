// ─── EventBus 接口 ───
// 抽象事件发布/订阅，可被 mitt / Tauri emit / Mock 实现

export interface EventBus {
  emit(event: string, payload?: unknown): void;
  on(event: string, handler: (payload?: unknown) => void): () => void;
  off(event: string, handler: (payload?: unknown) => void): void;
}
