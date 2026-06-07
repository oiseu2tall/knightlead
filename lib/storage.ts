// Local-disk file storage. Same interface a future S3 adapter would have.
//
// Layout on disk:
//   <UPLOAD_DIR>/<yyyy>/<mm>/<dd>/<randomId>.<ext>
//
// Access control is enforced by signed tokens (HMAC-SHA256 of the object
// key + expiry), not by file paths — files live outside /public so they
// cannot be requested directly.

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, stat, unlink, writeFile, readFile } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";

const UPLOAD_DIR = resolve(process.cwd(), process.env.UPLOAD_DIR ?? "uploads");
const SIGNING_KEY = process.env.AUTH_SECRET ?? "dev-only-change-me";
// Tokens are valid for 1 hour by default.
const DEFAULT_TTL_SEC = 60 * 60;

export type StoredObject = {
  /** Opaque object key — what we store in the DB. */
  key: string;
  /** Public URL path the client can use to fetch the file (with token). */
  url: string;
  size: number;
  contentType: string;
  sha256: string;
};

function datePath(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}`;
}

function safeExtension(name: string): string {
  const ext = extname(name).toLowerCase();
  // Allow only a short whitelist; no double extensions, no path traversal.
  return /^\.[a-z0-9]{1,8}$/.test(ext) ? ext : "";
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function b64urlDecode(s: string): Buffer {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Buffer.from(s, "base64");
}

/** Build a signed token for the given key. Tamper-evident, time-limited. */
export function signToken(key: string, ttlSec = DEFAULT_TTL_SEC): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const payload = b64url(Buffer.from(JSON.stringify({ k: key, e: exp })));
  const sig = b64url(createHmac("sha256", SIGNING_KEY).update(payload).digest());
  return `${payload}.${sig}`;
}

/** Verify a signed token, returning the key if valid. Throws otherwise. */
export function verifyToken(token: string): { key: string; exp: number } {
  const parts = token.split(".");
  if (parts.length !== 2) throw new Error("Invalid token");
  const [payload, sig] = parts;
  const expected = createHmac("sha256", SIGNING_KEY).update(payload).digest();
  const got = b64urlDecode(sig);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) {
    throw new Error("Bad signature");
  }
  const data = JSON.parse(b64urlDecode(payload).toString("utf8")) as { k: string; e: number };
  if (data.e < Math.floor(Date.now() / 1000)) throw new Error("Token expired");
  // Defense in depth: tokens only ever carry validated keys; still re-check shape.
  if (data.k.includes("..") || data.k.startsWith("/")) throw new Error("Invalid key");
  return { key: data.k, exp: data.e };
}

function objectPath(key: string): string {
  // Reject traversal attempts before they hit the filesystem.
  const abs = resolve(UPLOAD_DIR, key);
  if (!abs.startsWith(UPLOAD_DIR + sep) && abs !== UPLOAD_DIR) {
    throw new Error("Invalid key");
  }
  return abs;
}

export type PutOptions = {
  filename: string;
  contentType: string;
  data: Buffer;
};

export async function putObject(opts: PutOptions): Promise<StoredObject> {
  if (opts.data.byteLength === 0) throw new Error("Empty file");
  if (opts.data.byteLength > 50 * 1024 * 1024) throw new Error("File too large (50MB max)");

  const id = randomBytes(16).toString("hex");
  const key = `${datePath()}/${id}${safeExtension(opts.filename)}`;
  const abs = objectPath(key);
  await mkdir(abs.substring(0, abs.lastIndexOf(sep)), { recursive: true });
  await writeFile(abs, opts.data);

  const sha256 = createHash("sha256").update(opts.data).digest("hex");

  return {
    key,
    url: `/api/files/${encodeURIComponent(key)}?t=${signToken(key)}`,
    size: opts.data.byteLength,
    contentType: opts.contentType,
    sha256,
  };
}

export async function getObject(key: string): Promise<{ data: Buffer; contentType: string } | null> {
  try {
    const abs = objectPath(key);
    await stat(abs);
    const data = await readFile(abs);
    return { data, contentType: "application/octet-stream" };
  } catch {
    return null;
  }
}

export async function deleteObject(key: string): Promise<void> {
  try {
    await unlink(objectPath(key));
  } catch {
    // Already gone — fine.
  }
}

export { UPLOAD_DIR };
