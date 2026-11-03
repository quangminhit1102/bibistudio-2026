import { expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RichEditor from "../../src/features/admin/content/components/rich-editor";
vi.mock("../../src/features/admin/services/context", () => {
  const runtime = { store: { get: async () => undefined } };
  return { useAdmin: () => runtime };
});
vi.mock("../../src/features/admin/content/components/media-picker", () => ({
  default: () => null,
}));
it("retries with a fresh script request after the real React wrapper caches a load failure", async () => {
  render(<RichEditor value="Giữ nội dung" onChange={() => {}} />);
  await waitFor(() =>
    expect(document.querySelector('script[src*="tinymce.min.js"]')).not.toBeNull(),
  );
  const failed = document.querySelector('script[src*="tinymce.min.js"]')!;
  fireEvent.error(failed);
  await screen.findByRole("alert");
  await userEvent.setup().click(screen.getByRole("button", { name: "Thử lại" }));
  await waitFor(() =>
    expect(document.querySelectorAll('script[src*="tinymce.min.js"]').length).toBe(2),
  );
  const urls = [...document.querySelectorAll('script[src*="tinymce.min.js"]')].map((s) =>
    s.getAttribute("src"),
  );
  expect(urls[0]).not.toBe(urls[1]);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
