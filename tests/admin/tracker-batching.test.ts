import { afterEach, describe, expect, it, vi } from "vitest";
import { createVisitorTracker } from "../../src/lib/visitor-tracker";

const catalogue = {
  routes: [
    { path: "/", label: "Trang chủ" },
    { path: "/contact", label: "Liên hệ" },
    { path: "/products/a", label: "A" },
  ],
  products: [{ slug: "a", name: "A" }],
};
afterEach(() => vi.useRealTimers());
describe("lightweight public tracker", () => {
  it("only sends dirty public paths every15seconds; retains bootstrap until204", async () => {
    vi.useFakeTimers();
    const send = vi.fn().mockResolvedValueOnce({ status: 202 }).mockResolvedValue({ status: 204 });
    const tracker = createVisitorTracker({ catalogue, send, privacy: () => true });
    tracker.visit("/admin/accounts");
    tracker.visit("/products/a?email=private#token");
    tracker.visit("/products/a");
    await vi.advanceTimersByTimeAsync(14999);
    expect(send).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toEqual({
      paths: ["/products/a"],
      products: ["a"],
      lastPath: "/products/a",
    });
    await vi.advanceTimersByTimeAsync(15000);
    expect(send).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(60000);
    expect(send).toHaveBeenCalledTimes(2);
    tracker.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("keeps newer data from A→B→A while previous A is in flight", async () => {
    vi.useFakeTimers();
    let resolve!: (response: { status: number }) => void;
    const send = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      )
      .mockResolvedValue({ status: 204 });
    const tracker = createVisitorTracker({ catalogue, send, privacy: () => true });
    tracker.visit("/products/a");
    const pending = tracker.flush("pagehide");
    tracker.visit("/contact");
    tracker.visit("/products/a");
    resolve({ status: 204 });
    await pending;
    await vi.advanceTimersByTimeAsync(15000);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0].paths).toEqual(["/products/a", "/contact"]);
    tracker.dispose();
  });
  it("bounds blocked cookies, transient errors and pagehide duplicate sends", async () => {
    vi.useFakeTimers();
    const send = vi.fn().mockResolvedValue({ status: 202 });
    const tracker = createVisitorTracker({ catalogue, send, privacy: () => true });
    tracker.visit("/");
    await tracker.flush("pagehide");
    await tracker.flush("pagehide");
    expect(send).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(120000);
    expect(send).toHaveBeenCalledTimes(2);
    tracker.dispose();
    const failing = vi.fn().mockResolvedValue({ status: 429 });
    const retry = createVisitorTracker({ catalogue, send: failing, privacy: () => true });
    retry.visit("/");
    await vi.advanceTimersByTimeAsync(120000);
    expect(failing).toHaveBeenCalledTimes(3);
    retry.dispose();
  });
  it("privacy disables queued data, waits cookie writes before clearing and uses bootstrap lock", async () => {
    vi.useFakeTimers();
    let allowed = false;
    let resolve!: (response: { status: number }) => void;
    const send = vi.fn().mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const clear = vi.fn().mockResolvedValue(undefined);
    const lock = vi.fn(async (work: () => Promise<unknown>) => work());
    const tracker = createVisitorTracker({
      catalogue,
      send,
      clear,
      privacy: () => allowed,
      bootstrapLock: lock,
    });
    tracker.visit("/");
    await vi.advanceTimersByTimeAsync(20000);
    expect(send).not.toHaveBeenCalled();
    allowed = true;
    await tracker.setEnabled(true);
    tracker.visit("/");
    const inFlight = tracker.flush("pagehide");
    await Promise.resolve();
    const disabling = tracker.setEnabled(false);
    expect(clear).not.toHaveBeenCalled();
    resolve({ status: 202 });
    await inFlight;
    await disabling;
    expect(clear).toHaveBeenCalledTimes(1);
    expect(lock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(60000);
    expect(send).toHaveBeenCalledTimes(1);
    tracker.dispose();
  });
  it("bounds queue, chunks50 and stays under16KiB without importing admin", async () => {
    vi.useFakeTimers();
    const routes = Array.from({ length: 300 }, (_, i) => ({
      path: "/products/" + String(i).padStart(4, "0") + "x".repeat(146),
      label: "P",
    }));
    const products = routes.map((route) => ({ slug: route.path.slice(10), name: "P" }));
    const send = vi.fn().mockResolvedValue({ status: 204 });
    const tracker = createVisitorTracker({
      catalogue: { routes, products },
      send,
      privacy: () => true,
    });
    routes.forEach((route) => tracker.visit(route.path));
    await vi.advanceTimersByTimeAsync(300000);
    const batches = send.mock.calls.map((call) => call[0]);
    expect(batches.length).toBeGreaterThan(1);
    expect(batches.flatMap((batch) => batch.paths).length).toBe(200);
    expect(batches.flatMap((batch) => batch.products).length).toBe(100);
    for (const batch of batches) {
      expect(batch.paths.length).toBeLessThanOrEqual(50);
      expect(batch.products.length).toBeLessThanOrEqual(50);
      expect(new TextEncoder().encode(JSON.stringify(batch)).length).toBeLessThan(16384);
    }
    tracker.dispose();
  });
  it("does not send a queued request if privacy changes while waiting for the browser lock", async () => {
    vi.useFakeTimers();
    let unlock!: () => void;
    const held = new Promise<void>((resolve) => {
      unlock = resolve;
    });
    const send = vi.fn().mockResolvedValue({ status: 204 });
    const tracker = createVisitorTracker({
      catalogue,
      send,
      privacy: () => true,
      bootstrapLock: async (work) => {
        await held;
        return work();
      },
    });
    tracker.visit("/");
    const pending = tracker.flush("pagehide");
    const disabled = tracker.setEnabled(false);
    unlock();
    await pending;
    await disabled;
    expect(send).not.toHaveBeenCalled();
    tracker.dispose();
  });
});
