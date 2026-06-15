import { useEffect, useRef, type ReactNode } from "react";

export type ContextMenuItem = {
  icon?: ReactNode;
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

export function ContextMenu({
  items,
  position,
  onClose,
}: {
  items: ContextMenuItem[];
  position: { x: number; y: number };
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // Delay to avoid immediate close from the right-click that opened it
    requestAnimationFrame(() => {
      document.addEventListener("pointerdown", onPointerDown);
      document.addEventListener("keydown", onKey);
    });
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Adjust position to keep menu within viewport
  const adjusted = { ...position };
  if (typeof window !== "undefined") {
    adjusted.x = Math.min(adjusted.x, window.innerWidth - 200);
    adjusted.y = Math.min(adjusted.y, window.innerHeight - items.length * 36 - 16);
    adjusted.x = Math.max(8, adjusted.x);
    adjusted.y = Math.max(8, adjusted.y);
  }

  return (
    <div
      ref={ref}
      className="context-menu"
      style={{ left: adjusted.x, top: adjusted.y }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          className={`context-menu__item${item.danger ? " context-menu__item--danger" : ""}${item.disabled ? " context-menu__item--disabled" : ""}`}
          disabled={item.disabled}
          onClick={() => {
            onClose();
            item.onClick();
          }}
        >
          {item.icon && <span className="context-menu__icon">{item.icon}</span>}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
