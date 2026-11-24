import { afterEach, expect, test, vi } from "vitest";
import { render, renderHook, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { MediaAsset } from "../../src/features/admin/services/contracts";
import { measureImage, useMediaFacts } from "../../src/features/admin/content/media/facts";
import { MediaFactsLine } from "../../src/features/admin/content/pages/media";

const asset = (values: Partial<MediaAsset>): MediaAsset => ({
  id: "a",
  createdAt: "2026-11-24T00:00:00.000Z",
  updatedAt: "2026-11-24T00:00:00.000Z",
  revision: 1,
  name: "Ảnh",
  mime: "image/webp",
  size: 0,
  width: 0,
  height: 0,
  blobKey: "",
  ...values,
});
const seeded = asset({ url: "/catalogue/a.jpg" });
function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
// jsdom's Blob is not the one Node's Response reads, so the answer is a plain object.
const answer = (status: number, body: BlobPart, type: string) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    blob: async () => new Blob([body], { type }),
  }) as Response;
function stub(response: () => Response, bitmap = { width: 1200, height: 900, close() {} }) {
  const fetch = vi.fn(async (_url: string, _init?: RequestInit) => response());
  vi.stubGlobal("fetch", fetch);
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => bitmap),
  );
  return fetch;
}
const jpeg = () => answer(200, new Uint8Array(1572864), "image/jpeg");
afterEach(() => vi.unstubAllGlobals());

test("a record with figures is shown without a request", () => {
  const fetch = stub(jpeg);
  render(
    <MediaFactsLine asset={asset({ width: 800, height: 600, size: 204800, mime: "image/png" })} />,
    { wrapper },
  );
  expect(screen.getByText("800×600 · 200 KiB")).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});

test("a seeded record is measured from its file", async () => {
  const fetch = stub(jpeg);
  render(<MediaFactsLine asset={seeded} />, { wrapper });
  expect(screen.getByText("…")).toBeInTheDocument();
  expect(await screen.findByText("1200×900 · 1.5 MB")).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][0]).toBe("/catalogue/a.jpg");
});

test("the preview line names the type of the measured file, not the stored one", async () => {
  stub(jpeg);
  render(<MediaFactsLine asset={seeded} withMime />, { wrapper });
  expect(await screen.findByText("image/jpeg · 1200×900 · 1.5 MB")).toBeInTheDocument();
  const hook = renderHook(() => useMediaFacts(seeded), { wrapper });
  await waitFor(() => expect(hook.result.current.facts?.mime).toBe("image/jpeg"));
});

test("a file that cannot be measured shows —", async () => {
  const fetch = stub(() => answer(404, "missing", "text/plain"));
  render(<MediaFactsLine asset={seeded} />, { wrapper });
  expect(await screen.findByText("— · —")).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(1);
});

test("a file that is not an image shows —", async () => {
  stub(() => answer(200, "<html>", "text/html"));
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => {
      throw new DOMException("not an image", "InvalidStateError");
    }),
  );
  render(<MediaFactsLine asset={seeded} />, { wrapper });
  expect(await screen.findByText("— · —")).toBeInTheDocument();
});

test("a url outside the site is not fetched", async () => {
  const fetch = stub(jpeg);
  await expect(measureImage("//evil.example/a.jpg")).rejects.toThrow();
  await expect(measureImage("https://evil.example/a.jpg")).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
});
