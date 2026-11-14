# Content CMS feasibility — 2026-11-14

Task 1 prerequisite gate passed using synthetic canaries on the actual hosting account. No CMS, live Blog route, root routing, API routing, application release, credential or database was changed. Owner explicitly authorized the temporary fixture upload before it proceeded.

## Measured results

| Check                     | Observed evidence                                                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local runtime             | Windows x64 Node24.22.1                                                                                                                                       |
| Hosting runtime           | Linux x64 Node24.22.3, glibc2.28, PHP8.3.36                                                                                                                   |
| Codec and sanitizer       | sharp0.35.5, DOMPurify3.4.17, jsdom30.1.3 on both systems                                                                                                     |
| Compiled CommonJS proof   | SHA256 `ebf89eb7a352ad44404fd65ca4ad2d07fa922057070827d7c61325c49405deed`, identical executable on both systems                                               |
| Image operations          | JPEG/PNG/WebP encoded then decoded; EXIF orientation applied; WebP output generated; EXIF/ICC absent from output                                              |
| Node sanitization         | jsdom + DOMPurify removed script and event handlers in the compiled CJS executable                                                                            |
| Initial HTML              | HTTP200, `text/html; charset=utf-8`, body SHA256 matched deterministic expected HTML                                                                          |
| HEAD                      | HTTP200, zero response bytes                                                                                                                                  |
| Redirect and missing page | Real PHP301 with the exact expected Location; real PHP404 with its expected missing-page marker                                                               |
| Private paths             | Map request and encoded path escape both returned the reader's expected denial marker with404                                                                 |
| Atomic active pointer     | Actual HTTP bodies A→B→A after external Node symlink replacement; PHP cleared stat cache before resolving each request                                        |
| Cache                     | HTML `Cache-Control: no-store`                                                                                                                                |
| Reserved routes           | Root, API and node-test .htaccess SHA256 and HTTP statuses identical before/after                                                                             |
| File ownership            | Hosting account owns deployment root and private probe; probe checked its own canonical path/owner                                                            |
| Account quota             | Authenticated cPanel UAPI:15360MiB limit,8075.17MiB used,7284.83MiB remaining (15GiB total, about7.11GiB remaining)                                           |
| Managed deploy budget     | Limit4294967296bytes; measured used1475706469bytes, remaining2819260827bytes; existing runtime reserve67108864bytes                                           |
| Cleanup                   | Only freshly created public canary directories moved to the owned private fixture directory. No canary remains public. Recoverable private evidence retained. |

Successful host measurement time: `2026-11-14T10:18:18.246Z`. Sanitized receipt is retained in the plan's ignored workspace as `host-receipt.json` (file SHA256 `6d4625eae6ee742771e59ce8c9f298695aeaf11cc354aefbe023b2608b031212`); the complete synthetic receipt in the unit test is not operational evidence.

## Routing finding

The first attempt used a disposable child under `/node-test`. Existing `PassengerBaseURI /node-test` captured virtual paths, returning Node JSON200 even with child `PassengerEnabled off`. The validator rejected this soft response. All temporary public files were retired and reserved routing hashes remained unchanged.

The successful attempt used a fresh CMS-only child under the existing `.well-known` exception, outside Passenger. Its per-directory rewrite served PHP200/HEAD/301/404 and pointer changes without editing the site's root/API/Blog routing. This proves the PHP reader/rewrite prerequisite; final `/blog` integration still requires Task8 routing tests and Task14 acceptance of the exact compiled release. It does not prove that CMS is currently enabled.

CLI UAPI was unavailable inside the jailed shell; authenticated browser UAPI `Quota/get_quota_info` supplied account quota. Whole-machine filesystem free space was deliberately excluded from this gate.

## Storage limits carried forward

Keep the existing4GiB managed budget. Start with a64MiB candidate-generation cap, a1GiB total content-storage cap and256MiB minimum managed headroom during publication, with actual managed/account capacity checked under the shared environment lock. Count staging, existing generations, media, backups and app assets; these caps do not reserve or increase hosting quota. Deployment keeps its own extraction/runtime capacity checks. If either capacity check fails, reject publication; do not prune or delete content automatically. These conservative caps can be revised explicitly after observing real catalogue size.

## Reproduction and local baseline

1. Run `node --test scripts/content-host-spike.test.mjs` for validator behavior. RED was observed before the validator existed; GREEN:8/8.
2. Run `node scripts/content-codec-probe.mjs` with Node24. It installs the exact official-registry dependencies in an ignored private test directory, compiles its CJS proof and records the local receipt.
3. Upload only the probe script, compiled `probe.cjs`, local receipt and measured account quota to an owned private bootstrap directory. Use the Linux-only `--measure-host` command on that directory; the script installs exact packages there, measures synthetic HTTP canaries and retires its public files in `finally`.
4. Download the sanitized host receipt and run `node scripts/content-host-spike.mjs --verify <receipt>` locally. Observed result:`{"ok":true,"readerVersion":1}`.

The complete `npm run check` and `npm run build` passed on Node24. The first baseline check overlapped deliberate RED test creation and failed on that missing validator; it was rerun after the scripts existed and passed. Existing jsdom scrollTo notices, the simulated relay fallback connection refusals, and the build chunk-size advisory remain visible in logs; none failed their checks. The generated baseline bundle is local-only and has not been deployed.

References: [sharp installation requirements](https://sharp.pixelplumbing.com/install/), [DOMPurify Node usage](https://github.com/cure53/DOMPurify), [jsdom](https://github.com/jsdom/jsdom), [cPanel UAPI access methods](https://api.docs.cpanel.net/cpanel/introduction).
