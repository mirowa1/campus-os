import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      enabled?: unknown;
    };
    const enabled = body.enabled === true;

    const { data: prefs, error: readError } = await supabase
      .from("notification_preferences")
      .select("phone_verified, phone_number")
      .eq("user_id", user.id)
      .maybeSingle();

    if (readError) {
      return NextResponse.json({ error: readError.message }, { status: 500 });
    }

    if (enabled) {
      if (!prefs?.phone_verified || !prefs.phone_number) {
        return NextResponse.json(
          {
            error:
              "Verify your phone number before enabling text reminders.",
          },
          { status: 400 }
        );
      }
    }

    const now = new Date().toISOString();
    const { error: upsertError } = await supabase
      .from("notification_preferences")
      .upsert(
        {
          user_id: user.id,
          sms_enabled: enabled,
          phone_number: prefs?.phone_number ?? null,
          phone_verified: prefs?.phone_verified ?? false,
          updated_at: now,
        },
        { onConflict: "user_id" }
      );

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, sms_enabled: enabled });
  } catch (err) {
    console.error("sms/consent:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 500 }
    );
  }
}
