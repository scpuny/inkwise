import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

export type ContextMenuItem = {
  icon?: ReactNode;
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children?: ContextMenuItem[];
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
  const [submenuIndex, setSubmenuIndex] = useState<number | null>(null);
  const [submenuPos, setSubmenuPos] = useState({ x: 0, y: 0 });
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    requestAnimationFrame(() => {
      document.addEventListener("pointerdown", onPointerDown);
      document.addEventListener("keydown", onKey);
    });
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const adjusted = { ...position };
  if (typeof window !== "undefined") {
    adjusted.x = Math.min(adjusted.x, window.innerWidth - 220);
    adjusted.y = Math.min(adjusted.y, window.innerHeight - items.length * 36 - 16);
    adjusted.x = Math.max(8, adjusted.x);
    adjusted.y = Math.max(8, adjusted.y);
  }

  const handleItemHover = (index: number) => {
    const item = items[index];
    if (item?.children && item.children.length > 0) {
      setSubmenuIndex(index);
      const btn = itemRefs.current[index];
      if (btn) {
        const rect = btn.getBoundingClientRect();
        setSubmenuPos({ x: rect.right, y: rect.top });
      }
    } else {
      setSubmenuIndex(null);
    }
  };

  return (
    <div ref={ref} className="context-menu" style={{ left: adjusted.x, top: adjusted.y }}>
      {items.map((item, i) => (
        <div
          key={i}
          className={`context-menu__item${item.danger ? " context-menu__item--danger" : ""}${item.disabled ? " context-menu__item--disabled" : ""}${item.children ? " context-menu__item--parent" : ""}${submenuIndex === i ? " context-menu__item--open" : ""}`}
          onMouseEnter={() => handleItemHover(i)}
          onMouseLeave={() => { if (submenuIndex === i) setSubmenuIndex(null); }}
        >
          <button
            ref={(el) => { itemRefs.current[i] = el; }}
            className="context-menu__button"
            disabled={item.disabled}
            onClick={() => {
              if (!item.children) {
                onClose();
                item.onClick?.();
              }
            }}
          >
            {item.icon && <span className="context-menu__icon">{item.icon}</span>}
            <span className="context-menu__label">{item.label}</span>
            {item.children && <ChevronRight size={12} className="context-menu__chevron" />}
          </button>

          {/* Submenu */}
          {item.children && submenuIndex === i && (
            <div
              className="context-menu context-menu--sub"
            >
              {item.children.map((child, j) => (
                <button
                  key={j}
                  className={`context-menu__button${child.danger ? " context-menu__item--danger" : ""}${child.disabled ? " context-menu__item--disabled" : ""}`}
                  disabled={child.disabled}
                  onClick={() => {
                    onClose();
                    child.onClick?.();
                  }}
                >
                  {child.icon && <span className="context-menu__icon">{child.icon}</span>}
                  <span className="context-menu__label">{child.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
