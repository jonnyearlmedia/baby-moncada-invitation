import { createHash, createHmac, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const HOST_COOKIE = "baby_moncada_host";
const SESSION_SECONDS = 60 * 60 * 12;

function secret() {
  const value = process.env.HOST_SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("HOST_SESSION_SECRET must contain at least 32 characters");
  return value;
}

function equalBuffers(left: Buffer, right: Buffer) {
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyHostPasscode(passcode: string) {
  const encoded = process.env.HOST_PASSCODE_HASH;
  if (!encoded) throw new Error("HOST_PASSCODE_HASH is not configured");
  const [algorithm, nText, rText, pText, saltText, expectedText] = encoded.split("$");
  if (algorithm !== "scrypt") throw new Error("Unsupported passcode hash");
  const salt = Buffer.from(saltText, "base64url");
  const expected = Buffer.from(expectedText, "base64url");
  const actual = scryptSync(passcode, salt, expected.length, {
    N: Number(nText), r: Number(rText), p: Number(pText), maxmem: 64 * 1024 * 1024,
  });
  return equalBuffers(actual, expected);
}

export function createHostSession() {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS })).toString("base64url");
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function validateHostSession(value?: string) {
  if (!value) return false;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return false;
  const expected = createHmac("sha256", secret()).update(payload).digest();
  const received = Buffer.from(signature, "base64url");
  if (!equalBuffers(expected, received)) return false;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: number };
    return typeof decoded.exp === "number" && decoded.exp > Date.now() / 1000;
  } catch {
    return false;
  }
}

export async function hasHostSession() {
  return validateHostSession((await cookies()).get(HOST_COOKIE)?.value);
}

export function hashIp(value: string) {
  return createHash("sha256").update(`${secret()}:${value}`).digest("hex");
}

export const hostCookieOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_SECONDS,
};
