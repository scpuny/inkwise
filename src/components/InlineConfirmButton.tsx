import { useState } from "react";
import { Check, X } from "lucide-react";

export function InlineConfirmButton({
  label,
  confirmLabel,
  cancelLabel,
  danger,
  disabled,
  onConfirm,
}: {
  label: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  disabled?: boolean;
  onConfirm: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <span className="inline-confirm">
        <button className={`btn btn--small${danger ? " btn--danger" : ""}`} disabled={disabled} onClick={onConfirm}>
          <Check size={12} />
          {confirmLabel || "确认"}
        </button>
        <button className="btn btn--small" disabled={disabled} onClick={() => setConfirming(false)}>
          <X size={12} />
          {cancelLabel || "取消"}
        </button>
      </span>
    );
  }

  return (
    <button className="btn btn--small" disabled={disabled} onClick={() => setConfirming(true)}>
      {label}
    </button>
  );
}
