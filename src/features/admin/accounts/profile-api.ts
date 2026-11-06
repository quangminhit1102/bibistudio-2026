import type { AdminHttpClient } from "../../../lib/admin-http";
import type { ProfileDto } from "../../../../backend/src/profile/types";
export interface ProfileDraft {
  displayName: string;
  email: string | null;
  phone: string | null;
}
export function createProfileApi(http: AdminHttpClient, targetId?: string) {
  const avatar = targetId
    ? `/api/accounts/${encodeURIComponent(targetId)}/avatar`
    : "/api/profile/avatar";
  return {
    get: (signal?: AbortSignal) => http.request<ProfileDto>("/api/profile", { signal }),
    update: (draft: ProfileDraft, revision: number) =>
      http.request<ProfileDto>("/api/profile", { method: "PATCH", body: { ...draft, revision } }),
    upload: (blob: Blob, revision: number, signal?: AbortSignal) =>
      http.upload<ProfileDto>(avatar, blob, { revision, signal }),
    remove: (revision: number) =>
      http.request<ProfileDto>(avatar, { method: "DELETE", body: {}, ifMatch: revision }),
    avatarBlob: (id: string, signal?: AbortSignal) =>
      http.requestBlob(`${avatar}/${encodeURIComponent(id)}`, { signal }),
  };
}
