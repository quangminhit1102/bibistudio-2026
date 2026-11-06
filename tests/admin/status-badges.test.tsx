import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "../../src/features/admin/shared/ui/primitives";
import { statusBadgeTone } from "../../src/features/admin/shared/ui/status-badges";
it.each([
  ["vat", "false", "neutral"],
  ["vat", "true", "info"],
  ["account", "protected", "privilege"],
  ["account", "full-access", "privilege"],
  ["account", "active", "success"],
  ["account", "inactive", "neutral"],
  ["customer", "active", "success"],
  ["customer", "inactive", "neutral"],
  ["slip", "saved", "success"],
  ["slip", "void", "error"],
  ["product", "published", "success"],
  ["product", "draft", "neutral"],
  ["post", "published", "success"],
  ["post", "draft", "neutral"],
  ["stock", "low", "warning"],
  ["slip", "unknown", "neutral"],
  ["unknown", "published", "neutral"],
])("%s %s has semantic tone %s", (domain, state, tone) =>
  expect(statusBadgeTone(domain, state)).toBe(tone),
);
it("keeps readable text with extended tones and preserves the neutral default", () => {
  render(
    <>
      <Badge tone={statusBadgeTone("vat", "true")}>Có VAT</Badge>
      <Badge tone={statusBadgeTone("account", "protected")}>Được bảo vệ</Badge>
      <Badge>Chưa xác định</Badge>
    </>,
  );
  expect(screen.getByText("Có VAT")).toHaveClass("a-badge-info");
  expect(screen.getByText("Được bảo vệ")).toHaveClass("a-badge-privilege");
  expect(screen.getByText("Chưa xác định")).toHaveClass("a-badge-neutral");
});
