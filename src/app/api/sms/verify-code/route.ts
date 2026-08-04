import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  checkTwilioVerifyCode,
  normalizePhoneE164,
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
      code?: unknown;
    };
    const phone = normalizePhoneE164(
      typeof body.phone === "string" ? body.phone : ""
    );
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!phone) {
      return NextResponse.json(
        { error: "Enter a valid phone number." },
        { status: 400 }
      );
    }
    if (!/^\d{4,10}$/.test(code)) {
      return NextResponse.json(
        { error: "Enter the verification code from your text." },
        { status: 400 }
      );
    }

    const result = await checkTwilioVerifyCode(phone, code);
    const status =
      typeof result.data.status === "string" ? result.data.status : "";
    if (!result.ok || status !== "approved") {
      const msg =
        status === "pending"
          ? "Incorrect code. Try again."
          : typeof result.data.message === "string"
            ? result.data.message
            : "Verification failed.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { error: upsertError } = await supabase
      .from("notification_preferences")
      .upsert(
        {
          user_id: user.id,
          phone_number: phone,
          phone_verified: true,
          // Consent must be an explicit checkbox action — never enable here.
          sms_enabled: false,
          updated_at: now,
        },
        { onConflict: "user_id" }
      );

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      phone,
      phone_verified: true,
      sms_enabled: false,
    });
  } catch (err) {
    console.error("sms/verify-code:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Verify failed" },
      { status: 500 }
    );
  }
}
