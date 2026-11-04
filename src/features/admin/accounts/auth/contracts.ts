import type { DemoSession } from "../../services/contracts";
import type { AdminHttpClient } from "../../../../lib/admin-http";
export type AuthSession = DemoSession;
export interface AuthCredentials {
  username: string;
  password: string;
}
export interface AuthService {
  readonly mode?: "http" | "fixture";
  readonly client?: AdminHttpClient;
  login(credentials: AuthCredentials): Promise<AuthSession>;
  getSession(): Promise<AuthSession | null>;
  logout(): Promise<void>;
}
