// Upload limits and the accepted-type list.
//
// Deliberately free of Node-only imports so the browser can import it: the
// client uses these to reject a file before spending bandwidth, and the
// server uses the same values so the two can't drift into disagreeing
// about what "too big" or "unsupported" means.
//
// These are the AUTHORITATIVE limits. A signed upload is still validated
// server-side via the `max_file_size` byte limit baked into the signature,
// because a client-side check is a convenience, never a control.

/** Hard ceiling for a single file, across every upload surface. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const MAX_UPLOAD_LABEL = "10 MB";

/** MIME types accepted anywhere in the app. */
export const ALLOWED_UPLOAD_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/markdown",
  "application/zip",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
] as const;

const ALLOWED_SET = new Set<string>(ALLOWED_UPLOAD_TYPES);

/** `accept` attribute for file inputs. */
export const UPLOAD_ACCEPT_ATTRIBUTE = ALLOWED_UPLOAD_TYPES.join(",");

export function isAllowedUploadType(contentType: string): boolean {
  return ALLOWED_SET.has(contentType);
}

/**
 * Whether a type is a video. Videos are stored as Cloudinary video
 * resources so they can be streamed rather than downloaded whole.
 */
export function isVideoType(contentType: string): boolean {
  return contentType.startsWith("video/");
}

export function isImageType(contentType: string): boolean {
  return contentType.startsWith("image/");
}

/**
 * The Cloudinary resource type for a MIME type.
 *
 * Derived here rather than left to Cloudinary's `auto` upload, because the
 * object key we store is `<resourceType>/<publicId>` and Cloudinary's
 * delete call needs a concrete type. Knowing it up front also lets the
 * server hand the client a finished, signed download URL at ticket time
 * instead of after the fact.
 */
export function resourceTypeFor(contentType: string): "image" | "video" | "raw" {
  if (isVideoType(contentType)) return "video";
  if (isImageType(contentType)) return "image";
  return "raw";
}

/**
 * The file extension Cloudinary will use for a given MIME type.
 *
 * Needed because raw assets store their extension *inside* the public id.
 * Sending an id with no extension and getting one back means the stored id
 * no longer matches the one we signed — which breaks the "the client already
 * holds a download URL for this exact key" guarantee. So the extension has
 * to be part of the id we choose up front.
 *
 * Keyed by MIME type rather than by the submitted filename: a filename is
 * attacker-controlled, a MIME type is checked against the allowlist.
 */
const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "text/plain": "txt",
  "text/markdown": "md",
  "application/zip": "zip",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/ogg": "ogv",
  "video/quicktime": "mov",
};

/** Extension for an accepted MIME type, or null when the type isn't allowed. */
export function extensionFor(contentType: string): string | null {
  if (!isAllowedUploadType(contentType)) return null;
  return EXTENSION_BY_TYPE[contentType] ?? "bin";
}

/** Validate a size/content-type pair. Returns null when acceptable. */
export function validateUpload(
  size: number,
  contentType: string,
): { error: string; code: "too_large" | "unsupported_type" | "empty" } | null {
  if (size <= 0) return { error: "That file is empty.", code: "empty" };
  if (size > MAX_UPLOAD_BYTES) {
    return {
      error: `That file is larger than ${MAX_UPLOAD_LABEL}.`,
      code: "too_large",
    };
  }
  if (!isAllowedUploadType(contentType)) {
    return { error: "That file type isn't supported here.", code: "unsupported_type" };
  }
  return null;
}
