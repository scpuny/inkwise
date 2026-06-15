import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

export type IntentOption = {
  id: string;
  label: string;
  desc: string;
  icon: React.ReactNode;
  active: boolean;
  onToggle: (active: boolean) => void;
};

export function IntentMenu({
  currentIntent,
  options,
}: {
  currentIntent: string;
  options: IntentOption[];
}) {
  const [open, setOpen] = useState(false);
  const chipRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const current = options.find((o) => o.id === currentIntent) ?? options[0];

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const pd = (e: PointerEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        chipRef.current && !chipRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    const ek = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    requestAnimationFrame(() => {
      document.addEventListener("pointerdown", pd);
      document.addEventListener("keydown", ek);
    });
    return () => {
      document.removeEventListener("pointerdown", pd);
      document.removeEventListener("keydown", ek);
    };
  }, [open]);

  return (
    <>
      {/* Mode chip trigger — simple button matching pill-btn style */}
      <button
        ref={chipRef}
        className="composer-mode-chip"
        onClick={() => setOpen(!open)}
        title={current.desc}
      >
        {current.icon}
        <span className="composer-mode-chip__label">{current.label}</span>
      </button>

      {/* Intent menu popover — anchored above chip */}
      {open && createPortal(
        <div
          ref={menuRef}
          className="composer-access-menu composer-intent-menu"
          style={{
            position: "fixed",
            left: chipRef.current?.getBoundingClientRect().left,
            bottom: (window.innerHeight - (chipRef.current?.getBoundingClientRect().top ?? 0)) + 8,
            width: 258,
          }}
        >
          {options.map((opt) => {
            const isCurrent = currentIntent === opt.id;
            return (
              <div key={opt.id} className="composer-access-menu__section">
                <button
                  className={`composer-access-menu__item composer-intent-menu__item${isCurrent && opt.active ? " composer-access-menu__item--active" : ""}`}
                  onClick={() => opt.onToggle(!opt.active)}
                >
                  <span className="composer-access-menu__copy">
                    <span className="composer-access-menu__title">{opt.label}</span>
                    <span className="composer-access-menu__desc">{opt.desc}</span>
                  </span>
                  <span className={`composer-intent-switch${opt.active ? " composer-intent-switch--on" : ""}`} />
                </button>
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}
