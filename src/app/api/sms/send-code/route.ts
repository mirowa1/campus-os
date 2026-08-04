import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  normalizePhoneE164,
  sendTwilioVerifyCode,
  twilioConfig,
} from "@/lib/sms";

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

    if (!twilioConfig()) {
      return NextResponse.json(
        {
          error:
            "SMS verification is not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_VERIFY_SERVICE_SID.",
        },
        { status: 503 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      phone?: unknown;
    };
    const phone = normalizePhoneE164(
      typeof body.phone === "string" ? body.phone : ""
    );
    if (!phone) {
      return NextResponse.json(
        { error: "Enter a valid US phone number (10 digits)." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const { error: upsertError } = await supabase
      .from("notification_preferences")
      .upsert(
        {
          user_id: user.id,
          phone_number: phone,
          phone_verified: false,
          sms_enabled: false,
          updated_at: now,
        },
        { onConflict: "user_id" }
      );

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    const result = await sendTwilioVerifyCode(phone);
    if (!result.ok) {
      const msg =
        typeof result.data.message === "string"
          ? result.data.message
          : "Failed to send verification code.";
      console.error("twilio send-code:", result.status, result.data);
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    return NextResponse.json({ ok: true, phone });
  } catch (err) {
    console.error("sms/send-code:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Send failed" },
      { status: 500 }
    );
  }
}
