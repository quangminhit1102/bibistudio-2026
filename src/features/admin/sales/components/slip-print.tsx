import { useEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAdmin } from "../../services/context";
import type { PurchaseSlip } from "../../services/contracts";
import { Button, ErrorState, Field, Skeleton } from "../../shared/ui/primitives";
import { money } from "../../shared/lib/text";
import {
  calculatePrintTotals,
  loadPrintDraft,
  type PrintDraft,
  type PrintLine,
} from "../print-draft";
import { printDocument } from "../print-document";
import "../print.css";

export default function SlipPrint({ slip, onClose }: { slip: PurchaseSlip; onClose: () => void }) {
  const runtime = useAdmin();
  const record = useQuery({
    queryKey: ["bibi-admin", "print-draft", slip.id, slip.revision, runtime.session?.userId],
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    queryFn: () =>
      loadPrintDraft(slip, {
        customer: async (id) => {
          return runtime.service("customers").get(id);
        },
        product: async (id) => {
          return runtime.service("products").get(id);
        },
      }),
  });
  if (record.isPending) return <Skeleton />;
  if (record.error || !record.data)
    return (
      <>
        <Button onClick={onClose}>Quay lại phiếu</Button>
        <ErrorState error={record.error} onRetry={() => void record.refetch()} />
      </>
    );
  return (
    <PrintEditor initial={record.data.draft} warnings={record.data.warnings} onClose={onClose} />
  );
}

export function PrintEditor({
  initial,
  warnings,
  onClose,
}: {
  initial: PrintDraft;
  warnings: string[];
  onClose: () => void;
}) {
  const [draft, updateDraft] = useState(() => structuredClone(initial));
  const [viewOnly, setViewOnly] = useState(
    () =>
      typeof window.matchMedia === "function" && window.matchMedia("(max-width:1000px)").matches,
  );
  const [loaded, setLoaded] = useState("");
  function setDraft(value: SetStateAction<PrintDraft>) {
    setLoaded("");
    updateDraft(value);
  }
  const [printError, setPrintError] = useState("");
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(1155);
  const frame = useRef<HTMLIFrameElement>(null),
    preview = useRef<HTMLDivElement>(null);
  const focusNew = useRef(false),
    lines = useRef<HTMLDivElement>(null);
  const result = useMemo(() => {
    try {
      return { totals: calculatePrintTotals(draft), html: printDocument(draft), error: "" };
    } catch (error) {
      return {
        totals: null,
        html: "",
        error: error instanceof Error ? error.message : "Kiểm tra thông tin bản in.",
      };
    }
  }, [draft]);
  useEffect(() => {
    const area = preview.current;
    if (!area || typeof ResizeObserver === "undefined") return;
    const fit = () => setScale(Math.min(1, Math.max(0.2, (area.clientWidth - 32) / 794)));
    const observer = new ResizeObserver(fit);
    observer.observe(area);
    fit();
    return () => observer.disconnect();
  }, [viewOnly]);
  useEffect(() => {
    if (focusNew.current) {
      lines.current
        ?.querySelector<HTMLInputElement>(`[aria-label="Sản phẩm dòng ${draft.items.length}"]`)
        ?.focus();
      focusNew.current = false;
    }
  }, [draft.items.length]);
  function field<K extends keyof Omit<PrintDraft, "items">>(key: K, value: PrintDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  function line(id: string, key: keyof PrintLine, value: string) {
    setDraft((d) => ({
      ...d,
      items: d.items.map((item) => (item.id === id ? { ...item, [key]: value } : item)),
    }));
  }
  function text(label: string, key: keyof Omit<PrintDraft, "items" | "vat">, multiline = false) {
    return (
      <Field label={label}>
        {multiline ? (
          <textarea
            aria-label={label}
            value={String(draft[key])}
            maxLength={1000}
            onChange={(e) => field(key, e.target.value)}
          />
        ) : (
          <input
            aria-label={label}
            value={String(draft[key])}
            maxLength={250}
            onChange={(e) => field(key, e.target.value)}
          />
        )}
      </Field>
    );
  }
  function print() {
    if (!result.html || loaded !== result.html || !frame.current?.contentWindow) return;
    try {
      setPrintError("");
      frame.current.contentWindow.focus();
      frame.current.contentWindow.print();
    } catch {
      setPrintError("Không mở được hộp thoại in. Hãy thử lại trên trình duyệt Edge hoặc Chrome.");
    }
  }
  return (
    <div className="a-print-editor">
      <header className="a-print-toolbar">
        <div>
          <h1>In phiếu giao hàng</h1>
          <p>Chỉ chỉnh bản in · Phiếu gốc và báo cáo được giữ nguyên</p>
        </div>
        <div className="a-actions">
          <Button onClick={onClose}>Quay lại phiếu</Button>
          <Button onClick={() => setViewOnly((v) => !v)}>
            {viewOnly ? "Chỉnh thông tin" : "Chỉ xem phiếu"}
          </Button>
          <Button
            onClick={() => {
              setDraft(structuredClone(initial));
              setPrintError("");
            }}
          >
            Khôi phục dữ liệu phiếu
          </Button>
          <Button
            variant="primary"
            disabled={!result.html || loaded !== result.html}
            onClick={print}
          >
            In / Lưu PDF
          </Button>
        </div>
      </header>
      {warnings.length > 0 && (
        <div className="a-banner">
          {warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </div>
      )}
      <div className={`a-print-workspace ${viewOnly ? "is-preview" : ""}`}>
        {!viewOnly && (
          <aside className="a-print-fields" aria-label="Chỉnh thông tin bản in">
            <div className="a-print-summary">
              <span>Thành tiền thanh toán</span>
              <strong data-testid="print-total">
                {result.totals ? money(result.totals.total) : "Kiểm tra thông tin"}
              </strong>
            </div>
            <p className="a-print-note">
              Thông tin được điền từ dữ liệu khách hàng, sản phẩm và phiếu. Bạn có thể sửa riêng cho
              lần in này.
            </p>
            <details open>
              <summary>1. Khách hàng, ngày và VAT</summary>
              <div className="a-print-inputs">
                {text("Tên khách hàng", "customer")}
                {text("Địa chỉ nhận hàng", "customerAddress", true)}
                <Field label="Ngày trên phiếu">
                  <input
                    aria-label="Ngày trên phiếu"
                    type="date"
                    value={draft.date}
                    onChange={(e) => field("date", e.target.value)}
                  />
                </Field>
                {text("Số phiếu (có thể bỏ trống)", "number")}
                <div className="a-print-pair">
                  <Field label="Tính VAT">
                    <select
                      aria-label="Tính VAT"
                      value={draft.vat ? "yes" : "no"}
                      onChange={(e) => field("vat", e.target.value === "yes")}
                    >
                      <option value="yes">Có VAT</option>
                      <option value="no">Không VAT</option>
                    </select>
                  </Field>
                  <Field label="Thuế suất (%)">
                    <input
                      aria-label="Thuế suất VAT"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      disabled={!draft.vat}
                      value={draft.vatRate}
                      onChange={(e) => field("vatRate", e.target.value)}
                    />
                  </Field>
                </div>
                <small>
                  Đơn giá chưa VAT. Tiền thuế được cộng thêm và làm tròn đến đồng. Kiểm tra thuế
                  suất trước khi in.
                </small>
              </div>
            </details>
            <details open>
              <summary>2. Sản phẩm trên bản in</summary>
              <div ref={lines}>
                {draft.items.map((item, i) => (
                  <div className="a-print-line" key={item.id}>
                    <header>
                      <strong>Dòng {i + 1}</strong>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Xóa dòng ${i + 1}`}
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            items: d.items.filter((v) => v.id !== item.id),
                          }))
                        }
                      >
                        Xóa
                      </Button>
                    </header>
                    <Field label="Mã hàng">
                      <input
                        aria-label={`Mã hàng dòng ${i + 1}`}
                        value={item.code}
                        maxLength={100}
                        onChange={(e) => line(item.id, "code", e.target.value)}
                      />
                    </Field>
                    <Field label="Sản phẩm">
                      <input
                        aria-label={`Sản phẩm dòng ${i + 1}`}
                        value={item.name}
                        maxLength={500}
                        onChange={(e) => line(item.id, "name", e.target.value)}
                      />
                    </Field>
                    <div className="a-print-pair">
                      <Field label="Đơn vị">
                        <input
                          aria-label={`Đơn vị dòng ${i + 1}`}
                          value={item.unit}
                          maxLength={50}
                          onChange={(e) => line(item.id, "unit", e.target.value)}
                        />
                      </Field>
                      <Field label="Số lượng">
                        <input
                          aria-label={`Số lượng dòng ${i + 1}`}
                          type="number"
                          min="1"
                          step="1"
                          value={item.quantity}
                          onChange={(e) => line(item.id, "quantity", e.target.value)}
                        />
                      </Field>
                    </div>
                    <Field label="Đơn giá chưa VAT (VND)">
                      <input
                        aria-label={`Đơn giá dòng ${i + 1}`}
                        type="number"
                        min="0"
                        step="1"
                        value={item.price}
                        onChange={(e) => line(item.id, "price", e.target.value)}
                      />
                    </Field>
                  </div>
                ))}
              </div>
              <Button
                disabled={draft.items.length >= 100}
                onClick={() => {
                  focusNew.current = true;
                  setDraft((d) => ({
                    ...d,
                    items: [
                      ...d.items,
                      {
                        id: crypto.randomUUID(),
                        productId: "",
                        code: "",
                        name: "",
                        unit: "cuốn",
                        quantity: 1,
                        price: 0,
                      },
                    ],
                  }));
                }}
              >
                Thêm dòng sản phẩm
              </Button>
            </details>
            <details>
              <summary>3. Đơn vị giao hàng</summary>
              <div className="a-print-inputs">
                {text("Tên công ty", "company")}
                {text("Địa chỉ công ty", "companyAddress", true)}
                {text("Số điện thoại", "phone")}
                {text("Tiêu đề phiếu", "title")}
              </div>
            </details>
            <details>
              <summary>4. Ký nhận</summary>
              <div className="a-print-inputs">
                {text("Chức danh bên nhận", "receiverRole")}
                {text("Tên người nhận (nếu cần)", "receiverName")}
                {text("Chức danh bên lập phiếu", "issuerRole")}
                {text("Tên người lập phiếu (nếu cần)", "issuerName")}
                {text("Hướng dẫn ký tên", "signatureHint")}
              </div>
            </details>
          </aside>
        )}
        <section className="a-print-preview" ref={preview} aria-label="Xem trước bản in">
          <p className="a-print-note">
            A4 dọc · Chọn tỷ lệ 100%, tắt đầu/chân trang khi in. Bật đồ họa nền để giữ màu bảng.
          </p>
          {(result.error || printError) && (
            <p className="a-banner a-error" role="alert">
              {result.error || printError}
            </p>
          )}
          {result.html && (
            <div className="a-print-paper" style={{ width: 794 * scale, height: height * scale }}>
              <iframe
                key={result.html}
                ref={frame}
                title="Phiếu giao hàng xem trước"
                sandbox="allow-same-origin allow-modals"
                srcDoc={result.html}
                style={{ width: 794, height, transform: `scale(${scale})` }}
                onLoad={() => {
                  setHeight(
                    Math.max(
                      1155,
                      frame.current?.contentDocument?.documentElement.scrollHeight ?? 1155,
                    ),
                  );
                  setLoaded(result.html);
                }}
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
