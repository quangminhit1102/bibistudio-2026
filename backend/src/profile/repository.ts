import type { PoolConnection } from "mysql2/promise";
import { resolvePrincipal, type UserRow } from "../auth/repository";
import type { ProfileDto } from "./types";
export async function profileDto(connection: PoolConnection, user: UserRow): Promise<ProfileDto> {
  return {
    ...(await resolvePrincipal(connection, user)),
    phone: user.phone ?? null,
    avatarId: user.avatar_id ?? null,
  };
}
