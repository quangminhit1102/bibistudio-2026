import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useAdmin, useRecord, useRole } from "../../services/context";
import { can } from "../../accounts/permissions";
import { useRecordId } from "../../shared/record-editor";
import {
  Button,
  Badge,
  Card,
  ConfirmDialog,
  PageTitle,
  Skeleton,
  ErrorState,
  useNotice,
} from "../../shared/ui/primitives";
import { date, money } from "../../shared/lib/text";
import {
  orderLabels,
  paymentLabels,
  orderTransitions,
  paymentTransitions,
  transitionOrder,
  transitionPayment,
  updateOrderNotes,
  totalOrder,
} from "../service";
import type { OrderStatus, PaymentStatus } from "../../services/contracts";
export default function OrderDetail() {
  const id = useRecordId();
  const runtime = useAdmin();
  const role = useRole();
  const order = useRecord("orders", id);
  const client = useQueryClient();
  const notice = useNotice();
  const [next, setNext] = useState<OrderStatus | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (order.isPending) return <Skeleton />;
  if (order.error || !order.data)
    return <ErrorState error={order.error} onRetry={() => void order.refetch()} />;
  const record = order.data;
  const allowed = can(runtime.session, "sales", "update", role.data);
  const done = async () => {
    await client.invalidateQueries({ queryKey: ["bibi-admin"] });
    notice("Đã cập nhật đơn hàng demo.");
  };
  return (
    <>
      <PageTitle
        title={record.number}
        description={`${date(record.createdAt)} · ${record.customer.name}`}
        actions={
          <>
            <Link to="/admin/sales/orders" className="a-btn">
              Danh sách
            </Link>
            <Button onClick={() => window.print()}>In đơn</Button>
          </>
        }
      />
      <div className="a-detail-grid">
        <div>
          <Card>
            <div className="a-card-head">
              <h2>Sản phẩm trong đơn</h2>
              <Badge>{orderLabels[record.status]}</Badge>
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
                  {record.items.map((item, i) => (
                    <tr key={i}>
                      <td>{item.name}</td>
                      <td>{item.quantity}</td>
                      <td>{money(item.unitPrice)}</td>
                      <td>{money(item.quantity * item.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="a-key-values" style={{ marginTop: 20 }}>
              <dt>Tạm tính</dt>
              <dd>{money(record.items.reduce((n, i) => n + i.unitPrice * i.quantity, 0))}</dd>
              <dt>Giảm giá</dt>
              <dd>{money(record.discount)}</dd>
              <dt>Vận chuyển</dt>
              <dd>{money(record.shipping)}</dd>
              <dt>
                <strong>Tổng cộng</strong>
              </dt>
              <dd>
                <strong>{money(totalOrder(record))}</strong>
              </dd>
            </dl>
          </Card>
          <Card>
            <h2>Ghi chú nội bộ</h2>
            <textarea
              aria-label="Ghi chú nội bộ"
              value={notes ?? record.notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ margin: "16px 0" }}
              disabled={!allowed}
            />
            <Button
              disabled={!allowed || notes === null}
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await updateOrderNotes(
                    runtime.store,
                    runtime.session,
                    id,
                    notes ?? "",
                    record.revision,
                  );
                  await done();
                  setNotes(null);
                } catch (e) {
                  notice(e instanceof Error ? e.message : "Lưu thất bại", "error");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Lưu ghi chú
            </Button>
          </Card>
        </div>
        <div>
          <Card>
            <h2>Khách hàng mô phỏng</h2>
            <p style={{ marginTop: 15 }}>{record.customer.name}</p>
            <small>
              {record.customer.email}
              <br />
              {record.customer.address}
            </small>
          </Card>
          <Card>
            <h2>Thanh toán</h2>
            <p style={{ margin: "12px 0" }}>
              <Badge tone={record.paymentStatus === "Paid" ? "success" : "warning"}>
                {paymentLabels[record.paymentStatus]}
              </Badge>
            </p>
            <small>Chỉ thay đổi trạng thái demo, không thu/chuyển tiền.</small>
            <div className="a-actions" style={{ marginTop: 12 }}>
              {paymentTransitions[record.paymentStatus]
                .filter((p) => p !== "Refunded")
                .map((p) => (
                  <Button
                    key={p}
                    size="sm"
                    disabled={!allowed || ["Cancelled", "Refunded"].includes(record.status)}
                    onClick={async () => {
                      try {
                        await transitionPayment(
                          runtime.store,
                          runtime.session,
                          id,
                          p,
                          record.revision,
                        );
                        await done();
                      } catch (e) {
                        notice(e instanceof Error ? e.message : "Thao tác thất bại", "error");
                      }
                    }}
                  >
                    {paymentLabels[p]}
                  </Button>
                ))}
            </div>
          </Card>
          <Card>
            <h2>Tiến trình</h2>
            <ol className="a-timeline" style={{ marginTop: 20 }}>
              {record.timeline.map((event, i) => (
                <li key={i}>
                  {orderLabels[event.status]}
                  <small>{date(event.at)}</small>
                </li>
              ))}
            </ol>
            <div className="a-actions" style={{ marginTop: 22 }}>
              {orderTransitions[record.status].map((status) => (
                <Button
                  key={status}
                  size="sm"
                  variant={status === "Cancelled" ? "destructive" : "outline"}
                  disabled={!allowed}
                  onClick={() => setNext(status)}
                >
                  {orderLabels[status]}
                </Button>
              ))}
            </div>
          </Card>
        </div>
      </div>
      <ConfirmDialog
        open={next !== null}
        title={next ? orderLabels[next] : "Chuyển trạng thái"}
        description="Cập nhật trạng thái demo và tồn kho liên quan. Thao tác không tạo giao dịch tài chính thật."
        onCancel={() => setNext(null)}
        onConfirm={async () => {
          if (next) {
            await transitionOrder(runtime.store, runtime.session, id, next, record.revision);
            await done();
          }
        }}
      />
    </>
  );
}
