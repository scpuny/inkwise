// Tauri bridge — detects Tauri and provides invoke wrapper.
// Falls back to a no-op when running in browser (dev mode).

type InvokeFn = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;

let _invoke: InvokeFn | null = null;

// Detect Tauri: __TAURI_INTERNALS__ is injected by Tauri's WebView
const isTauri: boolean =
  typeof window !== "undefined" &&
  typeof (window as any).__TAURI_INTERNALS__ !== "undefined";

// Try to load the invoke function
const initPromise: Promise<void> = (async () => {
  if (!isTauri) return;
  try {
    const mod = await import("@tauri-apps/api/core");
    _invoke = mod.invoke as InvokeFn;
  } catch {
    _invoke = null;
  }
})();

export function isTauriEnv(): boolean {
  return isTauri && _invoke !== null;
}

export async function waitForTauri(): Promise<void> {
  await initPromise;
}

export async function tryInvoke<T>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (_invoke) {
    return (await _invoke(cmd, args)) as T;
  }
  throw new Error(`Tauri invoke not available for: ${cmd}`);
}

// Safe version with fallback
export async function invokeOrFallback<T>(
  cmd: string,
  args: Record<string, unknown> | undefined,
  fallback: () => T,
): Promise<T> {
  if (_invoke) {
    try {
      return (await _invoke(cmd, args)) as T;
    } catch {
      return fallback();
    }
  }
  return fallback();
}
