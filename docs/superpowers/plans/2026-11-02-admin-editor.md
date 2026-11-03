# Admin Article and Product Editors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver real self-hosted GPL TinyMCE editing, local persistence and unsaved-content previews for Vietnamese article/product forms matching the approved mockup.

**Architecture:** Retain entity services, permissions, IndexedDB, revisions and unsaved guards. Add a shared durable rich-content adapter and media resolver, a lazy TinyMCE wrapper, two focused form compositions and an editor-free preview renderer. Keep public static data and routes untouched.

**Tech Stack:** Existing React 19/TypeScript/Vite, react-hook-form, TanStack Query/Router, DOMPurify, IndexedDB, Vitest; `tinymce` 8.10.1, `@tinymce/tinymce-react` 6.3.1 and build-only `tinymce-i18n` 26.11.2, locked by npm.

**Spec:** `docs/superpowers/specs/2026-11-02-admin-editor-design.md` (read first).

## Global Constraints

- Chỉ UI, dữ liệu mẫu và lưu cục bộ trong trình duyệt; không kết nối backend/MySQL, không phát hành catalogue/blog public, không push/deploy.
- User superseded Tiny Cloud on 03/11 and explicitly accepted self-hosted GPL. Same-origin versioned vendor assets, `licenseKey='gpl'`, no API key/cloud/premium. Preserve license/notices and attribution. Never change BiBi's own license or repository visibility.
- Public catalogue has no prices/cart. Admin internal price/compareAt/stock/reserved remain intact.
- Stable media IDs in saved content, never persisted blob URLs/base64; JPEG/PNG/WebP, existing 5 MiB/40MP and 10-image limits remain.
- Legacy content remains readable; merely opening/previewing a record does not write or convert it.
- All admin-facing copy Vietnamese; accessible mobile/desktop layouts and existing admin theme/sidebar remain.
- Node24; use docs/build-and-deploy.md workflow. This existing worktree is the execution target; verify cleanliness before mutations, do not rewrite pushed history.

## Review Focus

1. Quick record navigation while async images resolve must not show/save the previous record's image (Task 2 race test).
2. Missing/invalid self-hosted assets or load error must not erase stored body or allow saving an empty replacement (Task 3 readiness test and Task 7 browser error case).
3. Pasted HTML with scripts/events or local blob URLs must not bypass content/media validation (Task 1 sanitizer test, Task 3 paste integration).
4. Revision conflict, role change or failed save must retain current edits and not navigate away (Task 4 lifecycle test).
5. Existing seed markers and user-edited content must survive inline-image seed upgrades (Task 6 preservation test).

## Files and responsibilities

- `content/rich-content.ts`: pure durable format adapter and sanitization; no editor runtime dependency.
- `content/media/resolve.ts`: asset URL/blob lease lifecycle shared by renderer/editor/MediaImage.
- `content/components/rich-content-view.tsx`: sanitized, media-aware read-only content.
- `content/components/rich-editor.tsx`: self-host integration, toolbar and media dialog; replaces Tiptap implementation.
- `shared/forms/editor-session.tsx`: focused reusable load/snapshot/permission/save/dirty lifecycle for posts/products only.
- `shared/forms/editor-fields.tsx`: reusable registered inputs, validation and scoped relation fields extracted without changing generic RecordForm behavior.
- `shared/forms/editor-preview.tsx`: accessible desktop/mobile preview overlay using plain renderer.
- `content/components/post-form.tsx`, `products/components/product-form.tsx`: module-specific compositions.
- `products/components/product-gallery.tsx`: ordered media selection and primary-image controls.
- Existing editor/detail routes, configs, registry/seed, admin styles and local documentation updated only where needed.
- New regression tests in `tests/admin/editor-*.test.{ts,tsx}`; acceptance evidence in `docs/superpowers/reports/2026-11-02-admin-editor.md`.

### Task 1: Durable rich content and compatibility

**Files:** Create `src/features/admin/content/rich-content.ts`, `tests/admin/editor-content.test.ts`; modify `src/features/admin/content/sanitize.ts` to retain a compatibility export if existing tests need it.

**Interfaces:** `readRichContent(raw: string): string` returns sanitized durable HTML; `writeRichContent(html: string): string` returns JSON `{format:'html-v1',html:string}`; `richContentText(raw: string): string` supports summaries. Media HTML uses `data-media-id` and `src='bibi-media:<id>'`; no runtime URLs.

- [ ] Write failing tests: plain text `'<script>literal</script>'` renders as text; Tiptap document preserves heading/list/quote/marks/link/mediaId; HTML envelope round-trips caption/alignment; malformed JSON is safe readable text, not a crash. Sanitizer removes script, onerror, iframe, javascript links, unknown image src, arbitrary CSS; keeps supported alignment only.
- [ ] Run `npm run test:admin -- tests/admin/editor-content.test.ts`; verify failure is missing adapter/behavior.
- [ ] Implement local structural legacy JSON types, traversal/escaping and DOMPurify allowlist. Images without valid media ID become safe fallback text rather than external requests. Link new-window rel is normalized. No Tiptap import.
- [ ] Run the focused test; expect PASS. Verify `readRichContent(writeRichContent(html))` is stable for supported fixtures.
- [ ] Commit only adapter/tests with `feat: preserve rich content across editor migration`.

### Task 2: Stable media display and renderer

**Files:** Create `src/features/admin/content/media/resolve.ts`, `src/features/admin/content/components/rich-content-view.tsx`, `tests/admin/editor-media.test.tsx`; modify `src/features/admin/content/components/media-image.tsx`.

**Interfaces:** `resolveMedia(store: AdminStore, id: string): Promise<{url:string;release:()=>void}>`; `RichContentView({value,className?}:{value:string;className?:string})`. Consume Task 1 adapter. Resolver rejects arbitrary external URLs; permit bundled root-relative asset URLs from seeds and Blob-backed imports, not protocol-relative URLs.

- [ ] Write failing tests for asset.url, blobKey different from id, missing blob, A→B navigation resolving A last, release after unmount, mediaId retained in serialization; no arbitrary external fetch.
- [ ] Run `npm run test:admin -- tests/admin/editor-media.test.tsx`; confirm intended failures.
- [ ] Implement lease cleanup with cancellation/generation protection. Render sanitized content and resolve inline media IDs; missing images get a labeled fallback. Update MediaImage to share resolver and clear stale URL when id changes.
- [ ] Focused tests PASS; renderer does not import/init TinyMCE and never writes IndexedDB.
- [ ] Commit `feat: resolve local editor media without transient saved URLs`.

### Task 3: Self-hosted GPL editor and generated local assets

**03/11 superseding delivery steps:** Install pinned core and wrapper plus build-only Vietnamese translation. `scripts/prepare-tinymce.mjs` copies selected runtime/plugins/skins, language and license notices from node_modules to ignored `public/vendor/tinymce-<version>`. Invoke it from existing postinstall/dev/prebuild hooks, preserving backend/ops setup. Test generated files against a disposable fixture root; verify the real editor uses same-origin scripts/styles and works without API key or Cloud requests. The remaining form/media/readiness requirements below still apply; all former Cloud-key prerequisites are replaced by presence of valid generated local assets.

**Files:** Modify `package.json`, `package-lock.json`, `.env.example`, `src/features/admin/content/components/rich-editor.tsx`; create `src/features/admin/content/components/tiny-config.ts`, `tests/admin/editor-selfhost.test.tsx`. Find existing Vite env typing before adding a declaration file if needed.

**Interfaces:** `RichEditor({value,onChange,scope?,label?,onReadyChange?})` where value/onChange are durable strings, scope is `'content'|'products'|'bookstore'`, readiness is boolean. Tiny config derives a base-aware local asset path from installed version. Do not use RichEditor for read-only views.

- [ ] Write failing tests with a mocked vendor boundary for asset error/retry, local GPL config, editor initial value converted from legacy content, no onChange on initialization, current unsaved content survives theme changes, editing emits sanitized envelope, runtime blob src normalized to mediaId, readiness false blocks unsafe save, record switching does not retain old callbacks.
- [ ] Run `npm run test:admin -- tests/admin/editor-selfhost.test.tsx`; confirm intended failures.
- [ ] Install pinned official core/wrapper and language package after GPL confirmation. Confirm React compatibility using package metadata/docs; prepare local assets and retain license notices. Remove the obsolete Cloud key entry from local configuration without printing its value.
- [ ] Implement editor with Task 1/2 adapters; pinned local script and `licenseKey='gpl'`, record-keyed instance, Vietnamese language, theme-aware skin/content styling, only lists/link/wordcount and custom media picker. Toolbar: undo redo, blocks paragraph/H2/H3, bold italic underline, lists, align, blockquote, link, media picker, removeformat. No AI/media-upload service.
- [ ] Wire existing MediaPicker through a custom toolbar dialog, retain selection, insert figure/image/alt/caption; prevent arbitrary pasted/dropped base64/remote images from bypassing picker. Use runtime media leases without persisting src; no normalization loop/caret jumps on each keystroke. Error/retry preserves body and fields; reset readiness on teardown.
- [ ] Focused tests PASS; manually verify local runtime/language/skins load without Cloud (final acceptance in Task 7).
- [ ] Commit `feat: integrate lazy self-hosted GPL rich editor`.

### Task 4: Shared lifecycle and article form

**Files:** Create `shared/forms/editor-session.tsx`, `shared/forms/editor-fields.tsx`, `content/components/post-form.tsx`, `tests/admin/editor-post.test.tsx`, `tests/admin/editor-session.test.tsx`; modify `content/pages/editor.tsx`, `shared/forms/record-form.tsx` (reuse field controls only), `services/validation.ts` if uniqueness validation is missing. Paths are under `src/features/admin` unless tests.

**Interfaces:** `useEditorSession(entity: 'posts'|'products', id?:string)` returns `{initial,loading,error,canEdit,busy,save(values:FormValues):Promise<void>,dirtyChanged(dirty:boolean):void,blocker}`; saves via existing runtime.service, snapshot revision and editable field allowlist. `PostForm({initial,onSave,onDirtyChange,onCancel})` consumes the same durable values contract. Field primitives consume RHF control/register and existing FormField definitions, with resource-scoped relation queries.

- [ ] Write failing lifecycle tests: create/update permission, stale snapshot guard, failed save/revision conflict retains edited values, no navigation on error, dirty remains until successful save, missing editor readiness does not overwrite body. Article tests cover required title/slug/author, slug generation stops after manual editing and never overwrites existing slug; save draft vs selected status; hidden optional fields preserved.
- [ ] Run `npm run test:admin -- tests/admin/editor-session.test.tsx tests/admin/editor-post.test.tsx`; confirm intended failures.
- [ ] Extract only reusable field controls, preserve generic RecordForm consumers. Implement session with loading/error retry, role guard, revision-aware save, query invalidation, success dirty reset and existing unsaved guard. Do not create a new generic form framework.
- [ ] Compose approved two-column article layout: title/slug/excerpt/editor/SEO, metadata and cover; one column at narrow widths. Scope content media permissions. Use real category/tag/author relations, not hardcoded sample options. Header actions support local create/update/draft without implying public publication.
- [ ] Route article create/edit to focused form; tests PASS, existing forms/edit-snapshot tests stay green.
- [ ] Commit `feat: add article editing workflow and local draft lifecycle`.

### Task 5: Product form and unsaved-content previews

**Files:** Create `products/components/product-form.tsx`, `products/components/product-gallery.tsx`, `shared/forms/editor-preview.tsx`, `tests/admin/editor-product.test.tsx`, `tests/admin/editor-preview.test.tsx`; modify `products/pages/editor.tsx`, `products/config.tsx`, `shared/record-editor.tsx`, `products/pages/detail.tsx`, `content/pages/detail.tsx` as consumers require; add scoped styles in existing admin style location after locating it.

**Interfaces:** `ProductForm` same lifecycle props as PostForm; `ProductGallery({value,onChange,disabled?})` uses ordered string[] media IDs, first primary. `EditorPreview({open,onOpenChange,snapshot})` snapshot discriminated union `{kind:'post',record:FormValues}` or `{kind:'product',record:FormValues}`. Consume Task 2 renderer and Task 4 lifecycle.

- [ ] Failing product tests: SKU/slug validation, gallery add/reorder/primary/remove with 10 limit, internal price/stock/reserved preserved, product type and collection independent. Failing preview tests: current unsaved title/body/images used, no save calls, no price/cart, focus return/Escape and desktop/mobile mode; detail renders content instead of envelope JSON.
- [ ] Run `npm run test:admin -- tests/admin/editor-product.test.tsx tests/admin/editor-preview.test.tsx`; confirm intended failures.
- [ ] Implement product layout per approved mockup and scoped media picker. Store rich description via adapter; audit all admin description consumers so no JSON leaks into detail/search summaries/exports meant for plain text. Keep generic modules functional.
- [ ] Implement preview overlay using shared existing Modal/accessibility primitives, width modes and public typography/crops. Article preview includes cover/metadata/rich body; product includes gallery/type/collection/rich body/contact. Use contact links/settings consistent with public site, not a new sales flow. Do not import static data routes or initialize editor in preview.
- [ ] Replace read-only RichEditor usage with RichContentView. Focused and existing form/detail tests PASS.
- [ ] Commit `feat: add product editing and responsive content previews`.

### Task 6: Seed images, cleanup and developer documentation

**Files:** Modify `content/seed.ts`, `demo/registry.ts` or add a focused `content/seed-upgrade.ts`, `products/seed.ts` only if needed, `package.json`, lockfile, `docs/admin.md`, `docs/build-and-deploy.md`; create `tests/admin/editor-seed.test.ts`.

**Interfaces:** additive media upgrade `ensureContentMedia(store:AdminStore):Promise<void>` triggered by content ensure path when needed; deterministic IDs per article/image index. Never overwrite existing posts/products/media or reset storage.

- [ ] Failing test: new seed retains inline image alt/caption and cover; repeated upgrade is idempotent; existing seed marker/user-edited post and custom gallery remain byte-for-byte unchanged; missing deterministic assets only are inserted. No fabricated product specs/images.
- [ ] Run `npm run test:admin -- tests/admin/editor-seed.test.ts`; confirm intended failures.
- [ ] Seed rich content from existing public blog blocks via adapter and stable media IDs; all product imagery references correspond to that product. Existing records are not rewritten automatically.
- [ ] Search repository for all Tiptap imports/JSON types and replace consumers with local compatibility types. Uninstall unused Tiptap packages only once no runtime consumer remains. No changes to backend dependency lockfiles unless tooling requires them.
- [ ] Document self-hosted GPL asset preparation, local startup, local-only saving and missing-asset retry. No API key required; retain vendor license/notices. Never promise production publishing.
- [ ] Focused tests PASS; commit `refactor: complete editor media seeds and remove unused Tiptap runtime`.

### Task 7: Full verification and reviewable local handoff

**Files:** Create `docs/superpowers/reports/2026-11-02-admin-editor.md`; update plan checkboxes with actual results. No production or workflow mutations.

- [ ] Run `npm run check` with Node24; inspect full result and fix failures, not only exit code/tail. Run `npm run build`; record artifact ID/checksum and actual bundle measurements. Use normal documented build/preview commands and explain tooling workarounds if required.
- [ ] Verify local TinyMCE core/plugins/skins/language load from the generated versioned directory without API key. Do not report mocked vendor unit tests as live TinyMCE success.
- [ ] On actual local app use browser UI to create/edit/save/reload article with formatted text, link, local image alt/caption and cover; preview current unsaved draft in both modes. Verify source string is durable, not blob URL, without exposing credentials.
- [ ] Repeat for product: gallery reorder/primary/remove, detail description, internal fields preserved, public preview no prices/cart. Test asset error/denied readiness and switching between records/routes without stale images or crash. Do not mutate production settings.
- [ ] Test 1440/768/390 widths and keyboard dialog interactions. Capture screenshots of the implemented forms and previews, inspect images, overflow, toolbar usability, dark theme and save buttons. Reset temporary viewport afterward.
- [ ] Confirm public homepage/product/blog/dashboard/list routes do not request TinyMCE on a fresh page; inspect network/resource entries and compare build chunks. Preserve static data files, gallery, sidebar and business flows.
- [ ] Record commands, pass counts, actual browser outcomes, screenshots and limitations in acceptance document. No unsupported claims if network/key prevents editor verification.
- [ ] Request final code review under applicable skill; fix actionable findings and rerun checks justified by those changes. Commit verified source/docs and present local URL/screenshots. No push/deploy.

## Self-review

All spec sections map to Tasks 1–7; all five Review Focus items have explicit test/browser cases. Adapter signatures and durable-string value contract are consistent across editor, form, renderer and preview. Delivery changed to self-hosted GPL by explicit user instruction and GPL confirmation on 03/11; the Cloud key is no longer used. Implementation findings/rulings are retained in the execution ledger and final acceptance report.
