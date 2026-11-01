export interface BaseRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
}
export interface NamedRecord extends BaseRecord {
  name: string;
  description?: string;
}
export interface Customer extends NamedRecord {
  kind: "bookstore" | "individual" | "company";
  address: string;
  vatApplied: boolean;
  notes: string;
  active: boolean;
  phone?: string;
  email?: string;
}
export interface SlipItem {
  lineId: string;
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
}
export interface PurchaseSlip extends BaseRecord {
  number: string;
  customerId: string;
  customerSnapshot: Pick<Customer, "name" | "address" | "kind">;
  vatApplied: boolean;
  items: SlipItem[];
  total: number;
  notes: string;
  status: "saved" | "void";
  voidedAt: string | null;
  voidReason: string;
}
export interface NotificationRead extends BaseRecord {
  userId: string;
  notificationId: string;
  readAt: string;
}
export interface CatalogueRecord extends NamedRecord {
  slug: string;
  price: number;
  stock: number;
  reserved: number;
  status: "draft" | "published" | "hidden";
  imageIds: string[];
  tags: string[];
  seoTitle: string;
  seoDescription: string;
}
export interface AdminProduct extends CatalogueRecord {
  sku: string;
  productType: string;
  collection: string;
  categoryId: string;
  shortDescription: string;
  compareAt: number;
}
export interface AdminBook extends CatalogueRecord {
  isbn: string;
  authorIds: string[];
  publisherId: string;
  genreIds: string[];
  year: number;
  language: string;
}
export interface Category extends NamedRecord {
  parentId: string | null;
  kind: "product" | "content" | "genre";
  slug: string;
  position: number;
  active: boolean;
}
export interface Author extends NamedRecord {
  nationality?: string;
  birthDate?: string;
}
export interface Publisher extends NamedRecord {
  country?: string;
  email?: string;
}
export type Action = "view" | "create" | "update" | "delete" | "export" | "settings";
export type Resource =
  | "dashboard"
  | "analytics"
  | "products"
  | "bookstore"
  | "sales"
  | "content"
  | "accounts"
  | "audit"
  | "notifications"
  | "settings"
  | "components";
export interface Role extends NamedRecord {
  permissions: Partial<Record<Resource, Action[]>>;
}
export interface AdminUser extends NamedRecord {
  email: string;
  roleId: string;
  active: boolean;
  lastLogin: string | null;
}
export interface Post extends BaseRecord {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  categoryId: string;
  tagIds: string[];
  authorId: string;
  status: "draft" | "published";
  publishAt: string | null;
  imageId: string | null;
  seoTitle: string;
  seoDescription: string;
}
export type OrderStatus =
  "Pending" | "Confirmed" | "Processing" | "Shipped" | "Delivered" | "Cancelled" | "Refunded";
export type PaymentStatus = "Pending" | "Paid" | "Failed" | "Refunded";
export interface OrderItem {
  entity: "products" | "books";
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
}
export interface Order extends BaseRecord {
  visitorId?: string;
  number: string;
  customer: { name: string; email: string; address: string };
  items: OrderItem[];
  discount: number;
  shipping: number;
  total: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  notes: string;
  timeline: { status: OrderStatus; at: string }[];
}
export interface Payment extends BaseRecord {
  orderId: string;
  amount: number;
  status: PaymentStatus;
  method: string;
}
export interface StockEvent extends BaseRecord {
  entity: "products" | "books";
  entityId: string;
  delta: number;
  reason: string;
  balance: number;
  orderId?: string;
}
export interface Visitor extends BaseRecord {
  anonymousId: string;
  ipAddress: string;
  country: string;
  city: string;
  deviceType: string;
  browser: string;
  operatingSystem: string;
  firstSeenAt: string;
  lastSeenAt: string;
  sessionCount: number;
  pageViewCount: number;
}
export interface VisitorSession extends BaseRecord {
  visitorId: string;
  startedAt: string;
  endedAt: string | null;
  landingPage: string;
  exitPage: string;
  referrer: string;
  pages: { path: string; at: string }[];
}
export interface MediaAsset extends BaseRecord {
  name: string;
  mime: string;
  size: number;
  width: number;
  height: number;
  blobKey: string;
  url?: string;
}
export interface AuditEvent extends BaseRecord {
  actor: string;
  resource: string;
  action: string;
  recordId: string;
  before: string;
  after: string;
}
export interface Notification extends NamedRecord {
  read: boolean;
  level: "info" | "success" | "warning";
  href: string;
}
export interface Setting extends BaseRecord {
  key: string;
  values: Record<string, string | number | boolean>;
}
export interface AdminModels {
  customers: Customer;
  purchaseSlips: PurchaseSlip;
  notificationReads: NotificationRead;
  products: AdminProduct;
  books: AdminBook;
  categories: Category;
  authors: Author;
  publishers: Publisher;
  roles: Role;
  users: AdminUser;
  posts: Post;
  tags: NamedRecord;
  orders: Order;
  payments: Payment;
  stock: StockEvent;
  visitors: Visitor;
  sessions: VisitorSession;
  media: MediaAsset;
  audit: AuditEvent;
  notifications: Notification;
  settings: Setting;
}
export type EntityKey = keyof AdminModels;
export const entityKeys: EntityKey[] = [
  "customers",
  "purchaseSlips",
  "notificationReads",
  "products",
  "books",
  "categories",
  "authors",
  "publishers",
  "roles",
  "users",
  "posts",
  "tags",
  "orders",
  "payments",
  "stock",
  "visitors",
  "sessions",
  "media",
  "audit",
  "notifications",
  "settings",
];
export type CreateInput<K extends EntityKey> = Omit<AdminModels[K], keyof BaseRecord>;
export interface ListInput<F = Record<string, string>> {
  page: number;
  pageSize: number;
  search?: string;
  filters?: F;
  sort?: { field: string; direction: "asc" | "desc" };
  signal?: AbortSignal;
}
export interface ListResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface DemoSession {
  userId: string;
  roleId: string;
}
export interface AdminTransaction {
  get<K extends EntityKey>(entity: K, id: string): Promise<AdminModels[K] | undefined>;
  list<K extends EntityKey>(entity: K): Promise<AdminModels[K][]>;
  put<K extends EntityKey>(entity: K, record: AdminModels[K]): Promise<void>;
  remove(entity: EntityKey, id: string): Promise<void>;
}
export interface AdminStore extends Pick<AdminTransaction, "get" | "list"> {
  readonly generation: number;
  invalidateOperations(): void;
  transaction<T>(entities: EntityKey[], work: (tx: AdminTransaction) => Promise<T>): Promise<T>;
  reset(): Promise<void>;
  close(): Promise<void>;
  destroy(): Promise<void>;
  getMeta(key: string): Promise<unknown>;
  setMeta(key: string, value: unknown): Promise<void>;
  putBlob(key: string, value: Blob): Promise<void>;
  getBlob(key: string): Promise<Blob | undefined>;
  removeBlob(key: string): Promise<void>;
  importMedia(records: { asset: MediaAsset; blob: Blob }[], actor?: string): Promise<void>;
}
export interface EntityService<K extends EntityKey> {
  export(input: ListInput): Promise<AdminModels[K][]>;
  bulk(
    action: { type: "delete" } | { type: "update"; values: Partial<CreateInput<K>> },
    records: { id: string; revision: number }[],
  ): Promise<{ updated: number; failures: { id: string; message: string }[] }>;
  list(input: ListInput): Promise<ListResult<AdminModels[K]>>;
  get(id: string, signal?: AbortSignal): Promise<AdminModels[K]>;
  create(input: CreateInput<K>): Promise<AdminModels[K]>;
  update(id: string, input: Partial<CreateInput<K>>, revision: number): Promise<AdminModels[K]>;
  remove(id: string, revision: number): Promise<void>;
}
