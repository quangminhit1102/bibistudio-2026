import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { PurchaseSlip } from "../../services/contracts";
import { useAdmin } from "../../services/context";
import { Button, Modal, Field, useNotice } from "../../shared/ui/primitives";
import { createSlipService } from "../slip-service";
export function VoidSlip({ slip }: { slip: PurchaseSlip }) {
  const runtime = useAdmin(),
    query = useQueryClient(),
    notice = useNotice();
  const [open, setOpen] = useState(false),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      <Button
        variant="outline"
        className="a-btn-danger-outline"
        onClick={() => {
          setOpen(true);
          setError("");
        }}
      >
        Hủy phiếu
      </Button>
      <Modal
        open={open}
        onOpenChange={(next) => {
          if (!busy) setOpen(next);
        }}
        title="Hủy phiếu mua hàng?"
        description="Phiếu vẫn được giữ để đối chiếu, nhưng không tính vào báo cáo doanh thu."
      >
        <form
          className="a-dialog-body"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            setError("");
            try {
              await createSlipService(runtime.store, () => runtime.session).void(
                slip.id,
                reason,
                slip.revision,
              );
              await query.invalidateQueries({ queryKey: ["bibi-admin"] });
              setOpen(false);
              notice("Đã hủy phiếu.");
            } catch (e) {
              setError(e instanceof Error ? e.message : "Không thể hủy phiếu.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Lý do hủy">
            <textarea
              aria-label="Lý do hủy"
              required
              maxLength={1000}
              value={reason}
              disabled={busy}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          {error && (
            <p className="a-error" role="alert">
              {error}
            </p>
          )}
          <div className="a-actions a-right">
            <Button disabled={busy} onClick={() => setOpen(false)}>
              Giữ phiếu
            </Button>
            <Button type="submit" variant="destructive" loading={busy}>
              Xác nhận hủy
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
