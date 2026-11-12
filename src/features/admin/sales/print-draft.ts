import type { PurchaseSlip } from "../services/contracts";
import { ServiceError } from "../services/errors";
import { calendarDate } from "../shared/lib/text";

/** Replace these read methods with API calls when business data moves to MySQL. */
export interface SlipPrintSource {
  customer: (id: string) => Promise<{ name: string; address: string } | null | undefined>;
  product: (id: string) => Promise<{ name: string; sku: string } | null | undefined>;
}
export interface PrintLine {
  id: string;
  productId: string;
  code: string;
  name: string;
  unit: string;
  quantity: number | string;
  price: number | string;
}
export interface PrintDraft {
  company: string;
  companyAddress: string;
  phone: string;
  title: string;
  customer: string;
  customerAddress: string;
  date: string;
  number: string;
  vat: boolean;
  vatRate: string;
  receiverRole: string;
  receiverName: string;
  issuerRole: string;
  issuerName: string;
  signatureHint: string;
  items: PrintLine[];
}
async function related<T>(read: () => Promise<T>): Promise<T | undefined> {
  try {
    return await read();
  } catch (error) {
    if (error instanceof ServiceError && ["not-found", "forbidden"].includes(error.code))
      return undefined;
    throw error;
  }
}
export async function loadPrintDraft(slip: PurchaseSlip, source: SlipPrintSource) {
  const warnings: string[] = [];
  const customer = await related(() => source.customer(slip.customerId));
  if (!customer)
    warnings.push("Khách hàng liên kết không khả dụng; dùng thông tin đã lưu trên phiếu.");
  const items = await Promise.all(
    slip.items.map(async (line) => {
      const product = await related(() => source.product(line.productId));
      if (!product)
        warnings.push(`Sản phẩm ${line.sku} không khả dụng; dùng thông tin đã lưu trên phiếu.`);
      return {
        id: line.lineId,
        productId: line.productId,
        code: product?.sku ?? line.sku,
        name: product?.name ?? line.name,
        unit: "cuốn",
        quantity: line.quantity,
        price: line.unitPrice,
      };
    }),
  );
  const draft: PrintDraft = {
    company: "Công Ty TNHH BI DIARY HANDMADE",
    companyAddress:
      "984/10 quốc lộ 1A, KP. 5, P. Linh Trung, Thành phố Thủ Đức, Thành phố Hồ Chí Minh",
    phone: "0392969000",
    title: "PHIẾU GIAO HÀNG",
    customer: customer?.name ?? slip.customerSnapshot.name,
    customerAddress: customer?.address ?? slip.customerSnapshot.address,
    date: calendarDate(slip.createdAt),
    number: slip.number,
    vat: slip.vatApplied,
    vatRate: "8",
    receiverRole: "Người nhận hàng",
    receiverName: "",
    issuerRole: "Người lập phiếu",
    issuerName: "",
    signatureHint: "Ký và ghi rõ họ tên",
    items,
  };
  return { draft, warnings };
}
function invalid(message: string): never {
  throw new ServiceError("validation", message);
}
const max = BigInt(Number.MAX_SAFE_INTEGER);
export function calculatePrintTotals(draft: PrintDraft) {
  if (!draft.customer.trim() || !draft.company.trim() || !draft.title.trim())
    invalid("Nhập tên khách hàng, đơn vị giao hàng và tiêu đề phiếu.");
  const date = new Date(draft.date + "T00:00:00Z");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(draft.date) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== draft.date
  )
    invalid("Chọn ngày trên phiếu hợp lệ.");
  if (!draft.items.length || draft.items.length > 100)
    invalid("Bản in cần từ 1 đến 100 dòng sản phẩm.");
  let subtotal = 0n;
  for (const item of draft.items) {
    if (!item.name.trim() || !item.unit.trim()) invalid("Nhập tên và đơn vị của từng sản phẩm.");
    const quantity = Number(item.quantity),
      price = Number(item.price);
    if (
      String(item.quantity).trim() === "" ||
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      String(item.price).trim() === "" ||
      !Number.isSafeInteger(price) ||
      price < 0
    )
      invalid("Số lượng phải nguyên dương; đơn giá là số VND nguyên không âm.");
    subtotal += BigInt(quantity) * BigInt(price);
    if (subtotal > max) invalid("Tổng tiền vượt giới hạn số an toàn.");
  }
  let tax = 0n;
  if (draft.vat) {
    if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(draft.vatRate) || Number(draft.vatRate) > 100)
      invalid("Thuế suất phải từ 0 đến 100%, tối đa 2 chữ số thập phân.");
    const basisPoints = BigInt(Math.round(Number(draft.vatRate) * 100));
    tax = (subtotal * basisPoints + 5000n) / 10000n;
  }
  if (subtotal + tax > max) invalid("Tổng tiền gồm VAT vượt giới hạn số an toàn.");
  return { subtotal: Number(subtotal), tax: Number(tax), total: Number(subtotal + tax) };
}
const digits = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
function triple(n: number, force: boolean) {
  const a = Math.floor(n / 100),
    b = Math.floor(n / 10) % 10,
    c = n % 10;
  const words: string[] = [];
  if (a || force) words.push(digits[a], "trăm");
  if (b > 1) words.push(digits[b], "mươi");
  else if (b === 1) words.push("mười");
  else if (c && (a || force)) words.push("lẻ");
  if (c) words.push(c === 1 && b > 1 ? "mốt" : c === 5 && b > 0 ? "lăm" : digits[c]);
  return words.join(" ");
}
export function amountInWords(n: number) {
  if (!Number.isSafeInteger(n) || n < 0) invalid("Số tiền không hợp lệ.");
  if (!n) return "Không đồng";
  const units = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"],
    chunks: number[] = [];
  while (n) {
    chunks.push(n % 1000);
    n = Math.floor(n / 1000);
  }
  const words: string[] = [];
  for (let i = chunks.length - 1; i >= 0; i--)
    if (chunks[i]) words.push(triple(chunks[i], words.length > 0 && chunks[i] < 100), units[i]);
  const result = words.filter(Boolean).join(" ");
  return result.charAt(0).toUpperCase() + result.slice(1) + " đồng";
}
