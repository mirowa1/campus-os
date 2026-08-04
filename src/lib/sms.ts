/** Normalize US phone numbers to E.164 (+1…). Returns null if invalid. */
export function normalizePhoneE164(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (input.trim().startsWith("+") && digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }
  return null;
}

export function twilioConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!accountSid || !authToken || !verifyServiceSid) {
    return null;
  }
  return { accountSid, authToken, verifyServiceSid };
}

async function twilioFetch(
  path: string,
  body: Record<string, string>
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const cfg = twilioConfig();
  if (!cfg) {
    throw new Error("Twilio Verify is not configured");
  }
  const auth = Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString(
    "base64"
  );
  const res = await fetch(`https://verify.twilio.com/v2${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, data };
}

export async function sendTwilioVerifyCode(phoneE164: string) {
  const cfg = twilioConfig();
  if (!cfg) throw new Error("Twilio Verify is not configured");
  return twilioFetch(`/Services/${cfg.verifyServiceSid}/Verifications`, {
    To: phoneE164,
    Channel: "sms",
  });
}

export async function checkTwilioVerifyCode(phoneE164: string, code: string) {
  const cfg = twilioConfig();
  if (!cfg) throw new Error("Twilio Verify is not configured");
  return twilioFetch(`/Services/${cfg.verifyServiceSid}/VerificationCheck`, {
    To: phoneE164,
    Code: code.trim(),
  });
}
