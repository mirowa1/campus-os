import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { parseAssessmentPatchBody } from "@/lib/assessment-validation";
import { requireOwnedClass } from "@/lib/class-access";
import {
  deleteAssessmentGoogleEvent,
  trySyncClassToGoogleCalendar,
} from "@/lib/google-calendar";
import type { AssessmentRow } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: { id: string; assessmentId: string } };

function revalidateAssessmentPaths(classId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/classes");
  revalidatePath("/grades");
  revalidatePath("/assessments");
  revalidatePath("/calendar");
  revalidatePath(`/classes/${classId}`);
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  try {
    const { userId, classRow, supabase } = await requireOwnedClass(params.id);
    const parsed = parseAssessmentPatchBody(await request.json());
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { data: existing, error: findError } = await supabase
      .from("assessments")
      .select("*")
      .eq("id", params.assessmentId)
      .eq("class_id", params.id)
      .maybeSingle();

    if (findError || !existing) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    const { data: assessment, error: updateError } = await supabase
      .from("assessments")
      .update(parsed.row)
      .eq("id", params.assessmentId)
      .eq("class_id", params.id)
      .select()
      .single();

    if (updateError || !assessment) {
      return NextResponse.json(
        { error: updateError?.message || "Failed to update assessment" },
        { status: 500 }
      );
    }

    const needsCalendarSync =
      existing.title !== parsed.row.title ||
      existing.due_date !== parsed.row.due_date;

    let calendarSyncWarning: string | null = null;
    if (needsCalendarSync) {
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
        console.error("[assessments PATCH] Google Calendar sync failed", {
          classId: params.id,
          assessmentId: params.assessmentId,
          userId,
          err,
        });
      }
    }

    revalidateAssessmentPaths(params.id);

    return NextResponse.json({
      assessment: assessment as AssessmentRow,
      ...(calendarSyncWarning ? { calendarSyncWarning } : {}),
    });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : "Failed to update assessment";
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const { userId, supabase } = await requireOwnedClass(params.id);

    const { data: assessment, error: findError } = await supabase
      .from("assessments")
      .select("id, class_id")
      .eq("id", params.assessmentId)
      .eq("class_id", params.id)
      .maybeSingle();

    if (findError || !assessment) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    let calendarSyncWarning: string | null = null;
    try {
      await deleteAssessmentGoogleEvent({
        supabase,
        userId,
        assessmentId: params.assessmentId,
      });
    } catch (err) {
      calendarSyncWarning =
        err instanceof Error ? err.message : "Google Calendar sync failed";
      console.error("[assessments DELETE] Google Calendar delete failed", {
        classId: params.id,
        assessmentId: params.assessmentId,
        userId,
        err,
      });
    }

    const { error: deleteError } = await supabase
      .from("assessments")
      .delete()
      .eq("id", params.assessmentId)
      .eq("class_id", params.id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    revalidateAssessmentPaths(params.id);

    return NextResponse.json({
      ok: true,
      ...(calendarSyncWarning ? { calendarSyncWarning } : {}),
    });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : "Failed to delete assessment";
    return NextResponse.json({ error: message }, { status });
  }
}
