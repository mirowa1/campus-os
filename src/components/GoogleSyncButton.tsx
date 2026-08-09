"use client";

import Link from "next/link";
import { useState } from "react";

export function GoogleSyncButton({
  classId,
  connected,
}: {
  classId: string;
  connected: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sync() {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/classes/${classId}/google-sync`, {
        method: "POST",
      });
      const data = (await res.json()) as {
        error?: string;
        created?: number;
        updated?: number;
      };
      if (!res.ok) {
        setError(data.error || "Sync failed");
        return;
      }
      setMessage(
        `Synced to Google Calendar (created ${data.created ?? 0}, updated ${data.updated ?? 0}).`
      );
    } catch {
      setError("Sync failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!connected) {
    return (
      <div className="surface rounded-2xl p-5">
        <h2 className="font-heading text-lg">Google Calendar</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Connect Google Calendar in Settings to sync this class&apos;s
          deadlines and meeting times.
        </p>
        <Link href="/settings" className="btn btn-ghost mt-4 text-sm">
          Open Settings
        </Link>
      </div>
    );
  }

  return (
    <div className="surface rounded-2xl p-5">
      <h2 className="font-heading text-lg">Google Calendar</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Push this class&apos;s assessments and recurring meeting times to your
        Google Calendar.
      </p>
      <button
        type="button"
        className="btn btn-primary mt-4 text-sm"
        disabled={loading}
        onClick={() => void sync()}
      >
        {loading
          ? "Syncing…"
          : message
            ? "Re-sync to Google Calendar"
            : "Sync to Google Calendar"}
      </button>
      {message && (
        <p className="mt-3 text-sm text-[var(--accent)]">{message}</p>
      )}
      {error && (
        <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>
      )}
    </div>
  );
}
