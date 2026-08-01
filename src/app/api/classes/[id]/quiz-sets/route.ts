import { NextRequest, NextResponse } from "next/server";
import { requireOwnedClass } from "@/lib/class-access";
import { generateQuizOrFlashcardsWithClaude } from "@/lib/claude";
import {
  EXTRA_TEXT_MAX_CHARS,
  loadClassSources,
  parseIdList,
} from "@/lib/class-sources";
import { parseQuizOrFlashcardResponse } from "@/lib/quiz-validate";
import type { QuizMode } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: { id: string } };

function stripFences(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/);
  return match ? match[1].trim() : trimmed;
}

export async function GET(_request: NextRequest, { params }: Ctx) {
  try {
    const { supabase } = await requireOwnedClass(params.id);
    const { data, error } = await supabase
      .from("quiz_sets")
      .select("*")
      .eq("class_id", params.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const sets = data ?? [];
    const ids = sets.map((s) => s.id);
    const attemptsBySet: Record<string, unknown[]> = {};
    if (ids.length) {
      const { data: attempts } = await supabase
        .from("quiz_attempts")
        .select("*")
        .in("quiz_set_id", ids)
        .order("created_at", { ascending: false });
      for (const a of attempts ?? []) {
        const list = attemptsBySet[a.quiz_set_id] ?? [];
        list.push(a);
        attemptsBySet[a.quiz_set_id] = list;
      }
    }

    return NextResponse.json({
      sets: sets.map((s) => ({
        ...s,
        attempts: attemptsBySet[s.id] ?? [],
      })),
    });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not set." },
        { status: 503 }
      );
    }

    const { classRow, supabase } = await requireOwnedClass(params.id);

    const form = await request.formData();
    const materialIds = parseIdList(form.get("materialIds"));
    const noteIds = parseIdList(form.get("noteIds"));
    const extraText = String(form.get("extraText") || "");
    const modeRaw = String(form.get("mode") || "");
    const mode = modeRaw as QuizMode;
    if (mode !== "quiz" && mode !== "flashcard") {
      return NextResponse.json(
        { error: "mode must be quiz or flashcard" },
        { status: 400 }
      );
    }

    const f = form.get("extraFile");
    const extraFile = f instanceof File && f.size > 0 ? f : null;

    if (extraText.length > EXTRA_TEXT_MAX_CHARS) {
      return NextResponse.json(
        {
          error: `Pasted text is too long. Max ${EXTRA_TEXT_MAX_CHARS.toLocaleString()} characters.`,
        },
        { status: 400 }
      );
    }

    const { materialTexts, images, sourceRefs } = await loadClassSources({
      supabase,
      classId: params.id,
      materialIds,
      noteIds,
      extraText,
      extraFile,
    });

    let parsed;
    let lastError = "Generation failed, please try again";
    for (let attempt = 0; attempt < 2; attempt++) {
      let text = "";
      try {
        text = await generateQuizOrFlashcardsWithClaude({
          mode,
          className: classRow.name,
          classCode: classRow.code,
          materialTexts,
          images,
        });
        const json = JSON.parse(stripFences(text));
        parsed = parseQuizOrFlashcardResponse(json, mode);
        break;
      } catch (err) {
        lastError =
          err instanceof Error ? err.message : "Generation failed, please try again";
        console.error(`quiz-sets attempt ${attempt + 1}:`, err);
        if (text) console.error("raw:", text.slice(0, 3000));
      }
    }

    if (!parsed) {
      return NextResponse.json(
        { error: "Generation failed, please try again", detail: lastError },
        { status: 502 }
      );
    }

    if (parsed.thin) {
      return NextResponse.json(
        { error: parsed.message, thin: true },
        { status: 422 }
      );
    }

    const date = new Date().toISOString().slice(0, 10);
    const label = [classRow.code, classRow.name].filter(Boolean).join(" ") || "Class";
    const title =
      mode === "quiz"
        ? `Quiz — ${label} — ${date}`
        : `Flashcards — ${label} — ${date}`;

    const { data: quizSet, error: insertError } = await supabase
      .from("quiz_sets")
      .insert({
        class_id: params.id,
        mode,
        title,
        source_refs: sourceRefs,
        content: parsed.items,
      })
      .select()
      .single();

    if (insertError || !quizSet) {
      return NextResponse.json(
        { error: insertError?.message || "Failed to save set" },
        { status: 500 }
      );
    }

    return NextResponse.json({ quizSet });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : "Generate failed";
    console.error("quiz-sets:", err);
    return NextResponse.json({ error: message }, { status });
  }
}
