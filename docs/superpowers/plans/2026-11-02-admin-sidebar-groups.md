# Admin sidebar groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Five expandable sidebar groups, two navigation levels, persistent multi-open state.
**Architecture:** Typed flat group configuration, pure route matching and isolated preference hook, shared navigation renderer. Parent owns state for desktop/drawer consistency.
**Tech Stack:** React, TanStack Router, Lucide, CSS, Vitest.
**Spec:** ../specs/2026-11-02-admin-sidebar-groups-design.md

## Global Constraints

Keep five groups/routes/permissions, no dependencies. Multiple groups may stay open; current route opens its group on navigation/reload. Compact/tablet exposes all allowed icons, mobile drawer retains groups. Preserve resize, scrollbar and account menus. Local only, no push/deploy.

## Review Focus

1. Invalid or unavailable localStorage must not crash or overwrite unrelated preferences.
2. Route detail/create/basepath must highlight a single correct destination.
3. Permissions must hide create links and empty groups after flattening.
4. Duplicate desktop/drawer renderers must have unique aria panel IDs and shared state.
5. Closed panels must be keyboard-inaccessible except in compact/tablet where every icon remains reachable.

### Task 1: Configure, render and verify groups

Files: modify `shell/navigation.ts`, `shell/admin-layout.tsx`, `admin.css`; create `shell/navigation-groups.ts`, `shell/sidebar-navigation.tsx`, `tests/admin/navigation-groups.test.tsx`.

Interfaces: `activeNavigationItem(groups,pathname)` returns a unique item; `filterNavigation(session,role)` returns allowed groups; `useNavigationGroups(pathname)` exposes open group IDs and toggle; `SidebarNavigation({groups,pathname,open,toggle})` renders buttons/panels with unique IDs.

- [ ] RED: tests flat group icons/order/create permissions; route matches details/basepath; multiple groups toggle and restore; active group auto-opens only on route change; corrupt/blocked storage; unique IDs and keyboard Enter/Space.
- [ ] Implement flattening and shared renderer/state. Replace old nested CSS; add compact/tablet overrides scoped to sidebar, not mobile drawer.
- [ ] GREEN targeted tests, TypeScript/scoped lint. Browser desktop/mobile light/dark: groups, reload, route links, compact, resizing, scroll/accounts, overflow. Build and verify actual artifact preview.
- [ ] Local commit, fresh independent final review, regression-backed important fixes and full suite. Record acceptance; preserve branch without push/deploy.

Native retained from the ongoing session. User approved the design for implementation; this plan adds no new product choices.
