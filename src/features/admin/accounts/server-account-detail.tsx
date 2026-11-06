import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AccountDto, RoleOptionDto } from "../../../../backend/src/http/contracts";
import { useAdmin } from "../services/context";
import { useAccountApi } from "./server-hooks";
import { canCode } from "./permissions";
import { AvatarEditor } from "./avatar-editor";
import { createProfileApi } from "./profile-api";
import type { ProfileDto } from "../../../../backend/src/profile/types";
import { AccountForm } from "./account-form";
import {
  Badge,
  Button,
  Card,
  ErrorState,
  PageTitle,
  Skeleton,
  useNotice,
} from "../shared/ui/primitives";
import { UnsavedDialog } from "../shared/forms/preference-form";

function AccountRoles({
  account,
  roles,
  disabled,
  onSave,
}: {
  account: AccountDto;
  roles: RoleOptionDto[];
  disabled: boolean;
  onSave: (ids: string[]) => Promise<void>;
}) {
  const [selected, setSelected] = useState(account.roleIds);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const changed = [...selected].sort().join() !== [...account.roleIds].sort().join();
  return (
    <Card>
      <h2>Vai trò</h2>
      <fieldset disabled={disabled || busy} style={{ border: 0, margin: 0, padding: 0 }}>
        {roles.map((role) => (
          <label key={role.id} className="a-checkbox">
            <input
              type="checkbox"
              checked={selected.includes(role.id)}
              onChange={(event) =>
                setSelected((current) =>
                  event.target.checked
                    ? [...current, role.id]
                    : current.filter((id) => id !== role.id),
                )
              }
            />{" "}
            {role.name}
          </label>
        ))}
      </fieldset>
      {error && (
        <p className="a-error" role="alert">
          {error}
        </p>
      )}
      <Button
        disabled={disabled || !changed}
        loading={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await onSave(selected);
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Không thể lưu vai trò");
          } finally {
            setBusy(false);
          }
        }}
      >
        Lưu vai trò
      </Button>
      <UnsavedDialog dirty={changed && !disabled} />
    </Card>
  );
}

export function ServerAccountDetail({ id }: { id: string }) {
  const runtime = useAdmin();
  const api = useAccountApi();
  const cache = useQueryClient();
  const notice = useNotice();
  const [dirty, setDirty] = useState(false);
  const [avatarDirty, setAvatarDirty] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const queryKey = ["bibi-admin", "http-account", runtime.session?.userId, id];
  const account = useQuery({ queryKey, queryFn: ({ signal }) => api.get(id, signal) });
  const canAssign = canCode(runtime.session, "account.assign_role");
  const roles = useQuery({
    queryKey: ["bibi-admin", "http-role-options", runtime.session?.userId],
    enabled: canAssign,
    queryFn: ({ signal }) => api.roleOptions(signal),
  });
  if (account.isPending) return <Skeleton />;
  if (!account.data)
    return <ErrorState error={account.error} onRetry={() => void account.refetch()} />;
  const user = account.data;
  const readonly = user.isMaster || !canCode(runtime.session, "account.update");
  const saved = (value: AccountDto) => {
    cache.setQueryData(queryKey, value);
    void cache.invalidateQueries({ queryKey: ["bibi-admin", "http-accounts"] });
  };
  return (
    <>
      <PageTitle
        title={`Tài khoản ${user.username}`}
        description="Thông tin tài khoản và các vai trò được cấp."
        actions={
          <Badge tone={user.active ? "success" : "neutral"}>
            {user.active ? "Hoạt động" : "Ngừng hoạt động"}
          </Badge>
        }
      />
      {account.error && <ErrorState error={account.error} onRetry={() => void account.refetch()} />}
      <Card>
        <AccountForm
          key={id}
          initial={user}
          roles={[]}
          readOnly={readonly}
          onDirtyChange={setDirty}
          onSave={async (draft, revision) => {
            if (avatarBusy) throw new Error("Đợi lưu ảnh hoàn tất");
            const value = await api.update(id, draft, revision);
            saved(value);
            notice("Đã lưu thông tin tài khoản");
            return value;
          }}
        />
      </Card>
      <Card>
        <AvatarEditor
          user={{ ...user, phone: user.phone ?? null, avatarId: user.avatarId ?? null }}
          api={createProfileApi(runtime.http!, id)}
          readOnly={readonly}
          metadataDirty={dirty}
          onDirtyChange={setAvatarDirty}
          onBusyChange={setAvatarBusy}
          onSaved={async (p: ProfileDto) => {
            saved({ ...user, ...p });
            if (user.id === runtime.session?.userId) await runtime.refreshProfile();
            notice("Đã cập nhật ảnh đại diện");
          }}
        />
      </Card>
      <UnsavedDialog dirty={dirty || avatarDirty} />
      {!user.isMaster &&
        canAssign &&
        user.id !== runtime.session?.userId &&
        (roles.data ? (
          <AccountRoles
            key={id}
            account={user}
            roles={roles.data}
            disabled={dirty || avatarBusy}
            onSave={async (ids) => {
              const value = await api.setRoles(user, ids);
              saved(value);
              notice("Đã lưu vai trò và thu hồi các phiên cũ");
            }}
          />
        ) : roles.error ? (
          <ErrorState error={roles.error} onRetry={() => void roles.refetch()} />
        ) : (
          <Skeleton />
        ))}
      {(user.isMaster || !canAssign || user.id === runtime.session?.userId) && (
        <Card>
          <h2>Vai trò</h2>
          <p>{user.roles.map((role) => role.name).join(", ") || "Chưa cấp vai trò"}</p>
        </Card>
      )}
    </>
  );
}
