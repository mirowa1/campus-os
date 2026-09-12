import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest, NextResponse } from "next/server";

export const UTM_COOKIE_NAME = "coursework_utm";
export const UTM_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days
const UTM_MAX_LEN = 100;

export type SignupUtm = {
  source: string | null;
  medium: string | null;
  campaign: string | null;
};

function sanitizeUtmValue(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const cleaned = raw
    .trim()
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .slice(0, UTM_MAX_LEN);
  return cleaned.length > 0 ? cleaned : null;
}

export function parseUtmSearchParams(
  searchParams: URLSearchParams
): SignupUtm | null {
  const source = sanitizeUtmValue(searchParams.get("utm_source"));
  const medium = sanitizeUtmValue(searchParams.get("utm_medium"));
  const campaign = sanitizeUtmValue(searchParams.get("utm_campaign"));
  if (!source && !medium && !campaign) return null;
  return { source, medium, campaign };
}

/** Raw JSON — Next/cookie libraries handle encoding; do not encodeURIComponent twice. */
export function serializeUtmCookie(utm: SignupUtm): string {
  return JSON.stringify({
    source: utm.source,
    medium: utm.medium,
    campaign: utm.campaign,
  });
}

export function parseUtmCookieValue(
  raw: string | undefined | null
): SignupUtm | null {
  if (!raw) return null;
  try {
    let text = raw;
    // Tolerate legacy double-encoded values from an earlier encodeURIComponent pass.
    for (let i = 0; i < 2; i++) {
      if (!text.includes("%")) break;
      try {
        const decoded = decodeURIComponent(text);
        if (decoded === text) break;
        text = decoded;
      } catch {
        break;
      }
    }
    const parsed = JSON.parse(text) as Partial<SignupUtm>;
    const source = sanitizeUtmValue(parsed.source ?? null);
    const medium = sanitizeUtmValue(parsed.medium ?? null);
    const campaign = sanitizeUtmValue(parsed.campaign ?? null);
    if (!source && !medium && !campaign) return null;
    return { source, medium, campaign };
  } catch {
    return null;
  }
}

export function utmCookieOptions(isProd: boolean) {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/",
    maxAge: UTM_COOKIE_MAX_AGE_SEC,
  };
}

/** Attach first-touch UTM cookie when query has utm_* and cookie is absent. */
export function applyFirstTouchUtmCookie(
  request: NextRequest,
  response: NextResponse
): void {
  if (request.cookies.get(UTM_COOKIE_NAME)?.value) return;
  const utm = parseUtmSearchParams(request.nextUrl.searchParams);
  if (!utm) return;
  const isProd = process.env.NODE_ENV === "production";
  response.cookies.set(
    UTM_COOKIE_NAME,
    serializeUtmCookie(utm),
    utmCookieOptions(isProd)
  );
}

/**
 * Write UTM onto profiles only when signup_utm_source is still null (first-touch).
 * Never overwrites an existing attribution (returning logins).
 */
export async function persistSignupUtm(
  supabase: SupabaseClient,
  userId: string,
  utm: SignupUtm | null
): Promise<{ wrote: boolean }> {
  if (!utm || (!utm.source && !utm.medium && !utm.campaign)) {
    return { wrote: false };
  }
  const { data, error } = await supabase
    .from("profiles")
    .update({
      signup_utm_source: utm.source,
      signup_utm_medium: utm.medium,
      signup_utm_campaign: utm.campaign,
    })
    .eq("id", userId)
    .is("signup_utm_source", null)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[utm] persistSignupUtm failed:", error.message);
    return { wrote: false };
  }
  return { wrote: !!data };
}
