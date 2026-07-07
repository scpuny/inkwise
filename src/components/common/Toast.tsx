import { useEffect, useRef } from "react";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { useToastStore, type Toast } from "../../store/toastStore";

/* ─── Icon mapping ─── */
const ICON_MAP: Record<Toast["type"], typeof CheckCircle> = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

/* ─── Single toast item ─── */
function ToastItem({ toast }: { toast: Toast }) {
  const removeToast = useToastStore((s) => s.removeToast);
  const Icon = ICON_MAP[toast.type];
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Entrance animation via CSS class
    requestAnimationFrame(() => ref.current?.classList.add("toast--visible"));
    return () => {};
  }, []);

  return (
    <div
      ref={ref}
      className={`toast toast--${toast.type}`}
      onClick={() => removeToast(toast.id)}
    >
      <Icon size={16} className="toast__icon" />
      <span className="toast__message">{toast.message}</span>
      <button
        className="toast__close"
        onClick={(e) => { e.stopPropagation(); removeToast(toast.id); }}
        aria-label="关闭"
      >
        <X size={14} />
      </button>
    </div>
  );
}

/* ─── Toast container ─── */
export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
