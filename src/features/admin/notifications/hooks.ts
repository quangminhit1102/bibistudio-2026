import { useRef } from "react";
import {
  useInfiniteQuery,
  useIsMutating,
  useMutation,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";
import { useAdmin, useRole } from "../services/context";
import { can } from "../accounts/permissions";
import type { DemoSession } from "../services/contracts";
import { ServiceError } from "../services/errors";
import { loadNotifications, markNotificationsRead, type NotificationPage } from "./service";
const locks = new WeakMap<QueryClient, Set<string>>();
type Request = {
  ids: string[] | "all";
  session: DemoSession;
  generation: number;
  key: readonly [string, string, string];
};
type Feed = InfiniteData<NotificationPage>;
export function useNotifications() {
  const runtime = useAdmin(),
    role = useRole(),
    client = useQueryClient();
  const current = useRef(runtime.session);
  current.current = runtime.session;
  const userId = runtime.session?.userId ?? "",
    generation = runtime.store.generation,
    key = ["bibi-admin", "notifications", userId] as const;
  const allowed =
    !!runtime.session &&
    !role.isPending &&
    can(runtime.session, "notifications", "view", role.data);
  const query = useInfiniteQuery({
    queryKey: key,
    enabled: allowed,
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      loadNotifications(runtime.store, runtime.session, { page: pageParam, pageSize: 10 }),
    getNextPageParam: (last) =>
      last.page * last.pageSize < last.total ? last.page + 1 : undefined,
  });
  const isActive = (request: Request) =>
    runtime.store.generation === request.generation &&
    current.current?.userId === request.session.userId &&
    current.current?.roleId === request.session.roleId;
  const mutation = useMutation({
    mutationKey: ["bibi-admin", "notification-read", userId, generation],
    mutationFn: async (request: Request) => {
      if (!isActive(request)) throw new ServiceError("aborted", "Phiên đã thay đổi.");
      await markNotificationsRead(runtime.store, request.session, request.ids);
    },
    onMutate: async (request) => {
      await client.cancelQueries({ queryKey: request.key, exact: true });
      if (!isActive(request)) throw new ServiceError("aborted", "Phiên đã thay đổi.");
      const snapshot = client.getQueryData<Feed>(request.key);
      client.setQueryData<Feed>(request.key, (old) => {
        if (!old) return old;
        const visibleUnread = new Set(
          old.pages.flatMap((p) => p.items.filter((n) => !n.isRead).map((n) => n.id)),
        );
        const ids = request.ids;
        const decrement =
          ids === "all"
            ? (old.pages[0]?.unreadCount ?? 0)
            : [...new Set(ids)].filter((id) => visibleUnread.has(id)).length;
        const count = Math.max(0, (old.pages[0]?.unreadCount ?? 0) - decrement);
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            unreadCount: count,
            items: page.items.map((n) =>
              ids === "all" || ids.includes(n.id) ? { ...n, isRead: true } : n,
            ),
          })),
        };
      });
      return { snapshot };
    },
    onError: (_error, request, context) => {
      if (isActive(request) && context?.snapshot)
        client.setQueryData(request.key, context.snapshot);
    },
    onSettled: async (_data, _error, request) => {
      if (isActive(request))
        await Promise.all([
          client.invalidateQueries({ queryKey: request.key, exact: true }),
          client.invalidateQueries({ queryKey: ["bibi-admin", "analytics-report"] }),
        ]);
    },
  });
  const busy =
    useIsMutating({ mutationKey: ["bibi-admin", "notification-read", userId, generation] }) > 0;
  async function read(ids: string[] | "all"): Promise<boolean> {
    if (!runtime.session || !allowed) return false;
    let pending = locks.get(client);
    if (!pending) {
      pending = new Set();
      locks.set(client, pending);
    }
    const lock = `${userId}:${generation}`;
    if (pending.has(lock)) return false;
    pending.add(lock);
    const request: Request = { ids, session: { ...runtime.session }, generation, key };
    try {
      await mutation.mutateAsync(request);
      return isActive(request);
    } catch {
      return false;
    } finally {
      pending.delete(lock);
    }
  }
  return {
    allowed,
    query,
    items: query.data?.pages.flatMap((p) => p.items) ?? [],
    unreadCount: query.data?.pages[0]?.unreadCount ?? 0,
    busy,
    read,
    error: mutation.variables && isActive(mutation.variables) ? mutation.error : null,
  };
}
