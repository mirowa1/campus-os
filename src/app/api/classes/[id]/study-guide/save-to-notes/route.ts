import { NextRequest, NextResponse } from "next/server";
import { requireOwnedClass } from "@/lib/class-access";

export const runtime = "nodejs";

type Ctx = { params: { id: string } };

export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const { supabase } = await requireOwnedClass(params.id);
    const body = await request.json().catch(() => ({}));
    const studyGuideId = body.studyGuideId as string | undefined;
    const title = String(body.title || "").trim();

    if (!title) {
      return NextResponse.json(
        { error: "Title is required to save as a new note." },
        { status: 400 }
      );
    }

    let guideContent: string | null = null;

    if (studyGuideId) {
      const { data: guide, error } = await supabase
        .from("study_guides")
        .select("*")
        .eq("id", studyGuideId)
        .eq("class_id", params.id)
        .single();
      if (error || !guide) {
        return NextResponse.json(
          { error: "Study guide not found" },
          { status: 404 }
        );
      }
      guideContent = guide.content;
    } else {
      const { data: latest } = await supabase
        .from("study_guides")
        .select("*")
        .eq("class_id", params.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!latest) {
        return NextResponse.json(
          { error: "No study guide to save" },
          { status: 404 }
        );
      }
      guideContent = latest.content;
    }

    const { data: note, error: insertError } = await supabase
      .from("notes")
      .insert({
        class_id: params.id,
        title,
        body: guideContent,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError || !note) {
      return NextResponse.json(
        { error: insertError?.message || "Failed to create note" },
        { status: 500 }
      );
    }

    return NextResponse.json({ note });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : "Save failed";
    return NextResponse.json({ error: message }, { status });
  }
}
