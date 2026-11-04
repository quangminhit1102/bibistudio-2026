import bcrypt from "bcryptjs";

export async function hashPassword(password: string): Promise<string> {
  if (!password || Buffer.byteLength(password, "utf8") > 72) {
    throw new Error("Password must contain 1–72 UTF-8 bytes");
  }
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || Buffer.byteLength(password, "utf8") > 72) return false;
  return bcrypt.compare(password, hash);
}
