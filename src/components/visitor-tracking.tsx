import { useEffect, useRef } from "react";
import type { startVisitorTracking } from "../lib/visitor-runtime";

/** Loading or tracking failure must never prevent navigation. */
export function VisitorTracking({ pathname }: { pathname: string }) {
  const tracker = useRef<ReturnType<typeof startVisitorTracking> | null>(null);
  const pending = useRef(new Set<string>());
  const currentPath = useRef(pathname);
  currentPath.current = pathname;
  useEffect(() => {
    let alive = true;
    const queued = pending.current;
    void import("../lib/visitor-runtime")
      .then((module) => {
        if (!alive) return;
        const instance = module.startVisitorTracking(() => currentPath.current);
        tracker.current = instance;
        for (const path of queued) instance.visit(path);
        queued.clear();
      })
      .catch(() => {
        queued.clear();
      });
    return () => {
      alive = false;
      tracker.current?.dispose();
      tracker.current = null;
      queued.clear();
    };
  }, []);
  useEffect(() => {
    if (tracker.current) tracker.current.visit(pathname);
    else if (pending.current.size < 200) pending.current.add(pathname);
  }, [pathname]);
  return null;
}
