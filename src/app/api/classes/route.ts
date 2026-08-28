import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Manual class creation — always free (no syllabus parse / paywall). */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      name?: string;
      code?: string;
      term?: string;
    };

    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "Class name is required" }, { status: 400 });
    }

    const code = body.code?.trim() || null;
    const term = body.term?.trim() || null;

    const { data: classRow, error: classError } = await supabase
      .from("classes")
      .insert({
        user_id: user.id,
        name,
        code,
        term,
      })
      .select()
      .single();

    if (classError || !classRow) {
      return NextResponse.json(
        { error: classError?.message || "Failed to create class" },
        { status: 500 }
      );
    }

    revalidatePath("/dashboard");
    revalidatePath("/classes");
    revalidatePath("/calendar");
    revalidatePath("/grades");

    return NextResponse.json({ class: classRow });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create class";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
