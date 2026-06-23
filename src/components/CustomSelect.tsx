import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";

export interface CustomSelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  placeholder: string;
  className?: string;
  /** 显示自定义图标/前缀 */
  renderPrefix?: (opt: CustomSelectOption) => ReactNode;
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder,
  className = "",
  renderPrefix,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  // 点击外部关闭
  const handleOutside = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);
  useEffect(() => {
    if (open) {
      document.addEventListener("mousedown", handleOutside);
      return () => document.removeEventListener("mousedown", handleOutside);
    }
  }, [open, handleOutside]);

  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className={`custom-select ${className}`} ref={containerRef}>
      <button
        className="custom-select__trigger"
        onClick={() => setOpen(!open)}
        type="button"
      >
        <span className={value ? "custom-select__text" : "custom-select__placeholder"}>
          {selected?.label || placeholder}
        </span>
        <svg className="custom-select__arrow" width="10" height="10" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="custom-select__panel">
          {options.map((opt) => (
            <button
              key={opt.value}
              className={`custom-select__item ${opt.value === value ? "custom-select__item--selected" : ""}`}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              type="button"
            >
              {renderPrefix && renderPrefix(opt)}
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
