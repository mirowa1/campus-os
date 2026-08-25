import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { deleteClassGoogleEvents } from "@/lib/google-calendar";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function DELETE(
  _request: Request,
  context: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const classId = context.params.id;

    const { data: classRow, error: classError } = await supabase
      .from("classes")
      .select("id, user_id, syllabus_path")
      .eq("id", classId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (classError || !classRow) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    const { data: materials } = await supabase
      .from("course_materials")
      .select("storage_path")
      .eq("class_id", classId);

    // Delete Google Calendar events before DB cascade removes event_map rows
    const gcal = await deleteClassGoogleEvents({
      supabase,
      userId: user.id,
      classId,
    });

    const { error: deleteError } = await supabase
      .from("classes")
      .delete()
      .eq("id", classId)
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("classes DELETE:", deleteError);
      return NextResponse.json(
        { error: deleteError.message || "Failed to delete class" },
        { status: 500 }
      );
    }

    // Best-effort storage cleanup (do not fail the request)
    const materialPaths = (materials ?? [])
      .map((m) => m.storage_path as string | null)
      .filter((p): p is string => !!p);
    if (materialPaths.length > 0) {
      const { error } = await supabase.storage
        .from("materials")
        .remove(materialPaths);
      if (error) {
        console.warn("class delete materials storage:", error.message);
      }
    }
    if (classRow.syllabus_path) {
      const { error } = await supabase.storage
        .from("syllabi")
        .remove([classRow.syllabus_path as string]);
      if (error) {
        console.warn("class delete syllabus storage:", error.message);
      }
    }

    revalidatePath("/dashboard");
    revalidatePath("/classes");
    revalidatePath("/calendar");
    revalidatePath("/grades");

    return NextResponse.json({
      ok: true,
      googleEventsDeleted: gcal.deleted,
      googleEventsSkipped: gcal.skipped,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to delete class";
    console.error("classes DELETE:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
