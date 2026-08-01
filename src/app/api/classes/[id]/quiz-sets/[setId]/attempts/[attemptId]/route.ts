import { NextRequest, NextResponse } from "next/server";
import { requireOwnedClass } from "@/lib/class-access";

export const runtime = "nodejs";

type Ctx = { params: { id: string; setId: string; attemptId: string } };

export async function PATCH(request: NextRequest, { params }: Ctx) {
  try {
    const { supabase } = await requireOwnedClass(params.id);
    const body = (await request.json().catch(() => ({}))) as {
      answers?: unknown;
      known_cards?: unknown;
      score?: unknown;
      completed_at?: unknown;
    };

    const { data: set } = await supabase
      .from("quiz_sets")
      .select("id")
      .eq("id", params.setId)
      .eq("class_id", params.id)
      .maybeSingle();

    if (!set) {
      return NextResponse.json({ error: "Quiz set not found" }, { status: 404 });
    }

    const patch: Record<string, unknown> = {};
    if (Array.isArray(body.answers)) patch.answers = body.answers;
    if (Array.isArray(body.known_cards)) patch.known_cards = body.known_cards;
    if (typeof body.score === "number" || body.score === null) {
      patch.score = body.score;
    }
    if (typeof body.completed_at === "string" || body.completed_at === null) {
      patch.completed_at = body.completed_at;
    }

    const { data: attempt, error } = await supabase
      .from("quiz_attempts")
      .update(patch)
      .eq("id", params.attemptId)
      .eq("quiz_set_id", params.setId)
      .select()
      .single();

    if (error || !attempt) {
      return NextResponse.json(
        { error: error?.message || "Failed to update attempt" },
        { status: 500 }
      );
    }

    return NextResponse.json({ attempt });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status });
  }
}
