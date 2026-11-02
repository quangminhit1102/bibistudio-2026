# Resizable admin sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resize the desktop sidebar and remember the preference without disrupting existing UI.
**Architecture:** Isolated width hook and accessible pointer/keyboard separator; existing grid consumes a CSS variable. Sidebar scrolling stays inside its own wrapper.
**Tech Stack:** React/TypeScript, CSS, Pointer Events, Vitest.
**Spec:** ../specs/2026-11-02-resizable-admin-sidebar-design.md

## Global Constraints

-236px default,220–400px limits,640px minimum workspace at desktop>=1024px;72px collapsed and70px tablet; mobile drawer unchanged.

- Persist preference separately; tolerate invalid/unavailable localStorage. No dependency, backend, push or deploy.

## Review Focus

1. Pointer cancel/lost capture/unmount cleans dragging state.
2. Viewport shrinking clamps rendered width without replacing stored preference.
3. Storage access errors do not break rendering or interaction.
4. Sidebar handle stays outside scrollbar and footer scrolls naturally.
5. Keyboard resizing, collapsed and mobile/tablet interaction remain accessible.

### Task 1: Width controller, separator and integration

**Files:** Create `src/features/admin/shell/sidebar-resize.tsx`, `tests/admin/sidebar-resize.test.tsx`; modify `shell/admin-layout.tsx`, `admin.css`.
**Interfaces:** `sidebarWidth(value:number,viewport:number):number`; `useSidebarResize():{width:number;separator:ReactNode}`. Hook reads/writes `bibi-admin:sidebar-width`, exposes separator with aria controls `admin-sidebar`, ArrowLeft/Right10px, Home/End, double-click236px; pointer captures and preserves pointer start offset.

- [ ] Write tests for bounds1024=>384max, preference restore/corrupt/storage throw, keyboard/reset, pointer move/cancel and viewport clamp/restoration. Run targeted test; expected missing module FAIL.
- [ ] Implement controller/component; wire grid CSS variable, sticky wrapper and scrollable sidebar, hide separator below1024px and collapsed. Keep header/footer/avatar/menu untouched.
- [ ] Targeted tests, TypeScript and scoped lint pass; browser drag/reload/reset/collapse/scroll/menu at desktop1024/1440 and tablet/mobile without global overflow. Build and preview actual artifact.
- [ ] Commit local source and acceptance, final independent review; fix important findings with regression then hand over local preview. Preserve branch; no push/deploy.

Native execution retained from the existing session; user approved this exact design for implementation. No additional product choices are introduced by this plan.
