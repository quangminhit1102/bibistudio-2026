import { useState, lazy, Suspense } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate, Link } from "@tanstack/react-router";
import { flushSync } from "react-dom";
import { useAdmin, useRecord, useRole } from "../services/context";
import { can, resourceForEntity } from "../accounts/permissions";
import type { EntityKey, CreateInput } from "../services/contracts";
import type { EntityConfig } from "./entity-manager";
import { RecordForm, type FormValues } from "./forms/record-form";
import { useUnsavedChanges } from "./forms/unsaved-guard";
import {
  Button,
  Card,
  ConfirmDialog,
  ErrorState,
  PageTitle,
  Skeleton,
  useNotice,
} from "./ui/primitives";
import { date } from "./lib/text";
const RichPreview = lazy(() => import("../content/components/rich-editor"));
export function RecordEditor<K extends EntityKey>({
  config,
  id,
  listHref,
}: {
  config: EntityConfig<K>;
  id?: string;
  listHref: string;
}) {
  const runtime = useAdmin();
  const query = useQueryClient();
  const navigate = useNavigate();
  const notice = useNotice();
  const record = useRecord(config.entity, id ?? "", config.resource);
  const role = useRole();
  const [dirty, setDirty] = useState(false);
  const blocker = useUnsavedChanges(dirty);
  if (id && record.isPending) return <Skeleton />;
  if (record.error)
    return <ErrorState error={record.error} onRetry={() => void record.refetch()} />;
  if (
    !can(
      runtime.session,
      config.resource ?? resourceForEntity(config.entity),
      id ? "update" : "create",
      role.data,
    )
  )
    return <ErrorState error={new Error("Bạn không có quyền chỉnh sửa dữ liệu này.")} />;
  return (
    <>
      <PageTitle
        title={
          id ? `Chỉnh sửa ${config.title.toLowerCase()}` : `Thêm ${config.title.toLowerCase()}`
        }
        description="Thay đổi chỉ áp dụng cho bộ dữ liệu demo trong trình duyệt."
      />
      <Card>
        <RecordForm
          key={id ?? "new"}
          fields={config.fields}
          initial={(record.data ?? config.defaults) as unknown as FormValues}
          onDirtyChange={setDirty}
          onCancel={() => void navigate({ to: listHref as "/admin" })}
          onSave={async (values) => {
            const service = runtime.service(config.entity, config.resource);
            if (id && record.data)
              await service.update(id, values as Partial<CreateInput<K>>, record.data.revision);
            else await service.create(values as CreateInput<K>);
            await query.invalidateQueries({ queryKey: ["bibi-admin"] });
            flushSync(() => setDirty(false));
            notice("Đã lưu dữ liệu demo.");
            void navigate({ to: listHref as "/admin" });
          }}
        />
      </Card>
      <ConfirmDialog
        open={blocker.status === "blocked"}
        title="Bỏ thay đổi chưa lưu?"
        description="Nội dung đang chỉnh sửa sẽ không được lưu."
        onCancel={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
      />
    </>
  );
}
export function RecordDetail<K extends EntityKey>({
  config,
  id,
  listHref,
}: {
  config: EntityConfig<K>;
  id: string;
  listHref: string;
}) {
  const record = useRecord(config.entity, id, config.resource);
  if (record.isPending) return <Skeleton />;
  if (record.error || !record.data) return <ErrorState error={record.error} />;
  const data = record.data as unknown as FormValues;
  return (
    <>
      <PageTitle
        title={String(data.name ?? data.title ?? id)}
        description={`${config.title} · Chi tiết dữ liệu demo`}
        actions={
          <>
            <Link to={listHref as "/admin"} className="a-btn">
              Quay lại
            </Link>
            {config.editHref && (
              <Link to={config.editHref(id) as "/admin"} className="a-btn a-btn-primary">
                Chỉnh sửa
              </Link>
            )}
          </>
        }
      />
      <Card>
        <dl className="a-key-values">
          {Object.entries(data)
            .filter(([k]) => !["content", "revision", "id"].includes(k))
            .map(([key, value]) => (
              <div key={key}>
                <dt>{config.fields.find((f) => f.key === key)?.label ?? key}</dt>
                <dd>
                  {key.endsWith("At") && typeof value === "string"
                    ? date(value)
                    : typeof value === "object"
                      ? JSON.stringify(value)
                      : String(value ?? "—")}
                </dd>
              </div>
            ))}
        </dl>
        {typeof data.content === "string" && (
          <div style={{ marginTop: 24 }}>
            <Suspense fallback={<Skeleton />}>
              <RichPreview value={data.content} onChange={() => {}} readOnly />
            </Suspense>
          </div>
        )}
      </Card>
    </>
  );
}
export function useRecordId() {
  return (useParams({ strict: false }) as { id?: string }).id ?? "";
}
