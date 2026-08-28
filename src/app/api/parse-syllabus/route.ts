import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { parseSyllabusWithClaude } from "@/lib/claude";
import { extractSyllabusContent } from "@/lib/extract";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        {
          error:
            "ANTHROPIC_API_KEY is not set. Add it to .env.local to parse syllabi.",
        },
        { status: 503 }
      );
    }

    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    const { error: uploadError } = await supabase.storage
      .from("syllabi")
      .upload(path, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      // Storage may not be configured yet — continue parsing without blocking
      console.warn("Syllabus storage upload failed:", uploadError.message);
    }

    const extracted = await extractSyllabusContent(
      buffer,
      file.type || "",
      file.name
    );

    console.error("[parse-syllabus] parse attempt", {
      fileName: file.name,
      mime: file.type || "application/octet-stream",
      sizeBytes: buffer.length,
      extractedKind: extracted.kind,
      textLength: extracted.kind === "text" ? extracted.text.length : null,
    });

    const parsed =
      extracted.kind === "image"
        ? await parseSyllabusWithClaude({
            imageBase64: extracted.base64,
            mediaType: extracted.mediaType,
          })
        : await parseSyllabusWithClaude({ text: extracted.text });

    const { data: classRow, error: classError } = await supabase
      .from("classes")
      .insert({
        user_id: user.id,
        name: parsed.name,
        code: parsed.code,
        term: parsed.term,
        syllabus_path: uploadError ? null : path,
        syllabus_file_name: uploadError ? null : file.name,
      })
      .select()
      .single();

    if (classError || !classRow) {
      return NextResponse.json(
        { error: classError?.message || "Failed to create class" },
        { status: 500 }
      );
    }

    const rows = parsed.assessments.map((a) => ({
      class_id: classRow.id,
      title: a.title,
      type: a.type,
      due_date: a.due_date,
      weight_percent: a.weight_percent,
      max_score: 100,
    }));

    if (rows.length > 0) {
      const { error: assessError } = await supabase
        .from("assessments")
        .insert(rows);
      if (assessError) {
        return NextResponse.json(
          { error: assessError.message },
          { status: 500 }
        );
      }
    }

    const meetingRows = (parsed.meetings ?? []).map((m) => ({
      class_id: classRow.id,
      user_id: user.id,
      day_of_week: m.day_of_week,
      start_time: m.start_time,
      end_time: m.end_time,
      location: m.location,
      term_start_date: m.term_start_date,
      term_end_date: m.term_end_date,
    }));

    if (meetingRows.length > 0) {
      const { error: meetingError } = await supabase
        .from("class_meetings")
        .insert(meetingRows);
      if (meetingError) {
        return NextResponse.json(
          { error: meetingError.message },
          { status: 500 }
        );
      }
    }

    const { data: assessments } = await supabase
      .from("assessments")
      .select("*")
      .eq("class_id", classRow.id)
      .order("due_date", { ascending: true, nullsFirst: false });

    const { data: meetings } = await supabase
      .from("class_meetings")
      .select("*")
      .eq("class_id", classRow.id)
      .order("day_of_week", { ascending: true });

    // Soft-invalidate calendar so new due dates appear without a hard refresh.
    revalidatePath("/calendar");

    return NextResponse.json({
      class: classRow,
      assessments: assessments ?? [],
      meetings: meetings ?? [],
      storagePath: uploadError ? null : path,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Parse failed";
    console.error("parse-syllabus:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
