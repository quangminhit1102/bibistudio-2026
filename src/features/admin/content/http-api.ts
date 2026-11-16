import { AdminHttpError, type AdminHttpClient } from "../../../lib/admin-http";
import type { ContentHttpModule, Page, MediaDto, PostDto, CategoryDto } from "./contracts";
const base = "/api/content",
  id = (value: string) => encodeURIComponent(value);
function query(input: object) {
  return new URLSearchParams(
    Object.entries(input)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, String(value)]),
  ).toString();
}
export function createContentHttp(http: AdminHttpClient): ContentHttpModule {
  return {
    capabilities: (signal) => http.request(base + "/capabilities", { signal }),
    posts: {
      list: (input, signal) => http.request(base + "/posts?" + query(input), { signal }),
      get: (value, signal) => http.request(base + "/posts/" + id(value), { signal }),
      saveDraft: (value, input, expectedRevision, signal) =>
        http.request<PostDto>(base + "/posts" + (value ? "/" + id(value) : ""), {
          method: value ? "PUT" : "POST",
          body: value ? { input, expectedRevision } : { input },
          signal,
        }),
      duplicate: (value, signal) =>
        http.request(base + "/posts/" + id(value) + "/duplicate", {
          method: "POST",
          body: {},
          signal,
        }),
      trash: (value, expectedRevision, signal) =>
        http.request(base + "/posts/" + id(value) + "/trash", {
          method: "POST",
          body: { expectedRevision },
          signal,
        }),
      restore: (value, expectedRevision, signal) =>
        http.request(base + "/posts/" + id(value) + "/restore", {
          method: "POST",
          body: { expectedRevision },
          signal,
        }),
    },
    categories: {
      list: (input, signal) => http.request(base + "/categories?" + query(input), { signal }),
      get: (value, signal) => http.request(base + "/categories/" + id(value), { signal }),
      save: (value, input, expectedRevision, signal) =>
        http.request<CategoryDto>(base + "/categories" + (value ? "/" + id(value) : ""), {
          method: value ? "PUT" : "POST",
          body: value ? { input, expectedRevision } : { input },
          signal,
        }),
      remove: (value, expectedRevision, signal) =>
        http.request(base + "/categories/" + id(value), {
          method: "DELETE",
          body: { expectedRevision },
          signal,
        }),
    },
    media: {
      list: (input, signal) =>
        http.request<Page<MediaDto>>(base + "/media?" + query(input), { signal }),
      get: (value, signal) => http.request(base + "/media/" + id(value), { signal }),
      read: (value, hash, signal) =>
        http.requestBlob(base + "/media/" + id(value) + "/" + id(hash), { signal }),
      upload: async (file, signal) => {
        signal?.throwIfAborted();
        if (file.size > 5242880)
          throw new AdminHttpError(413, "PAYLOAD_TOO_LARGE", "Dùng ảnh tối đa 5 MiB");
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
          throw new AdminHttpError(415, "UNSUPPORTED_MEDIA_TYPE", "Dùng ảnh JPEG, PNG hoặc WebP");
        const bytes = new Uint8Array(await file.arrayBuffer());
        signal?.throwIfAborted();
        let binary = "";
        for (let at = 0; at < bytes.length; at += 32768)
          binary += String.fromCharCode(...bytes.subarray(at, at + 32768));
        return http.request(base + "/media", {
          method: "POST",
          body: { mimeType: file.type, originalName: file.name, data: btoa(binary) },
          signal,
        });
      },
    },
    lookups: {
      authors: (input, signal) => http.request(base + "/authors?" + query(input), { signal }),
      tags: (input, signal) => http.request(base + "/tags?" + query(input), { signal }),
      categories: (input, signal) =>
        http.request(base + "/category-choices?" + query(input), { signal }),
    },
    publications: {
      request: (input, signal) =>
        http.request(base + "/publications", { method: "POST", body: input, signal }),
      status: (value, signal) => http.request(base + "/publications/" + id(value), { signal }),
    },
  };
}
