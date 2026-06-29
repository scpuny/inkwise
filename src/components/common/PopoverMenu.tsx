import { useRef, useState, useEffect, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

export type MenuItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  subtitle?: string;
  checked?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

const EDGE_GAP = 8;
const DEFAULT_OFFSET = 8;

export function PopoverMenu({
  items,
  anchorRef,
  open,
  onClose,
  width,
  align = "start",
  placement = "auto",
}: {
  items: MenuItem[];
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  width?: number;
  align?: "start" | "end";
  placement?: "auto" | "bottom";
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      if (anchorRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, anchorRef]);

  // Position after render
  useEffect(() => {
    if (!open) { setPos(null); return; }
    let frameId: number | null = null;

    const measure = () => {
      const anchor = anchorRef.current;
      const menu = menuRef.current;
      if (!anchor || !menu) {
        frameId = requestAnimationFrame(measure);
        return;
      }

      const anchorRect = anchor.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const viewportH = window.innerHeight;
      const viewportW = window.innerWidth;
      const menuH = Math.max(menuRect.height, 1);
      const menuW = Math.max(menuRect.width, 1);

      const preferredTop = anchorRect.top - menuH - DEFAULT_OFFSET;
      const fallbackTop = anchorRect.bottom + DEFAULT_OFFSET;

      let top: number;
      if (placement === "bottom") {
        top = fallbackTop;
      } else {
        top = preferredTop >= EDGE_GAP ? preferredTop : fallbackTop;
      }

      const rawLeft = align === "end" ? anchorRect.right - menuW : anchorRect.left;

      const clampedTop = Math.min(Math.max(top, EDGE_GAP), Math.max(EDGE_GAP, viewportH - menuH - EDGE_GAP));
      const clampedLeft = Math.min(Math.max(rawLeft, EDGE_GAP), Math.max(EDGE_GAP, viewportW - menuW - EDGE_GAP));

      // Guard against NaN from missing layout
      if (!Number.isFinite(clampedLeft) || !Number.isFinite(clampedTop)) {
        frameId = requestAnimationFrame(measure);
        return;
      }
      setPos({ left: clampedLeft, top: clampedTop });
    };

    // First measure
    frameId = requestAnimationFrame(measure);
    // Re-measure on scroll/resize
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);

    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [open, anchorRef, align, placement, items.length]);

  if (!open) return null;

  return createPortal(
    <div
      ref={menuRef}
      className="popover-menu"
      style={{
        left: pos?.left ?? -9999,
        top: pos?.top ?? -9999,
        visibility: pos ? "visible" : "hidden",
      }}
    >
      {items.map((item) => (
        <button
          key={item.id}
          className={`popover-menu__item${item.checked ? " popover-menu__item--checked" : ""}${item.disabled ? " popover-menu__item--disabled" : ""}`}
          disabled={item.disabled}
          onClick={() => { onClose(); item.onClick(); }}
        >
          {item.icon && <span className="popover-menu__icon">{item.icon}</span>}
          <span className="popover-menu__copy">
            <span className="popover-menu__label">{item.label}</span>
            {item.subtitle && <span className="popover-menu__subtitle">{item.subtitle}</span>}
          </span>
          {item.checked && (
            <svg className="popover-menu__check" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
          )}
        </button>
      ))}
    </div>,
    document.body,
  );
}
