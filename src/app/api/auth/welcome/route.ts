import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

type RateBucket = { count: number; resetAt: number };

/** Process-local only — resets on cold start; fine for lightweight abuse damping. */
const rateByIp = new Map<string, RateBucket>();

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const bucket = rateByIp.get(ip);
  if (!bucket || now >= bucket.resetAt) {
    rateByIp.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  if (bucket.count >= RATE_LIMIT_MAX) {
    return true;
  }
  bucket.count += 1;
  return false;
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  if (isRateLimited(ip)) {
    console.error("[welcome-email] rate limited:", ip);
    return NextResponse.json({ ok: true }, { status: 429 });
  }

  let email = "";
  try {
    const body = (await request.json()) as { email?: string };
    email = typeof body.email === "string" ? body.email.trim() : "";
  } catch {
    return NextResponse.json({ ok: true });
  }

  if (!email) {
    return NextResponse.json({ ok: true });
  }

  const result = await sendEmail({
    to: email,
    subject: "Welcome to Coursework by CoreMax",
    html: `<p>Welcome to Coursework by CoreMax.</p>
<p>You're all set — upload a syllabus to pull in your assignments, then sync your calendar so due dates show up where you already work.</p>
<p>— The CoreMax team</p>`,
    text: `Welcome to Coursework by CoreMax.

You're all set — upload a syllabus to pull in your assignments, then sync your calendar so due dates show up where you already work.

— The CoreMax team`,
  });

  if (!result.success) {
    console.error("[welcome-email]", result.error);
  }

  return NextResponse.json({ ok: true });
}
