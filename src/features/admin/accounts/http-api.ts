import type {
  AccountDto,
  Page,
  PermissionDto,
  RoleDto,
  RoleOptionDto,
} from "../../../../backend/src/http/contracts";
import type { AdminHttpClient } from "../../../lib/admin-http";

export interface AccountDraft {
  username: string;
  displayName: string;
  email: string | null;
  password?: string;
  roleIds?: string[];
}
export function createAccountApi(http: AdminHttpClient) {
  return {
    list: (input: { page: number; pageSize: number; search: string }, signal?: AbortSignal) =>
      http.request<Page<AccountDto>>(
        `/api/accounts?${new URLSearchParams({ page: String(input.page), pageSize: String(input.pageSize), search: input.search })}`,
        { signal },
      ),
    get: (id: string, signal?: AbortSignal) =>
      http.request<AccountDto>(`/api/accounts/${encodeURIComponent(id)}`, { signal }),
    create: (draft: AccountDraft) =>
      http.request<AccountDto>("/api/accounts", { method: "POST", body: draft }),
    update: (id: string, draft: AccountDraft, revision: number) =>
      http.request<AccountDto>(`/api/accounts/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: { ...draft, revision },
      }),
    setActive: (account: AccountDto, active: boolean) =>
      http.request<AccountDto>(
        `/api/accounts/${encodeURIComponent(account.id)}/${active ? "activate" : "deactivate"}`,
        { method: "PATCH", body: { revision: account.revision } },
      ),
    setRoles: (account: AccountDto, roleIds: string[]) =>
      http.request<AccountDto>(`/api/accounts/${encodeURIComponent(account.id)}/roles`, {
        method: "PATCH",
        body: { revision: account.revision, roleIds },
      }),
    remove: (account: AccountDto) =>
      http.request<void>(`/api/accounts/${encodeURIComponent(account.id)}`, {
        method: "DELETE",
        body: { revision: account.revision },
      }),
    roleOptions: (signal?: AbortSignal) =>
      http.request<RoleOptionDto[]>("/api/roles/options", { signal }),
    roles: (signal?: AbortSignal) => http.request<RoleDto[]>("/api/roles", { signal }),
    permissions: (signal?: AbortSignal) =>
      http.request<PermissionDto[]>("/api/permissions", { signal }),
    createRole: (input: { name: string; description: string }) =>
      http.request<RoleDto>("/api/roles", { method: "POST", body: input }),
    updateRole: (role: RoleDto, input: { name: string; description: string }) =>
      http.request<RoleDto>(`/api/roles/${encodeURIComponent(role.id)}`, {
        method: "PUT",
        body: { ...input, revision: role.revision },
      }),
    removeRole: (role: RoleDto) =>
      http.request<void>(`/api/roles/${encodeURIComponent(role.id)}`, {
        method: "DELETE",
        body: { revision: role.revision },
      }),
    setRolePermissions: (role: RoleDto, permissionIds: string[]) =>
      http.request<RoleDto>(`/api/roles/${encodeURIComponent(role.id)}/permissions`, {
        method: "PATCH",
        body: { revision: role.revision, permissionIds },
      }),
  };
}
