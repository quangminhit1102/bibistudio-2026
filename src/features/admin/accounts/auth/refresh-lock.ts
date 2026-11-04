export type RefreshLock = <T>(work: () => Promise<T>) => Promise<T>;

export function browserRefreshLock(): RefreshLock | null {
  if (typeof navigator === "undefined" || !navigator.locks) return null;
  return async (work) =>
    await navigator.locks.request("bibi-admin-auth", { mode: "exclusive" }, work);
}
