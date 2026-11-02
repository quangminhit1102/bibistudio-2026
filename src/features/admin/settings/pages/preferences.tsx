import { PreferenceForm } from "../../shared/forms/preference-form";
import { useQueryClient } from "@tanstack/react-query";
import { useAdmin, useRecord, useRole } from "../../services/context";
import { can } from "../../accounts/permissions";
import { Card, ErrorState, PageTitle, Skeleton, useNotice } from "../../shared/ui/primitives";
import { saveSetting } from "../service";
export default function Preferences() {
  const runtime = useAdmin(),
    role = useRole(),
    query = useRecord("settings", "general"),
    cache = useQueryClient(),
    notify = useNotice();
  return (
    <>
      <PageTitle title="Cài đặt chung" description="Thông tin liên hệ và tùy chọn của studio." />
      {query.isPending ? (
        <Skeleton />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        query.data && (
          <Card>
            {can(runtime.session, "settings", "update", role.data) ? (
              <PreferenceForm
                key={query.data.revision}
                fields={[
                  { key: "studioName", label: "Tên studio", type: "text", required: true },
                  { key: "email", label: "Email liên hệ", type: "email", required: true },
                ]}
                initial={query.data.values}
                onSave={async (values) => {
                  await saveSetting(
                    runtime.store,
                    runtime.session,
                    "general",
                    { ...query.data!.values, ...values, language: "vi" },
                    query.data!.revision,
                  );
                  await cache.invalidateQueries({ queryKey: ["bibi-admin", "settings"] });
                  notify("Đã lưu cài đặt.");
                }}
              />
            ) : (
              <p>Bạn có quyền xem cài đặt.</p>
            )}
          </Card>
        )
      )}
    </>
  );
}
