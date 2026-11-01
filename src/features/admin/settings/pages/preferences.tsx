import { PreferenceForm } from "../../shared/forms/preference-form";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { useAdmin, useRecord, useRole } from "../../services/context";
import { can } from "../../accounts/permissions";
import { type FormField } from "../../shared/forms/record-form";
import {
  Button,
  Card,
  ConfirmDialog,
  ErrorState,
  PageTitle,
  Skeleton,
  useNotice,
} from "../../shared/ui/primitives";
import { saveSetting } from "../service";
const general: FormField[] = [
  { key: "studioName", label: "Tên studio", type: "text", required: true },
  { key: "email", label: "Email liên hệ", type: "email", required: true },
  {
    key: "timezone",
    label: "Múi giờ",
    type: "select",
    options: [
      { value: "Asia/Ho_Chi_Minh", label: "Việt Nam (UTC+7)" },
      { value: "UTC", label: "UTC" },
    ],
  },
  {
    key: "language",
    label: "Ngôn ngữ",
    type: "select",
    options: [
      { value: "vi", label: "Tiếng Việt" },
      { value: "en", label: "English" },
    ],
  },
];
const security: FormField[] = [
  {
    key: "demoMfa",
    label: "Mô phỏng bật xác thực hai bước",
    type: "checkbox",
    description: "Chỉ lưu tùy chọn demo, không cung cấp xác thực thật.",
  },
  {
    key: "sessionTimeout",
    label: "Thời gian phiên demo (phút)",
    type: "number",
    min: 5,
    max: 120,
    required: true,
  },
];
export default function Preferences() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const kind = path.endsWith("/security") ? "security" : "general";
  const runtime = useAdmin();
  const role = useRole();
  const query = useRecord("settings", kind);
  const cache = useQueryClient();
  const notify = useNotice();
  const [reset, setReset] = useState(false);
  return (
    <>
      <PageTitle
        title={kind === "general" ? "Cài đặt chung" : "Bảo mật demo"}
        description="Các thay đổi chỉ áp dụng trong trình duyệt này."
      />
      {query.isPending ? (
        <Skeleton />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        query.data && (
          <Card>
            {can(runtime.session, "settings", "update", role.data) ? (
              <PreferenceForm
                key={kind + query.data.revision}
                fields={kind === "general" ? general : security}
                initial={query.data.values}

                onSave={async (values) => {
                  await saveSetting(
                    runtime.store,
                    runtime.session,
                    kind,
                    values,
                    query.data!.revision,
                  );
                  await cache.invalidateQueries({ queryKey: ["bibi-admin", "settings"] });
                  notify("Đã lưu cài đặt demo.");
                }}
              />
            ) : (
              <p>Bạn có quyền xem cài đặt.</p>
            )}
          </Card>
        )
      )}
      {kind === "security" && can(runtime.session, "settings", "settings", role.data) && (
        <Card>
          <h2>Khôi phục dữ liệu demo</h2>
          <p>
            Xóa dữ liệu admin, ảnh tải lên và phiên demo trong trình duyệt này. Lần đăng nhập tiếp
            theo sẽ tạo bộ mẫu mới.
          </p>
          <Button variant="destructive" onClick={() => setReset(true)}>
            Reset demo
          </Button>
        </Card>
      )}
      <ConfirmDialog
        open={reset}
        title="Xóa toàn bộ dữ liệu admin demo?"
        description="Thao tác này không thể hoàn tác các chỉnh sửa và ảnh demo đã lưu."
        onCancel={() => setReset(false)}
        onConfirm={async () => {
          await runtime.reset();
          setReset(false);
        }}
      />
    </>
  );
}
