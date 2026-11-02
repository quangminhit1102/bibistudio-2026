import type { AdminStore } from "../../services/contracts";
import { ServiceError } from "../../services/errors";
import type { AuthService, AuthSession } from "./contracts";
const key = "bibi-admin:session";
/** Local-only adapter; server data requires HTTP/cookie authentication later. */
export function createLocalAuthService(
  store: AdminStore,
  ensureAccounts: () => Promise<void>,
): AuthService {
  async function validate(session: AuthSession): Promise<boolean> {
    await ensureAccounts();
    const user = await store.get("users", session.userId);
    return (
      !!user?.active &&
      user.roleId === session.roleId &&
      !!(await store.get("roles", session.roleId))
    );
  }
  return {
    async login(credentials) {
      const generation = store.generation;
      if (credentials.username.trim() !== "bibi.admin" || credentials.password !== "BibiLocal!2026")
        throw new ServiceError("forbidden", "Thông tin đăng nhập không đúng.");
      const session = { userId: "user-1", roleId: "super-admin" };
      if (!(await validate(session)))
        throw new ServiceError("forbidden", "Tài khoản không còn hoạt động.");
      if (generation !== store.generation) throw new ServiceError("aborted", "Phiên đã thay đổi.");
      localStorage.setItem(key, JSON.stringify({ version: 2, session }));
      return session;
    },
    async getSession() {
      const raw = localStorage.getItem(key);
      try {
        const value = JSON.parse(raw ?? "null");
        const session = value?.version === 2 ? value.session : null;
        if (
          !session ||
          typeof session.userId !== "string" ||
          typeof session.roleId !== "string" ||
          !(await validate(session))
        ) {
          if (localStorage.getItem(key) === raw) localStorage.removeItem(key);
          return null;
        }
        return session;
      } catch {
        if (localStorage.getItem(key) === raw) localStorage.removeItem(key);
        return null;
      }
    },
    async logout() {
      localStorage.removeItem(key);
    },
  };
}
