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
