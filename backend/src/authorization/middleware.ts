import type { RequestHandler } from "express";
import type { AuthService } from "../auth/service";
import { ApiError } from "../http/errors";
import { assertPermission } from "./permissions";
export function authenticate(auth: AuthService): RequestHandler {
  return async (req, _res, next) => {
    try {
      const header = req.get("authorization") ?? "";
      if (!header.startsWith("Bearer "))
        throw new ApiError(401, "UNAUTHENTICATED", "Vui lòng đăng nhập lại");
      req.auth = await auth.authenticate(header.slice(7));
      next();
    } catch (error) {
      next(error);
    }
  };
}
export function requirePermission(code: string): RequestHandler {
  return (req, _res, next) => {
    try {
      if (!req.auth) throw new ApiError(401, "UNAUTHENTICATED", "Vui lòng đăng nhập lại");
      assertPermission(req.auth.principal, code);
      next();
    } catch (error) {
      next(error);
    }
  };
}
