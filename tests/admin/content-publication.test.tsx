import { it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { PublicationStatus } from "../../src/features/admin/content/components/publication-status";
import { contentFixture, ContentHarness } from "./helpers/content-fixture";
import ServerPosts from "../../src/features/admin/content/pages/server-posts";
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
it("reports success only from the terminal server job and preserves recovery errors", async () => {
  const f = contentFixture();
  f.api.publications.status.mockResolvedValue({
    id: f.jobId,
    status: "verifying",
    generationId: null,
    error: { code: "PUBLICATION_RECOVERY_REQUIRED", message: "Khôi phục chưa hoàn tất" },
  });
  render(
    <ContentHarness value={f.value}>
      <PublicationStatus jobId={f.jobId} />
    </ContentHarness>,
  );
  await screen.findByText("Khôi phục chưa hoàn tất");
  expect(screen.queryByText("Xuất bản thành công")).toBeNull();
});

it("a list trash retry after a lost response reuses its original publication request", async () => {
  const f = contentFixture();
  f.api.publications.request.mockRejectedValueOnce(new Error("Mất phản hồi"));
  render(
    <ContentHarness value={f.value}>
      <ServerPosts />
    </ContentHarness>,
  );
  await screen.findByText(f.post.title);
  for (let attempt = 0; attempt < 2; attempt++) {
    fireEvent.click(screen.getByRole("button", { name: "Thùng rác" }));
    fireEvent.click(await screen.findByRole("button", { name: "Xác nhận" }));
    if (attempt === 0) await screen.findByText("Mất phản hồi");
  }
  await waitFor(() => expect(f.api.publications.request).toHaveBeenCalledTimes(2));
  expect(f.api.publications.request.mock.calls[1][0]).toEqual(
    f.api.publications.request.mock.calls[0][0],
  );
});

it("article list category filtering sends the selected server category ID", async () => {
  const f = contentFixture();
  render(
    <ContentHarness value={f.value}>
      <ServerPosts />
    </ContentHarness>,
  );
  await screen.findByText(f.post.title);
  const field = await screen.findByLabelText("Danh mục");
  await screen.findByRole("option", { name: f.category.name });
  fireEvent.change(field, { target: { value: f.category.id } });
  await waitFor(() =>
    expect(f.api.posts.list.mock.calls.at(-1)![0].categoryId).toBe(f.category.id),
  );
});
