import { it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ServerCategories from "../../src/features/admin/content/pages/server-categories";
import { contentFixture, ContentHarness } from "./helpers/content-fixture";
import { filterNavigation, canAccessAdminPath } from "../../src/features/admin/shell/navigation";
import { profile } from "./helpers/http-client";
vi.mock("../../src/features/admin/shared/forms/unsaved-guard", () => ({
  useUnsavedChanges: () => ({ status: "idle" }),
}));
import { categoryParentChoices } from "../../src/features/admin/content/capabilities";
it("allows depth three, explains depth four, and prevents own descendants", () => {
  const base = {
      revision: 1,
      publicRevision: null,
      name: "Category",
      description: "",
      position: 0,
      active: true,
      seoTitle: "",
      seoDescription: "",
    },
    one = { ...base, id: "one", slug: "one", parentId: null },
    two = { ...base, id: "two", slug: "two", parentId: "one" },
    three = { ...base, id: "three", slug: "three", parentId: "two" };
  const choices = categoryParentChoices([one, two, three], null);
  expect(choices.find((c) => c.id === "two")!.disabled).toBe(false);
  expect(choices.find((c) => c.id === "three")!.disabled).toBe(true);
  expect(choices.find((c) => c.id === "three")!.reason).toMatch(/3 cấp/);
  expect(
    categoryParentChoices([one, two, three], "one")
      .filter((c) => c.id !== null)
      .every((c) => c.disabled),
  ).toBe(true);
});

it("category-only managers apply the saved revision without post or account lookups", async () => {
  const f = contentFixture();
  f.value.can = (code) => code.startsWith("content_category.");
  f.api.categories.save.mockResolvedValue({ ...f.category, name: "Mới", revision: 2 });
  render(
    <ContentHarness value={f.value}>
      <ServerCategories />
    </ContentHarness>,
  );
  fireEvent.click(await screen.findByRole("button", { name: f.category.name }));
  fireEvent.change(screen.getByLabelText("Tên danh mục"), { target: { value: "Mới" } });
  fireEvent.click(screen.getByRole("button", { name: "Áp dụng lên website" }));
  await waitFor(() => expect(f.api.publications.request).toHaveBeenCalledOnce());
  expect(f.api.publications.request.mock.calls[0][0].expectedRevision).toBe(2);
  expect(f.api.lookups.authors).not.toHaveBeenCalled();
  const session = {
    kind: "http" as const,
    userId: profile.id,
    principal: { ...profile, permissions: ["content_category.view"] },
  };
  expect(canAccessAdminPath(session, "/admin/content/categories")).toBe(true);
  expect(
    filterNavigation(session)
      .flatMap((g) => g.items)
      .map((item) => item.path),
  ).toContain("/admin/content/categories");
  expect(canAccessAdminPath(session, "/admin/content/tags")).toBe(false);
});
it("reference counts from the server remain visible after deletion is rejected", async () => {
  const f = contentFixture();
  f.api.categories.list.mockResolvedValue({
    items: [{ ...f.category, publicRevision: null }],
    page: 1,
    pageSize: 100,
    total: 1,
  });
  f.api.categories.remove.mockRejectedValue(
    new Error("Danh mục còn 2 danh mục con và 5 bài viết, kể cả thùng rác"),
  );
  render(
    <ContentHarness value={f.value}>
      <ServerCategories />
    </ContentHarness>,
  );
  fireEvent.click(await screen.findByRole("button", { name: f.category.name }));
  fireEvent.click(screen.getByRole("button", { name: "Xóa danh mục" }));
  fireEvent.click(await screen.findByRole("button", { name: "Xác nhận" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("2 danh mục con và 5 bài viết");
  expect(screen.getByDisplayValue(f.category.name)).toBeVisible();
});
it("retrying a lost public-category delete response uses the same job key", async () => {
  const f = contentFixture();
  f.api.publications.request.mockRejectedValueOnce(new Error("Mất phản hồi"));
  render(
    <ContentHarness value={f.value}>
      <ServerCategories />
    </ContentHarness>,
  );
  fireEvent.click(await screen.findByRole("button", { name: f.category.name }));
  for (let n = 0; n < 2; n++) {
    fireEvent.click(screen.getByRole("button", { name: "Xóa danh mục" }));
    fireEvent.click(await screen.findByRole("button", { name: "Xác nhận" }));
    if (n === 0) await screen.findByText("Mất phản hồi");
  }
  await waitFor(() => expect(f.api.publications.request).toHaveBeenCalledTimes(2));
  expect(f.api.publications.request.mock.calls[1][0]).toEqual(
    f.api.publications.request.mock.calls[0][0],
  );
});
