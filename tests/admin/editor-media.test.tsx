import { afterEach, expect, it, vi } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { createAdminStore } from "../../src/features/admin/demo/store";
import { resolveMedia } from "../../src/features/admin/content/media/resolve";
import { MediaImage } from "../../src/features/admin/content/components/media-image";
const state = vi.hoisted(() => ({ store: null as ReturnType<typeof createAdminStore> | null }));
vi.mock("../../src/features/admin/services/context", () => ({
  useAdmin: () => ({ store: state.store }),
}));
const stores: ReturnType<typeof createAdminStore>[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const s of stores.splice(0)) await s.destroy();
});
async function setup() {
  const s = createAdminStore("editor-media-" + crypto.randomUUID());
  stores.push(s);
  state.store = s;
  await s.transaction(["media"], async (tx) => {
    for (const id of ["a", "b"])
      await tx.put("media", {
        id,
        name: id,
        url: "/catalogue/" + id + ".webp",
        blobKey: "blob-" + id,
        mime: "image/webp",
        size: 1,
        width: 1,
        height: 1,
        createdAt: "x",
        updatedAt: "x",
        revision: 1,
      });
  });
  return s;
}
it("resolves bundled URLs and rejects missing or external media", async () => {
  const s = await setup();
  expect((await resolveMedia(s, "a")).url).toBe("/catalogue/a.webp");
  await expect(resolveMedia(s, "absent")).rejects.toThrow();
  await s.transaction(["media"], async (tx) => {
    const asset = await tx.get("media", "a");
    await tx.put("media", { ...asset!, url: "//evil.test/a" });
  });
  await expect(resolveMedia(s, "a")).rejects.toThrow();
});
it("uses blobKey rather than media id and releases its object URL", async () => {
  const s = await setup();
  await s.transaction(["media"], async (tx) => {
    const a = await tx.get("media", "a");
    await tx.put("media", { ...a!, url: undefined });
  });
  await s.putBlob("blob-a", new Blob(["image"]));
  const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:lease");
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const lease = await resolveMedia(s, "a");
  expect(lease.url).toBe("blob:lease");
  expect(create).toHaveBeenCalledOnce();
  lease.release();
  lease.release();
  expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:lease");
});
it("does not replace image B when image A resolves late", async () => {
  const s = await setup();
  const a = await s.get("media", "a");
  const original = s.get.bind(s);
  let finish: (v: typeof a) => void = () => {};
  vi.spyOn(s, "get").mockImplementation((...args) =>
    args[0] === "media" && args[1] === "a"
      ? new Promise((resolve) => {
          finish = resolve;
        })
      : original(...args),
  );
  const { rerender } = render(<MediaImage id="a" alt="Ảnh" />);
  rerender(<MediaImage id="b" alt="Ảnh" />);
  await waitFor(() =>
    expect(screen.getByAltText("Ảnh")).toHaveAttribute("src", "/catalogue/b.webp"),
  );
  await act(async () => finish(a));
  expect(screen.getByAltText("Ảnh")).toHaveAttribute("src", "/catalogue/b.webp");
});
