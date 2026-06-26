// storageEngine.ts — 统一存储引擎
// 架构：后端（Tauri/磁盘）是权威数据源，localStorage 仅作为读缓存
//
// 设计原则：
// - get()：后端优先读取，同步更新缓存
// - getSync()：仅读缓存（用于 React useState 等同步场景）
// - set()：同时写后端和缓存
// - delete()：后端正删 + 清理缓存
// - 缓存自动随后端读写同步，无需手动管理

import { isTauriEnv, tryInvoke } from "../bridge/tauri";

// ─── Backend Adapter ───
// 定义后端读写接口，每个数据模块实现自己的 adapter
export interface BackendAdapter<T> {
  read(): Promise<T | null>;
  write(data: T): Promise<void>;
  delete(): Promise<void>;
}

// ─── 存储引擎 ───
export class StorageEngine<T> {
  private cacheKey: string;
  private backend: BackendAdapter<T>;

  constructor(
    /** localStorage 缓存键名（自动加 inkwise: 前缀避免冲突） */
    cacheKey: string,
    /** 后端读写适配器 */
    backend: BackendAdapter<T>,
  ) {
    this.cacheKey = `inkwise:${cacheKey}`;
    this.backend = backend;
  }

  /** 权威读：后端 → 更新缓存 → 返回 */
  async get(): Promise<T | null> {
    const data = await this.backend.read();
    if (data !== null) {
      this.writeCache(data);
      return data;
    }
    return this.readCache();
  }

  /** 同步缓存读（用于 React useState 等不能 await 的场景） */
  getSync(): T | null {
    return this.readCache();
  }

  /** 权威写：同时写后端和缓存 */
  async set(data: T): Promise<void> {
    await this.backend.write(data);
    this.writeCache(data);
  }

  /** 删除：后端正删 + 清理缓存 */
  async delete(): Promise<void> {
    await this.backend.delete();
    this.clearCacheInternal();
  }

  /** 从后端重建缓存 */
  async rebuildCache(): Promise<void> {
    const data = await this.backend.read();
    if (data !== null) {
      this.writeCache(data);
    }
  }

  /** 清理当前项的缓存（不移除后端数据） */
  invalidateCache(): void {
    this.clearCacheInternal();
  }

  private readCache(): T | null {
    try {
      const raw = localStorage.getItem(this.cacheKey);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  private writeCache(data: T): void {
    try {
      localStorage.setItem(this.cacheKey, JSON.stringify(data));
    } catch {
      /* quota exceeded or localStorage unavailable */
    }
  }

  private clearCacheInternal(): void {
    try {
      localStorage.removeItem(this.cacheKey);
    } catch {
      /* ignore */
    }
  }

  // ─── 静态工具 ───

  /** 清理所有 inkwise 缓存 */
  static clearAllCache(): void {
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("inkwise:")) {
          keys.push(key);
        }
      }
      keys.forEach((k) => localStorage.removeItem(k));
    } catch {
      /* ignore */
    }
  }
}

// ─── 快捷工厂：创建 Tauri invoke 后端适配器 ───

interface TauriBackendConfig<T> {
  /** 读取命令名，如 "get_providers" */
  readCmd: string;
  /** 写入命令名，如 "set_providers" */
  writeCmd: string;
  /** 构造写入参数，默认 { data } */
  writeArgs?: (data: T) => Record<string, unknown>;
  /** 删除命令名（可选） */
  deleteCmd?: string;
}

/** 创建基于 Tauri invoke 的 BackendAdapter */
export function tauriBackend<T>(
  config: TauriBackendConfig<T>,
): BackendAdapter<T> {
  return {
    read: async () => {
      if (!isTauriEnv()) return null;
      try {
        return await tryInvoke<T>(config.readCmd);
      } catch {
        return null;
      }
    },
    write: async (data: T) => {
      if (!isTauriEnv()) return;
      const args = config.writeArgs ? config.writeArgs(data) : { data };
      try {
        await tryInvoke(config.writeCmd, args);
      } catch {
        /* backend unavailable */
      }
    },
    delete: async () => {
      if (!isTauriEnv() || !config.deleteCmd) return;
      try {
        await tryInvoke(config.deleteCmd);
      } catch {
        /* ignore */
      }
    },
  };
}
