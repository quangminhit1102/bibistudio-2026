# Blog editing tools — local implementation plan

**Goal:** Expand the existing self-hosted GPL editor for posts and product descriptions without adding dependencies or publishing changes.
**Architecture:** Keep the existing media picker, HTML envelope and preview. Add selected installed community plugins; extend the sanitizer with bounded styles/attributes so saved formatting survives safely.

Approved scope follows the feature proposal accepted by the user on 2026-11-03: H4, strike/super/subscript, text/highlight colors, tables, horizontal rule, indent, special characters, search/replace, fullscreen, existing document preview, and persistent image width. Keep Vietnamese menus and compact toolbar. No premium plugins, remote media embeds, source-code editing, backend or deployment changes.

- [ ] Add round-trip/security regression tests for blog formatting, tables and image dimensions; observe failures.
- [ ] Extend sanitizer and preview typography; preserve legacy content and media safety.
- [ ] Prepare only selected plugin assets; share retry coverage; configure menus/toolbar.
- [ ] Verify tests, type/lint checks and production build, then exercise actual local editor desktop/mobile, save/reload/preview.

Tradeoff: table and color controls add some local plugin assets; only editor pages load them. Image height remains automatic to avoid distortion on small screens. Local browser data remains local.

## Verification before production request, 2026-11-03

- Node24 TypeScript FE/BE and lint passed (0 errors,10 pre-existing warnings).
- All73 admin files /184 tests passed.54 tooling/backend passed and one Windows permissions test skipped; dev watcher timed out under CPU contention, then passed individually after stopping stale task-owned preview/test processes (17.3s). CI must run the entire suite before deployment.
- Actual browser: table inserted through TinyMCE menu; rich content pasted through normal clipboard; saved draft, reloaded and reopened; H4/table/sub/sup retained. Applied text color with toolbar, preview confirmed color, saved/reopened confirmed color visually.
- Fullscreen filled1280×720 and exited normally.390px viewport had no document horizontal overflow (clientWidth=scrollWidth=375); mobile preview content width346 had no overflow. Search found120 inside table.
- Prior test mock lacked newly used addMenuItem; updated the fake registry, not the production API. Earlier incomplete check is superseded by the results above and required CI.
