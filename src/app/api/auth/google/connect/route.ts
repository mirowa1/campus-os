import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import {
  assertGoogleCalendarConfigured,
  getGoogleAuthUrl,
} from "@/lib/google-calendar";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    assertGoogleCalendarConfigured();
  } catch {
    return NextResponse.json(
      { error: "Google Calendar sync is not configured" },
      { status: 503 }
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(
      new URL("/login", process.env.NEXT_PUBLIC_SITE_URL || "https://www.coremaxsystems.com")
    );
  }

  const state = `${user.id}.${randomBytes(16).toString("hex")}`;
  const res = NextResponse.redirect(getGoogleAuthUrl(state));
  res.cookies.set("gcal_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
