# BiBi Admin + homepage — read-only audit and proposed rules (commit ddfdd4c)

This is an audit only. No browser was run. "Confirmed" means read in source; "Hypothesis" needs your browser check.

## A. Source-confirmed root causes

1. **Invisible "Sửa" link on slip detail (dark mode)** — `admin.css:67` `.admin-root a { color: inherit }` (specificity 0,1,1) beats `.a-btn-primary { color: var(--a-on) }` (0,1,0, line 362). A `<Link className="a-btn a-btn-primary">` inherits `--a-text` (#fafafa in dark) on `--a-accent` (#fafafa) → white on white. In light mode it happens to look right only because both are dark-on-dark… actually #18181b on #18181b, also invisible unless parent colour differs. Same applies to `.a-btn-destructive` (`#fff`) and any variant that sets `color` on an `<a>`.
   - Rule: scope the reset to `.admin-root a:not(.a-btn)` or raise button selectors to `.admin-root .a-btn-*`. Add `:focus-visible`, `[aria-disabled]`, `[data-loading]` states for all variants; destructive hover needs its own darker token, not `opacity`.
2. **Sidebar footer shows role, not account** — `admin-layout.tsx:141-144` hardcodes initials "MN", shows role name with fallback "Demo", subtitle "Dữ liệu trên trình duyệt". Profile query (`getProfile`, line 37-41) already exists but is not used there. Rule: footer = avatar(initials or image) + display name + role; whole block is a dropdown with only "Hồ sơ" and "Đăng xuất".
3. **"Trang trong {label}" intermediary** — `admin-layout.tsx:118-122` renders a `<details>` summary for every item with children. Rule: render children as flat indented links under a group heading; keep `item.resource` permission filtering and existing paths; hub/index routes (`admin.products.index`, etc.) redirect to their first allowed child.
4. **Report chart labels** — `chart.tsx:89-97` vertical bars use fixed `YAxis width={120}` and truncate at 20 chars; `reports.tsx:198` builds labels as `name · id.slice(0,12)`, so long Vietnamese names lose the ID or vice-versa, and tooltip receives the truncated composite string. Rule: pass `{label, fullLabel, id}`; axis shows short label, tooltip shows full name + ID; width computed from container (e.g. 35% clamp 96–220px); on <640px swap chart for a ranked list with bars inline.
5. **Spacing above "Tổng kết sản phẩm"** — `reports.tsx:205` sibling `<section>`s have no shared vertical rhythm class; spacing depends on children. Rule: one `.a-section-stack` (gap 32px desktop / 24px mobile) wrapping all page sections, `h2` margin-bottom fixed.
6. **Visible demo wording** — found in ≥40 admin files, e.g. `admin-layout.tsx:213,218-220,227,234` ("Đăng xuất demo", demo strip, footer "Admin demo"), `reports.tsx:153`, `slip-editor.tsx:62`, `transactions.tsx:7,25`, `orders.tsx:9`, `order-detail.tsx:46,143,158,216`, `global-search.tsx:30,60`, `navigation.ts:119` ("Bảo mật demo"). Code identifiers (`DemoSession`, `demo/registry`) are not visible and can stay.
7. **Homepage dots** — `index.tsx:38` dot group lives inside `HeroSlides`, which is inside `animate-unveil` (`clip-path` inset 10%/14% at start, `styles.css:255`) and inside `<Parallax strength={90}>` (translated layer). The dots therefore move with parallax and are clipped by the unveil clip-path and any overflow of the parallax wrapper.
   - Rule: render dots as a sibling of `<Parallax>` in the `relative` hero container (not transformed, not clipped), `z-10`, bottom-centre. Simplify: drop the blurred pill, keep 44px buttons, 6px ring / 8px filled active. Keep 5500ms autoplay and reduced-motion check.

## B. Hypotheses needing browser verification

- Light-mode primary link-buttons may also lose contrast wherever a parent sets colour (item 1).
- Parallax wrapper `overflow-hidden` clipping dots on scroll at 360/390 widths.
- Recharts tooltip overflow off-screen on mobile.
- Dark-mode contrast of `--a-muted` (#a1a1aa) on `--a-hover` for small 11px text.
- Component catalogue (`components/catalogue.ts`, 34 `id:` entries found, not the 96 you cited — the rest may be nested examples): keyboard focus traps in overlays, Escape handling, disabled/loading states, mobile drawer focus return. Needs a per-example pass; I did not open each.

## C. Status semantics (proposal, not decided)

- People (customers, accounts): **Active / Inactive** — reversible, record kept.
- Content (products, articles): **Draft / Published / Hidden** — Hidden = was published, removed from public listing.
- Purchase slips: **Saved / Void** — Void is terminal, excluded from reports, number never reused.
- Badges: one colour per meaning across modules (green active/published/saved, neutral draft/inactive, amber hidden, red void).
- Language: needs your decision — full Vietnamese, full English (Catalog/Products/Add Product/Categories/Product Inventory), or English nav + Vietnamese content. Mixing per screen should be avoided.

## D. Synthetic data rule (needs scope confirmation)

- Remove visible demo labels and the "reset demo" control from UI; keep a non-destructive migration that only fills missing seed records and never overwrites user-edited ones; keep legacy IDs/links.
- Seed names/links from the real catalogue and journal slugs.
- Internal docs (`AGENTS.md`, README) keep stating data is stored in the browser. Not adding real auth, MySQL or tracking.
- Open question: should the visitors page stay at all without a disclosure, since its data is not real tracking?

## E. Verification matrix

| Check | 360 | 390 | 768 | 1024 | 1440 | Dark | Keyboard |
|---|---|---|---|---|---|---|---|
| Slip "Sửa"/destructive buttons visible, hover/focus/disabled | x | | x | | x | x | x |
| Sidebar footer name/avatar + menu (Hồ sơ, Đăng xuất) | drawer | drawer | x | x | x | x | x |
| Flat catalog nav, permissions hide items | x | | x | | x | | x |
| Report chart labels + full tooltip / mobile list | x | x | x | x | x | x | |
| Section spacing reports | x | | x | | x | | |
| No visible demo text (search "demo", "mô phỏng") | all | | | | | | |
| Hero dots not clipped while scrolling, reduced motion | x | x | x | x | x | | x |

## F. Optional missing components (do not build without confirmation)

1. Combobox with search — customer/product pickers on slips; faster than long selects.
2. Confirm dialog with typed reason — voiding slips; prevents accidental void.
3. Empty state block — every list; consistent guidance.
4. Status badge component — enforces section C colours.
5. Mobile card list for tables — avoids horizontal scroll.
6. Skeleton loaders — perceived speed.
7. Unsaved-changes guard — forms.
8. Date-range / year picker — reports filter.

## G. Profile page refinement (design only, for your local source)

Based on your description, not on your local files. Only the order and the visuals change. Auth, Master read-only, explicit image save, dirty guards and upload limits stay as they are.

Order: PageTitle "Hồ sơ" → avatar card → "Thông tin tài khoản" (SelfProfileForm) → "Vai trò" card.

```tsx
<Card className="a-profile-hero">
  <div className="a-profile-avatar">
    {preview ?? current ? <img src={preview ?? current} alt="Ảnh đại diện" /> : <span>{initials}</span>}
  </div>
  <div className="a-profile-meta">
    <h2>{displayName}</h2>
    <p>@{username} · {roleLabel}</p>
    <small>JPG, PNG hoặc WebP · tối đa {limit} · ảnh vuông hiển thị đẹp nhất</small>
    {error && <p role="alert" className="a-field-error">{error}</p>}
  </div>
  <div className="a-profile-actions">
    {!dirty ? <>
      <label className="a-btn a-btn-secondary">Chọn ảnh<input type="file" hidden accept="image/*" disabled={readOnly} /></label>
      {current && <button className="a-btn a-btn-ghost" disabled={readOnly}>Gỡ ảnh</button>}
    </> : <>
      <button className="a-btn a-btn-ghost">Hủy</button>
      <button className="a-btn a-btn-primary" aria-busy={saving}>Lưu ảnh</button>
    </>}
  </div>
</Card>
```

```css
.a-profile-hero{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:20px}
.a-profile-avatar{width:88px;height:88px;border-radius:50%;overflow:hidden;border:1px solid var(--a-border);background:var(--a-hover);display:grid;place-items:center;font-weight:600;font-size:24px}
.a-profile-avatar img{width:100%;height:100%;object-fit:cover}
.a-profile-meta{min-width:0;display:grid;gap:2px}
.a-profile-meta h2,.a-profile-meta p{overflow-wrap:anywhere}
.a-profile-meta p,.a-profile-meta small{color:var(--a-muted)}
.a-profile-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.a-profile-actions label:has(input:disabled){opacity:.5;pointer-events:none}
@media (max-width:640px){
  .a-profile-hero{grid-template-columns:1fr;justify-items:center;text-align:center}
  .a-profile-actions{justify-content:center;width:100%}
  .a-profile-actions .a-btn{flex:1 1 0;min-height:44px}
}
```

Notes:
- Show Hủy/Lưu only while a new image is chosen, so one clear next step is visible at a time.
- The hidden file input inside a `label` needs a visible focus ring: `.a-profile-actions label:focus-within{outline:2px solid var(--a-accent);outline-offset:2px}`.
- Master read-only: show buttons disabled with a short muted line ("Tài khoản Master chỉ xem"), don't hide them.
- If buttons are `<a>`/`<label>`, the colour bug in A1 applies; check the primary button in dark mode.
- Check at 360, 768 and 1440 px, light and dark: no overflow with a long name or email.

## Open decisions for you

- Admin language (section C).
- Whether the visitors page keeps any disclosure (section D).
- Whether hub routes redirect or stay reachable by URL.
