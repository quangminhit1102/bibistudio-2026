# Responsive audit — BiBi Studio catalogue (review only)

Scope: source review only for this pass. No browser test, edit, dependency update, commit or publish has been done. Every finding below comes from reading the source. Each one is marked **Source-confirmed** (the class or line is in the code) or **Inferred** (a likely effect that needs a check at real widths). Keep as-is: Lora headings, the 3x magnifier, bidiary social links, the removed footer wordmark, reduced-motion behaviour, and no shop/cart.

## Findings

| # | Area / file | Finding | Evidence | Severity |
|---|---|---|---|---|
| 1 | Home, Explore Vietnam (`src/routes/index.tsx:103, 227-228`) | `productsByCollection("explore-vietnam").slice(0, 3)` puts 3 cards in `grid-cols-2 sm:grid-cols-3`. Below 640px the second row has one empty cell. | Source-confirmed | High (visible on every phone) |
| 2 | Home, "What we make" rows (`index.tsx:207`) | `grid-cols-[3rem_1fr_auto] gap-6` on mobile: the `1fr` column has no `min-w-0`, so long Vietnamese type names can push the arrow column out at 360px. | Inferred | Medium |
| 3 | Home hero (`index.tsx:114`) | `min-h-[calc(100svh-77px)]` hard-codes the header height. Header height changes between breakpoints (logo `h-10 sm:h-11`), so the hero may end slightly past the first screen on some sizes. | Inferred | Low |
| 4 | Product detail (`products.$slug.tsx:75, 92, 114, 121`) | Uses `px-6`; other pages use `px-5 sm:px-6`. Gutters change between pages at 360/390. | Source-confirmed | Low |
| 5 | Product detail, related strip (`products.$slug.tsx:164`) | Card widths `w-[62vw] sm:w-[40vw]` use the viewport, not the container. At 768–1023 (tablet, before `md` width calc) about 2.4 cards show. That works, but the outer padding is not counted, so the last card may sit under the edge. | Inferred | Low |
| 6 | Product detail, mobile bottom bar (`product-contact-bar.tsx:17`) + floating contact (`floating-contact.tsx:76`) + back-to-top (`back-to-top.tsx:17`, `bottom-20 right-3`) | Three fixed bottom-area elements below `md`. On product pages the floating bar is supposed to hide. `bottom-20` for back-to-top may overlap the product bar, which is taller with safe-area padding on iPhone. | Inferred (the hide logic needs a runtime check) | Medium |
| 7 | Product page bottom padding | `pb-28` on the content. Whether the last related card clears the fixed product bar on 360px with safe-area inset is unconfirmed. | Inferred | Low |
| 8 | Products listing filter sheet (`products.index.tsx:148-150`) | `max-h-[85svh]` with safe-area padding looks correct. Need to check that body scroll locks and the sheet's sticky "Xem … sản phẩm" button is reachable at 360×640. | Inferred | Low |
| 9 | Quick search (`quick-search.tsx:55`) | `grid-cols-2 sm:grid-cols-3 md:grid-cols-4`. Fine. An odd number of results leaves a gap, which is acceptable for search. | Source-confirmed | Info |
| 10 | Journal listing (`blog.index.tsx:74, 88`) | Uses `px-4`; the site standard is `px-5 sm:px-6`, so gutters don't match. | Source-confirmed | Low |
| 11 | Contact map (`contact.tsx:65-74`) | `md:grid-cols-[1.7fr_1fr]` at 768px leaves the address panel about 260px wide. The two buttons ("Chỉ đường", "Mở trong Google Maps") may wrap awkwardly. | Inferred | Medium |
| 12 | Footer (`site-footer.tsx:27, 83, 96`) | `sm:grid-cols-2` between 640 and 1023, then 4 columns at `lg`. The map tile uses `h-[180%] -translate-y-[20%]` inside an overflow container; confirm the parent has `overflow-hidden`. Copyright `pb-24` clears the floating bar. | Inferred | Low |
| 13 | Header nav (`site-header.tsx`) | 6 desktop items with `xl:gap-9`. Between `lg` and `xl` (1024–1279), 6 items plus the logo, search, language and call button may get crowded or wrap. | Inferred | Medium |
| 14 | `/api-test` route | Dev/test page still in the routes. Check whether it should stay public; not a layout issue. | Source-confirmed (file exists) | Info |

## Recommended scoped changes (approve per item)

1. **Explore Vietnam, 4 products (fixes #1).** In `index.tsx:103` change `.slice(0, 3)` to `.slice(0, 4)`. In line 227 change the grid to `grid-cols-2 gap-4 lg:grid-cols-4`, which gives 2×2 on phone and tablet and 4 in a row on wide desktop. Inside the 2-column `md` split, 4 columns at 1024 may be narrow; a safer option is `grid-cols-2` at every width (always 2×2). Recommended: always 2×2, because it fits the half-width text/product split.
2. **Row overflow guard (#2).** Add `min-w-0` to the middle text cell of the "What we make" rows, and `shrink-0` to the arrow.
3. **Consistent gutters (#4, #10).** Change `px-6` to `px-5 sm:px-6` on product detail, and `px-4` to `px-5 sm:px-6` on the journal listing.
4. **Bottom stack on mobile (#6, #7).** On product pages, lift back-to-top above the product bar (for example `bottom-[calc(5rem+env(safe-area-inset-bottom))]` when the product bar is present). Confirm the floating contact hides there.
5. **Contact panel at tablet (#11).** Move the 2-column map layout from `md:` to `lg:`, so tablet stacks the map above the address panel.
6. **Header at 1024–1279 (#13).** Only if the check shows crowding: reduce the gap at `lg` (`lg:gap-6 xl:gap-9`), or move the language switcher into the utility area.
7. Leave #3, #5, #8, #9, #12 and #14 unless the browser check shows a real problem.

## Verification (to run after approval)

Playwright at widths 360, 390, 768, 1024 and 1440 (height 1800; also 360×640 for the sheets). Pages: `/`, `/products` (filter sheet open, search open), `/products/notebooks`, one product detail (gallery, fullscreen viewer, related strip), `/collections`, `/collections/greeting-cards` (sticky occasion bar), `/collections/explore-vietnam`, `/blog`, one article, `/about`, `/contact`.
Checks:
- `document.documentElement.scrollWidth <= innerWidth` (no sideways scroll).
- No broken images.
- The Explore Vietnam grid shows 4 cards in 2×2 with no empty cell.
- Fixed bottom elements don't overlap each other or the last content.
- Header doesn't wrap at 1024.
- Repeat with reduced motion turned on.

Screenshot each viewport. Report observed results apart from what the source suggests.
