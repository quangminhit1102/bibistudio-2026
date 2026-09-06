// src/hooks/use-scroll-to-on-page.ts
import { useEffect, useRef } from "react";

export function useScrollToOnPage(page: number, anchorId: string) {
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const target = document.getElementById(anchorId);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [page, anchorId]);
}
