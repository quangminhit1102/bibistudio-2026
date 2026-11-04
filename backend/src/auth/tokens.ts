import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import type { AuthConfig, Clock } from "../config";
import { ApiError } from "../http/errors";

export interface AccessClaims {
  sub: string;
  sid: string;
  authVersion: number;
}
export function signAccess(claims: AccessClaims, config: AuthConfig, clock: Clock): string {
  return jwt.sign({ ...claims, iat: Math.floor(+clock.now() / 1000) }, config.jwtSecret, {
    algorithm: "HS256",
    expiresIn: 900,
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
  });
}
export function verifyAccess(token: string, config: AuthConfig, clock: Clock): AccessClaims {
  try {
    const value = jwt.verify(token, config.jwtSecret, {
      algorithms: ["HS256"],
      issuer: config.jwtIssuer,
      audience: config.jwtAudience,
      clockTimestamp: Math.floor(+clock.now() / 1000),
    });
    if (
      typeof value === "string" ||
      typeof value.sub !== "string" ||
      typeof value.sid !== "string" ||
      !Number.isSafeInteger(value.authVersion)
    )
      throw new Error("Invalid claims");
    return { sub: value.sub, sid: value.sid, authVersion: value.authVersion as number };
  } catch {
    throw new ApiError(401, "UNAUTHENTICATED", "Vui lòng đăng nhập lại");
  }
}
export const newRefreshToken = (): string => randomBytes(32).toString("base64url");
export const hashRefresh = (token: string): string =>
  createHash("sha256").update(token).digest("hex");
