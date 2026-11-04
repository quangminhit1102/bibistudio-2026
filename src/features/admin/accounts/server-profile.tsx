import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AccountDto, PrincipalDto } from "../../../../backend/src/http/contracts";
import { useAdmin } from "../services/context";
import { canCode } from "./permissions";
import { useAccountApi } from "./server-hooks";
import { AccountForm } from "./account-form";
import { Card, ErrorState, PageTitle, Skeleton, useNotice } from "../shared/ui/primitives";
import { UnsavedDialog } from "../shared/forms/preference-form";

export function ServerProfile() {
  const runtime = useAdmin();
  const api = useAccountApi();
  const cache = useQueryClient();
  const notice = useNotice();
  const [dirty, setDirty] = useState(false);
  const id = runtime.session?.userId ?? "";
  const key = ["bibi-admin", "http-self-account", id];
  const account = useQuery<AccountDto | PrincipalDto>({
    queryKey: key,
    enabled: !!id,
    queryFn: ({ signal }) =>
      canCode(runtime.session, "account.view")
        ? api.get(id, signal)
        : runtime.http!.request<PrincipalDto>("/api/auth/profile", { signal }),
  });
  if (account.isPending) return <Skeleton />;
  if (!account.data)
    return <ErrorState error={account.error} onRetry={() => void account.refetch()} />;
  const user = account.data;
  return (
    <>
      <PageTitle title="Hồ sơ" description="Thông tin tài khoản và các vai trò của bạn." />
      {account.error && <ErrorState error={account.error} onRetry={() => void account.refetch()} />}
      <Card>
        {"active" in user ? (
          <AccountForm
            key={id}
            initial={user}
            roles={[]}
            readOnly={user.isMaster || !canCode(runtime.session, "account.update")}
            onDirtyChange={setDirty}
            onSave={async (draft, revision) => {
              const saved = await api.update(id, draft, revision);
              cache.setQueryData(key, saved);
              if (draft.password) {
                notice("Đã đổi mật khẩu. Vui lòng đăng nhập lại");
                await runtime.logout();
              } else {
                await runtime.refreshProfile();
                notice("Đã lưu hồ sơ");
              }
              return saved;
            }}
          />
        ) : (
          <dl className="a-detail-list">
            <dt>Tên tài khoản</dt>
            <dd>{user.username}</dd>
            <dt>Tên hiển thị</dt>
            <dd>{user.displayName}</dd>
            <dt>Email</dt>
            <dd>{user.email ?? "—"}</dd>
          </dl>
        )}
      </Card>
      <Card>
        <h2>Vai trò</h2>
        <p>{user.roles.map((role) => role.name).join(", ") || "Chưa cấp vai trò"}</p>
      </Card>
      <UnsavedDialog dirty={dirty} />
    </>
  );
}
