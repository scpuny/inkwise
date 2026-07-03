// toastStore.ts — 全局 toast 通知状态管理
import { create } from "zustand";

export interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info" | "warning";
  duration?: number;
}

export interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => string;
  removeToast: (id: string) => void;
}

let _toastSeq = 0;

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],

  addToast: (toast) => {
    const id = `toast-${++_toastSeq}-${Date.now()}`;
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
    const ms = toast.duration ?? 4000;
    if (ms > 0) {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, ms);
    }
    return id;
  },

  removeToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));
