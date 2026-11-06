import type { PrincipalDto } from "../http/contracts";
export type ProfileDto = PrincipalDto & { phone: string | null; avatarId: string | null };
