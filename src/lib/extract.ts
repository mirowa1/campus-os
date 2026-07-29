import mammoth from "mammoth";

export type ExtractedContent =
  | { kind: "text"; text: string }
  | {
      kind: "image";
      base64: string;
      mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
    };

function imageMediaType(
  mime: string
): "image/jpeg" | "image/png" | "image/gif" | "image/webp" | null {
  if (mime === "image/jpeg" || mime === "image/jpg") return "image/jpeg";
  if (mime === "image/png") return "image/png";
  if (mime === "image/gif") return "image/gif";
  if (mime === "image/webp") return "image/webp";
  return null;
}

export async function extractSyllabusContent(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<ExtractedContent> {
  const lower = fileName.toLowerCase();
  const mime = mimeType.toLowerCase();

  const asImage = imageMediaType(mime);
  if (asImage) {
    return {
      kind: "image",
      base64: buffer.toString("base64"),
      mediaType: asImage,
    };
  }

  if (
    mime.includes("word") ||
    lower.endsWith(".docx") ||
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return { kind: "text", text: result.value };
  }

  if (mime === "application/pdf" || lower.endsWith(".pdf")) {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    try {
      const data = await parser.getText();
      return { kind: "text", text: data.text };
    } finally {
      await parser.destroy();
    }
  }

  // Fallback: treat as UTF-8 text
  return { kind: "text", text: buffer.toString("utf8") };
}
