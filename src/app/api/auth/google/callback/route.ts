import { NextRequest, NextResponse } from "next/server";
import {
  assertGoogleCalendarConfigured,
  encryptToken,
  exchangeCodeForTokens,
} from "@/lib/google-calendar";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const SITE = "https://www.coremaxsystems.com";

export async function GET(request: NextRequest) {
  const settingsOk = `${SITE}/settings?google=connected`;
  const settingsFail = `${SITE}/settings?google=error`;

  try {
    assertGoogleCalendarConfigured();
  } catch {
    return NextResponse.redirect(
      `${SITE}/settings?google=error&reason=not_configured`
    );
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const cookieState = request.cookies.get("gcal_oauth_state")?.value;

  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(`${settingsFail}&reason=state`);
  }

  const userId = state.split(".")[0];
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== userId) {
    return NextResponse.redirect(`${SITE}/login`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const { error } = await supabase.from("google_calendar_connections").upsert(
      {
        user_id: user.id,
        access_token: encryptToken(tokens.accessToken),
        refresh_token: encryptToken(tokens.refreshToken),
        token_expires_at: tokens.expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    if (error) throw error;
  } catch (err) {
    console.error("google callback:", err);
    return NextResponse.redirect(`${settingsFail}&reason=token`);
  }

  const res = NextResponse.redirect(settingsOk);
  res.cookies.set("gcal_oauth_state", "", { path: "/", maxAge: 0 });
  return res;
}
