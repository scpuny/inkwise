// ─── EventBusImpl — mitt 事件总线实现 ───
import mitt from "mitt";
import type { EventBus } from "./EventBus";

export class MittEventBus implements EventBus {
  private bus = mitt<any>();

  emit(event: string, payload?: unknown): void {
    this.bus.emit(event, payload);
  }

  on(event: string, handler: (payload?: unknown) => void): () => void {
    this.bus.on(event, handler);
    return () => this.bus.off(event, handler);
  }

  off(event: string, handler: (payload?: unknown) => void): void {
    this.bus.off(event, handler);
  }
}
