"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function GoogleCalendarSettingsInner({
  connected,
}: {
  connected: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams.get("google");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function disconnect() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/google/disconnect", { method: "POST" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Disconnect failed");
        return;
      }
      router.refresh();
    } catch {
      setError("Disconnect failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface rounded-2xl p-6">
      <h2 className="font-heading text-2xl">Google Calendar</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Currently in limited testing — available to select users only.
      </p>

      {status === "connected" && (
        <p className="mt-4 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-2 text-sm text-[var(--accent)]">
          Google Calendar connected.
        </p>
      )}
      {status === "error" && (
        <p className="mt-4 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
          Could not connect Google Calendar. Try again, or confirm Google
          Calendar sync is configured on the server.
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        {connected ? (
          <>
            <span className="rounded-lg bg-[var(--bg-soft)] px-3 py-2 text-sm">
              Connected
            </span>
            <button
              type="button"
              className="btn btn-ghost text-sm"
              disabled={busy}
              onClick={() => void disconnect()}
            >
              {busy ? "Disconnecting…" : "Disconnect"}
            </button>
          </>
        ) : (
          <a href="/api/auth/google/connect" className="btn btn-primary text-sm">
            Connect Google Calendar
          </a>
        )}
      </div>
      {error && (
        <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>
      )}
      <p className="mt-4 text-xs text-[var(--muted)]">
        After connecting, open a class and use &quot;Sync to Google
        Calendar&quot; to push that class&apos;s deadlines and meeting times.
      </p>
    </section>
  );
}

export function GoogleCalendarSettings({ connected }: { connected: boolean }) {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading…</p>}>
      <GoogleCalendarSettingsInner connected={connected} />
    </Suspense>
  );
}
