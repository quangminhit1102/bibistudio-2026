# BiBi Studio Content CMS and SEO HTML Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triển khai Bài viết và Danh mục dùng chung trên server, tạo HTML public khi xuất bản, với SEO/ảnh/URL đúng và phục hồi được khi xuất bản hoặc deploy lỗi.

**Architecture:** Giữ React/TanStack/TinyMCE cho admin, thêm content feature trong Express/MariaDB. Publisher tạo immutable generation; atomic active pointer là mốc công khai, stable PHP reader chỉ phục vụ HTML/media đã tạo. Working draft độc lập với public snapshot; mọi public JSON, sitemap và analytics whitelist đọc cùng active generation.

**Tech Stack:** TypeScript, Express5/CommonJS, MariaDB, Node24, TinyMCE hiện có; DOMPurify + jsdom cho sanitizer Node, sharp cho JPEG/PNG/WebP sau compatibility gate; PHP8.3, Node test runner, Vitest và Playwright.

**Spec:** `docs/superpowers/specs/2026-11-14-content-cms-seo-design.md` — chủ website đã duyệt toàn bộ và xác nhận giữ tối đa3cấp danh mục trong chat ngày14/11/2026.

## Global Constraints

- Source bắt đầu từ linked checkout `C:/Users/Admin/.codex/worktrees/fullstack-cicd/bibistudio-2026`, design commit `7eec54e`; không lấy source cũ/chưa commit ở checkout D: hoặc ghi đè công việc đó. Xác minh HEAD/status/worktree lại trước khi thực thi; dùng using-git-worktrees ở thời điểm execution, không tự restart từ branch cũ.
- Chỉ viết plan ở bước này; implementation bắt đầu sau handoff/review và phương thức thực thi được chọn. Không coi duyệt thiết kế là quyền thay hosting hoặc mở thêm credential.
- Node major24 ở local/CI/hosting; chọn đúng executable nếu shell mặc định Node25. Commands trong plan giả định PATH đã chọn Node24 và cwd là implementation worktree.
- Ba lệnh hằng ngày giữ nguyên: `npm run dev`, `npm run check`, `npm run build`; setup có chủ đích vẫn `npm run db:setup:local`. Không thêm cron/daemon người dùng phải tự quản lý để publisher hoạt động.
- Một bài một danh mục chính; content hierarchy tối đa3cấp. Product category/type/collection và nghiệp vụ local khác không đổi. Author account tối thiểu hoặc thương hiệu BiBi Studio; tối đa10tags; không tag public/author manager mới.
- Nháp không sửa public, không tự lưu nền, không scheduler/Chờ duyệt. Trash/restore giữ nội dung; không hard delete/TTL/prune media/generation ở v1. Không tự import IndexedDB của người dùng.
- title/SEO title300ký tự; excerpt/description1000; sanitized body256KiB; non-media mutation body512KiB; JPEG/PNG/WebP5MiB,16MP, output master≤2400px. Request media JSON chỉ route riêng, decoded bytes≤5242880, base64≤6990508 và JSON envelope≤6991532byte.
- Public origin `https://bibistudio.vn`,9bài/trang, HTML hoàn chỉnh không chạy `src/main.tsx/createRoot`, card ảnh vuông và article cover3:2. Preview/local noindex; không chặn JS/CSS để làm SEO.
- Public PHP reader không nạp DB credential, không chạy nội dung upload và không render riêng theo Googlebot. `/api`, `/node-test`, `.well-known`, `/assets`, relay IP/auth và website khác giữ nguyên.
- Giữ budget managed4GiB, kiểm quota tài khoản/headroom thực; không suy ra quota từ disk free toàn máy, không tăng quota hoặc xóa dữ liệu để pass. Content root là `<deploy-root>/content/`, ngoài app releases/webroot.
- Atomic pointer là public source of truth; không báo publication success chỉ vì DB committed. Cùng thứ tự environment lock → RBAC authorization/DB transaction ngắn; media commit, publication, backup và deploy không chạy chéo mất consistency.
- Không sửa checksum migration cũ, không down-migrate/restore đè DB live, không rewrite/force push history Lovable. Scope mỗi commit rõ; source được review trước khi push implementation.
- Nghiệm thu SEO là HTTP HTML/status/canonical/sitemap/schema và nguồn Search Console quan sát được; không hứa ngày index hoặc thứ hạng.

## Review Focus

1. Sửa bài lúc job đang chờ, retry sau mất mạng hoặc thu hồi role trong lúc render: chỉ revision/quyền còn hợp lệ được đăng; không ghi đè job/bài khác (Task7, Task9).
2. Pointer đã đổi nhưng process chết trước canary/DB finalize, hoặc hai request đang đọc khi đổi pointer: mỗi response thuộc một generation đầy đủ, recovery không báo success giả (Task7, Task8).
3. Media vừa upload đúng lúc native backup bắt đầu, hoặc URL ảnh đã từng public còn nằm ở tab/backup cũ: không thiếu file trong restore và không lộ ảnh chưa từng public (Task3, Task12).
4. Đổi slug nhiều lần, danh mục reparent/ẩn/gỡ bài và người dùng đi qua link trong CSR/tab cũ: không có loop/soft404/static ghost post hay tracking URL tùy ý (Task4, Task8, Task10).
5. App rollback về code chưa biết CMS trong khi content đã được đăng sau deploy: không quay về Blog static/IndexedDB hoặc mất public assets; phải có baseline bridge tương thích và chặn target không tương thích (Task12, Task14).

---

## File structure và thứ tự

Một plan vì editing/media/publishing/public reader dùng chung snapshot, revision, media registry và backup; không thể phát hành độc lập an toàn. Chia thành ba đợt nội bộ: Tasks1–5 nền tảng CMS;6–10 publication/public/admin;11–14 local/release/acceptance. Không bật feature production ở giữa.

| Vị trí                                                                                                                                                                                                                         | Trách nhiệm                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `backend/src/content/{contracts,limits,validation,rich-policy,sanitize,schema,cli}.ts`, `backend/content-migrations/001_content.sql`                                                                                           | Contract thuần, kiểm dữ liệu/sanitize, feature migration/status                              |
| `backend/src/content/{repository,editing,categories,lookups,routes,capabilities,seed}.ts`                                                                                                                                      | Working draft/categories, revisions, lookup tối thiểu, HTTP/auth, seed idempotent            |
| `backend/src/content/media/{codec,worker,store,service,routes}.ts`                                                                                                                                                             | Decode giới hạn, private files, variants, upload/preview/pins                                |
| `backend/src/content/publication/{jobs,store,planner,publisher,worker,cli,active-read}.ts`                                                                                                                                     | Durable job, snapshot, generation lifecycle, worker wakeup/recovery/public reads             |
| `backend/src/content/render/{document,posts,categories,seo,routes,sitemap}.ts`                                                                                                                                                 | Full HTML templates escaped, route/redirect maps và Blog sitemap                             |
| `ops/{content-metadata,content-lifecycle,content-backup,content-routing,content-compatibility}.cjs`, `ops/php/content-reader.php`                                                                                              | Stable host bootstrap, capability/backup/rollback/routing                                    |
| `src/features/admin/content/{contracts,http-api,capabilities}.ts`, `src/features/admin/content/context.tsx`, `components/{server-post-form,server-media-picker,publication-status}.tsx`, `pages/server-{posts,categories}.tsx` | HTTP adapter, form/job/trash UX; local product adapter giữ nguyên                            |
| `src/lib/{public-content,blog-navigation}.ts`, `src/blog-client.ts`, `backend/src/content/render/presentation.ts`                                                                                                              | Public DTO reads, document navigation, progressive menu/privacy/tracker và presentation HTML |
| `scripts/{content-host-spike,build-content-seed,build-content-assets,content-ui-check,content-bundle-check,content-live-check}.mjs`                                                                                            | Probe riêng, build assets/seed, verification thật; không tạo lệnh hằng ngày mới              |
| `backend/test/content-*.test.mjs`, `scripts/content-*.test.mjs`, `tests/admin/content-*.test.ts[x]`, `tests/e2e/content-*.spec.mjs`                                                                                            | Tests theo interface, DB/PHP/browser thật                                                    |

### Shared interfaces phải khóa ở Task2

Tất cả types ở `backend/src/content/contracts.ts`, type-only import vào FE; runtime validation module riêng để không kéo Node/jsdom/sharp vào graph public.

```ts
type ContentMode = "bridge" | "cms";
type ContentListInput = {
  page: number;
  pageSize: number;
  search?: string;
  status?: "draft" | "published" | "trash";
  categoryId?: string;
  sort?: "updated_desc" | "published_desc";
};
type AuthorRef = { kind: "brand" } | { kind: "account"; id: string };
type PostDraftInput = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  categoryId: string | null;
  tags: string[];
  author: AuthorRef;
  coverMediaId: string | null;
  coverAlt: string;
  seoTitle: string;
  seoDescription: string;
};
type CategoryInput = {
  name: string;
  slug: string;
  description: string;
  parentId: string | null;
  position: number;
  active: boolean;
  seoTitle: string;
  seoDescription: string;
};
type SanitizedContent = { content: string; html: string; plainText: string; mediaIds: string[] };
type MediaVariant = {
  hash: string;
  file: string;
  mime: "image/webp" | "image/jpeg" | "image/png";
  width: number;
  height: number;
  bytes: number;
};
type MediaDto = {
  id: string;
  originalName: string;
  width: number;
  height: number;
  variants: MediaVariant[];
};
type PostDto = PostDraftInput & {
  id: string;
  revision: number;
  trashedAt: string | null;
  updatedAt: string;
  public: null | {
    snapshotId: string;
    draftRevision: number;
    slug: string;
    publishedAt: string;
    modifiedAt: string;
  };
};
type CategoryDto = CategoryInput & { id: string; revision: number; publicRevision: number | null };
type PublishedPost = {
  id: string;
  snapshotId: string;
  draftRevision: number;
  title: string;
  slug: string;
  excerpt: string;
  html: string;
  categoryId: string;
  tags: string[];
  author: { kind: "brand" | "account"; name: string };
  coverMediaId: string;
  coverAlt: string;
  seoTitle: string;
  seoDescription: string;
  publishedAt: string;
  modifiedAt: string;
  mediaIds: string[];
};
type PublicAssetManifest = {
  schemaVersion: 1;
  rendererVersion: string;
  css: string[];
  script: string;
  staticRoutes: Array<{ path: string; lastmod?: string }>;
};
type PublicSnapshot = {
  schemaVersion: 1;
  generationId: string;
  posts: PublishedPost[];
  categories: CategoryDto[];
  redirects: Record<string, string>;
  media: Record<string, MediaVariant>;
  routes: Array<{ path: string; label: string }>;
  committedAt: string;
};
type PublicRoute =
  | {
      kind: "html";
      file: string;
      sha256: string;
      indexable: boolean;
      contentType: "text/html" | "application/xml";
    }
  | { kind: "redirect"; location: string; status: 301 };
type GenerationManifest = {
  schemaVersion: 1;
  id: string;
  previousId: string | null;
  rendererVersion: string;
  publicDataFile: string;
  publicDataSha256: string;
  routes: Record<string, PublicRoute>;
  media: Record<string, MediaVariant>;
  assets: string[];
  fileHashes: Record<string, string>;
};
type RenderedGeneration = { manifest: GenerationManifest; files: Map<string, Uint8Array> };
type PublicationRequest = {
  action: "publish" | "unpublish" | "trash" | "apply-category" | "delete-category";
  targetId: string;
  expectedRevision: number;
  idempotencyKey: string;
  categoryRevisionToApply?: number;
};
type PublicationJob = {
  id: string;
  status: "queued" | "building" | "prepared" | "verifying" | "succeeded" | "failed";
  generationId: string | null;
  error: null | { code: string; message: string };
};
```

`PublicSnapshot.categories` serialize public category revisions only; working fields/publicRevision marker không được dùng làm nguồn khi render. `media` là cumulative registry của ảnh **đã từng commit public**, không phải toàn bộ upload table. `PostDto.public` được overlay từ active snapshot, không từ DB flag còn chậm finalize. Auth actor dùng `AuthPrincipal`, Clock dùng interface hiện có; lỗi dùng `ApiError` hiện tại. `ContentPaths` chứa absolute root/media/generations/active/deployLock và budgets được resolve trong config, không nhận từ request.

`ContentEditing` còn có `list(actor,input:ContentListInput):Promise<Page<PostDto>>`, `get(actor,id):Promise<PostDto>`, `duplicate(actor,id):Promise<PostDto>`, `trashDraft(actor,id,expectedRevision):Promise<PostDto>`, `restoreDraft(actor,id,expectedRevision):Promise<PostDto>`, `listCategories(actor,input):Promise<Page<CategoryDto>>`, `getCategory(actor,id):Promise<CategoryDto>` và `removeUnusedCategory(actor,id,expectedRevision):Promise<void>`. `Page<T>` dùng contract hiện có; lookup choices paginate với ancestor IDs, không giả định mọi mục nằm trong100record đầu. Xóa category đã có public revision đi qua PublicationRequest.delete-category, không xóa trực tiếp.

`ContentHttpModule` có `posts`/`categories` với các method editing tương ứng, `media` với upload/list/readPrivate, `authors`/`tags`/`categoryChoices` lookup, `publications.request/status` và `capabilities`; method HTTP bỏ actor parameter (client dùng session đã xác thực) và nhận thêm options cuối `{signal?:AbortSignal}`. `readPrivate` adapter FE trả Blob để tạo URL local, không serialize Buffer vào form. Các Report của bundle/live có shape `{ok:true,sourceSha:string,releaseId:string,generationId:string|null,checks:Record<string,boolean>,screenshots:string[]}`; không dùng một type Report chưa định nghĩa.

## Execution setup

- Dùng using-git-worktrees để xác minh/chuẩn bị workspace; không thực hiện trên checkout D: cũ. Nếu managed-worktree permission có vấn đề, ghi ruling và dùng workspace writable đã được cho phép; không tự chép source cũ đè worktree mới.
- Ledger riêng `.superpowers/sdd/2026-11-14-content-cms-seo/progress.md`, dòng đầu tên plan; mỗi task có BASE, test RED/GREEN, ruling, commit và kết quả thực tế. Không đọc/sửa ledger relay cũ để thay tiến độ CMS.
- Baseline bằng Node24: `npm ci`, `npm run check`, `npm run build`. Redirect log vào workspace và đọc kết quả/exit code; không claim các lệnh đã chạy ở bước viết plan. Docker/MariaDB fixture dùng `ensureTestDatabase()` từ `scripts/test-database.mjs`, không credential ứng dụng/live.
- Mọi task sau test step đều chạy đúng test mới trước implementation, rồi compiled backend build khi cần. Test helpers mới ở `backend/test/helpers/content.mjs` bọc `createDatabaseFixture`/`serve` hiện có và gọi ensureTestDatabase; không duplicate DB provisioning hoặc cho phép test trỏ hosting.
- Từng task commit scoped bằng `git add -- <task files>` rồi commit message chỉ định. Không `git add .`, không amend/squash pushed history. Native execution có một fresh whole-change review cuối; giữ phương thức người dùng chọn ở handoff.

### Task 1: Prove PHP/routing/codec/storage feasibility before broad implementation

**Files:** Create `scripts/content-host-spike.mjs`, `scripts/content-host-spike.test.mjs`, `scripts/content-codec-probe.mjs`; use ignored workspace fixtures/receipt; create `docs/superpowers/reports/2026-11-14-content-cms-feasibility.md`.

**Interfaces:** `verifyContentHostReceipt(receipt): {ok:true, readerVersion:1}` accepts measured checks (PHP request/HEAD/301/404, old/new pointer reads, cache refresh, path containment, route reservation, account quota/headroom, Node/libc/sharp formats). Receipt has only sanitized booleans/versions/digests, no credentials, paths derived from user input or raw customer data.

Representative assertion in `test("rejects an unmeasured HEAD/routing gate")`: `assert.throws(() => verifyContentHostReceipt({...validReceipt, headMeasured:false}), /HEAD/);` — `validReceipt` is the named complete synthetic receipt fixture in this test file, never live evidence.

- [ ] **Step1 — RED:** tests reject receipt missing HEAD, wrong HTTP404, stale pointer body, affected `/api` hash, unavailable WebP or only whole-disk free. Assert `verifyContentHostReceipt(missingHead)` throws and all required measured flags produce `.ok===true`.
- [ ] **Step2 — observe RED:** `node --test scripts/content-host-spike.test.mjs`. Expected: missing validator/behavior FAIL; no live request yet.
- [ ] **Step3 — implement bounded probes:** private fixture generation under fixed CMS-owned temporary prefix, expiry, deterministic expected HTML, headers and cleanup hash verification. Test sharp starting at official supported release0.35.5 (or maintained compatible version justified in receipt) on Windows Node24 and hosting Node24/CommonJS after isolated install; no host compiler/system install. Verify DOMPurify/jsdom exact current compatible packages execute in compiled CJS, not only TS loader. Probe real PHP initial HTML/HEAD/redirect/not-found/private-map denial, generation switch/cache, reserved paths and account quota. Do not modify live `/blog` or root routing for a probe; use a separate temporary prefix with equivalent rewrite semantics and restore its owned files only. Hosting mutations/installation need the applicable session authorization; absence blocks broad execution, not proof fabrication.
- [ ] **Step4 — GREEN and gate:** `node --test scripts/content-host-spike.test.mjs`, `node scripts/content-codec-probe.mjs`, `node scripts/content-host-spike.mjs --verify <private-receipt>`. Expected: all required flags measured true on local/host; record actual dependency versions and remaining bytes. If hosting blocks a core requirement, stop and revise design with owner; do not substitute CSR or unmaintained codec silently.
- [ ] **Step5 — commit:** `test: prove CMS hosting and image codec prerequisites`. No live CMS enabled.

### Task 2: Contracts, bounded sanitizer, feature schema and compiled fixture

**Files:** Create `backend/src/content/{contracts,limits,rich-policy,sanitize,sanitize-worker,schema,validation,cli}.ts`, `backend/content-migrations/001_content.sql`, `backend/test/helpers/content.mjs`, `backend/test/content-{schema,sanitize,validation}.test.mjs`; modify backend package/lock/config build as needed, `src/features/admin/content/rich-content.ts` only for pure shared policy.

**Interfaces:** types above; `sanitizePostContent(raw:string): Promise<SanitizedContent>`; `validatePostDraft(input:unknown):PostDraftInput`; `validateCategory(input:unknown):CategoryInput`; `migrateContent(pool,directory):Promise<void>` and `contentSchemaStatus(pool,directory):Promise<{version:1,state:"empty"|"complete"|"dirty",migrationChecksums:Record<string,string>}>`. Fixture initially returns `{pool,clock,paths,admin,editor,viewer}` with real test accounts/RBAC; later tasks extend it, never invent production fixture overrides.

Representative RED test:

```js
test("sanitizes stored HTML in Node and demotes the body H1", async () => {
  const value = await sanitizePostContent(
    JSON.stringify({
      format: "html-v1",
      html: '<h1>A</h1><img src=x onerror="alert(1)"><script>alert(1)</script>',
    }),
  );
  assert.match(value.html, /<h2>A<\/h2>/);
  assert.doesNotMatch(value.html, /onerror|<script|src="x"/);
});
```

- [ ] **Step1 — RED:** table-driven tests assert UTF-8 body256KiB boundary; title301/excerpt1001/tags11/deep1001nodes reject, request parser cap separate; script/onerror/javascript links/SVG removed, table/color/width allowed, external image becomes rejected reference, cover/inline media IDs extracted; sanitize twice same result; legacy JSON/plain/html-v1 normalize without global `window/document`; body heading h1 demoted to h2. Schema migrate twice preserves one ledger row, changed SQL checksum/dirty schema fails, auth4/profile1/history1/context1 unchanged.
- [ ] **Step2 — observe RED:** `node --test backend/test/content-schema.test.mjs backend/test/content-sanitize.test.mjs backend/test/content-validation.test.mjs`. Expected: new compiled behavior missing, not unrelated DB credentials failure.
- [ ] **Step3 — implementation:** feature SQL tables for `content_posts`, `content_post_revisions`, `content_categories`, `content_category_revisions`, `content_tags`, post-tag links, `content_media`, media variants/references, `content_published_snapshots`, `content_publication_jobs`, `content_generations`, `content_seed_imports`. UUID IDs, revision optimistic CAS, unique normalized slug reservation/alias registry and idempotency payload hash; schema ledger separate. Record generation/job recovery states explicitly. Use DOMPurify + current jsdom pinned from Task1 in bounded worker; pure shared whitelist limits only, no Node import in FE graph. Node-count limit1000 and DOM depth32; worker timeout5s; reject 256KiB+ after sanitation and bound input512KiB before parsing. CLI only `migrate|status`, fixed private env in production, no automatic runtime migration.
- [ ] **Step4 — GREEN:** `npm --prefix backend run build`, then Step2 command and `npm --prefix backend run check`; run existing rich-content Vitest tests to prove formatting/media parity. Expected: all named checks pass and emitted CJS works with no browser globals.
- [ ] **Step5 — commit:** `feat: add content contracts schema and server sanitization`.

### Task 3: Private managed media, variants and safe upload parsing

**Files:** Create `backend/src/content/media/{codec,worker,store,service,routes}.ts`, `backend/src/content/{environment-lock,lock-holder}.ts`, `backend/test/content-media.test.mjs`, `backend/test/content-media-http.test.mjs`; modify `backend/src/http/security.ts`, backend package/lock and content fixture.

**Interfaces:** `createContentMedia({pool,paths,clock,codec})` returns `upload(actor,{bytes,mimeType,originalName},signal?):Promise<MediaDto>`, `list(actor,{page,pageSize,search}):Promise<Page<MediaDto>>`, `readPrivate(actor,id,variantHash):Promise<{bytes:Buffer,mimeType:string}>`, `references(ids):Promise<MediaDto[]>`. `withContentEnvironmentLock(paths,work):Promise<T>` is the sole environment-lock adapter; upload decode outside lock, file/metadata commit and backup use it. Filename/hash comes from server, not originalName.

Lock implementation is in `environment-lock.ts`: Linux uses an owned `flock` holder subprocess on the existing deploy.lock; readiness pipe signals acquired, stdin/parent death releases it, lost holder aborts the work before commit. Windows local adapter uses owned atomic lock directory with PID+nonce and no takeover of a live owner; actual POSIX crash behavior is additionally exercised in Linux CI. The callback receives an internal lease; trusted receiver/backup CLI already under deploy.lock calls a work-under-lease helper instead of taking the same lock again. No lock bypass flag is accepted by HTTP/SSH command input. Cooperative abort and holder cleanup are part of the tests, not a separate public lock service.

Representative assertion in `test("rejects a decoded image above 5MiB")`: `await assert.rejects(media.upload(admin,{bytes:Buffer.alloc(5242881),mimeType:"image/png",originalName:"large.png"}), e => e.status===413);`. Extend the existing content fixture with the wired `media` module; PNG/JPEG bytes use existing `avatar-images.mjs`, WebP fixture is generated and pinned by the codec probe. Do not let MIME sniffing hide the over-size error.

- [ ] **Step1 — RED:** actual JPEG/PNG/WebP accepted; `5242881` decoded bytes/16000001pixels, MIME/header mismatch, malformed base64 and script/SVG reject; max dimension2400 and EXIF/GPS removed. Draft media HTTP anonymous401/public hash404. Temp decode error/cancel leaves no row/file marked ready. A barrier test starts backup between file staging and metadata commit and asserts restored media-row set has every file digest. No retained media is physically deleted.
- [ ] **Step2 — observe RED:** `node --test backend/test/content-media.test.mjs backend/test/content-media-http.test.mjs`; expect new service/route missing.
- [ ] **Step3 — implementation:** sharp worker with concurrency1, timeout15s and bounded pixel/byte input; variants480/960/1600/2400 without enlargement, WebP output and normalized master. Scope global JSON bypass to authenticated `/api/content/media` POST only (same pattern as avatar), limit6991532 JSON bytes, canonical base64 decode≤5242880, guard Origin/X-Bibi-Request and post.create/update **before** large parser; existing analytics16KiB cap unchanged. Private reads `private,no-store`, no token query. Resolve/check every path plus realpath containment, atomic file rename then DB metadata inside environment lock, failure rollback owned staging only. No public symlink to all uploaded files.
- [ ] **Step4 — GREEN:** backend build + Step2, existing avatar/HTTP security tests. Expected: three formats processed by real codec, large unauthorized body rejected before decode, fixture backup barrier passes; no source-env/IP logging.
- [ ] **Step5 — commit:** `feat: add private content media and bounded image variants`.

### Task 4: Real Post/Category CRUD, lookups, RBAC and conflicts

**Files:** Create `backend/src/content/{repository,editing,categories,lookups,routes,capabilities}.ts`, `backend/test/content-{editing,categories,http,permissions}.test.mjs`; modify `backend/src/{app,runtime}.ts`, `backend/src/authorization/registry.ts`, content fixture.

**Interfaces:** `createContentEditing({pool,paths,clock,media,activeRead})` produces the shared ContentEditing interface including `saveDraft(actor,id:string|null,input:PostDraftInput,expectedRevision:number|null):Promise<PostDto>` and `saveCategory(actor,id:string|null,input:CategoryInput,expectedRevision:number|null):Promise<CategoryDto>`. `lookupAuthors(actor):Promise<Array<{id:string,name:string,kind:"brand"|"account"}>>` and tags/category choices return only needed fields. `readContentCapabilities(release:ReleaseInfo): {mode:ContentMode,publicReaderVersion:1,canWrite:boolean}`; production capabilities come from the validated bundled manifest, not a client/env toggle. Local explicit setup and test composition use a local manifest with CMS capability; default production build remains bridge until release task.

Representative assertion in `test("depth four is rejected without changing the category tree")`: after creating three levels through `editing.saveCategory`, `await assert.rejects(editing.saveCategory(admin,null,{...categoryInput,parentId:level3.id},null), e => e.code==="CATEGORY_DEPTH");`. Extend fixture with editing and valid post/category input factories; category names/slugs are generated in the isolated DB, not fixed production IDs.

- [ ] **Step1 — RED:** real DB tests `saveDraft` preserves active public snapshot, stale revision409 holds user's latest draft; duplicate is new draft/new slug; restore never publishes. Category depth1/2/3 passes,4/cycle/self/missing parent rejects; reparent subtree exceeding3 fails transaction; delete child/reference/trash-held category409; inactive existing public category still readable, new article cannot choose inactive. Tag names normalize/dedupe≤10; authors endpoint never contains email/phone/password. Client `status:"published"` input rejected.
- [ ] **Step2 — observe RED:** `node --test backend/test/content-editing.test.mjs backend/test/content-categories.test.mjs backend/test/content-http.test.mjs backend/test/content-permissions.test.mjs`.
- [ ] **Step3 — implementation:** bind HTTP module paths from spec, authenticate/read permissions and transaction-time authorization. Add post.publish/post.restore and content_category.* rows through idempotent permission sync; full_access works, existing custom mappings unchanged. UI writer roles need post.view + create/update; minimal authors/tags/category choices available to authorized post writer without granting account.view/category management. Working-only CRUD and media references; public mutations rejected here and routed to Task7. Only never-public/unreferenced category can use removeUnusedCategory; an applied category deletion uses Task7 and delete+publish authority. Bridge capability returns read-only/503 for CMS mutation rather than seeding local. Limit HTTP text JSON512KiB after auth/Origin at content mutation routes only; existing APIs keep limits. Trash public post requires delete+publish via publisher, not direct repository flag write. Audit metadata excludes body/base64.
- [ ] **Step4 — GREEN:** backend build + Step2; real two-client save/reload fixture, permission union and existing auth/profile tests. Expected: all checks pass; tests inspect actual DB/reference/audit state.
- [ ] **Step5 — commit:** `feat: persist article drafts and three-level content categories`.

### Task 5: Versioned import of the current public Blog and images

**Files:** Create `scripts/build-content-seed.mjs`, `scripts/content-seed.test.mjs`, `backend/src/content/seed.ts`, `backend/test/content-seed.test.mjs`; modify content CLI and build source manifest helpers.

**Interfaces:** `buildContentSeed({outputDir}):Promise<{manifestFile:string,sha256:string}>` emits `seed.json` + bounded hashed image bytes from source; `importContentSeed({pool,media,seedDirectory,clock}):Promise<{created:number,skipped:number}>` creates imported working revisions **and immutable publication candidates**, never active pointer. Public data initially read from old site until Task7 initial generation activation.

Representative assertion in `test("second seed never overwrites an edited imported article")`: `await importContentSeed(seedOptions); /* save a changed title through ContentEditing */ await importContentSeed(seedOptions); assert.equal((await editing.get(admin,importedId)).title,"Đã biên tập");`. Extend fixture with seedDirectory/options from a generated local seed, and locate importedId by its sourceKey via the fixture query helper.

- [ ] **Step1 — RED:** capture all `getAllBlogPosts()` slugs/dates/block text/cover/inline alt+caption; imported rows/bytes equal source, category names dedupe; authors brand; running twice creates no duplicates and never overwrites a manually edited title. Missing/tampered image or seed digest fails before any active mutation; legacy plain/html payloads remain sanitizer-safe.
- [ ] **Step2 — observe RED:** `node --test scripts/content-seed.test.mjs backend/test/content-seed.test.mjs`.
- [ ] **Step3 — implementation:** build-time Vite/TS evaluation adapter exports bundled source data and local files, no remote fetch. Stable `sourceKey=blog:<original slug>`; DB source marker and image content hashes idempotent; keep original slug/date precision and add deterministic midnight Asia/Ho_Chi_Minh only when SQL timestamp needed, UI retains original date. CLI seed explicit and transactionally creates candidates; no seed on runtime startup and no assumption that IndexedDB records are source truth.
- [ ] **Step4 — GREEN:** backend build + Step2. Expected: all current articles represented with original URLs and locally verified image bytes; no active public change.
- [ ] **Step5 — commit:** `feat: import existing journal content without overwriting edits`.

### Task 6: Full-document HTML, route maps and SEO generation

**Files:** Create `backend/src/content/render/{document,presentation,posts,categories,seo,routes,sitemap}.ts`, `backend/test/content-render.test.mjs`, `backend/test/content-seo.test.mjs`; create `scripts/build-content-assets.mjs` contract tests. `src/styles.css` gains explicit scan source for server-rendered class names if required; no admin CSS import.

**Interfaces:** `renderContentGeneration(snapshot:PublicSnapshot,assets:PublicAssetManifest,canonicalOrigin:string):Promise<RenderedGeneration>`; `planPublicRoutes(snapshot):Record<string,PublicRoute>`; `buildSiteSitemap(staticRoutes,origin):string`. Renderer consumes trusted sanitized snapshots + media resolver, never arbitrary draft DTO. `fileHashes` covers every served HTML/data/map/sitemap file; private generation metadata is not a public route.

Representative assertions in `test("ten published articles create nine plus one and a canonical route")`: `assert.equal(snapshot.posts.length,10); assert.equal(output.manifest.routes["/blog/page/2"].kind,"html"); assert.equal(output.manifest.routes["/blog/old-slug"].location,"/blog/new-slug");`. Add pure `makePublicSnapshot({postCount:number})` and `makePublicAssets()` fixtures to the content helper for renderer tests; these do not start DB/PHP and contain no working draft records.

- [ ] **Step1 — RED:** parse actual output without JS: one H1, body/links visible, correct title/canonical/BlogPosting/BreadcrumbList, author Organization/Person, escaped `</script>` title, full image dimensions/srcset, card1:1/article3:2. Ten posts create9+1 pagination; category parent depth does not affect slug URL. Empty category200/noindex excluded from Blog sitemap; draft/trash/redirect excluded. Alias old1→old2→new maps one301; `/blog?page=2` canonical redirect to `/blog/page/2`; static site sitemap excludes private/admin/preview. Assert no Lovable origin, placeholder image, raw draft or TinyMCE asset.
- [ ] **Step2 — observe RED:** `node --test backend/test/content-render.test.mjs backend/test/content-seo.test.mjs`.
- [ ] **Step3 — implementation:** escaped HTML template modules with brand presentation/current CSS; native `<a href>` everywhere, no SPA root script. Include one optional enhancement entry from asset manifest, privacy controls functional with script and plain content usable without it. Excerpt/SEO fallback, visible original dates, related max3 same-category published posts. Canonical paths exactly spec, reserved names `category,page,tag,feed,sitemap.xml`, slug ASCII; normalize aliases to final owner and prevent reassignment. Emit Blog sitemap, not application static sitemap duplicated inside content snapshot.
- [ ] **Step4 — GREEN:** backend build + Step2; validate output with DOM parser and schema assertions. Expected: all routes/files/digests internally resolve; no unescaped injected content.
- [ ] **Step5 — commit:** `feat: render publish-time journal HTML and SEO metadata`.

### Task 7: Durable publication jobs, atomic activation and crash recovery

**Files:** Create `backend/src/content/publication/{jobs,store,planner,publisher,worker,cli,active-read}.ts`, `backend/test/content-publication.test.mjs`, `backend/test/content-recovery.test.mjs`, `backend/test/helpers/content-worker.mjs`; modify content routes/fixture/runtime.

**Interfaces:** `createContentPublication(deps)` returns `request(actor,input:PublicationRequest):Promise<PublicationJob>`, `status(actor,jobId):Promise<PublicationJob>`, `reconcile():Promise<void>`; `runNextPublication(context):Promise<boolean>` handles one job under environment lock. `readActiveContent(paths):Promise<{manifest:GenerationManifest,snapshot:PublicSnapshot}|null>`. Store `prepare(rendered)`, `activate(id,expectedPreviousId)`, `restore(expectedActiveId,previousId)` validate/verify hashes and use atomic pointer; restore is compare-and-swap, not blind overwrite.

Representative assertions in `test("retry is idempotent and stale render never activates")`: `assert.equal((await publication.request(admin,request)).id,(await publication.request(admin,request)).id); /* change the working revision before worker activation */ await runNextPublication(context); assert.equal((await publication.status(admin,job.id)).status,"failed"); assert.equal((await readActiveContent(paths)).manifest.id,previousId);`. Extend fixture with wired publication/context/canary and retain a real previous generation; test harness wrappers inject crashes only at store/canary seams.

- [ ] **Step1 — RED:** tests publish exact revision, saveDraft after publication leaves public unchanged; enqueue same key/payload returns same ID and changed payload409; concurrent different posts both survive. Render failure/disk cap/missing asset/revoked actor/edited draft keep old pointer. Category apply needs category.publish; article+category revision apply atomic and parent public dependency validated; public trash needs both delete+publish. Worker killed at prepared/after-pointer/before-finalize restarts and does not mark success without canary; no half snapshot or duplicate audit/publication.
- [ ] **Step2 — observe RED:** `node --test backend/test/content-publication.test.mjs backend/test/content-recovery.test.mjs`.
- [ ] **Step3 — implementation:** DB jobs/payload hash/lease + durable prepared generation. Lock env before fresh read of active snapshot, apply only targeted changes, cumulative media registry includes only old committed+newly published media. Prepare private generation and fsync, persist prepared metadata, lock/recheck actor session/authVersion/permission+target revision briefly, atomic active rename, run public canary, then finalize DB/audit. Reconcile verifies pointer/lease/known prepared data; a post-pointer crash must rerun canary and restore previous if it fails. Queue wakeup on enqueue/startup/authenticated status poll; detached worker only owned fixed CLI under same lock, idle exits after drain, no secrets argv/new cron. Tests wrap production storage/canary dependencies in separate harness for kill/fault injection; ship no test failpoint env in runtime.
- [ ] **Step4 — GREEN:** backend build + Step2; run actual subprocess kill matrix and temp-filesystem concurrent reader loop. Expected: HTTP/public data always whole old/new generation; failed canary restores old and reports failure, rollback failure distinctly reported; no long SQL transaction during rendering. Revoke authority during a blocked render and assert no activation.
- [ ] **Step5 — commit:** `feat: publish content atomically with durable recovery`.

### Task 8: Stable PHP public reader, precise status/routing and media privacy

**Files:** Create `ops/php/content-reader.php`, `ops/content-routing.cjs`, `ops/content-config.example.json`, `scripts/content-reader.test.mjs`, `scripts/content-routing.test.mjs`; add PHP fixture adapter under test helpers, not deployable reader.

**Interfaces:** reader config `{schemaVersion:1,environment,contentRoot,canonicalOrigin}` fixed private file; `installContentRouting(config):Promise<Receipt>` verifies existing owned hashes, saves routing backup and modifies only spec namespaces. PHP resolves active generation once/clears stat cache, exact route/media registry lookup; never DB or template evaluation.

Representative assertion in `test("a persistent PHP worker observes an external pointer change")`: `assert.match(await (await fetch(baseUrl+"/blog/a")).text(),/generation-one-body/); await store.activate(secondId,firstId); assert.match(await (await fetch(baseUrl+"/blog/a")).text(),/generation-two-body/);`. Add `scripts/test-helpers/content-reader.mjs` exporting `startContentReaderFixture(t,{paths,canonicalOrigin}):Promise<{baseUrl:string}>`, using existing owned PHP lifecycle; this helper is never packaged into runtime.

- [ ] **Step1 — RED:** run actual PHP persistent worker: G1→G2→G1 selected after external Node pointer changes, HEAD headers/body empty, unknown404, GET/HEAD only, `?page=2`/trailing slash/www content301 correct one hop. Traversal/double-encoded separators/direct generation metadata/internal PHP/private source returns404; draft image staged file404 until committed registry, previously published image200 after article unpublish. Application-code responses asserted, not external WAF codes.
- [ ] **Step2 — observe RED:** `node --test scripts/content-reader.test.mjs scripts/content-routing.test.mjs`.
- [ ] **Step3 — implementation:** install loader at owned static entry reached by Blog/sitemap/media rewrites before SPA fallback; reader uses fixed config+manifest schema/hash checks and serves only registered relative files with realpath containment. Media correct MIME/immutable cache/ETag/304; HTML/redirect/404/sitemap no-store, sitemap contentType application/xml. Query page must occur once and be a positive decimal; malformed/duplicate page400, page1→/blog, page2→/blog/page/2, out-of-range path404. Ignore UTM for canonical/map lookup and combine www/trailing-slash/slug alias normalization into final one-hop301. Invalid config/corruption503 with no paths/credentials; valid unknown path404. Preserve existing root/API/node-test/assets/.well-known rules byte-for-byte except scoped managed block and verified manifest metadata; uninstall/restoration only exact owned block. Do not redirect auth/API www.
- [ ] **Step4 — GREEN:** Step2 plus measured Task1 routing fixture using final reader in Linux PHP. Expected: no JS required to see article, no stale pointer or files exposed; reserved route checks all pass. Host-level routing acceptance remains live gate, no claim from local container only.
- [ ] **Step5 — commit:** `feat: serve generated journal documents through scoped PHP routing`.

### Task 9: HTTP admin forms, media picker, publication status and three-level categories

**Files:** Create `src/features/admin/content/{contracts,http-api,capabilities}.ts`, `src/features/admin/content/context.tsx`, `components/{server-post-form,server-media-picker,publication-status}.tsx`, `pages/server-{posts,categories}.tsx`, `tests/admin/content-{http,post-form,categories,media,publication}.test.ts[x]`; modify current content posts/categories/editor/detail routes/pages, `services/context.tsx`, form shared adapters and navigation only where needed.

**Interfaces:** `createContentHttp(client:AdminHttpClient):ContentHttpModule` mirrors editing/media/publication typed methods with AbortSignal; `useContent()` picks HTTP mode explicitly, never falls back to local on503/network errors. Keep product ComposeForm's existing local contract. Form saves server draft first, then queues request with returned revision/idempotency key; poll job uses status not elapsed timeout as evidence success.

Representative assertions in `it("publish uses the saved server revision and failed jobs keep the draft")`: `expect(publications.request.mock.calls[0][0].expectedRevision).toBe(savedDraft.revision); expect(screen.getByDisplayValue("Nội dung đang sửa")).toBeVisible(); expect(screen.getByText("Xuất bản thất bại")).toBeVisible();`. Here savedDraft and module mocks are local typed Vitest fixtures implementing ContentHttpModule, not additional production interfaces; assert request ordering and absence of any IndexedDB call too.

- [ ] **Step1 — RED:** tests save+publish sends exactly saved revision, failed save never calls publish, failed publication retains edited form and old-public badge; retry after lost response reuses key; load503 displays error without ensureDataset. Detail/trash/restore/duplicate permissions match backend; dirty guard tracks last saved values. Category depth3 allowed/4 disabled with explanation, cannot select own descendant, deletion references show counts. Media private Blob URLs revoked/cancelled and no base64 retained in DTO/localStorage; inactive category current value retained.
- [ ] **Step2 — observe RED:** `node node_modules/vitest/vitest.mjs run --config vitest.admin.config.ts tests/admin/content-http.test.ts tests/admin/content-post-form.test.tsx tests/admin/content-categories.test.tsx tests/admin/content-media.test.tsx tests/admin/content-publication.test.tsx`.
- [ ] **Step3 — implementation:** distinguish “Lưu nháp”, “Đăng bài/Cập nhật bài”, “Gỡ về nháp”, “Có thay đổi chưa đăng”, queued/building/failed/succeeded. Explicit category “Áp dụng lên website”; no status field bypass, no future publishAt scheduler. Author/choice minimal endpoints, tags names in form, hide misleading local tags source in HTTP mode. Bridge capabilities show read-only message and no local editor fallback. New post-only form adapter uses same TinyMCE/policy/preview semantics and server picker; products stay local. No client-only claim of permission/security; UI validation complements server.
- [ ] **Step4 — GREEN:** Step2, root `tsc --noEmit`, existing compose/dirty/profile/admin navigation Vitest tests. Expected: scoped tests green and network errors do not create ghost local records.
- [ ] **Step5 — commit:** `feat: connect article and category administration to server CMS`.

### Task 10: Public navigation, homepage reads, progressive analytics and compatibility bridge

**Files:** Create `src/lib/{public-content,blog-navigation}.ts`, `src/blog-client.ts`, `backend/src/content/publication/public-routes.ts`, `tests/admin/content-public-read.test.ts`, `scripts/content-navigation.test.mjs`, `backend/test/content-tracking.test.mjs`; modify `src/components/{site-header,site-footer,blog-highlights}.tsx`, `src/routes/blog.index.tsx`, `src/routes/blog.$slug.tsx`, `src/lib/{seo,visitor-runtime,visitor-tracker}.ts`, `backend/src/visitors/catalogue.ts`, runtime composition and necessary route wrappers.

**Interfaces:** `loadPublicContent({signal}):Promise<PublicSnapshot>` returns public DTO only, compatible schema1 and active generation ID; read-only endpoints `/api/public/content/posts[/:slug]` and `/api/public/content/routes`. `startVisitorTracking(getPath,options?:{catalogue?:PublishedCatalogue})` preserves default call sites; `mergePublishedCatalogue(base,active):Catalogue` exact allowlist. `isBlogDocumentPath(path):boolean` used only to force navigation, not allow arbitrary analytics.

Representative assertions in `test("published routes extend the analytics allowlist without prefix trust")`: `assert.equal(publicPath("/blog/new-article",merged),"/blog/new-article"); assert.equal(publicPath("/blog/not-published",merged),undefined);`. Define PublishedCatalogue as the existing generated catalogue JSON shape (routes path/label and products slug/name); merge only active snapshot routes, retain the original product map.

- [ ] **Step1 — RED:** anchor click from Home/CSR opens actual public document and back/forward returns; no createRoot clobbers generated article. Home highlights list public API newest3 and remove unpublished post after reload; errors do not restore static blog seed as live content. Dynamic new slug accepted in FE+BE tracker after pointer change without rebuild, unknown `/blog/anything` rejected, draft/preview excluded, old stored history still readable. Privacy opt-out/DNT/GPC and15s batching unchanged. Bridge mode admin mutations503/read-only and Blog always generation when cutover marker exists.
- [ ] **Step2 — observe RED:** `node --test scripts/content-navigation.test.mjs backend/test/content-tracking.test.mjs` and targeted content-public-read Vitest; missing new interfaces should fail.
- [ ] **Step3 — implementation:** replace Blog links with true document navigation/reloadDocument, thin public route adapters cannot render static `blog.ts` after CMS marker; inject minimal enhancement script+catalogue into generated document with escaped JSON. Header/mobile menu/consent work without importing admin. Tracker labels from active generation cached by generation ID and invalidated on pointer change, no permissive prefix matcher. Public read adapter for Home, search consumers if present; local/Lovable fixture explicitly marked and never chosen for production HTTP failure. SEO origin fixed shared config; leave product Offer/schema redesign outside scope.
- [ ] **Step4 — GREEN:** Step2 and existing tracker/privacy/relay tests; browser integration checked again Task13. Expected: imports keep admin/TinyMCE out public graph and baseline callers compile.
- [ ] **Step5 — commit:** `feat: bridge public journal navigation and analytics to published content`.

### Task 11: One-command local development and compiled preview with real PHP/CMS

**Files:** Modify `scripts/{local-database,local-analytics-relay,php-relay,dev,preview}.mjs`, `scripts/php-relay-router.php`, `vite.local.config.ts`, `.env.example`; create `scripts/content-local.test.mjs`, `scripts/content-preview.test.mjs`, `tests/e2e/helpers/content-fixture.mjs`.

**Interfaces:** `startLocalContent({env,backendPort,frontendPort,contentRoot,assets,signal})` composes existing owned PHP runtime and returns `{close():Promise<void>,url:string}`; avoid launching a second unmanaged PHP daemon. Fixture extends existing DB/HTTP/media/publication modules, generated public assets and isolated PHP paths; never production credentials/target overrides in deployable PHP.

Representative assertions in `test("compiled preview serves article HTML before browser JavaScript")`: `const r=await fetch(baseUrl+"/blog/new-article"); assert.equal(r.status,200); assert.match(await r.text(),/<h1[^>]*>Bài đã đăng<\/h1>/); await preview.close(); await assertPortsReleased(ownedPorts);`. Add `createContentE2eFixture(t,{bundleDir?,mode?})` in the named e2e helper, returning `{baseUrl,adminCredentials,paths,close}` and only real owned runtime objects; ports assertion reuses current process-group tests.

- [ ] **Step1 — RED:** setup twice keeps CMS data/keys and feature ledger, first explicit seed available; dev FE/API/PHP serve raw article and authenticated editor using same commands. Compiled preview creates/updates/publicates article from CJS backend with actual PHP, not source Vite renderer; Ctrl+C/fatal child/failed setup releases all owned ports and containers; no root hook recursion. Lovable fixture preview remains usable without hosting secrets.
- [ ] **Step2 — observe RED:** `node --test scripts/content-local.test.mjs scripts/content-preview.test.mjs`.
- [ ] **Step3 — implementation:** extend explicit local DB setup/migration/import, derive content root/private paths under ignored local workspace, mount same final PHP reader with local config. Vite and preview route Blog/sitemap/media namespaces to local PHP, preserve `/api` relay and inspector loopback9230. Process ownership and signal cleanup use existing helpers. Bootstrap initial content generation only in explicit setup; normal dev startup does not reset records. Readiness distinguishes configured empty/new setup from corrupt active generation.
- [ ] **Step4 — GREEN:** Step2 plus existing dev-relay/preview/watcher tests, real Windows restart and Node24 debugger attach. Expected: no extra daily command or stranded process; no live DB touched.
- [ ] **Step5 — commit:** `feat: run CMS publication and PHP reader in dev and preview`.

### Task 12: Release capability, paired content backup, stable bootstrap and rollback policy

**Files:** Create `ops/{content-metadata,content-lifecycle,content-backup,content-compatibility}.cjs`, `backend/src/content/backup.ts`, `backend/src/content/backup-cli.ts`, `scripts/content-release.test.mjs`, `scripts/content-rollback.test.mjs`, `backend/test/content-backup.test.mjs`; modify `ops/{release,receiver,deploy,database-lifecycle}.cjs`, `ops/passenger/app.cjs`, frontend routing template, `backend/src/release.ts`, `scripts/{build,release-manifest,smoke,build-content-assets}.mjs`, build configs and package/locks.

**Interfaces:** manifest7 `content={schemaVersion:1,readerVersion:1,migrationChecksums,seedSha256,assetManifestSha256}`; bridge manifest6 may carry `contentPublic={readerVersion:1,readModelVersion:1}` without enabling CMS schema/writes. `prepareContent(config,current,candidate,{backupReceipt}):Promise<void>` validates capabilities/state and migration readiness before pointer changes. `createContentBackup(options):Promise<{verified:true,profiles:true,content:true,sha256:string,bytes:number,generationId:string|null}>` proves DB+profile+content restored into verifier, not live DB. Stable public reader and content marker live outside app release.

`buildContentAcceptanceBundle({sourceSha,mode,outputDir})` may produce a **local-ID-only** alternate-mode bundle for testing, under a separate directory. It must reject a CI release identity or upload/promotion request; normal trusted artifact mode always comes from the committed CONTENT_RELEASE_MODE. No runtime environment flag may turn a bridge artifact into a CMS release. Final official artifact is tested in its own actual mode.

Representative assertions in `test("unaware rollback is refused and compatible bridge keeps new content")`: `await assert.rejects(rollbackRelease(config,legacyId),/content.*compatib/i); assert.equal(await activeGenerationId(),newContentId); await rollbackRelease(config,bridgeId); assert.equal(await activeGenerationId(),newContentId);`. These calls execute on an isolated native test fixture; no synthetic failure injected into real production.

- [ ] **Step1 — RED:** manifests1–6 still validate, unknown manifest7 rejected by unupgraded fixture; tampered SQL/seed/PHP/assets fail preparation. Native paired restore includes draft and public snapshots/jobs/redirects/media/all referenced generations/profile avatars, asset pins and pointer; injected upload-commit barrier cannot create missing file. Missing/corrupt/incompatible content fails readiness503; bridge mode no content mutation. App rollback preserves newer content root and active generation; rollback target without contentPublic capability after marker must fail **before** changing pointers/routing.
- [ ] **Step2 — observe RED:** `node --test scripts/content-release.test.mjs scripts/content-rollback.test.mjs backend/test/content-backup.test.mjs`.
- [ ] **Step3 — implementation:** versioned content metadata, build asset/seed/PHP contract hashes, Linux optional native codec deps installed from lock (no bundling platform node_modules). Backend artifact includes migration/seed/renderer assets only, not live content/env. Emit `/sitemaps/site.xml` from static public route catalogue; index/Blog sitemap supplied by active reader. Native backup under environment lock freezes media commits/pointer, copies file digests paired with full DB dump, restores on verifier and compares rows/references/digests. Keep active/public media/css JS pins, no automatic pruning; quota includes content/backups/runtime headroom. Stable routing owned block/pointer and media root remain through app rollback.
- [ ] **Step4 — baseline compatibility:** retain `CONTENT_RELEASE_MODE="bridge"` default in this task's reviewed source; its app serves public read contract/navigation and admin read-only capability while native CMS writes stay disabled. Its build emits contentPublic reader/readModel version1 but not manifest7 CMS activation. A later normal commit flips release mode to cms for the actual CMS artifact; these are two independently identified trusted CI releases, never edited/promoted under the same releaseId. Legacy `032ec99` without bridge capability is explicitly ineligible for post-cutover rollback; no patching bytes inside retained immutable app bundles. Test actual compiled bridge after schema7 migrations and with active generation changed after deployment. Expected: generated Blog remains current and CMS write attempts503, then CMS forward sees data intact.
- [ ] **Step5 — GREEN:** backend build + Step2; build both modes in temporary output and validate archives/checksums, no secret/draft DB/real media in artifact. Expected: all native restore and compiled rollback/forward checks pass before any real cutover. The fixed stable reader may use schema1 generations across both apps; cannot silently serve old static Blog if marker exists.
- [ ] **Step6 — commit:** `feat: package CMS with verified backup and compatible rollback bridge`. Do not flip final cms release default or deploy yet.

### Task 13: Full browser/compiled artifact acceptance and CI gates

**Files:** Create `tests/e2e/content-cms.spec.mjs`, `tests/e2e/content-bundle.spec.mjs`, `scripts/{content-ui-check,content-bundle-check}.mjs`, `scripts/content-check-policy.test.mjs`; modify `scripts/check.mjs`, `.github/workflows/ci.yml`, scoped lint/bundle checks, docs local usage and plan ledger.

**Interfaces:** `verifyContentBundle({bundleDir,evidenceDir,mode}):Promise<Report>` starts actual compiled API + PHP + isolated MariaDB, verifies raw HTTP/browser and writes sanitized evidence; `content-ui-check.mjs` executes source runtime acceptance. CI check invokes new named gates and artifact check uses **exact built release**, not a fresh source build substitute.

Representative assertions in `test("a draft becomes crawlable only after successful publication")`: `assert.equal((await fetch(baseUrl+"/blog/seo-fixture")).status,404); /* submit a real authenticated publication and await succeeded */ assert.equal((await fetch(baseUrl+"/blog/seo-fixture")).status,200); expect(await noJsPage.locator("h1").textContent()).toBe("SEO fixture");`. Build the page from the declared real e2e fixture, not mocked route data. Report uses the exact shared evidence shape above.

- [ ] **Step1 — RED:** check-policy test requires source browser + compiled CMS acceptance in CI/check, Linux no skips for PHP/media/DB cases. Browser cases: two contexts/users see same draft; publisher/editor permission distinction; edit/publish error retains form; category1→2→3 valid/4 rejected; create image/article, draft public404 then job success→200 without app build; edit draft public unchanged→update visible; unpublish404; restore draft not public; redirect2changes one hop; private media denied then immutable published URL remains after unpublish. Run same article with JS disabled and inspect HTML/meta/schema/sitemaps. CSR Home link/document navigation/back, existing page refresh, consent/DNT/GPC, new dynamic analytics slug, mobile390px/no overflow and cover/card ratios included.
- [ ] **Step2 — observe RED:** `node --test scripts/content-check-policy.test.mjs`, `node --test tests/e2e/content-cms.spec.mjs`, `node scripts/content-bundle-check.mjs <fixture-bundle>`. Expected: missing gates/behaviors fail; no passing mock API counted.
- [ ] **Step3 — implement acceptance integration:** extend maintained lint scope to new `src/blog-client.ts`/public-content/navigation/presentation/policy files, preserve existing scopes not whole-repo-clean claim. New source tests called by check, compiled check after build in CI, evidence screenshots masked/private-safe. Failure/timeouts close only owned browser/PHP/DB. Test actual bridge/cms manifests and public JS import closure; no lost existing301image/auth/analytics checks. Capture initial HTML, status/canonical routes, sitemap schema and sanitized generation/job receipts, not editor tokens or customer IP.
- [ ] **Step4 — full gate:** `npm run check`, `npm run build`, `node scripts/content-bundle-check.mjs <actual-bundle-dir>`. Expected: exit0 all three, exact sourceSHA/release evidence, no unexplained platform skip. Current bridge artifact must pass **bridge** acceptance (read-only503/current generated Blog); exercise the full compiled CMS workflow additionally with Task12's explicitly local-ID CMS variant, never claim that variant is the bridge artifact. CI runs both required branches; after final mode flip in Task14, full CMS acceptance must run on the exact official CMS release bundle before promotion. Run whole-change review against approved spec/plan/Review Focus; one fix pass with meaningful RED→GREEN + full green suite, no unrelated polish. Native method uses one fresh reviewer per executing-plans; do not dispatch self-review of this plan-writing step.
- [ ] **Step5 — commit:** `test: verify CMS publishing and SEO in compiled CI artifacts`.

### Task 14: Trusted bridge/CMS rollout, real publishing and handover

**Files:** Create `scripts/content-live-check.mjs`, `docs/content-cms-operations.md`, `docs/superpowers/reports/2026-11-14-content-cms-acceptance.md`; update `docs/{admin,build-and-deploy}.md`. Add AGENTS.md pointer only via writing-for-agents at execution if useful. Private host config/source manifests outside Git.

**Interfaces:** `verifyLiveContent({baseUrl,expectedRelease,fixtureState,evidenceDir}):Promise<Report>` uses designated disposable article/category/media fixture and existing authenticated account flow, keeps raw secrets/private data out of output; native host tooling uses same content capability/version and scoped reader contract as Task12. Live verification does not claim Google indexed a URL without Search Console observation.

- [ ] **Step1 — prepare concrete rollout:** confirm user authorization for publishing **this CMS feature**, reviewed exact source/artifacts, current hosting/domain/quota and paired backup. Copy/bootstrap reviewed ops/reader/config with per-file checksums and recoverable backup, no new deploy key. Keep CMS write gate off. Coordinate saving/closing or reloading old admin tabs before cutover: pre-bridge JS cannot be retroactively changed and any IndexedDB edits stay local, are not silently imported or erased. No DNS/Search Console permission/credential action inferred solely from a previous deployment. Before requesting any missing action-time approval, prepare exact destination/files/release/rollback result for review.
- [ ] **Step2 — trusted bridge first:** push reviewed bridge-mode normal commit only when publishing implementation authorized; main CI/check/build/compiled bridge acceptance must succeed. Promote exact artifact via production workflow/manual gate. Verify existing site/auth/relay and public reader readiness, bridge read-only semantics; record release as allowed rollback baseline. Do not cut Blog to CMS before this compatible baseline is live and retained.
- [ ] **Step3 — final CMS artifact:** normal commit changes `CONTENT_RELEASE_MODE` default from bridge to cms and manifest capability to7; no source behavior waived. Run complete CI/check/build/compiled acceptance on that exact final commit. Production preparation includes native paired restore, feature migration/status/import seed, valid initial generation, routing/load/canary. Deploy exact successful artifact, never rebuild on promotion. Website keeps old Blog until initial generation/routing is fully verified; controlled failure restores original routing/pointer.
- [ ] **Step4 — verify live operational flow:** designated test post/image and3-level category; save→draft404/private-image denied→publish202/job success→raw HTML200/body/meta/canonical/schema→Home/category/sitemap inclusion→working edit stays private→update→slug change301→unpublish404/excluded sitemap→restore draft. Test both hostnames, document navigation/JS off/mobile, login/refresh/profile and existing product images, dynamic analytics privacy and old-client assets. Retain fixture receipt before cleanup; restore/recover controlled fixtures through normal CMS operations, no deletion of real content.
- [ ] **Step5 — rollback drill within authorized window:** record current public generation/digests, roll back app to verified bridge baseline through normal workflow, assert same generated pages/previously public image URLs still work and CMS mutations disabled; forward same successful CMS artifact, assert working/public revisions, jobs/history/redirects/keys/analytics unchanged. No DB restore/down migration. Incompatible pre-bridge target refusal is checked in isolated test, not deliberately attempted as a destructive live cutover.
- [ ] **Step6 — SEO handover:** verify robots/sitemap and one real indexable article in Rich Results/URL Inspection if owner access exists; submit sitemap only in authorized property. Record property/observed index state without exposing account credentials; if no access or Google still pending, mark only that external gate pending, not an invented index time. Provide concise writing/alt/SEO fallback/publication error/restore instructions and compatible rollback IDs.
- [ ] **Step7 — record and commit:** exact CI/deploy/rollback/forward IDs, mode/sourceSHA/generation digests, native restore evidence, commands/results/screenshots, decisions and unmeasured limitations; plan ledger and runbook state must distinguish local/CI/live/Search Console. Commit `docs: record CMS production acceptance and operations`. Do not report live complete at build/push stage.

## Self-review before handoff

- Spec1–4 goals/approaches/scope → Global Constraints and14 tasks; design approved with3levels, no extra independent CMS/product project.
- Spec5–6 editing/categories → Tasks2/4/7/9; no status bypass, category publication separate, restore draft, max3 including reparent subtree, active semantics fixed.
- Spec7 media/sanitize → Tasks1–3/6/9/12; private→committed registry transition, worker bounds, no browser globals, code formatting parity and backup race covered.
- Spec8–10 interfaces/atomicity/PHP → shared contracts and Tasks6–8/10–12; one pointer source, post-pointer crash/canary, no createRoot/DB per public read, correct scoped routing.
- Spec11 SEO → Tasks5/6/8/10/12–14; old URLs/date/image kept, two-source sitemap, canonical production origin, aliases/404/raw HTML tested; no promise index/ranking.
- Spec12 authorization/analytics → Tasks4/7/9/10/13; permission recheck at activation, minimal lookups, dynamic allowlist and existing privacy semantics.
- Spec13–14 import/ops/acceptance → Tasks1/5/11–14; native paired restore, quota, bridge baseline and exact artifact source proof. Compatibility bridge is the plan's implementation choice for the spec's conditional pre-CMS rollback guarantee; original unaware app is not represented as safe.
- Type scan: all consumers use PostDraftInput/PostDto, PublicSnapshot, GenerationManifest, PublicAssetManifest, PublicationRequest/Job; no competing status string or DTO field name. Types introduced only as needed at Task2; actual asset population Task12, renderer uses typed fixture manifest until then.
- Five Review Focus lines each have named test owners. No spec gap identified. Code blocks define contracts/representative assertions, not implementation bodies. Commands/results above are **planned**, not claimed executed during plan writing.

## Execution handoff

Plan-writing changed only documentation. Recommend **Native** execution for this plan:14tasks are tightly coupled by schema/media/generation contracts, and one controller can keep those interfaces consistent with one fresh whole-change review. Subagent-driven execution remains an option if the owner prefers an independent reviewer gate after every task and accepts extra context/cost. Review this plan and choose the execution method before product implementation. Preserve a method already explicitly selected for this plan; do not repeatedly ask.

## Primary references checked while planning

- [sharp official installation](https://sharp.pixelplumbing.com/install/): Node-API/platform/optional dependency constraints require real host proof; package availability alone is not proof.
- [DOMPurify official README](https://github.com/cure53/DOMPurify) and [jsdom](https://github.com/jsdom/jsdom): use maintained server DOM with the existing sanitizer policy. `apostrophecms/sanitize-html` was archived when inspected; do not introduce it as the maintained default.
- Google Search Central links in the approved spec remain the SEO authority. No new external service/plugin or recurring automation is required by this plan.
