import { NextRequest, NextResponse } from "next/server";
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

    const { data: assessments } = await supabase
      .from("assessments")
      .select("*")
      .eq("class_id", classRow.id)
      .order("due_date", { ascending: true, nullsFirst: false });

    return NextResponse.json({
      class: classRow,
      assessments: assessments ?? [],
      storagePath: uploadError ? null : path,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Parse failed";
    console.error("parse-syllabus:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
