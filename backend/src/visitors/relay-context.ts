import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import ipaddr from "ipaddr.js";
import { ApiError } from "../http/errors";
export interface RelayObservation {
  ip: string;
  observedAt: Date;
  requestId: string;
  source: "php_relay";
}
export interface RelayVerification {
  context: unknown;
  signature: unknown;
  rawBody: Buffer;
  cookie: string;
  origin: string;
  userAgent: string;
  dnt: boolean;
  gpc: boolean;
  now: Date;
  secret: string;
}
export function verifyRelayContext(input: RelayVerification): RelayObservation {
  const invalid = () =>
    new ApiError(403, "INVALID_RELAY_CONTEXT", "Ngữ cảnh truy cập không hợp lệ");
  try {
    if (
      typeof input.context !== "string" ||
      input.context.length > 2048 ||
      !/^[A-Za-z0-9_-]+$/.test(input.context) ||
      typeof input.signature !== "string" ||
      !/^[a-f0-9]{64}$/.test(input.signature) ||
      !/^[A-Za-z0-9_-]{43}$/.test(input.secret)
    )
      throw invalid();
    const key = Buffer.from(input.secret, "base64url");
    if (key.length !== 32 || key.toString("base64url") !== input.secret) throw invalid();
    const bytes = Buffer.from(input.context, "base64url");
    if (bytes.toString("base64url") !== input.context) throw invalid();
    const expected = createHmac("sha256", key).update(bytes).digest();
    if (!timingSafeEqual(expected, Buffer.from(input.signature, "hex"))) throw invalid();
    const raw = bytes.toString("ascii");
    if (!Buffer.from(raw, "ascii").equals(bytes)) throw invalid();
    const lines = raw.split("\n");
    if (
      lines.length !== 13 ||
      lines[12] !== "" ||
      lines[0] !== "bibi-analytics-v1" ||
      lines[3] !== "POST" ||
      lines[4] !== "/api/analytics/collect"
    )
      throw invalid();
    const [, time, id, , , bodyHash, ip, origin, cookieHash, userAgent, dnt, gpc] = lines;
    if (!/^[1-9][0-9]{8,11}$/.test(time) || !/^[a-f0-9]{32}$/.test(id)) throw invalid();
    const observed = Number(time) * 1000,
      age = input.now.getTime() - observed;
    if (!Number.isFinite(age) || age > 30000 || age < -5000) throw invalid();
    const address = ipaddr.process(ip);
    if (address.range() !== "unicast" || address.toString() !== ip || /[%\s,]/.test(ip))
      throw invalid();
    const sha = (s: Buffer | string) => createHash("sha256").update(s).digest("hex");
    const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");
    if (
      input.rawBody.length > 16384 ||
      Buffer.byteLength(input.userAgent) > 512 ||
      bodyHash !== sha(input.rawBody) ||
      cookieHash !== sha(input.cookie) ||
      origin !== b64(input.origin) ||
      userAgent !== b64(input.userAgent) ||
      dnt !== (input.dnt ? "1" : "0") ||
      gpc !== (input.gpc ? "1" : "0")
    )
      throw invalid();
    return { ip, observedAt: new Date(observed), requestId: id, source: "php_relay" };
  } catch {
    throw invalid();
  }
}
