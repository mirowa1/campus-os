import { NextRequest, NextResponse } from "next/server";
import { requireOwnedClass } from "@/lib/class-access";
import { generateStudyGuideWithClaude } from "@/lib/claude";
import {
  EXTRA_TEXT_MAX_CHARS,
  loadClassSources,
  parseIdList,
} from "@/lib/class-sources";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: { id: string } };

export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not set." },
        { status: 503 }
      );
    }

    const { classRow, supabase } = await requireOwnedClass(params.id);

    const contentType = request.headers.get("content-type") || "";
    let materialIds: string[] = [];
    let noteIds: string[] = [];
    let extraText = "";
    let extraFile: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      materialIds = parseIdList(form.get("materialIds"));
      noteIds = parseIdList(form.get("noteIds"));
      extraText = String(form.get("extraText") || "");
      const f = form.get("extraFile");
      if (f instanceof File && f.size > 0) extraFile = f;
    } else {
      const body = await request.json().catch(() => ({}));
      materialIds = parseIdList(body.materialIds);
      noteIds = parseIdList(body.noteIds);
      extraText = String(body.extraText || "");
    }

    if (extraText.length > EXTRA_TEXT_MAX_CHARS) {
      return NextResponse.json(
        {
          error: `Pasted text is too long. Max ${EXTRA_TEXT_MAX_CHARS.toLocaleString()} characters.`,
        },
        { status: 400 }
      );
    }

    const { materialTexts, images } = await loadClassSources({
      supabase,
      classId: params.id,
      materialIds,
      noteIds,
      extraText,
      extraFile,
    });

    const content = await generateStudyGuideWithClaude({
      className: classRow.name,
      classCode: classRow.code,
      materialTexts,
      images,
    });

    const { data: studyGuide, error: insertError } = await supabase
      .from("study_guides")
      .insert({ class_id: params.id, content })
      .select()
      .single();

    if (insertError || !studyGuide) {
      return NextResponse.json(
        { error: insertError?.message || "Failed to save study guide" },
        { status: 500 }
      );
    }

    return NextResponse.json({ studyGuide });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : "Generate failed";
    console.error("study-guide:", err);
    return NextResponse.json({ error: message }, { status });
  }
}
