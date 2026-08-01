import { NextRequest, NextResponse } from "next/server";
import { requireOwnedClass } from "@/lib/class-access";

export const runtime = "nodejs";

type Ctx = { params: { id: string; setId: string } };

export async function POST(_request: NextRequest, { params }: Ctx) {
  try {
    const { supabase } = await requireOwnedClass(params.id);

    const { data: set, error: setError } = await supabase
      .from("quiz_sets")
      .select("id, class_id")
      .eq("id", params.setId)
      .eq("class_id", params.id)
      .maybeSingle();

    if (setError || !set) {
      return NextResponse.json({ error: "Quiz set not found" }, { status: 404 });
    }

    const { data: attempt, error } = await supabase
      .from("quiz_attempts")
      .insert({
        quiz_set_id: set.id,
        score: null,
        answers: [],
        known_cards: [],
        completed_at: null,
      })
      .select()
      .single();

    if (error || !attempt) {
      return NextResponse.json(
        { error: error?.message || "Failed to start attempt" },
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
