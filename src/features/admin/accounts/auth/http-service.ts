import { createAdminHttp, type AdminHttpClient } from "../../../../lib/admin-http";
import type { HttpSession } from "../../services/contracts";
import type { AuthService } from "./contracts";

export function createHttpAuthService(
  options: { client?: AdminHttpClient; onUnauthorized?: (error: Error) => void } = {},
): AuthService {
  const client = options.client ?? createAdminHttp({ onUnauthorized: options.onUnauthorized });
  return {
    mode: "http",
    client,
    async login(credentials): Promise<HttpSession> {
      const principal = await client.login(credentials);
      return { kind: "http", userId: principal.id, principal };
    },
    async getSession(): Promise<HttpSession | null> {
      const principal = await client.restore();
      return principal ? { kind: "http", userId: principal.id, principal } : null;
    },
    logout: () => client.logout(),
  };
}
