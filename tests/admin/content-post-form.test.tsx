import { it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ServerPostForm } from "../../src/features/admin/content/components/server-post-form";
import { contentFixture, ContentHarness } from "./helpers/content-fixture";
import { useUnsavedChanges } from "../../src/features/admin/shared/forms/unsaved-guard";
vi.mock("../../src/features/admin/content/components/rich-editor", () => ({
  default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea
      aria-label="Nội dung bài viết"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));
vi.mock("../../src/features/admin/shared/forms/unsaved-guard", () => ({
  useUnsavedChanges: vi.fn(() => ({ status: "idle" })),
}));
it("server editor keeps back navigation and resets unsaved values to its saved baseline", async () => {
  const f = contentFixture(),
    onBack = vi.fn();
  render(
    <ContentHarness value={f.value}>
      <ServerPostForm id={f.post.id} onBack={onBack} />
    </ContentHarness>,
  );
  await screen.findByDisplayValue(f.post.title);
  fireEvent.change(screen.getByLabelText("Tiêu đề"), { target: { value: "Chưa lưu" } });
  fireEvent.click(screen.getByRole("button", { name: "Hoàn tác", exact: true }));
  expect(screen.getByLabelText("Tiêu đề")).toHaveValue(f.post.title);
  expect(f.api.posts.saveDraft).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Quay lại", exact: true }));
  expect(onBack).toHaveBeenCalledOnce();
});
it("TinyMCE normalization of block-edge spaces does not leave a restored draft dirty", async () => {
  const f = contentFixture();
  f.post.content = JSON.stringify({ format: "html-v1", html: "<p>Nội dung </p>" });
  render(
    <ContentHarness value={f.value}>
      <ServerPostForm id={f.post.id} />
    </ContentHarness>,
  );
  await screen.findByDisplayValue(f.post.title);
  fireEvent.change(screen.getByLabelText("Nội dung bài viết"), {
    target: { value: JSON.stringify({ format: "html-v1", html: "<p>Nội dung</p>" }) },
  });
  expect(vi.mocked(useUnsavedChanges).mock.lastCall?.[0]).toBe(false);
  fireEvent.change(screen.getByLabelText("Nội dung bài viết"), {
    target: { value: JSON.stringify({ format: "html-v1", html: "<p>Nội dung mới</p>" }) },
  });
  expect(vi.mocked(useUnsavedChanges).mock.lastCall?.[0]).toBe(true);
});
it("publish uses the saved server revision and failed jobs keep the draft", async () => {
  const f = contentFixture();
  f.api.publications.status.mockResolvedValue({
    id: f.jobId,
    status: "failed",
    generationId: null,
    error: { code: "PUBLICATION_FAILED", message: "Failed" },
  });
  render(
    <ContentHarness value={f.value}>
      <ServerPostForm id={f.post.id} />
    </ContentHarness>,
  );
  await screen.findByDisplayValue(f.post.title);
  fireEvent.change(screen.getByLabelText("Tiêu đề"), { target: { value: "Nội dung đang sửa" } });
  fireEvent.click(screen.getByRole("button", { name: "Cập nhật bài" }));
  await screen.findByText("Xuất bản thất bại");
  expect(f.api.posts.saveDraft).toHaveBeenCalledOnce();
  expect(f.api.publications.request.mock.calls[0][0].expectedRevision).toBe(2);
  expect(screen.getByDisplayValue("Nội dung đang sửa")).toBeVisible();
  expect(screen.getByText("Đang công khai")).toBeVisible();
});
it("failed save never queues publication and a load503 never falls back to local data", async () => {
  const f = contentFixture();
  f.api.posts.saveDraft.mockRejectedValue(new Error("Không lưu được"));
  const view = render(
    <ContentHarness value={f.value}>
      <ServerPostForm id={f.post.id} />
    </ContentHarness>,
  );
  await screen.findByDisplayValue(f.post.title);
  fireEvent.change(screen.getByLabelText("Tiêu đề"), { target: { value: "Unsaved" } });
  fireEvent.click(screen.getByRole("button", { name: "Cập nhật bài" }));
  await screen.findByText("Không lưu được");
  expect(f.api.publications.request).not.toHaveBeenCalled();
  expect(screen.getByDisplayValue("Unsaved")).toBeVisible();
  view.unmount();
  const failed = contentFixture();
  failed.api.posts.get.mockRejectedValue(new Error("API503"));
  render(
    <ContentHarness value={failed.value}>
      <ServerPostForm id={failed.post.id} />
    </ContentHarness>,
  );
  await screen.findByText("API503");
  expect(failed.api.posts.saveDraft).not.toHaveBeenCalled();
});
it("a publisher without draft-edit permission can publish the saved revision", async () => {
  const f = contentFixture();
  f.value.can = (code) => ["post.view", "post.publish"].includes(code);
  render(
    <ContentHarness value={f.value}>
      <ServerPostForm id={f.post.id} />
    </ContentHarness>,
  );
  await screen.findByDisplayValue(f.post.title);
  fireEvent.click(screen.getByRole("button", { name: "Cập nhật bài" }));
  await waitFor(() => expect(f.api.publications.request).toHaveBeenCalledOnce());
  expect(f.api.posts.saveDraft).not.toHaveBeenCalled();
  expect(f.api.publications.request.mock.calls[0][0].expectedRevision).toBe(1);
});
it("typing a tag delimiter keeps it visible until the next tag is entered", async () => {
  const f = contentFixture();
  render(
    <ContentHarness value={f.value}>
      <ServerPostForm id={f.post.id} />
    </ContentHarness>,
  );
  await screen.findByDisplayValue(f.post.title);
  const field = screen.getByLabelText(/^Thẻ bài viết/);
  fireEvent.change(field, { target: { value: "Viết tay," } });
  expect(field).toHaveValue("Viết tay,");
});

it("bridge forms stay read-only and retain the current inactive category selection", async () => {
  const f = contentFixture();
  f.value.capabilities = { mode: "bridge", publicReaderVersion: 1, canWrite: false };
  f.api.lookups.categories.mockResolvedValue({
    items: [],
    ancestors: [],
    page: 1,
    pageSize: 100,
    total: 0,
  });
  render(
    <ContentHarness value={f.value}>
      <ServerPostForm id={f.post.id} />
    </ContentHarness>,
  );
  await screen.findByDisplayValue(f.post.title);
  expect(screen.getByLabelText("Danh mục")).toHaveValue(f.post.categoryId);
  expect(screen.getByRole("button", { name: "Lưu nháp" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Cập nhật bài" })).toBeDisabled();
  expect(f.api.posts.saveDraft).not.toHaveBeenCalled();
  expect(f.api.publications.request).not.toHaveBeenCalled();
});

it("author choices remain available beyond the first hundred accounts", async () => {
  const f = contentFixture(),
    last = { id: crypto.randomUUID(), name: "Tác giả trang hai", kind: "account" as const };
  f.api.lookups.authors
    .mockResolvedValueOnce({
      items: [
        { id: "brand", kind: "brand", name: "BiBi Studio" },
        ...Array.from({ length: 99 }, (_, index) => ({
          id: crypto.randomUUID(),
          name: "Author " + index,
          kind: "account" as const,
        })),
      ],
      page: 1,
      pageSize: 100,
      total: 101,
    })
    .mockResolvedValue({ items: [last], page: 2, pageSize: 100, total: 101 });
  render(
    <ContentHarness value={f.value}>
      <ServerPostForm id={f.post.id} />
    </ContentHarness>,
  );
  await screen.findByDisplayValue(f.post.title);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Tải thêm tác giả" })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Tải thêm tác giả" }));
  expect(await screen.findByRole("option", { name: last.name })).toHaveValue(last.id);
  expect(f.api.lookups.authors.mock.calls.at(-1)![0].page).toBe(2);
});
it("a publication retry after a lost response reuses its saved revision and idempotency key", async () => {
  const f = contentFixture();
  f.api.publications.request.mockRejectedValueOnce(new Error("Mất phản hồi"));
  render(
    <ContentHarness value={f.value}>
      <ServerPostForm id={f.post.id} />
    </ContentHarness>,
  );
  await screen.findByDisplayValue(f.post.title);
  fireEvent.change(screen.getByLabelText("Tiêu đề"), { target: { value: "Updated" } });
  fireEvent.click(screen.getByRole("button", { name: "Cập nhật bài" }));
  await screen.findByText("Mất phản hồi");
  fireEvent.click(screen.getByRole("button", { name: "Cập nhật bài" }));
  await waitFor(() => expect(f.api.publications.request).toHaveBeenCalledTimes(2));
  expect(f.api.publications.request.mock.calls[1][0]).toEqual(
    f.api.publications.request.mock.calls[0][0],
  );
  expect(f.api.posts.saveDraft).toHaveBeenCalledOnce();
});
