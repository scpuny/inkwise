// usePanelManager.ts — 面板打开/关闭/联动 & 调整大小逻辑
import { useCallback, useEffect, useRef } from "react";
import type React from "react";
import { usePanelStore } from "../store/panelStore";

export function usePanelManager() {
  const resizing = usePanelStore((s) => s.resizing);
  const setResizing = usePanelStore((s) => s.setResizing);
  const setSidebarWidth = usePanelStore((s) => s.setSidebarWidth);
  const setSettingsOpen = usePanelStore((s) => s.setSettingsOpen);
  const setSettingsTab = usePanelStore((s) => s.setSettingsTab);

  const layoutRef = useRef<HTMLDivElement>(null);

  const openSettings = useCallback(() => {
    setSettingsTab("general");
    setSettingsOpen(true);
  }, [setSettingsTab, setSettingsOpen]);

  const startResize = useCallback(
    (type: "sidebar") => (e: React.PointerEvent) => {
      setResizing(type);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    },
    [setResizing],
  );

  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: PointerEvent) => {
      if (!layoutRef.current) return;
      const rect = layoutRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      if (resizing === "sidebar") {
        setSidebarWidth(Math.max(200, Math.min(320, x)));
      }
    };
    const onUp = () => setResizing(null);
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
  }, [resizing, setResizing, setSidebarWidth]);

  return { openSettings, startResize, layoutRef };
}
