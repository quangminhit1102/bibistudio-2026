# BiBi Admin — production release 02/11/2026

User requested production deployment after local review. Source `4c6e07014824cb8d1020875439cba3d153077d8e` merges the reviewed admin branch with current main, preserving Lovable's added plan and published history. No force push, rebase or rewritten commits.

| Evidence                  | Observed value                                                                                                                          |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Main CI                   | [41388721286](https://github.com/quangminhit1102/bibistudio-2026/actions/runs/41388721286), success                                     |
| CI checks                 | 43 files /98 admin tests;55 tooling/API pass,0 skipped on Linux; build success                                                          |
| Production workflow       | [41388994773](https://github.com/quangminhit1102/bibistudio-2026/actions/runs/41388994773), success after existing environment approval |
| Release ID                | `4c6e07014824cb8d1020875439cba3d153077d8e-41388721286`                                                                                  |
| GitHub artifact           | `13116388282`, exact main-push CI artifact                                                                                              |
| Archive SHA256            | `383efc78fd836332b782b4e7017477b9ebf1c48b3b0ce3208f91c2745cabf715`                                                                      |
| GitHub deployment         | `7484362567`, production/success, recorded02/11/2026 04:35:22 UTC                                                                       |
| Previous release retained | `4c791499859ea42bbb7214c7bd3e222b2a6a4a57-41274633689`                                                                                  |

## Independent production acceptance

- HTTPS `/api/version`, `/version.json` and www API all200 and exact release ID/source SHA. Actual browser `/api-test` confirms FE/BE match.
- Missing API path returns404 `application/json`, not SPA HTML. Existing `/node-test` remains200.
- Browser Đà Lạt product image decodes at1676px width. Its WebP bytes match the source SHA256 `66c30dc25323fe62d59ef0fb4e8274d4e694a5f53a766d9f13760e439f7e0f35`.
- Tab opened before deployment successfully navigated to About afterward. Old `cpanel-BrzXOa--.js` remains200 under a cache-busting URL with unchanged SHA256 `76b510e0e31950ea8456ed26b9e1ca19b17373628748a6f457e129843e73cf87`.
- Actual production `/admin/analytics/visitors` opens the disclosed demo login and, after selection, shows80 visitors. Customers load12 sample customers; slips show30 records. Reports load recorded sample revenue3630000VND. The bell opens an anchored read/unread popup and Escape closes it.
- Production visitors at375×812 render mobile cards with clientWidth360/scrollWidth360; no horizontal page overflow. Final browser error log list is empty. No customer/slip business record was created, edited or voided in this production smoke.
- Workflow additionally completed product/API browser smoke and retained old-client asset checks. No new rollback drill was performed; the successful receipt explicitly records the previous release for the existing rollback workflow.

Admin remains an IndexedDB demo saved in each browser, with simulated IP/location, accounts and business records. Express/MySQL auth, real visitor tracking and server-side business CRUD were not introduced by this release.

Local source verification before push also passed98 admin +54 tooling/API with1 POSIX skip on Windows. Local review/reproduction/fix evidence remains in [business execution report](2026-11-02-admin-business-execution.md). Known deferred minors are unchanged.

## Evidence files

The chat visualization directory contains `admin-production-visitors.jpg`, `admin-production-mobile.jpg`, `production-admin-before-assets.json`, `admin-production-http-acceptance.json`, and workflow logs. These are actual observations, not generated mockups. Local preview remains independent of production.
