import { Link, useSearch } from "@tanstack/react-router";
import { useAdmin, useRecord, useRole } from "../../services/context";
import { can } from "../../accounts/permissions";
import { useRecordId } from "../../shared/record-editor";
import { internalTarget, safeListReturn } from "../../shared/lib/navigation";
import { money, dateTime } from "../../shared/lib/text";
import { Card, PageTitle, Badge, Button, ErrorState, Skeleton } from "../../shared/ui/primitives";
import { VoidSlip } from "../components/void-slip";
export default function SlipDetail() {
  const id = useRecordId(),
    record = useRecord("purchaseSlips", id),
    runtime = useAdmin(),
    role = useRole();
  const search = useSearch({ strict: false }) as { returnTo?: unknown };
  const back = safeListReturn(search.returnTo, "/admin/sales/slips");
  if (record.isPending) return <Skeleton />;
  if (record.error || !record.data)
    return <ErrorState error={record.error} onRetry={() => void record.refetch()} />;
  const s = record.data,
    editable = s.status === "saved" && can(runtime.session, "sales", "update", role.data);
  return (
    <div className="a-slip-detail">
      <PageTitle
        title={s.number}
        description={`Phiếu mua hàng · ${dateTime(s.createdAt)} · Giờ Việt Nam`}
        actions={
          <>
            <Link {...internalTarget(back)} className="a-btn">
              Quay lại
            </Link>
            {editable && (
              <>
                <Link
                  to={`/admin/sales/slips/${id}/edit` as "/admin"}
                  search={{ returnTo: back } as never}
                  className="a-btn a-btn-primary"
                >
                  Chỉnh sửa
                </Link>
                <VoidSlip slip={s} />
              </>
            )}
            <Button onClick={() => window.print()}>In phiếu</Button>
          </>
        }
      />
      <Card>
        <div className="a-slip-customer">
          <div>
            <h2>{s.customerSnapshot.name}</h2>
            <p>{s.customerSnapshot.address || "Chưa có địa chỉ"}</p>
            <small>Mã khách: {s.customerId}</small>
          </div>
          <div className="a-actions">
            <Badge>{s.vatApplied ? "Có VAT" : "Không VAT"}</Badge>
            <Badge>{s.status === "void" ? "Đã hủy" : "Đã lưu"}</Badge>
          </div>
        </div>
        <div className="a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                <th>Sản phẩm</th>
                <th>Số lượng</th>
                <th>Đơn giá</th>
                <th>Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {s.items.map((i) => (
                <tr key={i.lineId}>
                  <td>
                    <strong>{i.name}</strong>
                    <small>{i.sku}</small>
                  </td>
                  <td>{i.quantity}</td>
                  <td>{money(i.unitPrice)}</td>
                  <td>{money(i.quantity * i.unitPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="a-slip-footer">
          <div>
            <span>Tổng tiền</span>
            <strong>{money(s.total)}</strong>
            <small>{s.vatApplied ? "Có VAT" : "Không VAT"} · Không tự tính thuế</small>
          </div>
        </div>
        {s.notes && <p className="a-slip-notes">{s.notes}</p>}
        {s.status === "void" && (
          <div className="a-banner">
            <strong>Đã hủy · {s.voidedAt ? dateTime(s.voidedAt) : ""}</strong>
            <p>{s.voidReason}</p>
          </div>
        )}
      </Card>
    </div>
  );
}
