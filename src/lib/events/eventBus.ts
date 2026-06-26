// eventBus.ts — 轻量事件总线（基于 mitt）
// 替代 window.dispatchEvent/addEventListener 全局通信

import mitt from "mitt";
import type { EventBusMap, EventBusKey } from "./events";

// Cast to any to work around mitt's strict Record<EventType, unknown> constraint
// (EventBusMap uses string keys only, no symbols, so this is safe at runtime)
const _mitt = mitt<any>();

/**
 * 带类型安全的订阅包装器。
 * 返回一个 dispose 函数，调用后取消订阅。
 */
export function on<K extends EventBusKey>(
  event: K,
  handler: (detail?: EventBusMap[K]) => void,
): () => void {
  _mitt.on(event, handler);
  return () => _mitt.off(event, handler);
}

/**
 * 一次性订阅，触发一次后自动移除。
 */
export function once<K extends EventBusKey>(
  event: K,
  handler: (detail?: EventBusMap[K]) => void,
): () => void {
  const wrapper = (detail: EventBusMap[K] | undefined) => {
    handler(detail);
    _mitt.off(event, wrapper);
  };
  _mitt.on(event, wrapper as any);
  return () => _mitt.off(event, wrapper as any);
}

/**
 * 发布事件。
 */
export function emit<K extends EventBusKey>(
  event: K,
  detail?: EventBusMap[K],
): void {
  _mitt.emit(event, detail);
}

// 导出 mitt 原始实例供高级用法
export { _mitt as bus };
export type { EventBusMap, EventBusKey };
export default _mitt;
