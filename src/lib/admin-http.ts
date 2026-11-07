import type { PrincipalDto } from "../../backend/src/http/contracts";
import { browserRefreshLock, type RefreshLock } from "../features/admin/accounts/auth/refresh-lock";

export class AdminHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
interface Options {
  fetch?: typeof globalThis.fetch;
  origin?: string;
  clock?: () => number;
  refreshLock?: RefreshLock | null;
  onUnauthorized?: (error: Error) => void;
}
interface RequestOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
  ifMatch?: number;
}
interface WireOptions extends RequestOptions {
  rawBody?: Blob;
  readBlob?: boolean;
}
interface Grant {
  accessToken: string;
  expiresAt: string;
  profile: PrincipalDto;
}
const aborted = () => new DOMException("Phiên đã thay đổi", "AbortError");
const unauthenticated = () => new AdminHttpError(401, "UNAUTHENTICATED", "Vui lòng đăng nhập lại");

/** Access tokens live only in this closure. Cookies are exclusively managed by the browser. */
export function createAdminHttp(options: Options = {}) {
  const send = options.fetch ?? globalThis.fetch.bind(globalThis);
  const origin = options.origin ?? (typeof location === "undefined" ? "" : location.origin);
  const now = options.clock ?? Date.now;
  const lock = options.refreshLock === undefined ? browserRefreshLock() : options.refreshLock;
  let token: string | null = null;
  let identity: string | null = null;
  let expires = 0;
  let epoch = 0;
  let refreshing: { epoch: number; promise: Promise<Grant> } | undefined;
  const assertEpoch = (ticket: number) => {
    if (ticket !== epoch) throw aborted();
  };
  const clear = () => {
    epoch++;
    token = null;
    identity = null;
    expires = 0;
    refreshing = undefined;
  };
  const failSession = (ticket: number, error: Error) => {
    if (ticket !== epoch) return;
    clear();
    options.onUnauthorized?.(error);
  };
  function endpoint(path: string): string {
    if (!path.startsWith("/api/") || path.startsWith("//") || path.includes("\\"))
      throw new Error("Invalid API destination");
    const url = new URL(path, origin);
    if (url.origin !== origin || !url.pathname.startsWith("/api/"))
      throw new Error("Invalid API destination");
    return url.href;
  }
  async function raw<T>(path: string, input: WireOptions = {}, bearer?: string): Promise<T> {
    const response = await send(endpoint(path), {
      method: input.method ?? "GET",
      credentials: "include",
      signal: input.signal,
      headers: {
        "Content-Type": input.rawBody?.type ?? "application/json",
        ...(input.ifMatch === undefined ? {} : { "If-Match": `"${input.ifMatch}"` }),
        "X-Bibi-Request": "1",
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      },
      ...(input.rawBody
        ? { body: input.rawBody }
        : input.body === undefined
          ? {}
          : { body: JSON.stringify(input.body) }),
    });
    if (response.status === 204) return undefined as T;
    if (response.ok && input.readBlob) {
      if (!/^image\/(png|jpeg)$/.test(response.headers.get("content-type") ?? ""))
        throw new AdminHttpError(503, "INVALID_RESPONSE", "Invalid image response");
      return (await response.blob()) as T;
    }
    const json = response.headers.get("content-type")?.includes("application/json");
    let body;
    try {
      body = json ? await response.json() : null;
    } catch {
      throw new AdminHttpError(503, "INVALID_RESPONSE", "Phản hồi API không hợp lệ");
    }
    if (!response.ok)
      throw new AdminHttpError(
        response.status,
        body?.error?.code ?? "REQUEST_FAILED",
        typeof body?.error?.message === "string"
          ? body.error.message
          : "Không thể thực hiện yêu cầu",
      );
    if (!json) throw new AdminHttpError(503, "INVALID_RESPONSE", "Phản hồi API không hợp lệ");
    return body as T;
  }
  function accept(grant: Grant, ticket: number): Grant {
    assertEpoch(ticket);
    if (
      !grant ||
      typeof grant.accessToken !== "string" ||
      !grant.accessToken ||
      grant.accessToken.length > 4096 ||
      !Number.isFinite(Date.parse(grant.expiresAt)) ||
      !grant.profile?.id
    )
      throw new AdminHttpError(503, "INVALID_RESPONSE", "Phản hồi đăng nhập không hợp lệ");
    if (identity && identity !== grant.profile.id)
      throw new AdminHttpError(
        401,
        "IDENTITY_CHANGED",
        "Tài khoản đã thay đổi ở tab khác. Vui lòng đăng nhập lại",
      );
    token = grant.accessToken;
    identity = grant.profile.id;
    expires = Date.parse(grant.expiresAt);
    return grant;
  }
  function refresh(): Promise<Grant> {
    const ticket = epoch;
    if (refreshing?.epoch === ticket) return refreshing.promise;
    if (!lock) {
      const error = new AdminHttpError(
        401,
        "REFRESH_UNSUPPORTED",
        "Trình duyệt chưa hỗ trợ khôi phục phiên an toàn. Vui lòng đăng nhập lại",
      );
      failSession(ticket, error);
      return Promise.reject(error);
    }
    const promise = lock(async () => {
      assertEpoch(ticket);
      return accept(await raw<Grant>("/api/auth/refresh", { method: "POST", body: {} }), ticket);
    })
      .catch((error) => {
        failSession(ticket, error instanceof Error ? error : unauthenticated());
        throw error;
      })
      .finally(() => {
        if (refreshing?.promise === promise) refreshing = undefined;
      });
    refreshing = { epoch: ticket, promise };
    return promise;
  }
  async function authorizedRequest<T>(path: string, input: WireOptions = {}): Promise<T> {
    endpoint(path);
    input.signal?.throwIfAborted();
    const ticket = epoch;
    if (!token) throw unauthenticated();
    if (expires <= now()) await refresh();
    assertEpoch(ticket);
    const sentToken = token!;
    try {
      const result = await raw<T>(path, input, sentToken);
      assertEpoch(ticket);
      return result;
    } catch (error) {
      assertEpoch(ticket);
      if (!(error instanceof AdminHttpError) || error.status !== 401) throw error;
      if (path.startsWith("/api/auth/")) {
        failSession(ticket, error);
        throw error;
      }
      input.signal?.throwIfAborted();
      if (token === sentToken) await refresh();
      assertEpoch(ticket);
      try {
        const result = await raw<T>(path, input, token!);
        assertEpoch(ticket);
        return result;
      } catch (retryError) {
        if (retryError instanceof AdminHttpError && retryError.status === 401)
          failSession(ticket, retryError);
        throw retryError;
      }
    }
  }
  return {
    async login(credentials: { username: string; password: string }): Promise<PrincipalDto> {
      clear();
      const ticket = epoch;
      const work = async () => {
        assertEpoch(ticket);
        return accept(
          await raw<Grant>("/api/auth/login", { method: "POST", body: credentials }),
          ticket,
        ).profile;
      };
      return lock ? lock(work) : work();
    },
    async restore(): Promise<PrincipalDto | null> {
      if (!lock) return null;
      const ticket = epoch;
      try {
        await refresh();
        const profile = await raw<PrincipalDto>("/api/auth/profile", {}, token!);
        assertEpoch(ticket);
        return profile;
      } catch (error) {
        if (error instanceof AdminHttpError && error.status === 401) return null;
        throw error;
      }
    },
    request: <T>(path: string, input: RequestOptions = {}) => authorizedRequest<T>(path, input),
    upload: async <T>(
      path: string,
      blob: Blob,
      options: { revision: number; signal?: AbortSignal },
    ) => {
      endpoint(path);
      options.signal?.throwIfAborted();
      const ticket = epoch;
      if (!token) throw unauthenticated();
      if (blob.size > 2097152)
        throw new AdminHttpError(413, "PAYLOAD_TOO_LARGE", "Dùng ảnh tối đa 2 MiB");
      const bytes = new Uint8Array(await blob.arrayBuffer());
      assertEpoch(ticket);
      options.signal?.throwIfAborted();
      let binary = "";
      for (let at = 0; at < bytes.length; at += 32768)
        binary += String.fromCharCode(...bytes.subarray(at, at + 32768));
      return authorizedRequest<T>(path, {
        method: "PUT",
        body: { mimeType: blob.type, data: btoa(binary) },
        ifMatch: options.revision,
        signal: options.signal,
      });
    },
    requestBlob: (path: string, options: { signal?: AbortSignal } = {}) =>
      authorizedRequest<Blob>(path, { ...options, readBlob: true }),
    async logout(): Promise<void> {
      clear();
      const work = () => raw<void>("/api/auth/logout", { method: "POST", body: {} });
      await (lock ? lock(work) : work());
    },
    dispose: clear,
  };
}
export type AdminHttpClient = ReturnType<typeof createAdminHttp>;
