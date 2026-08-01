import { extractSyllabusContent } from "@/lib/extract";
import { validateMaterialUpload } from "@/lib/materials";
import type { createClient } from "@/lib/supabase/server";

export const EXTRA_TEXT_MAX_CHARS = 50_000;

export type LoadedSources = {
  materialTexts: { fileName: string; text: string }[];
  images: {
    fileName: string;
    base64: string;
    mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  }[];
  sourceRefs: {
    materialIds: string[];
    noteIds: string[];
    hadExtraText: boolean;
    hadExtraFile: boolean;
    extraFileName?: string;
  };
};

export function parseIdList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map(String).filter(Boolean);
  }
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      return raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return [];
}

type Supabase = ReturnType<typeof createClient>;

export async function loadClassSources(input: {
  supabase: Supabase;
  classId: string;
  materialIds: string[];
  noteIds: string[];
  extraText: string;
  extraFile: File | null;
}): Promise<LoadedSources> {
  const materialTexts: LoadedSources["materialTexts"] = [];
  const images: LoadedSources["images"] = [];
  const { materialIds, noteIds, extraText, extraFile, supabase, classId } =
    input;

  if (materialIds.length > 0) {
    const { data: materials, error: matError } = await supabase
      .from("course_materials")
      .select("*")
      .eq("class_id", classId)
      .in("id", materialIds);

    if (matError) {
      throw Object.assign(new Error(matError.message), { status: 500 });
    }

    const found = new Set((materials ?? []).map((m) => m.id));
    const missing = materialIds.filter((id) => !found.has(id));
    if (missing.length) {
      throw Object.assign(
        new Error(
          "One or more selected materials were not found for this class."
        ),
        { status: 400 }
      );
    }

    for (const m of materials ?? []) {
      const { data: blob, error: dlError } = await supabase.storage
        .from("materials")
        .download(m.storage_path);
      if (dlError || !blob) {
        throw Object.assign(
          new Error(
            `Failed to download ${m.file_name}: ${dlError?.message}`
          ),
          { status: 500 }
        );
      }
      const buffer = Buffer.from(await blob.arrayBuffer());
      const extracted = await extractSyllabusContent(
        buffer,
        m.mime_type,
        m.file_name
      );
      if (extracted.kind === "text") {
        materialTexts.push({ fileName: m.file_name, text: extracted.text });
      } else {
        images.push({
          fileName: m.file_name,
          base64: extracted.base64,
          mediaType: extracted.mediaType,
        });
      }
    }
  }

  if (noteIds.length > 0) {
    const { data: selectedNotes, error: notesError } = await supabase
      .from("notes")
      .select("id, title, body")
      .eq("class_id", classId)
      .in("id", noteIds);

    if (notesError) {
      throw Object.assign(new Error(notesError.message), { status: 500 });
    }

    const found = new Set((selectedNotes ?? []).map((n) => n.id));
    const missing = noteIds.filter((id) => !found.has(id));
    if (missing.length) {
      throw Object.assign(
        new Error("One or more selected notes were not found for this class."),
        { status: 400 }
      );
    }

    for (const n of selectedNotes ?? []) {
      const body = n.body?.trim() ?? "";
      if (!body) continue;
      materialTexts.push({
        fileName: `Note: ${n.title || "Untitled"}`,
        text: body,
      });
    }
  }

  if (extraText.trim()) {
    materialTexts.push({
      fileName: "Pasted content",
      text: extraText.trim(),
    });
  }

  if (extraFile) {
    const validation = validateMaterialUpload({
      fileName: extraFile.name,
      mimeType: extraFile.type || "",
      size: extraFile.size,
    });
    if (!validation.ok) {
      throw Object.assign(new Error(validation.error), { status: 400 });
    }
    const buffer = Buffer.from(await extraFile.arrayBuffer());
    const extracted = await extractSyllabusContent(
      buffer,
      validation.mimeType,
      extraFile.name
    );
    if (extracted.kind === "text") {
      materialTexts.push({
        fileName: `Attached: ${extraFile.name}`,
        text: extracted.text,
      });
    } else {
      images.push({
        fileName: `Attached: ${extraFile.name}`,
        base64: extracted.base64,
        mediaType: extracted.mediaType,
      });
    }
  }

  if (!materialTexts.length && !images.length) {
    throw Object.assign(
      new Error(
        "No usable sources. Select materials, non-empty notes, paste text, or attach a file."
      ),
      { status: 400 }
    );
  }

  return {
    materialTexts,
    images,
    sourceRefs: {
      materialIds,
      noteIds,
      hadExtraText: Boolean(extraText.trim()),
      hadExtraFile: Boolean(extraFile),
      extraFileName: extraFile?.name,
    },
  };
}
