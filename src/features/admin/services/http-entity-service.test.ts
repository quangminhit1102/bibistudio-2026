import { describe, expect, it, vi } from "vitest";
import { createHttpEntityService } from "./http-entity-service";
import type { AdminHttpClient } from "../../../lib/admin-http";
import type { ListResult } from "./contracts";

function mockClient(overrides: Partial<Record<"request" | "requestBlob", ReturnType<typeof vi.fn>>> = {}) {
  const request = overrides.request ?? vi.fn();
  const requestBlob = overrides.requestBlob ?? vi.fn();
  return { request, requestBlob, client: { request, requestBlob } as unknown as AdminHttpClient };
}

const customersResult: ListResult<{ id: string } & Record<string, unknown>> = {
  items: [{ id: "c1" }],
  total: 1,
  page: 1,
  pageSize: 10,
};

describe("createHttpEntityService", () => {
  it("maps entity to server base path", async () => {
    const { client, request } = mockClient();
    request.mockResolvedValue(customersResult);
    await createHttpEntityService(client, "customers").list({ page: 1, pageSize: 10 });
    expect(request).toHaveBeenCalledWith("/api/customers?page=1&size=10", { signal: undefined });
  });

  it("list forwards the abort signal", async () => {
    const { client, request } = mockClient();
    request.mockResolvedValue(customersResult);
    const signal = new AbortController().signal;
    await createHttpEntityService(client, "customers").list({ page: 1, pageSize: 10, signal });
    expect(request).toHaveBeenCalledWith("/api/customers?page=1&size=10", { signal });
  });

  it("resolves categories to content vs product path by resource", async () => {
    const { client, request } = mockClient();
    request.mockResolvedValue(customersResult);
    await createHttpEntityService(client, "categories", "content").list({ page: 1, pageSize: 10 });
    await createHttpEntityService(client, "categories", "bookstore").list({ page: 1, pageSize: 10 });
    expect(request).toHaveBeenNthCalledWith(1, "/api/content-categories?page=1&size=10", {
      signal: undefined,
    });
    expect(request).toHaveBeenNthCalledWith(2, "/api/product-categories?page=1&size=10", {
      signal: undefined,
    });
  });

  it("serializes search, sort, and f_* filters as query params", async () => {
    const { client, request } = mockClient();
    request.mockResolvedValue(customersResult);
    await createHttpEntityService(client, "products").list({
      page: 2,
      pageSize: 50,
      search: "abc",
      sort: { field: "name", direction: "desc" },
      filters: { kind: "company", status: "" },
    });
    const path = request.mock.calls[0][0] as string;
    expect(path).toContain("page=2");
    expect(path).toContain("size=50");
    expect(path).toContain("q=abc");
    expect(path).toContain("sort=name");
    expect(path).toContain("dir=desc");
    expect(path).toContain("f_kind=company");
    expect(path).not.toContain("f_status");
  });

  it("GETs a record by id and forwards the signal", async () => {
    const { client, request } = mockClient();
    request.mockResolvedValue({ id: "c1" });
    const signal = new AbortController().signal;
    await createHttpEntityService(client, "customers").get("c1", signal);
    expect(request).toHaveBeenCalledWith("/api/customers/c1", { signal });
  });

  it("POSTs to create", async () => {
    const { client, request } = mockClient();
    request.mockResolvedValue({ id: "c1" });
    const input = { name: "A" };
    await createHttpEntityService(client, "customers").create(input as never);
    expect(request).toHaveBeenCalledWith("/api/customers", { method: "POST", body: input });
  });

  it("PUTs to update with an If-Match revision", async () => {
    const { client, request } = mockClient();
    request.mockResolvedValue({ id: "c1" });
    const input = { name: "B" };
    await createHttpEntityService(client, "customers").update("c1", input as never, 3);
    expect(request).toHaveBeenCalledWith("/api/customers/c1", {
      method: "PUT",
      body: input,
      ifMatch: 3,
    });
  });

  it("DELETEs with an If-Match revision", async () => {
    const { client, request } = mockClient();
    request.mockResolvedValue(undefined);
    await createHttpEntityService(client, "customers").remove("c1", 7);
    expect(request).toHaveBeenCalledWith("/api/customers/c1", { method: "DELETE", ifMatch: 7 });
  });

  it("bulk delete loops remove and reports failures", async () => {
    const { client, request } = mockClient();
    request
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("boom"));
    const service = createHttpEntityService(client, "customers");
    const result = await service.bulk(
      { type: "delete" },
      [
        { id: "a", revision: 1 },
        { id: "b", revision: 2 },
      ],
    );
    expect(request).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenNthCalledWith(1, "/api/customers/a", { method: "DELETE", ifMatch: 1 });
    expect(request).toHaveBeenNthCalledWith(2, "/api/customers/b", { method: "DELETE", ifMatch: 2 });
    expect(result.updated).toBe(1);
    expect(result.failures).toEqual([{ id: "b", message: "boom" }]);
  });

  it("bulk update loops update with values", async () => {
    const { client, request } = mockClient();
    request.mockResolvedValue({ id: "a" });
    const service = createHttpEntityService(client, "customers");
    const result = await service.bulk(
      { type: "update", values: { name: "X" } },
      [{ id: "a", revision: 5 }],
    );
    expect(request).toHaveBeenCalledWith("/api/customers/a", {
      method: "PUT",
      body: { name: "X" },
      ifMatch: 5,
    });
    expect(result.updated).toBe(1);
    expect(result.failures).toEqual([]);
  });

  it("export returns a single page when total fits one page", async () => {
    const { client, request } = mockClient();
    request.mockResolvedValue({ items: [1, 2, 3], total: 3, page: 1, pageSize: 200 });
    const items = await createHttpEntityService(client, "posts").export({ page: 5, pageSize: 10 });
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith("/api/posts?page=1&size=200", { signal: undefined });
    expect(items).toEqual([1, 2, 3]);
  });

  it("export paginates through all pages when total exceeds page size", async () => {
    const { client, request } = mockClient();
    const page1 = Array.from({ length: 200 }, (_, i) => i);
    const page2 = Array.from({ length: 200 }, (_, i) => 200 + i);
    const page3 = Array.from({ length: 50 }, (_, i) => 400 + i);
    request
      .mockResolvedValueOnce({ items: page1, total: 450, page: 1, pageSize: 200 })
      .mockResolvedValueOnce({ items: page2, total: 450, page: 2, pageSize: 200 })
      .mockResolvedValueOnce({ items: page3, total: 450, page: 3, pageSize: 200 });
    const items = await createHttpEntityService(client, "posts").export({ page: 1, pageSize: 200 });
    expect(request).toHaveBeenCalledTimes(3);
    expect(request).toHaveBeenNthCalledWith(1, "/api/posts?page=1&size=200", { signal: undefined });
    expect(request).toHaveBeenNthCalledWith(2, "/api/posts?page=2&size=200", { signal: undefined });
    expect(request).toHaveBeenNthCalledWith(3, "/api/posts?page=3&size=200", { signal: undefined });
    expect(items).toHaveLength(450);
    expect(items[0]).toBe(0);
    expect(items[449]).toBe(449);
  });

  it("rejects unsupported entities", () => {
    const { client } = mockClient();
    expect(() => createHttpEntityService(client, "audit" as never)).toThrow(
      "Unsupported server entity: audit",
    );
  });
});
