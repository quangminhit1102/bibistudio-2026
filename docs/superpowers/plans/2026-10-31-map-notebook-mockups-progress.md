# SDD ledger — plan: docs/superpowers/plans/2026-10-31-map-notebook-mockups.md

- Spec approved, including “Sổ tay bản đồ + địa danh” and new-only galleries. Execution is Native with one final independent review. Base de41d705429d8dc4fa9025d4b3868a984984f2a8; existing linked worktree verified, branch codex/map-notebook-mockups.
- Pre-flight Tasks1→2:13 ASCII WebP URLs match place keys from the approved mapping; Task2→3:existing Product interface and routes unchanged, browser checks consume the actual built catalogue. No interface conflict.
- Content-only change: follow approved plan's data/build/browser verification; no application logic or mirrored unit tests added. Baseline sandbox check could not exercise local networking/process tests; rerun outside sandbox before product edits.
- Task1 in progress: Pillow10.3.0 with WebP already installed. No new application dependency. Approved image conversion uses ordinary resize/compression, no generative editing.

- Baseline outside sandbox: Node24 npm run check exit0, 51 tests/50 pass/0 fail/1 Windows POSIX skip; types/lint/catalogue green.
- Task1: complete. All13 PNGs 1983×2366 converted using Pillow WebP quality88/method6 to1676×2000 without crop/upscale; visually inspected all13. Total103582497→6520374 bytes (93.7% reduction), maximum547648 bytes; all below600KB, all decoded. Source hashes below retain provenance.

| Source → output place | Source SHA256 | WebP bytes |
|---|---|---|
| MOCKUP_DN.png → da-nang | fe04ca3c5d8ce08a4621bf4c8df05f118c2c8d5bb57e7c71471087424e251f01 | 481160 |
| MOCKUP_HG.png → ha-giang | a6069bd90852613473b04afa93c7d4b40fec7ce0b1b0bd57237f9953d7b2a203 | 504484 |
| MOCKUP_SG.png → sai-gon | 17a91aecbd3f86d0a9c39654baeb009ace8507ead701ccfc14124f8d969c06de | 536738 |
| MOCKUP_CA MAU.png → ca-mau | 93cca09903cfa3d65b28ae5b79b4cd04de85dbbe5a6136b3d4328ec687d62e9a | 506710 |
| MOCKUP_DA LAT.png → da-lat | 3d19b6c4c96a8bf7bcbded6f37d568ecdff7f692ba73a027090eb251c88bf6a1 | 446390 |
| MOCKUP_HN.png → ha-noi | 009f1618ba906b340b342d544c28e79bfd1bb200723f3585500baefbc1a2f9ba | 547648 |
| MOCKUP_HOI AN.png → hoi-an | 82597920f807c5779db92508de274f208a5dde5a86c2650011dd7e82b5d8755e | 484584 |
| MOCKUP_HUE.png → hue | f0cb928192e312bf8ac40b8783a3326f490f0bf26cf18c165520636a2023397d | 483912 |
| MOCKUP_NHA TRANG.png → nha-trang | beb7f329691824800fa460c9acd596faf8025557720404cf5e45c3afe59127eb | 530190 |
| MOCKUP_PHU YEN.png → phu-yen | b3e3d93a916c0e7a1023a03270107c73c8af33392b3fc056a8f35aa6394da892 | 537412 |
| MOCKUP_PQ.png → phu-quoc | 5d35e0a602469fb1b66a40a7e9209df4ee8369293d1afb3980e2de906b5d868e | 445922 |
| MOCKUP_QUANG NINH.png → quang-ninh | c01f29146b7df59cc398bcfc89d3c223dfd9f2a8c15304a09499ce638c0104f3 | 529250 |
| MOCKUP_VN.png → viet-nam | 61ad68f2e45d93ae1ac98ee10d95b54d5ced1f8c3a60e81d06045feda0dfefb2 | 485974 |

- Task2 content verification was run before edits and failed on expected product count; after3 updates/10 additions it passes. Existing unrelated product lines, collection/type data and helpers unchanged; all13 target galleries are single new mockups. Details in the saved verification report at acceptance.
- Task2: complete. Actual content verification64→74 products, unrelated records unchanged. Node24 npm run check exit0:51 tests/50 pass/0 fail/1 POSIX skip; types/lint/catalogue pass. One verification print initially hit Windows encoding after assertions; rerun with UTF-8 exited0.
- Task3: Ruling: existing `npm run build -- --preview` creates the artifact but exits1 on an unsettled top-level await: build.mjs awaits preview.mjs, which statically imports build.mjs. No tooling changes in this catalogue task; use `npm run build` (exit0) then standalone `node scripts/preview.mjs .releases/local-96d280bdc96a0317907250f3eaf36e9db7673d6d` (serves4173). Cost if left unresolved: the combined preview shortcut still fails; independent build and preview remain usable.
- Task3: complete. Local release `local-96d280bdc96a0317907250f3eaf36e9db7673d6d`; FE/BE visibly match at /api-test. Browser visited13 details at desktop1309×818 and mobile390×844; all had matching title/new image,1676×2000 natural dimensions, object-contain, no mobile horizontal overflow. Desktop representative detail/fullscreen/list/search also checked at1440×900 after compensating existing browser zoom.
- Both /products/notebooks and /collections/explore-vietnam render13 map cards, one new image each; no old secondary hover image remains. Search “Sổ tay bản đồ Đà Lạt” returned exactly1 correct result. Fullscreen opened/closed on desktop Đà Lạt and mobile Việt Nam with1/1. No image/gallery component changes were needed.
- Independent HTTP local acceptance: all13 WebP URLs return200, image/webp and exact recorded hashes; /api/version matches the built release. Node24 build exits0 (existing chunk-size warning). Content verifier64→74/unique slugs/unrelated records unchanged and browser-report acceptance both exit0. No push or live deploy performed for this change.
- Browser proof directory: C:/Users/Admin/.codex/visualizations/2026/10/20/01a15a26-a0cd-7650-bf39-5920671482d5. Files: map-notebook-desktop.png, map-notebook-mobile.png, map-notebook-fullscreen.png, map-notebook-mobile-fullscreen.png, map-notebook-search.png, map-notebook-collection.png, map-notebook-new-products.png, map-notebook-browser-report.json. Temporary viewport override reset after verification.
- Final whole-branch review679c2fc..810c880: fresh read-only reviewer approved; no Critical/Important/Minor product findings. Reviewer decoded13 committed WebPs and checked cover/file mapping, complete notebook/title, maximum547648 bytes, preserved URLs/featured and unrelated scope.
- Final: Ruling: reviewer declined production deployment — no live rollout is claimed or performed; this task ends with reviewed local implementation as approved plan states. Cost if mistaken for live acceptance: the public website still shows its previously deployed release.
- Final: Ruling: reviewer declined physical-device behavior and relied on recorded Edge responsive/fullscreen checks — browser mobile390×844 is verified, actual phone hardware is not. Cost: device-specific touch behavior remains unproven.
- Final: Ruling: reviewer noted no independent pointer Magnifier/related-link evidence — executor additionally clicked desktop main image, observed the new mockup lens background at260%, then clicked the related Đà Nẵng card from Đà Lạt and observed its exact URL/h1. No defect found; image component unchanged. Cost: this is representative interaction coverage rather than thirteen repeated interaction checks.
- No deferred minor product findings. Separate known preview-shortcut tooling limitation remains recorded above; separate build/preview succeeds. Branch kept local for review; no shared integration or production publish implied.

## Production acceptance — 01/11/2026

- User explicitly requested preview re-verification then production deployment. Node24 check repeated:51 tests/50pass/0fail/1POSIX skip; standalone build exit0 at e1df4d2348eb9e06426afd7584c86a982c8f3278. Fresh local preview13/13 detail images, API FE/BE match and mobile gallery verified again; all13 preview image responses MIME/bytes/hash/decoder checked against source.
- Fast-forward push to main and feature branch completed without history rewriting. [Main CI41255894313](https://github.com/quangminhit1102/bibistudio-2026/actions/runs/41255894313) SUCCESS, same-repo main push; artifact13062759573 named release-e1df4d2348eb9e06426afd7584c86a982c8f3278-41255894313, unexpired. Local preview artifact was not used for deploy.
- After user re-opened Edge, manually dispatched [Deploy production41261096084](https://github.com/quangminhit1102/bibistudio-2026/actions/runs/41261096084), reviewed and approved the production environment. Job124714344324 completed SUCCESS in2m25s. No keys/permissions/workflow policies changed.
- Receipt event deployed: releaseId e1df4d2348eb9e06426afd7584c86a982c8f3278-41255894313; previousReleaseId0bc74538db34e673123370cfc422f449e7823533-41188480787. HTTP smoke, browser product/API smoke and already-open client2 retained uncached assets passed. Existing rollback/autorecovery preserved; no new rollback drill performed.
- Independent production HTTP smoke exit0, all13 new WebP files return200/image-webp and exactly match local source bytes/SHA256. www/api/version matches the release; /node-test200. Node direct TLS initially reset; rerun through existing environment proxy (`--use-env-proxy`) passed without changing TLS validation.
- Live Edge visited all13 product detail URLs: correct Sổ tay bản đồ names, one visible matching mockup1676×2000 each. Public /api-test visibly reports matching FE/BE for exact release. Proof files in the session visualization directory: map-production-product.png, map-production-api.png, map-production-browser-report.json and map-production-approved.png.
- This final evidence-only documentation commit does not require another release; production intentionally remains the exact accepted e1df4d2 artifact. Read /api/version for current live state.
