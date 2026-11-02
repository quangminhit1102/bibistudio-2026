import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAdmin, useRecord, useRole } from "../../services/context";
import { can } from "../../accounts/permissions";
import type { PurchaseSlip } from "../../services/contracts";
import { useRecordId } from "../../shared/record-editor";
import { useUnsavedChanges } from "../../shared/forms/unsaved-guard";
import { internalTarget, safeListReturn } from "../../shared/lib/navigation";
import {
  Card,
  PageTitle,
  Skeleton,
  ErrorState,
  ConfirmDialog,
  useNotice,
} from "../../shared/ui/primitives";
import { useSlipOptions } from "../hooks";
import { SlipForm } from "../components/slip-form";
import { createSlipService } from "../slip-service";
import { useSlipRoute } from "../use-slip-route";
export default function SlipEditor() {
  const id = useRecordId();
  const record = useSlipRoute(id);
  if (id && record.isPending) return <Skeleton />;
  if (id && (record.error || !record.data))
    return <ErrorState error={record.error} onRetry={() => void record.refetch()} />;
  const primaryId = record.data?.id ?? "";
  return <SlipEditorSession key={primaryId || "new"} id={primaryId} />;
}
function SlipEditorSession({ id }: { id: string }) {
  const record = useRecord("purchaseSlips", id),
    options = useSlipOptions(),
    runtime = useAdmin(),
    role = useRole();
  const query = useQueryClient(),
    navigate = useNavigate(),
    notice = useNotice();
  const search = useSearch({ strict: false }) as { returnTo?: unknown };
  const back = safeListReturn(search.returnTo, "/admin/sales/slips");
  const [snapshot, setSnapshot] = useState<PurchaseSlip | null>(null),
    [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (record.data && (!snapshot || snapshot.id !== record.data.id)) setSnapshot(record.data);
  }, [record.data, snapshot]);
  const blocker = useUnsavedChanges(dirty);
  if ((!options.data && options.error) || (id && !snapshot && record.error))
    return (
      <ErrorState
        error={options.error ?? record.error}
        onRetry={() => {
          void options.refetch();
          if (id) void record.refetch();
        }}
      />
    );
  if (!options.data || role.isPending || (id && (!snapshot || snapshot.id !== id)))
    return <Skeleton />;
  if (!can(runtime.session, "sales", id ? "update" : "create", role.data))
    return <ErrorState error={new Error("Bạn không có quyền chỉnh sửa phiếu.")} />;
  if (snapshot?.status === "void")
    return <ErrorState error={new Error("Phiếu đã hủy chỉ được xem.")} />;
  return (
    <>
      <PageTitle
        title={id ? "Chỉnh sửa phiếu mua hàng" : "Tạo phiếu mua hàng"}
        description="Ghi nhận sản phẩm bán cho khách · · Không tự trừ kho"
      />
      {(options.error || record.error) && (
        <ErrorState
          error={options.error ?? record.error}
          onRetry={() => {
            void options.refetch();
            if (id) void record.refetch();
          }}
        />
      )}
      <Card>
        <SlipForm
          key={id || "new"}
          initial={snapshot ?? undefined}
          {...options.data}
          onDirtyChange={setDirty}
          onCancel={() => void navigate(internalTarget(back))}
          onSave={async (draft) => {
            const service = createSlipService(runtime.store, () => runtime.session);
            if (id && snapshot) await service.update(id, draft, snapshot.revision);
            else await service.create(draft);
            await query.invalidateQueries({ queryKey: ["bibi-admin"] });
            flushSync(() => setDirty(false));
            notice("Đã lưu phiếu mua hàng.");
            void navigate(internalTarget(back));
          }}
        />
      </Card>
      <ConfirmDialog
        open={blocker.status === "blocked"}
        title="Bỏ thay đổi chưa lưu?"
        description="Nội dung phiếu đang nhập sẽ không được lưu."
        onCancel={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
      />
    </>
  );
}
