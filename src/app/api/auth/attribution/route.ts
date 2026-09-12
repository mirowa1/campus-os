import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  UTM_COOKIE_NAME,
  parseUtmCookieValue,
  persistSignupUtm,
} from "@/lib/utm";

export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const raw = cookies().get(UTM_COOKIE_NAME)?.value;
  const utm = parseUtmCookieValue(raw);
  const { wrote } = await persistSignupUtm(supabase, user.id, utm);
  return NextResponse.json({ ok: true, wrote });
}
