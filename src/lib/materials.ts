/** Server-side validation for course material uploads. */

export const MAX_MATERIAL_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_MATERIAL_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "text/markdown",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const EXT_TO_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc": "application/msword",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export function resolveMaterialMime(
  fileName: string,
  declaredMime: string
): string | null {
  const lower = fileName.toLowerCase();
  const ext = Object.keys(EXT_TO_MIME).find((e) => lower.endsWith(e));
  const fromExt = ext ? EXT_TO_MIME[ext] : null;
  const mime = (declaredMime || fromExt || "").toLowerCase().trim();

  if (mime && ALLOWED_MATERIAL_MIME_TYPES.has(mime)) return mime;
  if (fromExt && ALLOWED_MATERIAL_MIME_TYPES.has(fromExt)) return fromExt;
  return null;
}

export function validateMaterialUpload(input: {
  fileName: string;
  mimeType: string;
  size: number;
}): { ok: true; mimeType: string } | { ok: false; error: string } {
  if (!input.fileName?.trim()) {
    return { ok: false, error: "Missing file name." };
  }
  if (input.size <= 0) {
    return { ok: false, error: "Empty file." };
  }
  if (input.size > MAX_MATERIAL_BYTES) {
    return {
      ok: false,
      error: `File too large. Max size is ${MAX_MATERIAL_BYTES / (1024 * 1024)} MB.`,
    };
  }
  const mime = resolveMaterialMime(input.fileName, input.mimeType);
  if (!mime) {
    return {
      ok: false,
      error:
        "Unsupported file type. Allowed: PDF, DOCX, TXT, MD, JPEG, PNG, WEBP, GIF.",
    };
  }
  return { ok: true, mimeType: mime };
}
