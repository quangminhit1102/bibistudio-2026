import { it, expect, vi } from "vitest";
import { createServerMediaAdapter } from "../../src/features/admin/content/media/server-adapter";
import { contentFixture } from "./helpers/content-fixture";
it("revokes authenticated Blob URLs and cancels reads without retaining base64", async () => {
  const f = contentFixture(),
    create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:private"),
    revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {}),
    adapter = createServerMediaAdapter(f.api.media);
  const lease = await adapter.resolve(f.media.id);
  expect(lease.url).toBe("blob:private");
  expect(f.api.media.read).toHaveBeenCalled();
  lease.release();
  lease.release();
  expect(revoke).toHaveBeenCalledTimes(1);
  const controller = new AbortController();
  controller.abort();
  await expect(adapter.resolve(f.media.id, controller.signal)).rejects.toMatchObject({
    name: "AbortError",
  });
  expect(create).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(f.media)).not.toMatch(/base64|blob:/);
  create.mockRestore();
  revoke.mockRestore();
});
