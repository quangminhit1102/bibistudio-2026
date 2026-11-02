import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { createAdminStore } from "../demo/store";
import { ensureDataset } from "../demo/registry";
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
import { resetDemoData } from "../settings/service";
import type { AuthCredentials, AuthService } from "../accounts/auth/contracts";
import { createLocalAuthService } from "../accounts/auth/local-service";
type Theme = "light" | "dark" | "system";
interface Runtime {
  store: AdminStore;
  session: DemoSession | null;
  sessionLoading: boolean;
  theme: Theme;
  setTheme: (t: Theme) => void;
  login: (credentials: AuthCredentials) => Promise<void>;
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
export function AdminProvider({
  children,
  authFactory,
}: {
  children: ReactNode;
  authFactory?: (store: AdminStore) => AuthService;
}) {
  const query = useQueryClient();
  const [storageBlocked, setStorageBlocked] = useState(false);
  const [store] = useState(() =>
    createAdminStore(undefined, { onBlocked: () => setStorageBlocked(true) }),
  );
  const [auth] = useState(
    () =>
      authFactory?.(store) ?? createLocalAuthService(store, () => ensureDataset(store, "users")),
  );
  const [session, setSession] = useState<DemoSession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [theme, themeState] = useState<Theme>(() => preference("theme", "light"));
  const epoch = useRef(0);
  const clear = useCallback(() => {
    store.invalidateOperations();
    void query.cancelQueries({ queryKey: ["bibi-admin"] });
    query.removeQueries({ queryKey: ["bibi-admin"] });
  }, [store, query]);
  useEffect(() => {
    let alive = true;
    const restore = async () => {
      const ticket = ++epoch.current;
      setSessionLoading(true);
      setSession(null);
      clear();
      try {
        const next = await auth.getSession();
        if (alive && ticket === epoch.current) setSession(next);
      } catch {
        if (alive && ticket === epoch.current) setSession(null);
      } finally {
        if (alive && ticket === epoch.current) setSessionLoading(false);
      }
    };
    void restore();
    const sync = (event: StorageEvent) => {
      if (event.key === "bibi-admin:session" || event.key === null) void restore();
    };
    window.addEventListener("storage", sync);
    return () => {
      alive = false;
      epoch.current++;
      window.removeEventListener("storage", sync);
    };
  }, [auth, clear]);
  useEffect(() => {
    let active = true;
    void store
      .getMeta("storage-ready")
      .then(() => {
        if (active) setStorageBlocked(false);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [store]);
  const ensure = useCallback((entity: EntityKey) => ensureDataset(store, entity), [store]);
  const service = useCallback(
    <K extends EntityKey>(entity: K, resource?: Resource) =>
      createEntityService(store, entity, () => session, resource ?? resourceForEntity(entity)),
    [store, session],
  );
  const logout = useCallback(async () => {
    ++epoch.current;
    clear();
    setSession(null);
    setSessionLoading(false);
    await auth.logout();
  }, [auth, clear]);
  const login = async (credentials: AuthCredentials) => {
    const ticket = ++epoch.current;
    clear();
    const next = await auth.login(credentials);
    if (ticket !== epoch.current) throw new ServiceError("aborted", "Phiên đã thay đổi.");
    setSession(next);
    setSessionLoading(false);
  };
  const setTheme = (value: Theme) => {
    localStorage.setItem("bibi-admin:theme", JSON.stringify(value));
    themeState(value);
  };
  const reset = async () => {
    if (query.isMutating({ mutationKey: ["bibi-admin"] }))
      throw new ServiceError("conflict", "Đợi thao tác đang lưu hoàn tất.");
    await query.cancelQueries({ queryKey: ["bibi-admin"] });
    await resetDemoData(store, session);
    await logout();
  };
  return (
    <RuntimeContext.Provider
      value={{
        store,
        session,
        sessionLoading,
        theme,
        setTheme,
        login,
        logout,
        reset,
        service,
        ensure,
      }}
    >
      {storageBlocked && (
        <p role="alert" className="a-banner">
          Đang chờ nâng cấp dữ liệu. Hãy đóng hoặc tải lại các tab admin cũ; dữ liệu hiện có được
          giữ nguyên.
        </p>
      )}
      {children}
    </RuntimeContext.Provider>
  );
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
