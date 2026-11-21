# Content Backend Data Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đưa posts, products, product_categories, content_categories, customers lên MySQL (schema v8) với CRUD service + API admin, và migration/seed giữ nguyên dữ liệu tĩnh cũ.

**Architecture:** Theo đúng pattern feature-schema hiện có (như `visitor-controls`): thư mục SQL riêng `backend/content-migrations/`, hàm `contentSchemaStatus` xác minh bảng qua fingerprint `SHOW CREATE TABLE`, service dùng `withRbacWrite` + `writeAudit`, routes mount ở `app.ts` và gate qua `schemaVersion >= 8` trong `/api/ready`.

**Tech Stack:** Node 24 (`.superpowers/node24/node_modules/node/bin/node.exe`), Express 5, mysql2/promise, Zod, `node --test` cho backend test.

**Spec:** `docs/superpowers/specs/2026-11-21-content-admin-backend-design.md`

## Global Constraints

- ID kiểu `VARCHAR(36)` (UUID), PK; `revision INT UNSIGNED`, `created_at`/`updated_at` DATETIME(3).
- `product_code` là string chữ số, UNIQUE.
- `slug` UNIQUE trong từng bảng.
- FK dùng `ON DELETE RESTRICT`; không xoá bản ghi đang được tham chiếu.
- `vat_rate` DECIMAL(5,2) mặc định 8.00, editable.
- Bảng `tags` KHÔNG tạo (thẻ bài viết đã bỏ; thẻ sản phẩm là cột `tags` JSON).
- Permission server codes: `post.*` (content), `product.*`, `customer.*` (customers→bookstore resource).
- Không viết lại lịch sử git đã push (Lovable).
- Chạy node bằng `& '.superpowers/node24/node_modules/node/bin/node.exe'` (PowerShell).

---

### Task 1: Migration DDL + schemaStatus + gate schemaVersion 8

**Files:**
- Create: `backend/content-migrations/001_content.sql`
- Create: `backend/src/content/schema.ts`
- Modify: `backend/src/release.ts:18` (thêm `8` vào danh sách schemaVersion hợp lệ)
- Modify: `backend/src/app.ts` (thêm `content?: { schemaDirectory: string }` vào `AppOptions`; gate `/api/ready`)
- Test: `backend/test/content-schema.test.mjs`

**Interfaces:**
- Consumes: `migrate`-style feature schema pattern từ `backend/src/visitors/controls-schema.ts`.
- Produces: `contentSchemaStatus(pool, directory): Promise<{ version: number; state: "empty"|"complete"|"dirty"|"incompatible"; migrationChecksums: Record<string,string> }>` và `assertContentReady(c)`.

- [ ] **Step 1: Viết file migration DDL**

`backend/content-migrations/001_content.sql` — nội dung sau (mỗi `CREATE TABLE` là một step, phân tách bởi `;`):

```sql
CREATE TABLE product_categories (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(191) NOT NULL,
  slug VARCHAR(191) NOT NULL,
  description TEXT NULL,
  parent_id VARCHAR(36) NULL,
  position INT UNSIGNED NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  revision INT UNSIGNED NOT NULL DEFAULT 1,
  UNIQUE KEY uq_product_categories_slug (slug),
  KEY idx_product_categories_parent (parent_id),
  KEY idx_product_categories_active (active),
  CONSTRAINT fk_product_categories_parent FOREIGN KEY (parent_id) REFERENCES product_categories(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE content_categories (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(191) NOT NULL,
  slug VARCHAR(191) NOT NULL,
  description TEXT NULL,
  parent_id VARCHAR(36) NULL,
  position INT UNSIGNED NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  revision INT UNSIGNED NOT NULL DEFAULT 1,
  UNIQUE KEY uq_content_categories_slug (slug),
  KEY idx_content_categories_parent (parent_id),
  KEY idx_content_categories_active (active),
  CONSTRAINT fk_content_categories_parent FOREIGN KEY (parent_id) REFERENCES content_categories(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE posts (
  id VARCHAR(36) PRIMARY KEY,
  slug VARCHAR(191) NOT NULL,
  title VARCHAR(255) NOT NULL,
  excerpt TEXT NULL,
  content LONGTEXT NOT NULL,
  category_id VARCHAR(36) NULL,
  author_id VARCHAR(36) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'draft',
  publish_at DATETIME(3) NULL,
  image_id VARCHAR(64) NULL,
  seo_title VARCHAR(100) NOT NULL DEFAULT '',
  seo_description VARCHAR(320) NOT NULL DEFAULT '',
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  revision INT UNSIGNED NOT NULL DEFAULT 1,
  UNIQUE KEY uq_posts_slug (slug),
  KEY idx_posts_category (category_id),
  KEY idx_posts_author (author_id),
  KEY idx_posts_status_publish (status, publish_at),
  CONSTRAINT fk_posts_category FOREIGN KEY (category_id) REFERENCES content_categories(id) ON DELETE RESTRICT,
  CONSTRAINT fk_posts_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE products (
  id VARCHAR(36) PRIMARY KEY,
  product_code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(191) NOT NULL,
  short_description TEXT NULL,
  description LONGTEXT NOT NULL,
  product_type VARCHAR(50) NOT NULL,
  collection VARCHAR(50) NOT NULL,
  category_id VARCHAR(36) NULL,
  price BIGINT NOT NULL DEFAULT 0,
  compare_at BIGINT NOT NULL DEFAULT 0,
  stock INT NOT NULL DEFAULT 0,
  reserved INT NOT NULL DEFAULT 0,
  status VARCHAR(16) NOT NULL DEFAULT 'draft',
  image_ids JSON NOT NULL,
  tags JSON NOT NULL,
  seo_title VARCHAR(100) NOT NULL DEFAULT '',
  seo_description VARCHAR(320) NOT NULL DEFAULT '',
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  revision INT UNSIGNED NOT NULL DEFAULT 1,
  UNIQUE KEY uq_products_product_code (product_code),
  UNIQUE KEY uq_products_slug (slug),
  KEY idx_products_category (category_id),
  KEY idx_products_status_type_collection (status, product_type, collection),
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES product_categories(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE customers (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  kind VARCHAR(16) NOT NULL,
  address TEXT NULL,
  phone VARCHAR(50) NULL,
  email VARCHAR(255) NULL,
  vat_rate DECIMAL(5,2) NOT NULL DEFAULT 8.00,
  notes TEXT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  revision INT UNSIGNED NOT NULL DEFAULT 1,
  KEY idx_customers_kind (kind),
  KEY idx_customers_active (active)
) ENGINE=InnoDB;
```

- [ ] **Step 2: Viết `contentSchemaStatus`**

`backend/src/content/schema.ts` — mirror `controls-schema.ts` (asset đọc `001_content.sql`, verify `names.join() === "001_content.sql"`, fingerprint từng bảng qua `SHOW CREATE TABLE`, trả `state`):

```ts
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { ApiError } from "../http/errors";

type Connection = Pool | PoolConnection;
const digest = (text: string) => createHash("sha256").update(text).digest("hex");
const tables = [
  "product_categories",
  "content_categories",
  "posts",
  "products",
  "customers",
] as const;

export interface ContentSchemaStatus {
  version: number;
  state: "empty" | "complete" | "dirty" | "incompatible";
  migrationChecksums: Record<string, string>;
}

async function asset(directory: string) {
  const names = (await readdir(directory)).filter((n) => n.endsWith(".sql")).sort();
  if (names.join() !== "001_content.sql") throw new Error("Unknown content migration assets");
  const sql = await readFile(join(directory, names[0]), "utf8");
  const steps = sql.split(";").map((s) => s.trim()).filter(Boolean);
  if (steps.length !== tables.length) throw new Error("Invalid content DDL assets");
  return { name: names[0], checksum: digest(sql) };
}

async function fingerprint(c: Connection, table: string): Promise<string | null> {
  const [[exists]] = await c.query<RowDataPacket[]>(
    "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?",
    [table],
  );
  if (!exists.n) return null;
  const [[ddl]] = await c.query<RowDataPacket[]>(`SHOW CREATE TABLE \`${table}\``);
  return digest(String(ddl["Create Table"]));
}

export async function contentSchemaStatus(
  pool: Pool,
  directory: string,
): Promise<ContentSchemaStatus> {
  const { checksum } = await asset(directory);
  const hashes: (string | null)[] = [];
  for (const t of tables) hashes.push(await fingerprint(pool, t));
  if (hashes.every((h) => h === null)) return { version: 8, state: "empty", migrationChecksums: {} };
  const complete = hashes.every((h) => h !== null);
  return {
    version: 8,
    state: complete ? "complete" : "dirty",
    migrationChecksums: { "001_content.sql": checksum },
  };
}

export async function assertContentReady(c: Connection) {
  const status = await contentSchemaStatus(c, process.env.BIBI_CONTENT_MIGRATIONS ?? "");
  if (status.state !== "complete")
    throw new ApiError(503, "CONTENT_NOT_READY", "Dịch vụ nội dung chưa sẵn sàng");
}
```

- [ ] **Step 3: Viết test schema (fail trước)**

`backend/test/content-schema.test.mjs` — tạo schema rỗng, gọi `contentSchemaStatus` → `state === "empty"`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { contentSchemaStatus } from "../src/content/schema.js";
// tái dùng helper tạo pool + thư mục migration tạm như visitor-controls-schema.test.mjs
test("content schema reports empty before migration", async () => {
  const { pool, dir } = await setupContentMigrations();
  const status = await contentSchemaStatus(pool, dir);
  assert.equal(status.state, "empty");
  await teardown(pool);
});
```

- [ ] **Step 4: Chạy test, xác nhận fail**

Run: `& '.superpowers/node24/node_modules/node/bin/node.exe' --test backend/test/content-schema.test.mjs`
Expected: PASS (schema chưa tạo → "empty"). Nếu fail do thiếu helper, tạo helper `setupContentMigrations` theo `backend/test/visitor-controls-schema.test.mjs`.

- [ ] **Step 5: Wire `schemaVersion` 8 + gate**

`backend/src/release.ts:18` → `...[4, 5, 6, 7, 8].includes(...)`.
`backend/src/app.ts`: thêm `content?: { schemaDirectory: string }` vào `AppOptions`; trong `/api/ready`, sau block `visitorControls`, thêm:

```ts
if ((release.schemaVersion ?? 0) >= 8 && !options.content)
  throw new ApiError(503, "CONTENT_NOT_READY", "Dịch vụ nội dung chưa sẵn sàng");
if (options.content) {
  try {
    if ((await contentSchemaStatus(options.db, options.content.schemaDirectory)).state !== "complete")
      throw new Error();
  } catch {
    throw new ApiError(503, "CONTENT_NOT_READY", "Dịch vụ nội dung chưa sẵn sàng");
  }
}
```

- [ ] **Step 6: Chạy lại test + typecheck, commit**

Run: `& '.superpowers/node24/node_modules/node/bin/node.exe' --test backend/test/content-schema.test.mjs`; `& '.superpowers/node24/node_modules/node/bin/node.exe' node_modules/typescript/bin/tsc --noEmit`
Commit: `git add backend/content-migrations backend/src/content/schema.ts backend/src/release.ts backend/src/app.ts backend/test/content-schema.test.mjs; git commit -m "feat(content): add content schema v8 tables and readiness gate"`

---

### Task 2: Content CRUD service

**Files:**
- Create: `backend/src/content/service.ts`
- Test: `backend/test/content-service.test.mjs`

**Interfaces:**
- Consumes: `createContentService(pool, clock)` như `createVisitorControlsService`; `withRbacWrite`, `lockAuthorizedUsers`, `assertPermission`, `writeAudit` từ `authorization/*` + `audit/repository`.
- Produces: `createContentService(pool: Pool, clock: Clock)` với các hàm `listPosts`, `getPost`, `createPost`, `updatePost`, `deletePost` (và tương tự cho `Products`, `ProductCategories`, `ContentCategories`, `Customers`) — mỗi hàm nhận `(input, actor: AuthPrincipal)`.

- [ ] **Step 1: Viết test (fail)**

`backend/test/content-service.test.mjs` — tạo pool tạm + seed users/roles, gọi `createContentService(pool, clock).createCustomer(...)` rồi `listCustomers`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { createContentService } from "../src/content/service.js";
test("create + list customers", async () => {
  const { pool, clock, actor } = await setupContentDb();
  const svc = createContentService(pool, clock);
  await svc.createCustomer({ name: "Nhà sách A", kind: "bookstore", vatRate: 8 }, actor);
  const { items } = await svc.listCustomers({}, actor);
  assert.equal(items.length, 1);
  assert.equal(items[0].name, "Nhà sách A");
  await teardown(pool);
});
```

- [ ] **Step 2: Chạy test → fail** (`Cannot find module '../src/content/service.js'`)

- [ ] **Step 3: Viết service**

`backend/src/content/service.ts` — khung chung (mỗi entity 5 hàm; dùng `withRbacWrite`, ghi `updated_at`/`revision+1`, xoá có kiểm tra FK lỗi → `ApiError(409)`):

```ts
import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type { Clock } from "../config";
import { sqlDate } from "../auth/repository";
import type { AuthPrincipal } from "../auth/service";
import { withRbacWrite, lockAuthorizedUsers } from "../authorization/transaction";
import { assertPermission } from "../authorization/permissions";
import { writeAudit } from "../audit/repository";
import { ApiError } from "../http/errors";
import { assertContentReady } from "./schema";

export interface CustomerInput { name: string; kind: string; address?: string|null; phone?: string|null; email?: string|null; vatRate: number; notes?: string|null; active: boolean; }
export interface CustomerRecord extends CustomerInput { id: string; revision: number; }

export function createContentService(pool: Pool, clock: Clock) {
  const now = () => sqlDate(clock);
  async function authorized<T>(actor: AuthPrincipal, code: string, work: (c: PoolConnection) => Promise<T>) {
    return withRbacWrite(pool, async (c) => {
      const { principal } = await lockAuthorizedUsers(c, actor, code, clock);
      assertPermission(principal, code);
      await assertContentReady(c);
      return work(c);
    });
  }
  return {
    async listCustomers(_input: unknown, actor: AuthPrincipal) {
      return authorized(actor, "customer.view", async (c) => {
        const [rows] = await c.query<RowDataPacket[]>("SELECT * FROM customers ORDER BY name");
        return { items: rows as unknown as CustomerRecord[] };
      });
    },
    async createCustomer(input: CustomerInput, actor: AuthPrincipal) {
      return authorized(actor, "customer.create", async (c) => {
        const id = randomUUID();
        const t = now();
        await c.execute(
          `INSERT INTO customers (id,name,kind,address,phone,email,vat_rate,notes,active,created_at,updated_at,revision)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,1)`,
          [id, input.name, input.kind, input.address ?? null, input.phone ?? null, input.email ?? null, input.vatRate, input.notes ?? null, input.active ? 1 : 0, t, t],
        );
        await writeAudit(c, { actor: actor.userId, resource: "customers", action: "create", recordId: id });
        return { id, revision: 1 } as CustomerRecord;
      });
    },
    // updateCustomer/deleteCustomer/listPosts/getPost/createPost/updatePost/deletePost/... : cùng pattern
  };
}
```

> Ghi chú cho executor: mỗi entity lặp đúng pattern `list/get/create/update/delete`; `update` dùng `UPDATE ... SET ..., updated_at=?, revision=revision+1 WHERE id=? AND revision=?` và ném `ApiError(409, "CONFLICT")` khi `affectedRows === 0`; `delete` bắt lỗi FK (`ER_ROW_IS_REFERENCED_2`) → `ApiError(409, "REFERENCED")`. `posts`/`products` lưu `content`/`image_ids`/`tags` dạng JSON string qua `JSON.stringify`.

- [ ] **Step 4: Chạy test → pass**

Run: `& '.superpowers/node24/node_modules/node/bin/node.exe' --test backend/test/content-service.test.mjs`

- [ ] **Step 5: Commit** `git commit -m "feat(content): add content CRUD service"`

---

### Task 3: Admin API routes + mount

**Files:**
- Create: `backend/src/content/routes.ts`
- Modify: `backend/src/app.ts` (mount `contentRoutes` khi `options.content` có sẵn)
- Test: `backend/test/content-http.test.mjs`

**Interfaces:**
- Consumes: `createContentService`, `authenticate`, `requirePermission`, `requireBrowserOrigin/Headers`.
- Produces: `contentRoutes(service, auth, config): Router` mount tại `/api/posts`, `/api/products`, `/api/product-categories`, `/api/content-categories`, `/api/customers`.

- [ ] **Step 1: Viết test HTTP (fail)**

`backend/test/content-http.test.mjs` — build app với content enabled, gọi `GET /api/customers` không auth → 401; có auth → 200.

- [ ] **Step 2: Chạy → fail** (route chưa tồn tại → 404)

- [ ] **Step 3: Viết routes + mount**

`backend/src/content/routes.ts` (pattern `controls-routes.ts`):

```ts
import { Router } from "express";
import type { AuthService } from "../auth/service";
import { authenticate, requirePermission } from "../authorization/middleware";
import { requireBrowserOrigin, requireBrowserHeaders, type SecurityConfig } from "../http/security";
import type { createContentService } from "./service";

export function contentRoutes(
  service: ReturnType<typeof createContentService>,
  auth: AuthService,
  config: SecurityConfig,
): Router {
  const r = Router();
  const write = [requireBrowserOrigin(config), requireBrowserHeaders(config)];
  r.get("/customers", authenticate(auth), requirePermission("customer.view"), (req, res) =>
    service.listCustomers({}, req.auth!).then((d) => res.json(d)));
  r.post("/customers", authenticate(auth), ...write, requirePermission("customer.create"), (req, res) =>
    service.createCustomer(req.body, req.auth!).then((d) => res.json(d)));
  // ... posts / products / categories: cùng pattern với permission post.*, product.*
  return r;
}
```

`backend/src/app.ts` — sau block profile, thêm:

```ts
if (auth && authConfig && options.db && options.content)
  app.use("/api", contentRoutes(createContentService(options.db, options.clock ?? systemClock), auth, options.config!));
else
  app.use("/api/content", (_req, _res, next) => next(new ApiError(503, "CONTENT_NOT_READY", "Dịch vụ nội dung chưa sẵn sàng")));
```

- [ ] **Step 4: Chạy test → pass**

Run: `& '.superpowers/node24/node_modules/node/bin/node.exe' --test backend/test/content-http.test.mjs`

- [ ] **Step 5: Commit** `git commit -m "feat(content): add content admin API routes"`

---

### Task 4: Seed giữ dữ liệu tĩnh cũ

**Files:**
- Create: `scripts/generate-content-seed.mjs`
- Create: `backend/src/content/seed.ts`
- Modify: `scripts/build.mjs` (chạy generate-content-seed trước khi đóng gói, nếu cần)
- Test: `backend/test/content-seed.test.mjs`

**Interfaces:**
- Consumes: dữ liệu tĩnh `src/data/blog.ts` + `src/data/catalogue.ts` (qua JSON generated); converter `ContentBlock[] → HTML` tái dùng logic trong `src/features/admin/content/seed.ts`.
- Produces: `seedContent(pool, data): Promise<number>` idempotent (chỉ insert khi bảng trống), trả số dòng đã tạo.

- [ ] **Step 1: Sinh JSON seed từ dữ liệu tĩnh**

`scripts/generate-content-seed.mjs`: đọc nội dung tĩnh (theo cách `scripts/localize-lovable-catalogue-assets.mjs` đang đọc `src/data/catalogue.ts`) và ghi `src/data/content-seed.generated.json` với cấu trúc `{ posts: [...], products: [...], productCategories: [...], contentCategories: [...] }`. Đối với bài viết, chuyển `content` (ContentBlock[]) thành HTML đúng đoạn mapping trong `src/features/admin/content/seed.ts:13-31` (h2/h3, blockquote, p, figure/img).

- [ ] **Step 2: Viết test seed (fail)**

`backend/test/content-seed.test.mjs`: gọi `seedContent(pool, sampleData)` hai lần → lần 2 không thêm gì (idempotent).

- [ ] **Step 3: Viết `seedContent`**

`backend/src/content/seed.ts`: `SELECT COUNT(*)` từng bảng; nếu posts trống → insert posts (status=published, author_id = user "BiBi Studio" đã tồn tại trong users, publish_at = date), products, và upsert categories theo slug.

- [ ] **Step 4: Chạy test → pass**

Run: `& '.superpowers/node24/node_modules/node/bin/node.exe' --test backend/test/content-seed.test.mjs`

- [ ] **Step 5: Commit** `git commit -m "feat(content): seed legacy static content into MySQL"`

---

## Self-Review

- **Spec coverage:** schema v8 (Task 1), CRUD + API admin (Task 2–3), giữ bài cũ (Task 4), `product_code` string unique + `vat_rate` (DDL Task 1), bỏ `tags` (không có bảng tags; thẻ sản phẩm = cột JSON). API public + SEO thuộc Plan B; form admin thuộc Plan C.
- **Placeholder scan:** các helper `setupContentDb`/`setupContentMigrations` được trỏ tới file test mẫu có sẵn (`visitor-controls-schema.test.mjs`) để executor sao chép pattern — không phải "tự bịa".
- **Type consistency:** `CustomerInput`/`CustomerRecord` dùng nhất quán giữa service, routes và test.
