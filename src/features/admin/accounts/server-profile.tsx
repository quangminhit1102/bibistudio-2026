import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAdmin } from "../services/context";
import { createProfileApi } from "./profile-api";
import { SelfProfileForm } from "./self-profile-form";
import { AvatarEditor } from "./avatar-editor";
import type { ProfileDto } from "../../../../backend/src/profile/types";
import { Card, ErrorState, PageTitle, Skeleton, useNotice } from "../shared/ui/primitives";
import { UnsavedDialog } from "../shared/forms/preference-form";
export function ServerProfile() {
  const runtime = useAdmin(),
    cache = useQueryClient(),
    notice = useNotice();
  const api = useMemo(() => createProfileApi(runtime.http!), [runtime.http]);
  const [dirty, setDirty] = useState(false),
    [avatarDirty, setAvatarDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [avatarBusy, setAvatarBusy] = useState(false),
    [generation, setGeneration] = useState(0);
  const id = runtime.session?.userId ?? "",
    key = ["bibi-admin", "http-self-account", id];
  const account = useQuery({
    queryKey: key,
    enabled: !!id,
    queryFn: ({ signal }) => api.get(signal),
  });
  const saved = (p: ProfileDto) => {
    if (!runtime.applyProfile(p)) throw new DOMException("Phiên đã thay đổi", "AbortError");
    cache.setQueryData(key, p);
    void cache.invalidateQueries({ queryKey: ["bibi-admin", "http-accounts"] });
  };
  if (account.isPending) return <Skeleton />;
  if (!account.data)
    return <ErrorState error={account.error} onRetry={() => void account.refetch()} />;
  const user = account.data;
  return (
    <>
      <PageTitle title="Hồ sơ" description="Thông tin tài khoản và các vai trò của bạn." />
      {account.error && <ErrorState error={account.error} onRetry={() => void account.refetch()} />}
      <Card className="a-profile-avatar-card">
        <AvatarEditor
          key={id}
          user={user}
          api={api}
          metadataDirty={dirty || busy}
          onDirtyChange={setAvatarDirty}
          onBusyChange={setAvatarBusy}
          onSaved={async (p) => {
            await saved(p);
            notice("Đã cập nhật ảnh đại diện");
          }}
        />
      </Card>
      <Card>
        <h2 className="a-profile-section-title">Thông tin tài khoản</h2>
        <SelfProfileForm
          key={`${id}:${generation}`}
          initial={user}
          blocked={avatarBusy}
          onDirtyChange={setDirty}
          onBusyChange={setBusy}
          onSave={async (d, r) => {
            if (avatarBusy) throw new Error("Đợi lưu ảnh hoàn tất");
            const p = await api.update(d, r);
            await saved(p);
            notice("Đã lưu hồ sơ");
            return p;
          }}
          onReload={() => {
            void account.refetch().then((result) => {
              if (result.isSuccess && result.data && runtime.applyProfile(result.data))
                setGeneration((n) => n + 1);
            });
          }}
        />
      </Card>
      <Card>
        <h2>Vai trò</h2>
        <p>{user.roles.map((r) => r.name).join(", ") || "Chưa cấp vai trò"}</p>
      </Card>
      <UnsavedDialog dirty={dirty || avatarDirty} />
    </>
  );
}
