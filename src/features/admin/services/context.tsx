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
import { createHttpAuthService } from "../accounts/auth/http-service";
import type { AdminHttpClient } from "../../../lib/admin-http";
import type { PrincipalDto } from "../../../../backend/src/http/contracts";
type Theme = "light" | "dark" | "system";
interface Runtime {
  store: AdminStore;
  session: DemoSession | null;
  sessionLoading: boolean;
  http?: AdminHttpClient;
  authNotice: string;
  theme: Theme;
  setTheme: (t: Theme) => void;
  login: (credentials: AuthCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  applyProfile: (principal: PrincipalDto) => boolean;
  reset: () => Promise<void>;
  service: <K extends EntityKey>(entity: K, resource?: Resource) => EntityService<K>;
  ensure: (entity: EntityKey) => Promise<void>;
}
const RuntimeContext = createContext<Runtime | null>(null);
const serverEntities: EntityKey[] = ["users", "roles", "audit", "visitors", "sessions"];
function announce() {
  try {
    localStorage.setItem(
      "bibi-admin:auth-event",
      JSON.stringify({ type: "invalidate", nonce: crypto.randomUUID() }),
    );
  } catch {
    /* Tokens never depend on storage. */
  }
}
function markLoggedOut(value: boolean) {
  try {
    if (value) localStorage.setItem("bibi-admin:logged-out", "1");
    else localStorage.removeItem("bibi-admin:logged-out");
  } catch {
    /* Browser storage may be blocked. */
  }
}
function cacheIdentity(session: DemoSession | null) {
  return session?.kind === "http" ? [session.userId, session.principal.revision] : session?.roleId;
}
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
  const [session, setSession] = useState<DemoSession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [authNotice, setAuthNotice] = useState("");
  const [theme, themeState] = useState<Theme>(() => preference("theme", "light"));
  const epoch = useRef(0);
  const clear = useCallback(() => {
    store.invalidateOperations();
    void query.cancelQueries({ queryKey: ["bibi-admin"] });
    query.removeQueries({ queryKey: ["bibi-admin"] });
  }, [store, query]);
  const [auth] = useState(
    () =>
      authFactory?.(store) ??
      createHttpAuthService({
        onUnauthorized: (error) => {
          ++epoch.current;
          clear();
          setSession(null);
          setSessionLoading(false);
          setAuthNotice(error.message);
          markLoggedOut(true);
          announce();
        },
      }),
  );
  useEffect(() => {
    let alive = true;
    const restore = async () => {
      const ticket = ++epoch.current;
      setSessionLoading(true);
      setSession(null);
      clear();
      try {
        if (auth.mode === "http") {
          try {
            localStorage.removeItem("bibi-admin:session");
            if (localStorage.getItem("bibi-admin:logged-out") === "1") return;
          } catch {
            /* Cookie authentication remains independent of local storage. */
          }
        }
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
      if (auth.mode === "http") {
        if (event.key === "bibi-admin:auth-event" || event.key === null) {
          ++epoch.current;
          auth.client?.dispose();
          clear();
          setSession(null);
          setSessionLoading(false);
          setAuthNotice("Phiên đã thay đổi ở tab khác. Vui lòng đăng nhập lại");
        }
      } else if (event.key === "bibi-admin:session" || event.key === null) void restore();
    };
    window.addEventListener("storage", sync);
    return () => {
      alive = false;
      epoch.current++;
      auth.client?.dispose();
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
  const ensure = useCallback(
    (entity: EntityKey) =>
      auth.mode === "http" && serverEntities.includes(entity)
        ? Promise.resolve()
        : ensureDataset(store, entity),
    [store, auth.mode],
  );
  const service = useCallback(
    <K extends EntityKey>(entity: K, resource?: Resource) => {
      if (session?.kind === "http" && serverEntities.includes(entity))
        throw new ServiceError("forbidden", "Dữ liệu này được quản lý qua API máy chủ");
      return createEntityService(
        store,
        entity,
        () => session,
        resource ?? resourceForEntity(entity),
      );
    },
    [store, session],
  );
  const logout = useCallback(async () => {
    ++epoch.current;
    clear();
    setSession(null);
    setSessionLoading(false);
    if (auth.mode === "http") {
      markLoggedOut(true);
      announce();
    }
    try {
      await auth.logout();
    } catch {
      setAuthNotice(
        "Đã đóng phiên trên trình duyệt. Chưa thể thu hồi phiên trên máy chủ; hãy thử đăng xuất lại khi kết nối phục hồi",
      );
    }
  }, [auth, clear]);
  const login = async (credentials: AuthCredentials) => {
    const ticket = ++epoch.current;
    clear();
    if (auth.mode === "http") {
      markLoggedOut(true);
      announce();
    }
    const next = await auth.login(credentials);
    if (ticket !== epoch.current) throw new ServiceError("aborted", "Phiên đã thay đổi.");
    setSession(next);
    setAuthNotice("");
    if (auth.mode === "http") markLoggedOut(false);
    setSessionLoading(false);
  };
  const refreshProfile = async () => {
    if (!auth.client) return;
    const ticket = epoch.current;
    const principal =
      await auth.client.request<import("../../../../backend/src/http/contracts").PrincipalDto>(
        "/api/auth/profile",
      );
    if (ticket === epoch.current) setSession({ kind: "http", userId: principal.id, principal });
  };
  const renderedEpoch = epoch.current;
  const applyProfile = (principal: PrincipalDto): boolean => {
    if (
      renderedEpoch !== epoch.current ||
      session?.kind !== "http" ||
      session.userId !== principal.id
    )
      return false;
    setSession((current) =>
      renderedEpoch === epoch.current && current?.kind === "http" && current.userId === principal.id
        ? { ...current, principal }
        : current,
    );
    return true;
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
        http: auth.client,
        authNotice,
        theme,
        setTheme,
        login,
        logout,
        refreshProfile,
        applyProfile,
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
      cacheIdentity(runtime.session),
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
    queryKey: ["bibi-admin", entity, "detail", id, cacheIdentity(runtime.session)],
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
    queryKey: ["bibi-admin", "role", cacheIdentity(session)],
    queryFn: async () => {
      await ensure("roles");
      if (!session || session.kind === "http") return undefined;
      return store.get("roles", session.roleId) as Promise<Role | undefined>;
    },
    enabled: !!session && session.kind !== "http",
  });
}
