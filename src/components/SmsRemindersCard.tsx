"use client";

import { useState } from "react";

export type NotificationPrefs = {
  sms_enabled: boolean;
  phone_number: string | null;
  phone_verified: boolean;
};

const CONSENT_LABEL =
  "I agree to receive automated SMS/text messages from CoreMax about upcoming assignment due dates. Message frequency varies based on your course load, typically up to a few times per week. Msg & data rates may apply. Reply STOP to cancel, HELP for help.";

type Props = {
  initial: NotificationPrefs | null;
};

export function SmsRemindersCard({ initial }: Props) {
  const [phone, setPhone] = useState(initial?.phone_number ?? "");
  const [code, setCode] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(
    initial?.phone_verified ?? false
  );
  const [smsEnabled, setSmsEnabled] = useState(initial?.sms_enabled ?? false);
  const [storedPhone, setStoredPhone] = useState(initial?.phone_number ?? null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function sendCode() {
    setSending(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/sms/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        phone?: string;
      };
      if (!res.ok) {
        setError(data.error || "Failed to send code.");
        setSending(false);
        return;
      }
      if (data.phone) {
        setPhone(data.phone);
        setStoredPhone(data.phone);
      }
      setPhoneVerified(false);
      setSmsEnabled(false);
      setCodeSent(true);
      setStatus("Verification code sent. Check your texts.");
    } catch {
      setError("Failed to send code.");
    }
    setSending(false);
  }

  async function verifyCode() {
    setVerifying(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/sms/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        phone?: string;
        phone_verified?: boolean;
        sms_enabled?: boolean;
      };
      if (!res.ok) {
        setError(data.error || "Verification failed.");
        setVerifying(false);
        return;
      }
      setPhoneVerified(true);
      setSmsEnabled(false);
      if (data.phone) {
        setPhone(data.phone);
        setStoredPhone(data.phone);
      }
      setCode("");
      setCodeSent(false);
      setStatus("Phone verified. Opt in below if you want reminders.");
    } catch {
      setError("Verification failed.");
    }
    setVerifying(false);
  }

  async function onConsentChange(checked: boolean) {
    setToggling(true);
    setError(null);
    setStatus(null);
    const previous = smsEnabled;
    setSmsEnabled(checked);
    try {
      const res = await fetch("/api/sms/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: checked }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setSmsEnabled(previous);
        setError(data.error || "Could not update SMS preference.");
        setToggling(false);
        return;
      }
      setStatus(
        checked
          ? "Text reminders enabled."
          : "Text reminders disabled."
      );
    } catch {
      setSmsEnabled(previous);
      setError("Could not update SMS preference.");
    }
    setToggling(false);
  }

  const phoneDirty =
    phone.replace(/\D/g, "") !== (storedPhone ?? "").replace(/\D/g, "");

  return (
    <section className="surface space-y-4 rounded-2xl p-6">
      <div>
        <h2 className="font-heading text-xl">Text Message Reminders</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Optional. Verify your number, then opt in to SMS due-date reminders.
          You can use CoreMax fully without enabling this.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="sms-phone">
          Mobile phone number
        </label>
        <input
          id="sms-phone"
          className="input"
          type="tel"
          autoComplete="tel"
          placeholder="(404) 555-0100"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            if (phoneVerified) {
              setPhoneVerified(false);
              setSmsEnabled(false);
            }
          }}
        />
        <p className="mt-1.5 text-xs text-[var(--muted)]">
          US numbers preferred. We&apos;ll text a 6-digit verification code.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-ghost text-xs"
          onClick={() => void sendCode()}
          disabled={sending || !phone.trim()}
        >
          {sending ? "Sending…" : "Send verification code"}
        </button>
        {phoneVerified && !phoneDirty && (
          <span className="self-center text-xs text-[var(--accent-cyan)]">
            Verified{storedPhone ? ` · ${storedPhone}` : ""}
          </span>
        )}
      </div>

      {(codeSent || (phoneVerified === false && !!storedPhone)) &&
        !phoneVerified && (
          <div>
            <label className="label" htmlFor="sms-code">
              Verification code
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                id="sms-code"
                className="input max-w-[10rem]"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-primary text-xs"
                onClick={() => void verifyCode()}
                disabled={verifying || !code.trim()}
              >
                {verifying ? "Verifying…" : "Verify"}
              </button>
            </div>
          </div>
        )}

      {phoneVerified && !phoneDirty && (
        <label className="flex cursor-pointer gap-3 rounded-xl border border-[var(--line)] bg-[var(--bg-soft)] p-4">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 shrink-0"
            checked={smsEnabled}
            disabled={toggling}
            onChange={(e) => void onConsentChange(e.target.checked)}
          />
          <span className="text-sm leading-relaxed text-[var(--ink)]">
            {CONSENT_LABEL}
          </span>
        </label>
      )}

      <p className="text-xs text-[var(--muted)]">
        Reminder delivery is rolling out soon — verification works today, and
        you&apos;ll start receiving due-date texts once it&apos;s fully live.
      </p>

      {error && (
        <p className="rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}
      {status && !error && (
        <p className="text-sm text-[var(--accent-cyan)]">{status}</p>
      )}
    </section>
  );
}
