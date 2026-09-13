import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { parseAssessmentCreateBody } from "@/lib/assessment-validation";
import { requireOwnedClass } from "@/lib/class-access";
import { trySyncClassToGoogleCalendar } from "@/lib/google-calendar";
import type { AssessmentRow } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: { id: string } };

function revalidateAssessmentPaths(classId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/classes");
  revalidatePath("/grades");
  revalidatePath("/assessments");
  revalidatePath("/calendar");
  revalidatePath(`/classes/${classId}`);
}

export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const { userId, classRow, supabase } = await requireOwnedClass(params.id);
    const parsed = parseAssessmentCreateBody(await request.json());
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { data: assessment, error: insertError } = await supabase
      .from("assessments")
      .insert({
        class_id: params.id,
        ...parsed.row,
      })
      .select()
      .single();

    if (insertError || !assessment) {
      return NextResponse.json(
        { error: insertError?.message || "Failed to create assessment" },
        { status: 500 }
      );
    }

    let calendarSyncWarning: string | null = null;
    try {
      await trySyncClassToGoogleCalendar({
        supabase,
        userId,
        classId: params.id,
        classRow,
      });
    } catch (err) {
      calendarSyncWarning =
        err instanceof Error ? err.message : "Google Calendar sync failed";
      console.error("[assessments POST] Google Calendar sync failed", {
        classId: params.id,
        assessmentId: assessment.id,
        userId,
        err,
      });
    }

    revalidateAssessmentPaths(params.id);

    return NextResponse.json({
      assessment: assessment as AssessmentRow,
      ...(calendarSyncWarning ? { calendarSyncWarning } : {}),
    });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : "Failed to create assessment";
    return NextResponse.json({ error: message }, { status });
  }
}
