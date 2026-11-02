import { getProfile, saveProfile } from "../../accounts/profile-service";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAdmin } from "../../services/context";
import { ProfileForm } from "../../accounts/profile-form";
import { Card, PageTitle, Skeleton, ErrorState, useNotice } from "../../shared/ui/primitives";
export default function Profile() {
  const runtime = useAdmin(),
    cache = useQueryClient(),
    notice = useNotice();
  const user = useQuery({
    queryKey: ["bibi-admin", "profile", runtime.session?.userId],
    enabled: !!runtime.session,
    queryFn: () => getProfile(runtime.store, runtime.session),
  });
  return (
    <>
      <PageTitle title="Hồ sơ" description="Thông tin cá nhân và ảnh đại diện của bạn." />
      {user.isPending ? (
        <Skeleton />
      ) : user.error && !user.data ? (
        <ErrorState error={user.error} onRetry={() => void user.refetch()} />
      ) : (
        user.data && (
          <Card>
            {user.error && <ErrorState error={user.error} onRetry={() => void user.refetch()} />}
            <ProfileForm
              key={user.data.id}
              user={user.data}
              onSave={async (values, revision, avatar) => {
                const saved = await saveProfile(
                  runtime.store,
                  runtime.session,
                  values,
                  revision,
                  avatar,
                );
                await cache.invalidateQueries({ queryKey: ["bibi-admin"] });
                notice("Đã lưu hồ sơ.");
                return saved;
              }}
            />
          </Card>
        )
      )}
    </>
  );
}
