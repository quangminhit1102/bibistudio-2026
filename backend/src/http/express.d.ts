import type { AuthPrincipal } from "../auth/service";
declare module "express-serve-static-core" {
  interface Request {
    auth?: AuthPrincipal;
  }
}
