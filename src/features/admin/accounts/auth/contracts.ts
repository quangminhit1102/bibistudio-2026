import type { DemoSession } from "../../services/contracts";
export type AuthSession = DemoSession;
export interface AuthCredentials {
  username: string;
  password: string;
}
export interface AuthService {
  login(credentials: AuthCredentials): Promise<AuthSession>;
  getSession(): Promise<AuthSession | null>;
  logout(): Promise<void>;
}
