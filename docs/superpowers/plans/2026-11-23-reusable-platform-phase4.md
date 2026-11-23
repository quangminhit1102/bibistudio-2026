# Reusable platform, phase 4: admin modules a site switches on

Spec: `docs/superpowers/specs/2026-11-22-reusable-platform-design.md`, "Giai đoạn 4".
Stacked on phase 3b-1 (PR #10). No database change, no API change. BiBi Studio lists every
module, so its admin looks and behaves as before.

## Goal

A site chooses its admin features in `site/site.config.ts` (`admin.modules`). A module that is
not listed has no menu entry, no search result, no header widget, and its addresses lead to
the dashboard.

## Design

1. **Module manifests.** Each admin feature folder exports a manifest from `module.ts`: its
   `id`, the permission `resource` that is switched off with it, the path prefixes it owns,
   its menu items (each naming its menu group) and `browserOnly` when its data is kept only
   in the browser. `src/features/admin/modules.ts` lists the manifests in menu order and
   answers three questions: is a module on, is a resource on, which module owns a path.
2. **Module ids.** The eight of the spec (`content`, `products`, `customers`, `sales`,
   `analytics`, `accounts`, `audit`, `settings`) plus `inventory`, `notifications` and
   `components`, which the spec names as parts a new site leaves off (stock, notifications)
   or which are a developer showcase (UI components). The dashboard and a user's own profile
   and appearance pages belong to no module and are always on. `AdminModuleId` in
   `src/platform/site-contract.ts` types `admin.modules`, so a misspelt id fails type
   checking.
3. **Menu.** `navigation.ts` builds the groups from the manifests of the listed modules
   (`buildNavigation`); the group order and the order inside a group stay as today.
4. **One switch for everything that asks for permission.** `can()` in
   `accounts/permissions.ts` answers no for a resource whose module is off. The menu, the
   global search, the header notifications, dashboard blocks and every service call already
   ask `can()`, so they follow without their own check.
5. **Addresses.** The `/admin` route's `beforeLoad` sends an address owned by a module that
   is off to `/admin/dashboard`. It loads the manifests with a dynamic import, so the public
   bundle does not grow. `canAccessAdminPath` refuses the same addresses.
6. **Browser-only modules.** `sales`, `inventory`, `notifications`, `settings` and
   `components` are marked `browserOnly`. BiBi keeps them on. The blank site of phase 5
   lists only modules that are not `browserOnly`.

## Tasks

1. Tests: the full list builds today's menu, in order; a short list builds only its modules;
   path ownership (longest prefix); `can()` with a module off; the site lists known ids.
2. `AdminModuleId`, manifests, `modules.ts`.
3. `navigation.ts` from manifests; `can()` switch; `beforeLoad` redirect.
4. `npm run check`, `npm run build`, `AGENTS.md`, open the PR (no merge).

## Not in this PR

- The server API of a module that is off still answers a signed-in user with the right
  permission; switching a module off hides it in the admin, it is not an access rule.
- Removing unused files and libraries (spec item O5): done in PR #4.
- Texts of the admin (still Vietnamese in core).
