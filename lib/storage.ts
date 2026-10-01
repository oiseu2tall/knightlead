// Cloudinary-backed file storage.
//
// Files go straight from the browser to Cloudinary using a signature
// minted here — never through a Next.js request body. Serverless hosts
// cap request bodies at ~4.5MB, so proxying a 10MB file through an API
// route would fail in production while working locally.
//
// Two access paths, both gated on the HMAC token in this file:
//   - direct upload: client → Cloudinary, authorised by a signed payload
//     (see `createUploadTicket`)
//   - download: client → /api/files/download/<key> → Cloudinary, so an
//     object key is not a bearer token on its own
//
// Object keys are `<resourceType>/<publicId>` — the resolved resource
// type, not "auto", because Cloudinary's delete call needs the concrete
// type. Everything stored in the DB predates this adapter and keeps its
// old `yyyy/mm/dd/<id>.<ext>` shape; those keys simply no longer resolve,
// which surfaces as a 404 rather than silently serving the wrong file.

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  MAX_UPLOAD_BYTES,
  isAllowedUploadType,
  resourceTypeFor,
  extensionFor,
} from "@/lib/upload-config";

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME ?? "";
const API_KEY = process.env.CLOUDINARY_API_KEY ?? "";
const API_SECRET = process.env.CLOUDINARY_API_SECRET ?? "";
/** Where uploads are filed in the Cloudinary media library. */
const FOLDER = process.env.CLOUDINARY_FOLDER ?? "knightlead";
/**
 * Optional Cloudinary upload preset.
 *
 * This is the ONLY way to make the size ceiling genuinely unbypassable.
 * `max_file_size` is a validated upload option, not a signed parameter —
 * Cloudinary excludes it from the digest, so a client that simply omits it
 * uploads a 10MB-free file and still passes signature verification. A
 * preset, by contrast, is a body parameter, so it IS signed: the client
 * can neither swap it for a laxer preset nor drop it.
 *
 * Create one in the Cloudinary console (Settings → Upload → Upload
 * presets) with `max_file_size: 10485760`, `folder: knightlead`, and
 * `allowed_formats` matching ALLOWED_UPLOAD_TYPES, then set its name here.
 */
const UPLOAD_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET ?? "";

const SIGNING_KEY = process.env.AUTH_SECRET ?? "dev-only-change-me";
// Download tokens are valid for 1 hour by default.
const DEFAULT_TTL_SEC = 60 * 60;

export type StoredObject = {
  /** Opaque object key — what we store in the DB. */
  key: string;
  /** URL the client can use to fetch the file (already signed). */
  url: string;
  size: number;
  contentType: string;
  sha256: string;
};

export function isStorageConfigured(): boolean {
  return Boolean(CLOUD_NAME && API_KEY && API_SECRET);
}

function requireConfig() {
  if (!isStorageConfigured()) {
    throw new Error(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, " +
        "CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.",
    );
  }
  return { cloudName: CLOUD_NAME, apiKey: API_KEY, apiSecret: API_SECRET };
}

// ---------------------------------------------------------------------------
// Download-token signing (unchanged contract — the download route and every
// page that builds a file URL depend on it).
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Object keys
// ---------------------------------------------------------------------------

export type ParsedKey = { resourceType: string; publicId: string };

export function parseKey(key: string): ParsedKey {
  const slash = key.indexOf("/");
  if (slash <= 0 || slash === key.length - 1) {
    throw new Error("Invalid key");
  }
  const resourceType = key.slice(0, slash);
  if (!/^[a-z]+$/.test(resourceType)) throw new Error("Invalid key");
  // publicId may contain slashes (our folder prefix does), but never a
  // traversal segment.
  const publicId = key.slice(slash + 1);
  if (publicId.includes("..")) throw new Error("Invalid key");
  return { resourceType, publicId };
}

function buildKey(resourceType: string, publicId: string): string {
  return `${resourceType}/${publicId}`;
}

// ---------------------------------------------------------------------------
// Direct (signed) upload
// ---------------------------------------------------------------------------

export type UploadTicket = {
  cloudName: string;
  apiKey: string;
  /** Endpoint the browser POSTs the file to. */
  uploadUrl: string;
  /** Present in the POST body alongside the file. */
  timestamp: number;
  signature: string;
  folder: string;
  publicId: string;
  /** Server-side upload preset, when configured. Signed, so unbypassable. */
  uploadPreset: string;
  /** `<resourceType>/<publicId>` — final key, known before the upload runs. */
  key: string;
  /** Signed download URL for that key. */
  url: string;
  /** The single signature keeps the client from widening its own limits. */
  maxFileSize: number;
};

/**
 * The public id to store the asset under.
 *
 * Must include the extension, and must not be combined with a separate
 * `folder` upload parameter. Cloudinary rewrites the public id it returns:
 * raw assets gain their extension, and a `folder` param gets prefixed onto
 * the id. Either rewrite means the returned id differs from the one we
 * signed, and the client — which was handed a download URL for that exact
 * key before uploading — would end up holding a link to nothing. Including
 * the extension and letting the upload preset own the folder makes the
 * returned id byte-identical to the requested one.
 *
 * Verified against live Cloudinary: an id without an extension comes back
 * as `<id>.txt`, and the same id with `.txt` comes back unchanged.
 */
function newPublicId(extension: string): string {
  const d = new Date();
  return (
    `lms/${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/` +
    `${randomBytes(16).toString("hex")}.${extension}`
  );
}

/**
 * Build the string Cloudinary will reconstruct, and its SHA1 digest.
 *
 * Cloudinary signs the request's body parameters, sorted alphabetically,
 * with `api_key`, `file`, `resource_type`, `cloud_name` and the validated
 * options (`max_file_size`) excluded. Verified against a live rejection:
 * including `max_file_size` in the digest produces "Invalid Signature" for
 * every upload, because Cloudinary computes it without that parameter.
 *
 * `upload_preset` IS signed, which is the point of using one — it cannot be
 * swapped or dropped by the client. `folder` is deliberately NOT sent or
 * signed: it would be prefixed onto the returned public id and break the
 * key match. The preset's own folder setting still applies.
 */
function signUploadParams(publicId: string, timestamp: number): { toSign: string; signature: string } {
  const params: string[] = [
    `public_id=${publicId}`,
    `timestamp=${timestamp}`,
  ];
  if (UPLOAD_PRESET) params.push(`upload_preset=${UPLOAD_PRESET}`);
  params.sort();
  const toSign = `${params.join("&")}${API_SECRET}`;
  return { toSign, signature: createHash("sha1").update(toSign).digest("hex") };
}

/**
 * Mint a signature authorising exactly one upload of a known content type,
 * of at most MAX_UPLOAD_BYTES, to a server-chosen object key.
 *
 * The resource type, folder, public id and size ceiling are all part of
 * the signed payload, so a client cannot swap one for another — the upload
 * is rejected by Cloudinary if any of them differs. Because the key is
 * decided here, the finished download URL can be returned immediately,
 * rather than the client having to ask for a signature afterwards (which
 * would amount to a signing oracle for any key, including other people's
 * submissions).
 */
export function createUploadTicket(contentType: string): UploadTicket {
  const { cloudName, apiKey } = requireConfig();
  if (!isAllowedUploadType(contentType)) {
    throw new Error("Unsupported file type");
  }

  const resourceType = resourceTypeFor(contentType);
  const extension = extensionFor(contentType);
  if (!extension) throw new Error("Unsupported file type");
  const publicId = newPublicId(extension);
  const timestamp = Math.floor(Date.now() / 1000);
  const { signature } = signUploadParams(publicId, timestamp);

  const key = buildKey(resourceType, publicId);

  return {
    cloudName,
    apiKey,
    // Typed endpoint, not `auto`: the resource type is signed in via the
    // public id and can't be swapped for a different one.
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
    timestamp,
    signature,
    folder: FOLDER,
    publicId,
    uploadPreset: UPLOAD_PRESET,
    key,
    url: `/api/files/download/${encodeURIComponent(key)}?t=${signToken(key)}`,
    maxFileSize: MAX_UPLOAD_BYTES,
  };
}

// ---------------------------------------------------------------------------
// Server-side operations
// ---------------------------------------------------------------------------

export type PutOptions = {
  filename: string;
  contentType: string;
  data: Buffer;
};

/**
 * Upload a buffer from the server. Used by any code path that already
 * holds the bytes; the browser path goes direct via `createUploadTicket`.
 */
export async function putObject(opts: PutOptions): Promise<StoredObject> {
  const { cloudName, apiKey } = requireConfig();

  if (opts.data.byteLength === 0) throw new Error("Empty file");
  if (opts.data.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error("File too large (10MB max)");
  }
  if (!isAllowedUploadType(opts.contentType)) {
    throw new Error("Unsupported file type");
  }

  const resourceType = resourceTypeFor(opts.contentType);
  const extension = extensionFor(opts.contentType);
  if (!extension) throw new Error("Unsupported file type");
  const publicId = newPublicId(extension);
  const timestamp = Math.floor(Date.now() / 1000);
  const { signature } = signUploadParams(publicId, timestamp);

  // Copy into a plain ArrayBuffer: Node's Buffer is a SharedArrayBuffer-
  // backed view, which the DOM Blob type doesn't accept.
  const body = new Uint8Array(opts.data.byteLength);
  body.set(opts.data);
  const form = new FormData();
  form.append("file", new Blob([body], { type: opts.contentType }), opts.filename);
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("public_id", publicId);
  // No `folder` param — see newPublicId(): it would be prefixed onto the
  // returned public id and break the key the caller was already given.
  if (UPLOAD_PRESET) form.append("upload_preset", UPLOAD_PRESET);
  // Best-effort ceiling. Unenforceable on its own (Cloudinary excludes it
  // from the digest, so a client could drop it) — set CLOUDINARY_UPLOAD_PRESET
  // to make the limit real. See the note on UPLOAD_PRESET above.
  form.append("max_file_size", String(MAX_UPLOAD_BYTES));
  form.append("signature", signature);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
    { method: "POST", body: form },
  );
  if (!res.ok) {
    throw new Error(`Cloudinary upload failed (${res.status})`);
  }
  const json = (await res.json()) as { bytes?: number };

  // The key is the one we asked for, not the one echoed back: the
  // signature pins public_id, so a mismatch is a Cloudinary bug, not a
  // value to be trusted.
  const key = buildKey(resourceType, publicId);
  return {
    key,
    url: `/api/files/download/${encodeURIComponent(key)}?t=${signToken(key)}`,
    size: json.bytes ?? opts.data.byteLength,
    contentType: opts.contentType,
    sha256: createHash("sha256").update(opts.data).digest("hex"),
  };
}

const EXT_BY_FORMAT: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  txt: "text/plain",
  md: "text/markdown",
  zip: "application/zip",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  mp4: "video/mp4",
  webm: "video/webm",
  ogv: "video/ogg",
  mov: "video/quicktime",
};

/**
 * Fetch an object from Cloudinary.
 *
 * Cloudinary reports `format` for images and videos but reports raw assets
 * without one — the extension *is* the id there. Falling back to the id
 * keeps the download filename and Content-Type correct for PDFs, docs and
 * zips rather than labelling them all octet-stream.
 */
function guessFormat(publicId: string): string {
  const lastDot = publicId.lastIndexOf(".");
  const slash = publicId.lastIndexOf("/");
  if (lastDot <= slash) return "";
  const ext = publicId.slice(lastDot + 1).toLowerCase();
  return /^[a-z0-9]{1,8}$/.test(ext) ? ext : "";
}

/**
 * Fetch an object from Cloudinary.
 *
 * The content type is derived from the object key rather than fetched from
 * a metadata endpoint. Every key we mint encodes its own extension — the
 * upload ticket only exists to produce one — so a second round trip buys
 * nothing, and the admin `resources` endpoint cannot be addressed for a
 * nested public id anyway (it rejects the path with "Invalid value … for
 * parameter type", having read the first folder segment as the type).
 *
 * Streaming rather than redirecting keeps the HMAC download token the only
 * way in: a Cloudinary delivery URL handed to a browser would be a
 * permanent, unexpiring bearer link to the original file.
 */
export async function getObject(
  key: string,
): Promise<{ data: Buffer; contentType: string; format: string } | null> {
  const { cloudName } = requireConfig();
  const { resourceType, publicId } = parseKey(key);

  const format = guessFormat(publicId);
  const contentType =
    EXT_BY_FORMAT[format] ?? "application/octet-stream";

  // Raw assets carry their extension inside the public_id; appending
  // ".<format>" again would request "report.pdf.pdf". Image and video ids
  // don't include one, so there it must be appended.
  //
  // Read via the delivery CDN. There is no authenticated delivery route for
  // raw assets on this account — the API 404s on every path form tried —
  // so the CDN is the only way to fetch bytes back.
  const suffix = format && resourceType !== "raw" ? `.${format}` : "";
  const delivery = `https://res.cloudinary.com/${cloudName}/${resourceType}/upload/${publicId}${suffix}`;

  const res = await fetch(delivery);
  if (res.status === 404 || res.status === 403) return null;
  if (!res.ok) throw new Error(`Cloudinary delivery failed (${res.status})`);
  const data = Buffer.from(await res.arrayBuffer());
  return { data, contentType, format };
}

export async function deleteObject(key: string): Promise<void> {
  const { cloudName, apiKey } = requireConfig();
  const { resourceType, publicId } = parseKey(key);

  // Signed destroy, with CDN invalidation.
  //
  // Three Cloudinary quirks, each verified against live rejections:
  //   - `upload_preset` must NOT appear in the destroy signature. Including
  //     it returns 401 Invalid Signature.
  //   - `invalidate` MUST appear and MUST be signed, or the asset is removed
  //     from the media library but keeps being served.
  //   - even so, `invalidate` does not purge the delivery CDN's cache. An
  //     asset that was read before it was deleted can keep streaming from
  //     res.cloudinary.com until that entry ages out. This is a Cloudinary
  //     caching behaviour, not something the API can override — see
  //     README "File uploads" for the consequence.
  const timestamp = Math.floor(Date.now() / 1000);
  const toSign = `invalidate=true&public_id=${publicId}&timestamp=${timestamp}${API_SECRET}`;
  const signature = createHash("sha1").update(toSign).digest("hex");

  await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        public_id: publicId,
        timestamp,
        signature,
        api_key: apiKey,
        invalidate: true,
      }),
    },
  ).catch(() => {
    // Best-effort: the DB row is already gone, and a stranded asset costs
    // storage but not correctness. Failing the request would be worse.
  });
}

export { MAX_UPLOAD_BYTES };
