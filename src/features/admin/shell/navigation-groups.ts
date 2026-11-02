import { useCallback, useEffect, useState } from "react";
import { activeNavigationItem, navigation } from "./navigation";
const key = "bibi-admin:nav-groups:v1";
function restore(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(value)
      ? value.filter(
          (id): id is string => typeof id === "string" && navigation.some((g) => g.id === id),
        )
      : [];
  } catch {
    return [];
  }
}
export function useNavigationGroups(pathname: string) {
  const active = activeNavigationItem(navigation, pathname);
  const group = navigation.find((g) => g.items.some((i) => i.path === active?.path))?.id;
  const [open, setOpen] = useState(() => new Set([...restore(), ...(group ? [group] : [])]));
  useEffect(() => {
    if (group)
      setOpen((previous) => (previous.has(group) ? previous : new Set([...previous, group])));
  }, [pathname, group]);
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify([...open]));
    } catch {
      /* Optional appearance preference. */
    }
  }, [open]);
  const toggle = useCallback((id: string) => {
    setOpen((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  return { open, toggle };
}
