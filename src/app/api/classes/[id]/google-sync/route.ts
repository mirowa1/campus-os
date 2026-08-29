import { NextResponse } from "next/server";
import {
  PaywallError,
  assertCanUseCalendarSync,
  markFreeCalendarSyncUsed,
} from "@/lib/billing";
import { syncClassToGoogleCalendar } from "@/lib/google-calendar";
import { createClient } from "@/lib/supabase/server";
import type {
  AssessmentRow,
  ClassMeetingRow,
  ClassRow,
} from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
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

    let billing;
    try {
      billing = await assertCanUseCalendarSync(supabase, user.id, user.email);
    } catch (err) {
      if (err instanceof PaywallError) {
        return NextResponse.json(
          { error: "PAYWALL_REQUIRED", feature: err.feature },
          { status: 402 }
        );
      }
      throw err;
    }

    const classId = context.params.id;
    const { data: classRow, error: classError } = await supabase
      .from("classes")
      .select("*")
      .eq("id", classId)
      .eq("user_id", user.id)
      .single();

    if (classError || !classRow) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    const { data: connection } = await supabase
      .from("google_calendar_connections")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!connection) {
      return NextResponse.json(
        {
          error:
            "Google Calendar is not connected. Connect it in Settings first.",
        },
        { status: 400 }
      );
    }

    const [{ data: assessments }, { data: meetings }] = await Promise.all([
      supabase.from("assessments").select("*").eq("class_id", classId),
      supabase.from("class_meetings").select("*").eq("class_id", classId),
    ]);

    const result = await syncClassToGoogleCalendar({
      supabase,
      userId: user.id,
      classRow: classRow as ClassRow,
      assessments: (assessments ?? []) as AssessmentRow[],
      meetings: (meetings ?? []) as ClassMeetingRow[],
    });

    await markFreeCalendarSyncUsed(supabase, billing);

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Google Calendar sync failed";
    console.error("google-sync:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
