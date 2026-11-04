import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { ApiError } from "../http/errors";
const ttl = 24 * 3600000;
const sign = (payload: string, secret: string) =>
  createHmac("sha256", secret).update(payload).digest("base64url");
export interface VerifiedProbe {
  releaseId: string;
  markerHash: string;
  expiresAt: Date;
}
export function createProbeMarker(secret: string, releaseId: string, now: Date): string {
  if (Buffer.byteLength(secret) < 32 || !/^[A-Za-z0-9_-]{1,160}$/.test(releaseId))
    throw new Error("Invalid probe configuration");
  const payload = `${releaseId}.${Math.floor((+now + ttl) / 1000).toString(36)}.${randomBytes(32).toString("base64url")}`;
  return `${payload}.${sign(payload, secret)}`;
}
export function verifyProbeMarker(
  marker: string,
  secret: string | undefined,
  releaseId: string,
  now: Date,
): VerifiedProbe {
  const reject = () => new ApiError(403, "INVALID_PROBE", "Yêu cầu không được phép");
  if (
    !secret ||
    Buffer.byteLength(secret) < 32 ||
    !/^[A-Za-z0-9_-]{1,160}\.[a-z0-9]{1,12}\.[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{43}$/.test(marker)
  )
    throw reject();
  const [release, expiry, nonce, signature] = marker.split(".");
  const expiresAt = new Date(parseInt(expiry, 36) * 1000);
  const expected = sign(`${release}.${expiry}.${nonce}`, secret);
  if (
    release !== releaseId ||
    +expiresAt <= +now ||
    +expiresAt > +now + ttl ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  )
    throw reject();
  return { releaseId, markerHash: createHash("sha256").update(marker).digest("hex"), expiresAt };
}
