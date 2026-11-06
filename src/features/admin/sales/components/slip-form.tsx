import { useEffect, useMemo, useState } from "react";
import type { AdminProduct, Customer, PurchaseSlip } from "../../services/contracts";
import { Button, Badge, Field } from "../../shared/ui/primitives";
import { money, dateTime } from "../../shared/lib/text";
import { calculateSlipTotal, parseSlipDraft, type SlipDraft } from "../slip-schema";
import { statusBadgeTone } from "../../shared/ui/status-badges";

function Picker({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { id: string; name: string }[];
  onChange: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  return (
    <div className="a-field">
      <span>{label}</span>
      <input
        aria-label={`Tìm ${label.toLowerCase()}`}
        placeholder="Gõ để lọc…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Chọn {label.toLowerCase()}…</option>
        {options
          .filter(
            (o) =>
              o.id === value || o.name.toLocaleLowerCase("vi").includes(q.toLocaleLowerCase("vi")),
          )
          .map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
      </select>
    </div>
  );
}
export function SlipForm({
  initial,
  customers,
  products,
  onSave,
  onCancel,
  onDirtyChange,
}: {
  initial?: PurchaseSlip;
  customers: Customer[];
  products: AdminProduct[];
  onSave: (draft: SlipDraft) => Promise<void>;
  onCancel: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState<SlipDraft>(() => ({
    customerId: initial?.customerId ?? "",
    vatApplied: initial?.vatApplied ?? false,
    notes: initial?.notes ?? "",
    items:
      initial?.items.map(({ lineId, productId, quantity, unitPrice }) => ({
        lineId,
        productId,
        quantity,
        unitPrice,
      })) ?? [],
  }));
  const [snapshots] = useState(() => initial?.items ?? []);
  const [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [submitted, setSubmitted] = useState(false);
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  const customer = customers.find((c) => c.id === draft.customerId);
  const total = useMemo(() => {
    try {
      return calculateSlipTotal(draft.items);
    } catch {
      return null;
    }
  }, [draft.items]);
  function change(next: SlipDraft) {
    setDraft(next);
    setDirty(true);
  }
  function add(id: string) {
    const existing = draft.items.find((i) => i.productId === id);
    if (existing) {
      document.getElementById(`slip-qty-${existing.lineId}`)?.focus();
      return;
    }
    const product = products.find((p) => p.id === id);
    if (!product) return;
    if (draft.items.length >= 100) {
      setError("Phiếu tối đa 100 dòng.");
      return;
    }
    change({
      ...draft,
      items: [
        ...draft.items,
        { lineId: crypto.randomUUID(), productId: id, quantity: 1, unitPrice: product.price },
      ],
    });
  }
  function edit(index: number, field: "quantity" | "unitPrice", raw: string) {
    change({
      ...draft,
      items: draft.items.map((line, i) =>
        i === index ? { ...line, [field]: raw === "" ? NaN : Number(raw) } : line,
      ),
    });
  }
  if (initial?.status === "void") return <p role="status">Phiếu đã hủy chỉ được xem.</p>;
  return (
    <form
      className="a-slip-form"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setSubmitted(true);
        setError("");
        try {
          const parsed = parseSlipDraft(draft);
          setBusy(true);
          await onSave(parsed);
          setDirty(false);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Không thể lưu phiếu. Thử lại.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy} className="a-slip-fieldset">
        <div className="a-form-grid">
          <Picker
            label="Khách mua hàng"
            value={draft.customerId}
            options={customers
              .filter((c) => c.active || c.id === draft.customerId)
              .map((c) => ({
                id: c.id,
                name: `${c.name} · ${c.id.slice(0, 12)}${!c.active ? " · Ngừng sử dụng" : ""}`,
              }))}
            onChange={(id) =>
              change({
                ...draft,
                customerId: id,
                vatApplied: customers.find((c) => c.id === id)?.vatApplied ?? false,
              })
            }
          />
          <div className="a-field">
            <span>Ngày giờ tạo phiếu</span>
            <p>{initial ? dateTime(initial.createdAt) : "Ghi nhận tự động khi lưu phiếu"}</p>
            <small>Giờ Việt Nam</small>
          </div>
          <div className="a-field">
            <label>
              <input
                type="checkbox"
                aria-label="Có VAT"
                checked={draft.vatApplied}
                onChange={(e) => change({ ...draft, vatApplied: e.target.checked })}
              />{" "}
              Có VAT
            </label>
            <Badge tone={statusBadgeTone("vat", String(draft.vatApplied))}>
              {draft.vatApplied ? "Có VAT" : "Không VAT"}
            </Badge>
            <small>Chỉ là nhãn trên phiếu, không tính thuế.</small>
            {customer && draft.vatApplied !== customer.vatApplied && (
              <>
                <small>Khác mặc định của khách</small>
                <Button
                  size="sm"
                  variant="link"
                  onClick={() => change({ ...draft, vatApplied: customer.vatApplied })}
                >
                  Lấy mặc định của khách
                </Button>
              </>
            )}
          </div>
        </div>
        <Picker
          label="Sản phẩm"
          value=""
          options={products
            .filter((p) => p.status !== "hidden")
            .map((p) => ({ id: p.id, name: `${p.sku} · ${p.name}` }))}
          onChange={add}
        />
        <div className="a-slip-lines" role="table" aria-label="Các dòng sản phẩm">
          <div className="a-slip-row a-slip-head" role="row">
            <span role="columnheader">Sản phẩm</span>
            <span role="columnheader">Số lượng</span>
            <span role="columnheader">Đơn giá (VND)</span>
            <span role="columnheader">Thành tiền</span>
            <span role="columnheader">Bỏ</span>
          </div>
          {draft.items.map((line, i) => {
            const snapshot = snapshots.find(
                (s) => s.lineId === line.lineId && s.productId === line.productId,
              ),
              product = products.find((p) => p.id === line.productId);
            const badQty = !Number.isSafeInteger(line.quantity) || line.quantity < 1,
              badPrice = !Number.isSafeInteger(line.unitPrice) || line.unitPrice < 0;
            const amount = line.quantity * line.unitPrice;
            return (
              <div className="a-slip-row" role="row" key={line.lineId}>
                <div role="cell">
                  <strong>{snapshot?.name ?? product?.name ?? "Sản phẩm không còn tồn tại"}</strong>
                  <small>{snapshot?.sku ?? product?.sku}</small>
                </div>
                <label role="cell">
                  <span className="a-slip-mobile-label">Số lượng</span>
                  <input
                    id={`slip-qty-${line.lineId}`}
                    aria-label={`Số lượng dòng ${i + 1}`}
                    type="number"
                    inputMode="numeric"
                    min="1"
                    step="1"
                    value={Number.isFinite(line.quantity) ? line.quantity : ""}
                    aria-invalid={submitted && badQty}
                    onChange={(e) => edit(i, "quantity", e.target.value)}
                  />
                  {submitted && badQty && <small className="a-error">Nhập số nguyên dương.</small>}
                </label>
                <label role="cell">
                  <span className="a-slip-mobile-label">Đơn giá (VND)</span>
                  <input
                    aria-label={`Đơn giá dòng ${i + 1}`}
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="1"
                    value={Number.isFinite(line.unitPrice) ? line.unitPrice : ""}
                    aria-invalid={submitted && badPrice}
                    onChange={(e) => edit(i, "unitPrice", e.target.value)}
                  />
                  {submitted && badPrice && (
                    <small className="a-error">Nhập số VND nguyên không âm.</small>
                  )}
                </label>
                <div role="cell">
                  <span className="a-slip-mobile-label">Thành tiền</span>
                  {!badQty && !badPrice && Number.isSafeInteger(amount) ? money(amount) : "—"}
                </div>
                <div role="cell">
                  <Button
                    size="icon"
                    aria-label={`Bỏ dòng ${i + 1}`}
                    onClick={() =>
                      change({ ...draft, items: draft.items.filter((_, index) => index !== i) })
                    }
                  >
                    ×
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        {!draft.items.length && <p>Chọn sản phẩm để thêm dòng vào phiếu.</p>}
        <Field label="Ghi chú">
          <textarea
            aria-label="Ghi chú"
            value={draft.notes}
            maxLength={5000}
            onChange={(e) => change({ ...draft, notes: e.target.value })}
          />
        </Field>
      </fieldset>
      {error && (
        <p className="a-error" role="alert">
          {error}
        </p>
      )}
      <div className="a-slip-footer">
        <div>
          <span>Tổng tiền</span>
          <strong role="status" aria-label="Tổng tiền">
            {total === null ? "—" : money(total)}
          </strong>
          <small>{draft.vatApplied ? "Có VAT" : "Không VAT"} · Không tự tính thuế</small>
        </div>
        <div className="a-actions">
          <Button disabled={busy} onClick={onCancel}>
            Hủy
          </Button>
          <Button type="submit" variant="primary" loading={busy}>
            Lưu phiếu
          </Button>
        </div>
      </div>
    </form>
  );
}
