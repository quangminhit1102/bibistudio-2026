import { getProfile, saveProfile } from "../../accounts/profile-service";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAdmin } from "../../services/context";
import { PreferenceForm } from "../../shared/forms/preference-form";
import { Card, PageTitle, Skeleton, ErrorState, useNotice } from "../../shared/ui/primitives";
export default function Profile() {
  const runtime = useAdmin();
  const user = useQuery({
    queryKey: ["bibi-admin", "profile", runtime.session?.userId],
    queryFn: () => getProfile(runtime.store, runtime.session),
  });
  const cache = useQueryClient();
  const notice = useNotice();
  return (
    <>
      <PageTitle title="Hồ sơ" description="Thông tin tài khoản demo đang sử dụng." />
      {user.isPending ? (
        <Skeleton />
      ) : user.error ? (
        <ErrorState error={user.error} />
      ) : (
        user.data && (
          <Card>
            <PreferenceForm
              key={user.data.revision}
              fields={[
                { key: "name", label: "Họ tên", type: "text", required: true },
                { key: "email", label: "Email", type: "email", required: true },
              ]}
              initial={{ name: user.data.name, email: user.data.email }}

              onSave={async (values) => {
                await saveProfile(runtime.store, runtime.session, values, user.data!.revision);
                await cache.invalidateQueries({ queryKey: ["bibi-admin"] });
                notice("Đã lưu hồ sơ demo.");
              }}
            />
          </Card>
        )
      )}
    </>
  );
}
