import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  UTM_COOKIE_NAME,
  parseUtmCookieValue,
  persistSignupUtm,
} from "@/lib/utm";

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/dashboard";
  }
  return raw;
}

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return undefined;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const createdAt = Date.parse(data.user.created_at);
  const isNewUser =
    Number.isFinite(createdAt) && Date.now() - createdAt < 60_000;
  if (isNewUser && data.user.email) {
    void fetch(`${origin}/api/auth/welcome`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: data.user.email }),
    }).catch((err) => {
      console.error("[welcome-email] oauth request failed:", err);
    });

    const utm = parseUtmCookieValue(readCookie(request, UTM_COOKIE_NAME));
    await persistSignupUtm(supabase, data.user.id, utm);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
