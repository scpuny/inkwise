// useOutlineNavigation.ts — 大纲选中与导航
import { useCallback } from "react";
import { useArticleStore } from "../store/articleStore";
import { emit } from "../lib/events/eventBus";

export function useOutlineNavigation() {
  const outlineItems = useArticleStore((s) => s.outlineItems);
  const setOutlineItems = useArticleStore((s) => s.setOutlineItems);
  const setActiveOutlineId = useArticleStore((s) => s.setActiveOutlineId);

  const handleOutlineChange = useCallback(
    (items: any[]) => {
      setOutlineItems(items);
    },
    [setOutlineItems],
  );

  const handleOutlineSelect = useCallback(
    (id: string) => {
      setActiveOutlineId(id);
      const item = outlineItems.find((i) => i.id === id);
      if (item) {
        emit("outline-navigate", { headingText: item.text });
      }
    },
    [outlineItems, setActiveOutlineId],
  );

  return { outlineItems, handleOutlineChange, handleOutlineSelect };
}
