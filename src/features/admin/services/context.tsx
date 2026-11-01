import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { createAdminStore } from "../demo/store";
import { ensureDataset, clearSeedCache, drainSeedJobs } from "../demo/registry";
import { createEntityService } from "./entity-service";
import type {
  AdminStore,
  DemoSession,
  EntityKey,
  EntityService,
  ListInput,
  Role,
  Resource,
} from "./contracts";
import { resourceForEntity } from "../accounts/permissions";
import { ServiceError } from "./errors";
type Theme = "light" | "dark" | "system";
interface Runtime {
  store: AdminStore;
  session: DemoSession | null;
  theme: Theme;
  setTheme: (t: Theme) => void;
  login: (id: string) => Promise<void>;
  logout: () => Promise<void>;
  reset: () => Promise<void>;
  service: <K extends EntityKey>(entity: K, resource?: Resource) => EntityService<K>;
  ensure: (entity: EntityKey) => Promise<void>;
}
const RuntimeContext = createContext<Runtime | null>(null);
function preference<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem("bibi-admin:" + key) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
}
export function AdminProvider({ children }: { children: ReactNode }) {
  const query = useQueryClient();
  const [store] = useState(() => createAdminStore());
  const [session, setSession] = useState<DemoSession | null>(() => preference("session", null));
  const [theme, themeState] = useState<Theme>(() => preference("theme", "light"));
  const ensure = useCallback((entity: EntityKey) => ensureDataset(store, entity), [store]);
  const service = useCallback(
    <K extends EntityKey>(entity: K, resource?: Resource) =>
      createEntityService(store, entity, () => session, resource ?? resourceForEntity(entity)),
    [store, session],
  );
  const logout = useCallback(async () => {
    store.invalidateOperations();
    await query.cancelQueries({ queryKey: ["bibi-admin"] });
    query.removeQueries({ queryKey: ["bibi-admin"] });
    localStorage.removeItem("bibi-admin:session");
    setSession(null);
  }, [query, store]);
  const login = async (id: string) => {
    await ensure("users");
    const user = await store.get("users", id);
    if (!user?.active) throw new ServiceError("forbidden", "Tài khoản demo không hoạt động.");
    await query.cancelQueries({ queryKey: ["bibi-admin"] });
    query.removeQueries({ queryKey: ["bibi-admin"] });
    const next = { userId: user.id, roleId: user.roleId };
    localStorage.setItem("bibi-admin:session", JSON.stringify(next));
    setSession(next);
  };
  const setTheme = (value: Theme) => {
    localStorage.setItem("bibi-admin:theme", JSON.stringify(value));
    themeState(value);
  };
  const reset = async () => {
    if (query.isMutating({ mutationKey: ["bibi-admin"] }))
      throw new ServiceError("conflict", "Đợi thao tác đang lưu hoàn tất trước khi reset.");
    await query.cancelQueries({ queryKey: ["bibi-admin"] });
    await drainSeedJobs(store);
    await store.reset();
    clearSeedCache(store);
    query.removeQueries({ queryKey: ["bibi-admin"] });
    await logout();
  };
  const value = { store, session, theme, setTheme, service, ensure, logout, login, reset };
  return <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>;
}
export function useAdmin() {
  const c = useContext(RuntimeContext);
  if (!c) throw new Error("AdminProvider missing");
  return c;
}
export function useEntity<K extends EntityKey>(entity: K, input: ListInput, resource?: Resource) {
  const runtime = useAdmin();
  return useQuery({
    queryKey: [
      "bibi-admin",
      entity,
      "list",
      { ...input, signal: undefined },
      runtime.session?.roleId,
    ],
    queryFn: async ({ signal }) => {
      await runtime.ensure(entity);
      return runtime.service(entity, resource).list({ ...input, signal });
    },
    enabled: !!runtime.session,
  });
}
export function useRecord<K extends EntityKey>(entity: K, id: string, resource?: Resource) {
  const runtime = useAdmin();
  return useQuery({
    queryKey: ["bibi-admin", entity, "detail", id, runtime.session?.roleId],
    queryFn: async ({ signal }) => {
      await runtime.ensure(entity);
      return runtime.service(entity, resource).get(id, signal);
    },
    enabled: !!runtime.session && !!id,
  });
}
export function useRole() {
  const { store, session, ensure } = useAdmin();
  return useQuery({
    queryKey: ["bibi-admin", "role", session?.roleId],
    queryFn: async () => {
      await ensure("roles");
      return store.get("roles", session!.roleId) as Promise<Role | undefined>;
    },
    enabled: !!session,
  });
}
