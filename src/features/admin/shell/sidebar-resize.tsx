import { useEffect, useRef, useState } from "react";
const key = "bibi-admin:sidebar-width";
const viewport = () =>
  typeof window === "undefined" ? 1440 : document.documentElement.clientWidth || window.innerWidth;
export function sidebarWidth(value: number, viewport: number) {
  return Math.min(Math.max(220, value), Math.max(220, Math.min(400, viewport - 640)));
}
function restore() {
  try {
    const raw = localStorage.getItem(key),
      n = Number(raw);
    return raw && Number.isFinite(n) && n >= 220 && n <= 400 ? n : 236;
  } catch {
    return 236;
  }
}
function save(n: number) {
  try {
    localStorage.setItem(key, String(n));
  } catch {
    /* Preference storage is optional. */
  }
}
export function useSidebarResize(enabled = true) {
  const [preferred, setPreferred] = useState(restore),
    [screen, setScreen] = useState(viewport),
    [dragging, setDragging] = useState(false);
  const drag = useRef<{
    id: number;
    x: number;
    width: number;
    previous: number;
    current: number;
  } | null>(null);
  const cancel = () => {
    const d = drag.current;
    if (d) setPreferred(d.previous);
    drag.current = null;
    setDragging(false);
  };
  useEffect(() => {
    const resize = () => {
      setScreen(viewport());
      if (viewport() < 1024) cancel();
    };
    window.addEventListener("resize", resize);
    window.addEventListener("blur", cancel);
    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("blur", cancel);
      drag.current = null;
    };
  }, []);
  useEffect(() => {
    if (!enabled) cancel();
  }, [enabled]);
  const width = sidebarWidth(preferred, screen),
    max = sidebarWidth(400, screen);
  const commit = (n: number) => {
    setPreferred(n);
    save(n);
  };
  const active = enabled && screen >= 1024;
  const separator = (
    <div
      role="separator"
      aria-label="Thay đổi độ rộng thanh bên"
      aria-orientation="vertical"
      aria-controls="admin-sidebar"
      aria-valuemin={220}
      aria-valuemax={max}
      aria-valuenow={width}
      aria-valuetext={`${width} pixel`}
      tabIndex={active ? 0 : -1}
      className="a-sidebar-resizer"
      onDoubleClick={() => {
        if (active) commit(sidebarWidth(236, screen));
      }}
      onKeyDown={(e) => {
        if (!active) return;
        const values: Record<string, number> = {
          ArrowLeft: width - 10,
          ArrowRight: width + 10,
          Home: 220,
          End: max,
        };
        if (e.key in values) {
          e.preventDefault();
          commit(sidebarWidth(values[e.key], screen));
        }
      }}
      onPointerDown={(e) => {
        if (!active || e.button !== 0 || drag.current) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = {
          id: e.pointerId,
          x: e.clientX,
          width,
          previous: preferred,
          current: width,
        };
        setDragging(true);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d || d.id !== e.pointerId) return;
        d.current = sidebarWidth(d.width + e.clientX - d.x, viewport());
        setPreferred(d.current);
      }}
      onPointerUp={(e) => {
        const d = drag.current;
        if (!d || d.id !== e.pointerId) return;
        drag.current = null;
        setDragging(false);
        commit(d.current);
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          e.currentTarget.releasePointerCapture(e.pointerId);
      }}
      onPointerCancel={cancel}
      onLostPointerCapture={cancel}
    />
  );
  return { width, dragging, separator };
}
